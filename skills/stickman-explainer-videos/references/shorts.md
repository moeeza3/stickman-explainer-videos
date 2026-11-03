# Shorts route (9:16)

Use this for YouTube Shorts, TikTok, or Reels: 20-60 seconds, vertical, a new picture every two or three seconds, and big captions that light up as each word is spoken. Everything runs on the user's computer. The voice is free, Whisper times the words, the sound effects and music are generated, and the frames come from the same Three.js renderer as the long route.

## Setup

Do the Three.js setup in [threejs-route.md](threejs-route.md) first, then add the Python parts:

```bash
pip install numpy edge-tts faster-whisper
```

Whisper downloads its model the first time it runs (base.en is about 150 MB, small.en about 500 MB). For an offline voice, or to narrate in the user's own voice from a short clip, set up Pocket TTS or Chatterbox Nano as [voices.md](voices.md) says.

## Pick a look

Each look is a palette, a caption style, and the sets that suit it. Choose from the topic, say which one you picked, and ask only if two fit equally well.

| Look | Good for | Sets | Captions |
| --- | --- | --- | --- |
| `steps` | survival tips, how-to, "what would you do if" | `forest`, `room`, `street` | dark bar, gold keyword |
| `punchy` | quick science or body facts, "what happens if" | `room`, `plain` | huge white capitals, yellow keyword |
| `casefile` | mysteries and strange true events | `spotlight` | typed out like a typewriter, red keyword, film grain |
| `storybook` | history and old legends | `page`, plus the map route for real geography | serif type on a ragged parchment band, crimson keyword |
| `tale` | funny or surprising true stories | `street`, `room`, `forest` | one or two words at a time, no highlight |

Every set takes `time: 'day' | 'dusk' | 'night'`, and `room` also takes `lamp: true`. Give people `glow: true` at night or they disappear into the dark. For `casefile`, give the hero a dark `skin` and `ink` in `HERO` so the figures read as faceless silhouettes, and keep red for the one person the story follows.

New topics often need a new prop or set. Add it to the shot's `draw(g, lt, d, t)` hook or to `shorts-kit.js`, using the same flat colours and outline weight, then check it in a still.

## Build

1. **Script.** Copy `assets/short-script.json` into a new project folder as `script.json` and rewrite it. Each entry in `lines` is one cut, not one sentence. Split a long sentence at its natural pauses so the picture changes while the voice keeps going; `narrate.py` still reads the whole sentence in one breath. Aim for 85-110 words for 35 seconds. Open with the question, raise the stakes, give the surprise, and close on a line that pays off the opening. Write it as speech, with joining words like "so" and "which means", rather than as a list of slogans. Spell numbers the way they are said. Put each fact's source in `sources`, and check health and safety advice against an official body.
2. **Captions.** In each line's `cap`, `/` starts a new on-screen chunk and `[brackets]` mark the one highlighted word. Keep chunks to one to three words, and start each chunk with a word that is actually spoken so it appears on time. Without `cap`, lines are chunked automatically, which is fine for a draft.
3. **Show the plan.** Before building, show the user the title, the lines with their caption chunks, a one-line description of each shot, and the sources. Wait for a yes if they asked to approve, otherwise carry on.
4. **Voice and timing**, from the project folder:

   ```bash
   python <skill>/scripts/narrate.py .
   ```

   ```bash
   python <skill>/scripts/time_words.py . --model base.en
   ```

   To pick or copy a voice, set `voice` in `script.json` as [voices.md](voices.md) shows. For the user's own full recording, run `narrate.py . --audio their_take.m4a` and then `time_words.py`. For a captions-only video with no voice, run `time_words.py . --estimate`. Read `timing.txt` and check that the words follow the speech.
5. **Shots.** Copy `assets/short-scene.js`, `assets/shorts-kit.js`, and `assets/characters.js` into the project, then edit `LOOK`, `HERO`, and `SHOTS` (one entry per line). Put each card's entrance on its word with `on`, so the X lands on "wandering" rather than somewhere near it.
6. **Stills**, then fix what they show:

   ```bash
   node <skill>/scripts/render_three.mjs --scene short-scene.js --at 1,5,9,13 --width 540 --height 960 --out stills
   ```

7. **Sound.** Add `sfx` to lines that need a hit, then build the soundtrack:

   ```bash
   python <skill>/scripts/mix_audio.py .
   ```

8. **Render and mux.** A full render at 1080x1920 takes about 0.8 seconds per frame on software WebGL, so roughly 7 minutes for 20 seconds. Tell the user the wait and run it in the background:

   ```bash
   node <skill>/scripts/render_three.mjs --scene short-scene.js --duration 21.6 --width 1080 --height 1920 --out silent.mp4
   ```

   ```bash
   ffmpeg -i silent.mp4 -i audio/mix.wav -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -shortest short.mp4
   ```

   Use the `duration` from `timing.json`.

## Check before handing over

Make a sheet with one frame per second (`ffmpeg -i short.mp4 -vf "fps=1,scale=216:-1,tile=11x2" sheet.jpg`) and look at all of it, then look at the busiest frames at full size. Ask of every frame:

- Does the picture match what is being said at that moment, and does each reveal arrive on its word?
- Does every caption show one to three words, spelled correctly, with exactly one highlighted word, and is it readable at phone size?
- Does anything collide? Keep cards, marks, and moving props away from faces and out of the caption zone near the bottom.
- Does anything happen before its cause? A prop belongs in a hand before it moves, and a result follows its action.
- Do night shots still show the people?

You cannot hear the result. Report the loudness figure, and tell the user to listen for voice clarity and harsh effects.

## Deliver

Give the MP4 path, a cover frame (a still from the strongest moment), a title, a one-line caption, and five to eight hashtags. For an own-recording video, also give the script with each line's time so they can match their delivery. Offer to make one set of exact fixes, and render again only the shots those fixes touch.

## Do not

- copy another creator's script, shots, characters, or frames; take the format, never the content
- use AI image or video generation on this route, or spend the user's money
- present an invented person or quote as real
- show gore; show danger with colour, marks, and words instead
