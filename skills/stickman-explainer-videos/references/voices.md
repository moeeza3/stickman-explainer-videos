# Voices

`scripts/narrate.py` reads the `voice` field in `script.json` and picks the engine from its prefix. All of these are free and English. Pick one, and if the user asked for their own voice, use one of the two engines that copy a voice.

| `voice` | Runs | Copies a voice | Notes |
| --- | --- | --- | --- |
| `en-US-AndrewNeural` (any edge-tts name) | online | no | No setup beyond `pip install edge-tts`. An unofficial client, so it can stop working. |
| `kokoro:am_michael` | offline, CPU | no | Needs `kokoro-onnx` and its two model files (see `narrate.py`). |
| `pocket:alba`, `pocket:michael`, ... | offline, CPU | no | Kyutai Pocket TTS catalog voices. No sign-in needed. |
| `pocket:voices/me.wav` | offline, CPU | yes | Pocket TTS copying the voice in the clip. Gated model, see below. |
| `nano:voices/me.wav` | offline, CPU | yes | Chatterbox Nano (Resemble AI) copying the voice in the clip. Slower, and adds an inaudible watermark. |
| `narrate.py . --audio take.m4a` | | | The user's own full recording, used as is. |

Speed on a 10-core laptop CPU, tested in November 2026: Pocket made 21 seconds of speech in about 24 seconds, and Nano took about 160 seconds for the same lines (both after the first run's download, which for Nano is about 2 GB). Both read the test script without dropping words. Try Pocket first; use Nano if its copy of the voice sounds closer and the wait is acceptable. Let the user judge by ear, since you cannot hear the results.

`rate` (for example `"+6%"`) works for every engine. For Pocket and Nano it speeds the finished audio up without changing the pitch.

## Copying a voice

Only copy the user's own voice, or a voice whose owner has agreed. Never copy a celebrity, a public figure, or anyone who has not said yes, and say so if asked.

The clip decides most of the quality:

- 10 to 15 seconds of one person talking normally, in the tone the videos should have
- a quiet room, no music, no echo, the microphone a hand's width away
- save it as `voices/me.wav` in the project (any of wav, mp3, m4a, or flac works)

Then set `"voice": "pocket:voices/me.wav"` or `"voice": "nano:voices/me.wav"` and run `narrate.py` as usual. Everything after it (Whisper timing, captions, mix) is the same.

## Setup

Both models need PyTorch, and they need different versions of it, so each gets its own folder with its own environment (`env`) and its downloaded models (`models`):

```
<tools>/
  pocket-tts/       env/  models/
  chatterbox-nano/  env/  models/
```

`<tools>` is `~/.cache/stickman-explainer` unless the `STICKMAN_TTS_DIR` environment variable names another folder, such as `D:/tools`. `narrate.py` runs `scripts/tts_local.py` inside the right `env` and points the Hugging Face cache at that tool's `models`, so the first run downloads there (about 0.2 GB for Pocket, 3 GB for Nano). The commands below use `~/.cache/stickman-explainer` on Windows; replace it with your folder, and on macOS or Linux use `bin/python` in place of `Scripts/python`.

Pocket TTS:

```bash
python -m venv ~/.cache/stickman-explainer/pocket-tts/env
```

```bash
~/.cache/stickman-explainer/pocket-tts/env/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
```

```bash
~/.cache/stickman-explainer/pocket-tts/env/Scripts/python -m pip install pocket-tts
```

Chatterbox Nano (it is only in the GitHub source so far, not in the `chatterbox-tts` release on PyPI):

```bash
python -m venv ~/.cache/stickman-explainer/chatterbox-nano/env
```

```bash
~/.cache/stickman-explainer/chatterbox-nano/env/Scripts/python -m pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
```

```bash
~/.cache/stickman-explainer/chatterbox-nano/env/Scripts/python -m pip install "chatterbox-tts @ https://github.com/resemble-ai/chatterbox/archive/refs/heads/master.zip"
```

### Pocket's gated weights

Pocket's catalog voices download freely, but the weights that copy a voice sit behind a Hugging Face terms page (Nano's downloaded without a sign-in when tested; if that changes, the same steps apply to [its page](https://huggingface.co/ResembleAI/chatterbox-nano)). The user does this part themselves, once; never accept terms or type a token for them:

1. Sign in at huggingface.co and accept the terms on [kyutai/pocket-tts](https://huggingface.co/kyutai/pocket-tts).
2. Make a read token in Settings, Access Tokens.
3. Run `~/.cache/stickman-explainer/pocket-tts/env/Scripts/hf auth login` and paste it. The token is stored for the whole computer.

Until then, `narrate.py` stops with a message that links the terms page. Do not use re-uploads of the gated weights by other accounts.
