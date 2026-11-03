"""Speak a list of sentences with a local CPU model. narrate.py runs this inside the model's own Python environment,
so torch never has to be installed next to the rest of the skill.

  python tts_local.py <engine> <voice> <sentences.json> <out_dir>

  engine pocket   voice = a Pocket TTS catalog name (alba, michael, george, ...) or a .wav of the voice to copy
  engine nano     voice = a .wav of the voice to copy (Chatterbox Nano always needs one)

Writes out_dir/000.wav, 001.wav, ... (one per sentence) and prints how fast it ran.
"""
import json, sys, time, wave
from pathlib import Path
import numpy as np

GATED = {
    'pocket': 'https://huggingface.co/kyutai/pocket-tts',
    'nano': 'https://huggingface.co/ResembleAI/chatterbox-nano',
}


def save(path, x, sr):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


def load(engine, voice):
    if engine == 'pocket':
        from pocket_tts import TTSModel
        m = TTSModel.load_model()
        state = m.get_state_for_audio_prompt(voice)
        return (lambda text: m.generate_audio(state, text).cpu().numpy()), m.sample_rate
    if engine == 'nano':
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        m = ChatterboxTurboTTS.from_pretrained(device='cpu', nano=True)
        m.prepare_conditionals(voice)   # read the reference clip once, not once per sentence
        return (lambda text: m.generate(text)[0].cpu().numpy()), m.sr
    sys.exit(f'unknown engine {engine}: use pocket or nano')


def main():
    engine, voice, job, out = sys.argv[1:5]
    texts, out = json.loads(Path(job).read_text(encoding='utf-8')), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    try:
        say, sr = load(engine, voice)
    except Exception as e:   # both models that copy a voice sit behind a Hugging Face terms page
        if any(k in str(e).lower() for k in ('gated', 'voice cloning', '401', '403', 'restricted', 'token')):
            sys.exit(f'{engine}: the voice-copying model is gated. Accept its terms at {GATED[engine]} while signed in, '
                     f'then run `hf auth login` once on this computer. ({type(e).__name__}: {str(e)[:200]})')
        raise
    print(f'{engine}: model ready in {time.time() - t0:.0f} s', flush=True)
    spoken = took = 0.0
    for i, text in enumerate(texts):
        t = time.time(); x = say(text); took += time.time() - t; spoken += len(x) / sr
        save(out / f'{i:03d}.wav', x, sr)
    print(f'{engine}: {spoken:.1f} s of speech in {took:.1f} s ({spoken / max(took, 1e-9):.1f}x real time)')


if __name__ == '__main__':
    main()
