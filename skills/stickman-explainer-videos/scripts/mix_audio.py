"""Build the soundtrack: narration, a music bed that ducks under the voice, and small sound effects, all made here.

  python mix_audio.py <project>      script.json + timing.json + voice/narration.wav -> audio/mix.wav

script.json fields it reads:
  "music": "soft" | "tense" | "bouncy" | "none" | "path/to/your_licensed_track.mp3"
  "cut_sound": "whoosh"                 played on every new line; "none" to turn it off
  per line, "sfx": [ { "on": "power", "type": "pop" }, { "at": 0.4, "type": "thud", "dur": 1 } ]
     "on" = the first word in that line starting with those letters; "at" = seconds after the line starts
Sound types: whoosh pop thud tick ding riser stamp drone. All are generated, so there is nothing to license.
Loudness is set when the final video is muxed (see the shorts reference), so this file only keeps peaks safe.
"""
import argparse, json, re, subprocess, wave
from pathlib import Path
import numpy as np

SR = 48000
rng = np.random.default_rng(11)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def env(n, attack, release):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / max(release, 1e-4))


def lowpass(x, k):   # cheap one-pole smoothing; k near 1 = darker
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc = acc * k + v * (1 - k); y[i] = acc
    return y


def sound(kind, dur=None):
    if kind == 'whoosh':
        n = int(0.45 * SR); t = np.arange(n) / n
        x = lowpass(rng.standard_normal(n), 0.9) * np.sin(np.pi * t) ** 2
        return 0.5 * x / np.abs(x).max()
    if kind == 'pop':
        n = int(0.12 * SR); t = np.arange(n) / SR
        return 0.45 * np.sin(2 * np.pi * (520 * t - 900 * t * t)) * env(n, 0.002, 0.035)
    if kind == 'thud':
        n = int(0.5 * SR); t = np.arange(n) / SR
        return 0.8 * np.sin(2 * np.pi * (80 * t - 40 * t * t)) * env(n, 0.003, 0.12)
    if kind == 'tick':
        n = int(0.05 * SR); return 0.35 * lowpass(rng.standard_normal(n), 0.5) * env(n, 0.0005, 0.006)
    if kind == 'ding':
        n = int(1.4 * SR); t = np.arange(n) / SR
        return 0.25 * sum(a * np.sin(2 * np.pi * f * t) for f, a in ((1320, 1), (2640, 0.4), (3960, 0.15))) * env(n, 0.002, 0.35)
    if kind == 'riser':
        n = int((dur or 1.2) * SR); t = np.arange(n) / n
        return 0.3 * lowpass(rng.standard_normal(n), 0.97 - 0.5 * t) * t ** 2
    if kind == 'stamp':   # a thud with a short slap of noise on top
        body = sound('thud')[: int(0.25 * SR)]; m = int(0.08 * SR)
        body[:m] += 0.6 * lowpass(rng.standard_normal(m), 0.3) * env(m, 0.0005, 0.02)
        return body
    if kind == 'drone':
        n = int((dur or 2) * SR); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)
        return 0.25 * x * np.minimum(1, np.minimum(t, t[::-1]) / 0.4)
    raise SystemExit(f'unknown sound type: {kind}')


def music(kind, n):
    t = np.arange(n) / SR
    if kind == 'tense':   # low drone with a slow heartbeat pulse
        x = 0.5 * np.sin(2 * np.pi * 49 * t) + 0.25 * np.sin(2 * np.pi * 73.4 * t + np.sin(t * 0.3))
        beat = np.zeros(n)
        for s in np.arange(0, n / SR, 1.1):
            k = int(s * SR); m = min(n - k, int(0.3 * SR)); beat[k:k + m] += np.sin(2 * np.pi * 50 * np.arange(m) / SR) * env(m, 0.005, 0.08)
        return 0.35 * x + 0.5 * beat
    chords = [(261.6, 329.6, 392.0), (220.0, 261.6, 329.6), (174.6, 220.0, 261.6), (196.0, 246.9, 293.7)]
    bar = 2.4 if kind == 'soft' else 1.6
    x = np.zeros(n)
    for b, s in enumerate(np.arange(0, n / SR, bar)):
        k = int(s * SR); m = min(n - k, int(bar * 1.3 * SR)); tt = np.arange(m) / SR
        shape = np.minimum(1, tt / 0.25) * np.exp(-tt / (bar * 0.9))
        for f in chords[b % 4]:
            x[k:k + m] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * shape / 3
        if kind == 'bouncy':   # plucked bass on every half bar
            for h in (0, bar / 2):
                kk = k + int(h * SR); mm = min(n - kk, int(0.25 * SR))
                if mm > 0: x[kk:kk + mm] += 0.8 * np.sin(2 * np.pi * chords[b % 4][0] / 2 * np.arange(mm) / SR) * env(mm, 0.003, 0.07)
    return 0.3 * x


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); a = ap.parse_args()
    P = Path(a.project); S = json.loads((P / 'script.json').read_text(encoding='utf-8'))
    T = json.loads((P / 'timing.json').read_text(encoding='utf-8'))
    voice = load(P / 'voice' / 'narration.wav') if (P / 'voice' / 'narration.wav').exists() else np.zeros(1)
    n = max(len(voice), int(T['duration'] * SR)); voice = np.pad(voice, (0, n - len(voice)))

    fx, placed = np.zeros(n + 3 * SR), []
    def put(at, kind, gain=1.0, dur=None):
        x = sound(kind, dur) * gain; k = max(0, int(at * SR)); fx[k:k + len(x)] += x[: len(fx) - k]; placed.append((at, kind))
    cut = S.get('cut_sound', 'whoosh')
    for i, ln in enumerate(S['lines']):
        start = T['lines'][i]['start']
        if cut != 'none' and i: put(start - 0.18, cut, 0.6)
        for e in ln.get('sfx', []):
            if 'on' in e:
                hit = [w for w in T['words'] if w['line'] == i and re.sub(r'[^a-z0-9]', '', w['w'].lower()).startswith(e['on'].lower())]
                if not hit: raise SystemExit(f'line {i}: no word starting with "{e["on"]}"')
                at = hit[0]['s']
            else:
                at = start + float(e.get('at', 0))
            put(at, e['type'], float(e.get('gain', 1)), e.get('dur'))
    fx = fx[:n]

    kind = S.get('music', 'soft'); bed = np.zeros(n)
    if kind in ('soft', 'tense', 'bouncy'): bed = music(kind, n)
    elif kind != 'none':
        src = load(P / kind if not Path(kind).is_absolute() else kind); bed = np.resize(src, n) * 0.6
    if kind != 'none':   # duck the bed under the voice, with smooth attack and release
        hop = int(0.02 * SR); m = n // hop + 1
        level = np.array([np.sqrt(np.mean(voice[i * hop:(i + 1) * hop] ** 2)) if i * hop < n else 0 for i in range(m)])
        talking = lowpass((level > 0.02 * max(1e-9, level.max()) * 3).astype(float), 0.85)
        gain = np.repeat(1 - 0.72 * np.clip(talking * 1.4, 0, 1), hop)[:n]
        fade = np.minimum(1, np.minimum(np.arange(n), n - np.arange(n)) / SR)
        bed *= gain * fade * 0.35

    mix = voice + 0.55 * fx + bed
    mix *= 0.9 / max(1e-9, np.abs(mix).max())
    out = P / 'audio' / 'mix.wav'; out.parent.mkdir(exist_ok=True)
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
    print(f'{out}: {n / SR:.2f} s, music {kind}, {len(placed)} sound effects')


if __name__ == '__main__':
    main()
