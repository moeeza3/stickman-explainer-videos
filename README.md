# Stickman Explainer Videos

An agent skill that makes narrated stickman and cartoon explainer videos from a topic, as landscape explainers or vertical Shorts, choosing the production route that suits it:

- **Google Vids** for richly illustrated AI-generated scenes with a recurring character
- **Three.js** for maps, timelines, diagrams, and simple cartoon characters, rendered locally for free with no account or quota
- **Shorts** for vertical 9:16 videos with stick figures, word-synced captions, a free voice, generated music and sound effects, and five looks: steps, punchy, casefile, storybook, and tale

## Install

```bash
npx skills add moeeza3/stickman-explainer-videos --skill stickman-explainer-videos
```

## Requirements

Google Vids route:

- An agent with browser control, such as the Claude desktop app's built-in browser
- A Google account with access to Google Vids, signed in by you

Three.js route:

- Node.js, ffmpeg, and these packages in your project: `three`, `playwright`, `topojson-client`, `world-atlas`
- No paid plan or Google account

Shorts route: the Three.js requirements, plus Python with `numpy`, `edge-tts`, and `faster-whisper`

## Use

Ask for a video on a topic, for example:

- "Make a cartoon explainer on why Rome built roads."
- "Make a map documentary on the route of the Silk Road."
- "Make a Short: what would you do if you got lost in a forest?"

The agent never types your password, and it stops if Google asks for a login, billing, or account check. Vids generations come from your own Google plan.

## Status

The Vids workflow comes from one real test video made in October 2026, and Vids changes often, so `skills/stickman-explainer-videos/references/vids-notes.md` may go out of date. The Three.js map route produced a full test video. The Shorts route produced a full 22-second test Short in the `steps` look; the other four looks have only been checked in stills, and the offline Kokoro voice has not been tested.

## Contributing

Want to improve this skill? Feel free to update it. Open an issue or send a pull request with new characters, scene templates, fixes, or better notes.

## License

MIT. See [LICENSE](LICENSE).
