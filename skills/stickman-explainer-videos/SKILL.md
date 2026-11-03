---
name: stickman-explainer-videos
description: Make narrated stickman and cartoon explainer videos from a topic, as long landscape explainers or vertical 9:16 Shorts with word-synced captions, choosing between Google Vids AI clips and free local Three.js rendering with stick-figure characters, maps, and generated sound. Use this whenever the user wants a history or science explainer, a map documentary, a faceless YouTube video, a YouTube Short, TikTok or Reel, a "what would you do if" or "what happens if" video, a mystery or true story short, a cartoon with a recurring character, or an animated route or timeline, even if they only give a topic and never name a tool.
---

# Stickman Explainer Videos

Turn one topic into a finished narrated video: a 40-90 second landscape explainer or a 20-60 second vertical Short. The script comes first on every route, then the visuals are made in whichever tool suits them.

## Choose the route

| Use | When the video needs | Cost and limits |
| --- | --- | --- |
| **Google Vids** | Richly illustrated scenes, places, and mood that would take too long to draw | Limited AI generations, and paid plans give more; text and geography come out unreliable |
| **Three.js** | Maps, routes, timelines, charts, and diagrams with exact labels and dates, plus simple cartoon characters | Free, with no account or quota, but every animation is built by code and full renders are slow |
| **Shorts** | A vertical 9:16 short with stick figures, cards, word-by-word captions, voice, music, and sound effects, in one of five looks | Free and local, using the Three.js renderer; read [references/shorts.md](references/shorts.md) |

Decide from the content and tell the user which route you chose and why. A request for a Short, TikTok, Reel, or anything vertical goes to the Shorts route. If they name a tool, use it. If a video needs both, build the map and diagram shots in Three.js, generate the cartoon shots in Vids, and join them with ffmpeg or in Vids.

If the user does not want to pay, or Vids runs out of quota, use Three.js. It covers characters too: `assets/characters.js` draws stick figures with moods, poses, walking, hats, and talking mouths, and `assets/character-scene.js` puts one on a painted backdrop with speech bubbles and captions. Tell the user the look is simpler than AI clips, with flatter backgrounds and movement limited to what the code draws.

If the `aitrends-2d-studio` plugin is installed, you may use it for characters and shots instead. It is optional, as this skill does not include it.

Follow sections 1, 5, and 6 on the Vids and Three.js routes. Sections 2 to 4 are for Vids; for Three.js, read [references/threejs-route.md](references/threejs-route.md) instead. The Shorts route has its own script rules, checks, and delivery steps in [references/shorts.md](references/shorts.md), which replace sections 1, 5, and 6.

## Ground rules

- Sign-in belongs to the user. Do not type passwords or create accounts. When Google asks for a login, billing, or account check, stop and tell the user, then wait.
- Generations are limited, so treat each one as spending the user's money. Count every generation you start and report the total, including failed or lost ones. If Vids shows a remaining balance, report it before each clip. If it does not, say so once instead of guessing.
- Only say what you checked. You cannot hear the audio or watch the motion from stills, so tell the user which parts still need their eyes and ears.

## 1. Write the script first

Scene timing comes from the narration, so the script decides everything downstream.

Build the video around one curious viewer question, and answer it only near the end. Start in the middle of the most striking event, then step back. Follow one small person through the events, because a viewer cares about someone before they care about a date. Let each line raise something the next line pays off.

Default to eight scenes with one spoken line each, at most about 15 words, which is roughly what fits in a clip of 6 seconds. Use everyday words. For history or science, keep the facts accurate and do not present an invented character as a real person. Show the user the script, then carry on unless they asked to approve it first.

## 2. Lock the look (Vids)

Write two fixed blocks and paste them word for word into every clip prompt. Rewording them between scenes is the main cause of a character changing appearance.

**Character lock** (25-40 words): head shape and colour, face, hair or headwear, clothing with colours, and one signature prop. Pick details that are easy to see at small size. Example:

> a small cartoon baker with an oval cream head, wide ink-dot pupils, curly red hair, a flour-dusted blue apron, a wooden spoon tucked behind one ear, arms and legs drawn as single ink strokes

**Style lock**: medium, line quality, palette, background treatment, and framing. Example:

> ink-and-wash storybook illustration, wobbly pen lines, muted paper tones, richly painted scenery, no words or lettering anywhere, widescreen

A new channel should get its own character and style. Reusing the examples above makes every video look alike.

## 3. Generate the clips in sequence (Vids)

Each prompt reads: character lock, then where we are, then one clear action, then style lock. Name any people who must not appear to be the main character ("soldiers in the distance"), and name the era's clothing when it matters, because the model drifts toward modern or generic costume otherwise.

Before generating, confirm these, since the panel can change them without warning:

- the aspect ratio is still landscape
- the prompt box contains the full new prompt (read it back from the page)
- the clip length fits that scene's line, usually 5-6 seconds

Wait for each clip to finish before starting the next, and do not reload the page while one is running, because the job can be lost. After each clip, confirm it landed in the intended scene.

Look at every result. Remake a clip only for a real fault: wrong character, visible text, broken anatomy, or the wrong era. Allow one remake per clip, tighten the prompt rather than repeating it, and accept the better of the two. Mention any shot changes inside a clip, as one generation can cut to a new angle on its own.

See [references/vids-notes.md](references/vids-notes.md) for interface behaviour that wastes time if you meet it unprepared.

## 4. Assemble (Vids)

1. Put clips in story order, with a short title card showing the question.
2. Add narration with a calm voice, one line per scene, and check each line ends before its scene does.
3. Mute every clip's own audio. Scene by scene is reliable; afterwards, spot-check a few scenes because a stray click can undo a mute.
4. Add transitions only if timing survives them. Vids transitions take time out of the scenes on both sides, so check narration again after adding one. If lines collide, use hard cuts and tell the user why.

## 5. Export and check

Export or render the MP4 and find the real file. A finished Vids download can sit under a temporary name, so check the Downloads folder by size and time, then copy it to the user's folder under a clear name.

With ffmpeg available, verify:

- resolution, duration, and that an audio track exists
- loudness, using `ffmpeg -i video.mp4 -af ebur128=peak=true -f null -`. Vids exports can be quieter than YouTube's -14 LUFS, so report the figure and raise it if needed
- a contact sheet of frames, to confirm scene order and that the character holds up
- for Vids, that scene ends are quiet, which shows the clip audio really is muted

## 6. Report

Tell the user where the file is, then describe every scene briefly and give the generation count, each clip you remade and why, and any step that differs from this workflow. List what you could not verify. Remind them to review the video before uploading, because platforms can limit monetisation of repetitive, mass-produced work. Leave their Google account signed in unless they ask you to sign out.
