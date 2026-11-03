"""Make the narration track for a short from script.json, for free.

  python narrate.py <project>                    speak script.json -> voice/narration.wav
  python narrate.py <project> --audio take.m4a   use the user's own recording instead
  python narrate.py --voices                     a few voices that work well

Engines, picked by the "voice" field in script.json:
  "en-US-AndrewNeural" (any edge-tts name)   needs `pip install edge-tts` and internet; an unofficial client, so it can break
  "kokoro:am_michael"                        offline; needs `pip install kokoro-onnx` and the two model files from the
                                             kokoro-onnx releases page in ~/.cache/stickman-explainer/kokoro/
  "pocket:alba" or "pocket:voices/me.wav"    offline on CPU (Kyutai Pocket TTS): a catalog voice, or copy the voice in a
                                             10 s clip; runs in its own environment, see references/voices.md
  "nano:voices/me.wav"                       offline on CPU (Chatterbox Nano): copies the voice in a 10 s clip; also in
                                             its own environment, see references/voices.md

Lines are joined into sentences (a line that ends in . ? or ! closes one) and each sentence is spoken in one go, so a
sentence split over several lines (several cuts) still sounds natural. Run time_words.py afterwards for the timings.
"""
import argparse, asyncio, json, re, subprocess, sys, tempfile, time, wave
from pathlib import Path
import numpy as np

SR = 24000
CACHE = Path.home() / '.cache' / 'stickman-explainer'
KOKORO_DIR = CACHE / 'kokoro'
LOCAL = {'pocket': 'pocket-env', 'nano': 'nano-env'}   # engines that run in their own venv under CACHE, through tts_local.py
VOICES = {
    'en-US-AndrewNeural': 'edge-tts, US male, warm and steady',
    'en-US-BrianNeural': 'edge-tts, US male, casual',
    'en-US-AvaNeural': 'edge-tts, US female, bright',
    'en-GB-RyanNeural': 'edge-tts, UK male, documentary',
    'kokoro:am_michael': 'kokoro, US male, explainer',
    'kokoro:af_heart': 'kokoro, US female, warm',
    'kokoro:bm_george': 'kokoro, UK male, documentary',
    'pocket:alba': 'pocket, catalog voice (others: michael, george, jean, marius, ...)',
    'pocket:voices/me.wav': 'pocket, your own voice from a 10 s clip',
    'nano:voices/me.wav': 'chatterbox nano, your own voice from a 10 s clip',
}


def decode(path, tempo=1.0):
    """any audio file -> mono float32 at SR, through ffmpeg (tempo speeds it up without changing the pitch)"""
    speed = ['-af', f'atempo={tempo:.3f}'] if abs(tempo - 1) > 1e-3 else []
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), *speed, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def write_wav(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def trim(x, floor=0.01):
    """drop silence before and after the speech, keeping a few ms so consonants are not clipped"""
    loud = np.flatnonzero(np.abs(x) > floor * max(1e-9, np.abs(x).max()) * 4)
    if not len(loud): return x
    return x[max(0, loud[0] - int(0.015 * SR)): loud[-1] + int(0.04 * SR)]


def sentences(lines):
    """group line indices into spoken sentences"""
    out, cur = [], []
    for i, ln in enumerate(lines):
        cur.append(i)
        if re.search(r'[.?!]["\')]*\s*$', ln['say'].strip()) or i == len(lines) - 1: out.append(cur); cur = []
    return out


def env_python(engine):
    env = CACHE / LOCAL[engine]
    py = next((p for p in (env / 'Scripts' / 'python.exe', env / 'bin' / 'python') if p.exists()), None)
    if not py: sys.exit(f'{engine} voice chosen but {env} does not exist: set it up as references/voices.md says')
    return py


def speak_local(engine, voice, rate, texts, project):
    """run every sentence through tts_local.py in the engine's own environment, loading the model once"""
    if voice.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')):
        ref = (project / voice).resolve()
        if not ref.exists(): sys.exit(f'voice clip {ref} not found: record 10 s of clean speech there')
        voice = str(ref)
    elif engine == 'nano':
        sys.exit('nano needs a voice clip, for example "nano:voices/me.wav"')
    tempo = 1 + int(re.sub(r'[^-\d]', '', rate) or 0) / 100
    with tempfile.TemporaryDirectory() as d:
        job = Path(d) / 'sentences.json'; job.write_text(json.dumps(texts), encoding='utf-8')
        worker = Path(__file__).with_name('tts_local.py')
        if subprocess.run([str(env_python(engine)), '-I', str(worker), engine, voice, str(job), d]).returncode:
            sys.exit(f'{engine} failed, see the message above')
        return [decode(Path(d) / f'{i:03d}.wav', tempo) for i in range(len(texts))]


def speaker(voice, rate):
    if voice.startswith('kokoro:'):
        try:
            from kokoro_onnx import Kokoro
        except ImportError:
            sys.exit('kokoro voice chosen but kokoro-onnx is not installed: pip install kokoro-onnx')
        model, voices = KOKORO_DIR / 'kokoro-v1.0.onnx', KOKORO_DIR / 'voices-v1.0.bin'
        if not model.exists() or not voices.exists():
            sys.exit(f'kokoro model files missing: put kokoro-v1.0.onnx and voices-v1.0.bin in {KOKORO_DIR}')
        k, name = Kokoro(str(model), str(voices)), voice.split(':', 1)[1]
        speed = 1 + int(re.sub(r'[^-\d]', '', rate) or 0) / 100
        lang = 'en-gb' if name.startswith('b') else 'en-us'

        def say(text):
            audio, sr = k.create(text, voice=name, speed=speed, lang=lang)
            x = np.asarray(audio, dtype=np.float64)
            return x if sr == SR else np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x)
        return say
    try:
        import edge_tts
    except ImportError:
        sys.exit('edge-tts is not installed: pip install edge-tts (or pick a kokoro: voice)')

    def say(text):
        for attempt in range(4):   # the service drops requests now and then, so try again before giving up
            try:
                with tempfile.TemporaryDirectory() as d:
                    mp3 = Path(d) / 's.mp3'
                    asyncio.run(edge_tts.Communicate(text, voice, rate=rate).save(str(mp3)))
                    return decode(mp3)
            except Exception as e:
                if attempt == 3: sys.exit(f'edge-tts failed: {e}. Try again later, or use a kokoro: voice or --audio')
                time.sleep(2 + attempt * 3)
    return say


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project', nargs='?'); ap.add_argument('--audio'); ap.add_argument('--voices', action='store_true')
    a = ap.parse_args()
    if a.voices:
        for k, v in VOICES.items(): print(f'{k:22s} {v}')
        return
    if not a.project: ap.error('give the project folder')
    P = Path(a.project); S = json.loads((P / 'script.json').read_text(encoding='utf-8'))
    out = P / 'voice' / 'narration.wav'

    if a.audio:   # the user's own take: keep it as recorded, only convert it
        write_wav(out, decode(a.audio))
        (P / 'voice' / 'sentences.json').unlink(missing_ok=True)
        print(f'{out}: own recording, {len(decode(a.audio)) / SR:.2f} s'); return

    voice, rate = S.get('voice', 'en-US-AndrewNeural'), S.get('rate', '+0%')
    groups = sentences(S['lines'])
    texts = [' '.join(S['lines'][i]['say'].strip() for i in group) for group in groups]
    engine = voice.split(':', 1)[0]
    if engine in LOCAL:
        spoken = speak_local(engine, voice.split(':', 1)[1], rate, texts, P)
    else:
        say = speaker(voice, rate); spoken = (say(text) for text in texts)
    lead, tail, pause = float(S.get('lead', 0.4)), float(S.get('tail', 1.0)), float(S.get('pause', 0.3))
    parts, marks, t = [np.zeros(int(lead * SR))], [], lead
    for group, text, x in zip(groups, texts, spoken):
        x = trim(x); parts.append(x)
        marks.append({'lines': group, 'start': round(t, 3), 'end': round(t + len(x) / SR, 3)})
        gap = float(S['lines'][group[-1]].get('pause', pause)); t += len(x) / SR + gap
        parts.append(np.zeros(int(gap * SR)))
        print(f'  {marks[-1]["start"]:6.2f}  {text}')
    parts[-1] = np.zeros(int(tail * SR))
    x = np.concatenate(parts); x *= 0.89 / max(1e-9, np.abs(x).max())
    write_wav(out, x)
    (P / 'voice' / 'sentences.json').write_text(json.dumps(marks, indent=1), encoding='utf-8')
    print(f'{out}: {len(x) / SR:.2f} s, {len(marks)} sentences')


if __name__ == '__main__':
    main()
