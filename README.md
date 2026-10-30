# Explainer Video Maker

An agent skill that makes a short narrated explainer video from a topic, choosing the production route that suits it:

- **Google Vids** for richly illustrated AI-generated scenes with a recurring character
- **Three.js** for maps, timelines, diagrams, and simple cartoon characters, rendered locally for free with no account or quota

## Install

```bash
npx skills add moeeza3/stickman-explainer-videos --skill explainer-video-maker
```

## Requirements

Google Vids route:

- An agent with browser control, such as the Claude desktop app's built-in browser
- A Google account with access to Google Vids, signed in by you

Three.js route:

- Node.js, ffmpeg, and these packages in your project: `three`, `playwright`, `topojson-client`, `world-atlas`
- No paid plan or Google account

## Use

Ask for a video on a topic, for example:

- "Make a cartoon explainer on why Rome built roads."
- "Make a map documentary on the route of the Silk Road."

The agent never types your password, and it stops if Google asks for a login, billing, or account check. Vids generations come from your own Google plan.

## Status

The Vids workflow comes from one real test video made in October 2026, and Vids changes often, so `skills/explainer-video-maker/references/vids-notes.md` may go out of date. The Three.js renderer, map template, and character kit have passed short render tests but have not yet produced a full video.

## Contributing

Want to improve this skill? Feel free to update it. Open an issue or send a pull request with new characters, scene templates, fixes, or better notes.

## License

MIT. See [LICENSE](LICENSE).
