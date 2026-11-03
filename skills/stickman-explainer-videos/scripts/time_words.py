"""Find when every scripted word is spoken, and write timing.json for the scene and the sound mix.

  python time_words.py <project>              listen to voice/narration.wav with local Whisper (faster-whisper)
  python time_words.py <project> --estimate   no audio yet: guess from word lengths (for captions-only or a draft cut)
  options: --model small.en (default, best) | base.en (faster) | tiny.en

timing.json = { duration, lines: [{ i, say, start, end }], words: [{ w, line, s, e }] }
Words keep the script's spelling. A word Whisper heard differently ("7" for "seven") or missed gets a time shared out
between its matched neighbours. Without Whisper, words are spread through each sentence that narrate.py measured.
Also writes timing.txt, one word per row, to read through.
"""
import argparse, json, re, wave
from difflib import SequenceMatcher
from pathlib import Path

key = lambda w: re.sub(r'[^a-z0-9]', '', w.lower())


def script_words(S):
    return [(w, i) for i, ln in enumerate(S['lines']) for w in ln['say'].split() if key(w)]


def weight(w):   # rough speaking length of a word, plus room for the pause its punctuation brings
    return len(key(w)) + 2 + (2 if w.endswith((',', ';', ':')) else 4 if re.search(r'[.?!]["\')]*$', w) else 0)


def spread(words, t0, t1):
    """place words one after another inside [t0, t1] by weight"""
    total, t, out = sum(weight(w) for w in words) or 1, t0, []
    for w in words:
        d = (t1 - t0) * weight(w) / total
        out.append((t, t + d * (len(key(w)) + 2) / weight(w))); t += d
    return out


def align(sw, heard, t0, t1):
    """sw: script words, heard: [(word, s, e)] -> one (s, e) per script word"""
    ops = SequenceMatcher(None, [key(w) for w in sw], [key(h[0]) for h in heard], autojunk=False).get_opcodes()
    out = []
    for n, (tag, a0, a1, b0, b1) in enumerate(ops):
        if tag == 'equal':
            out += [h[1:] for h in heard[b0:b1]]
        elif a1 > a0:   # script words heard differently or not at all: share out the time Whisper spent here
            start = heard[b0][1] if b1 > b0 else (out[-1][1] if out else t0)
            later = next((heard[o[3]][1] for o in ops[n + 1:] if o[0] == 'equal'), t1)
            stop = heard[b1 - 1][2] if b1 > b0 else later
            out += spread(sw[a0:a1], start, max(stop, start + 0.06 * (a1 - a0)))
    return out


def audio_length(p):
    with wave.open(str(p)) as w: return w.getnframes() / w.getframerate()


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--estimate', action='store_true')
    ap.add_argument('--model', default='small.en'); ap.add_argument('--wps', type=float, default=3.2)
    a = ap.parse_args()
    P = Path(a.project); S = json.loads((P / 'script.json').read_text(encoding='utf-8'))
    sw = script_words(S); texts = [w for w, _ in sw]; how = ''

    if a.estimate:
        t, times, pause = float(S.get('lead', 0.4)), [], float(S.get('pause', 0.3))
        for i, ln in enumerate(S['lines']):
            ws = [w for w in ln['say'].split() if key(w)]
            d = len(ws) / a.wps   # speaking time; the spread inside it leaves room for commas
            times += spread(ws, t, t + d); t += d
            if re.search(r'[.?!]["\')]*$', ln['say'].strip()): t += float(ln.get('pause', pause))
        duration, how = t + float(S.get('tail', 1.0)), 'estimated from word lengths'
    else:
        wav = P / 'voice' / 'narration.wav'; duration = audio_length(wav)
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel(a.model, device='cpu', compute_type='int8')
            segs, _ = model.transcribe(str(wav), word_timestamps=True, language='en',
                                       initial_prompt=' '.join(ln['say'] for ln in S['lines'])[:800])
            heard = [(w.word, w.start, w.end) for s in segs for w in s.words]
            times, how = align(texts, heard, 0, duration), f'Whisper {a.model}, {len(heard)} words heard'
        except ImportError:
            marks = P / 'voice' / 'sentences.json'
            if not marks.exists(): raise SystemExit('no Whisper and no sentences.json: pip install faster-whisper')
            times = [None] * len(sw)
            for m in json.loads(marks.read_text()):
                idx = [k for k, (_, ln) in enumerate(sw) if ln in m['lines']]
                for k, se in zip(idx, spread([sw[k][0] for k in idx], m['start'], m['end'])): times[k] = se
            how = 'spread through measured sentences (no Whisper)'

    words = [{'w': w, 'line': ln, 's': round(s, 3), 'e': round(e, 3)} for (w, ln), (s, e) in zip(sw, times)]
    lines = []
    for i, ln in enumerate(S['lines']):
        mine = [w for w in words if w['line'] == i]
        lines.append({'i': i, 'say': ln['say'], 'start': mine[0]['s'], 'end': mine[-1]['e']})
    out = {'duration': round(duration, 3), 'estimated': a.estimate, 'lines': lines, 'words': words}
    (P / 'timing.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
    rows = [f"line {w['line']:>2}  {w['s']:6.2f} -> {w['e']:6.2f}  {w['w']}" for w in words]
    (P / 'timing.txt').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print(f'timing.json: {len(lines)} lines, {len(words)} words, {duration:.2f} s ({how})')


if __name__ == '__main__':
    main()
