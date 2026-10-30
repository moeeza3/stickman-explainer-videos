# Three.js route

Use this route for maps, timelines, diagrams, and anything needing exact labels, dates, or geography, and for character stories when the user does not want to pay. It runs locally and uses no generation quota or paid service.

## Setup

Work in a project folder, not inside the skill, and install what the renderer loads:

```bash
npm install three playwright topojson-client world-atlas
```

```bash
npx playwright install chromium
```

Render from that project folder. ffmpeg must be on the PATH. See Free voice below for narration.

## Build order

1. Generate the narration first and measure every line, because line timings set every animation beat.
2. Copy `assets/map-scene.js` into the project. For a map video, edit only the block at the top: view, route stops, march timing, labels, camera keys, and colours. For a non-map video, keep the same module shape and write a new scene.
3. Check stills before a full render, because a full render is slow on software WebGL:

   ```bash
   node <skill>/scripts/render_three.mjs --scene scene.js --at 2,10,20 --width 960 --height 540 --out stills
   ```

4. Fix what the stills show, then render the silent video:

   ```bash
   node <skill>/scripts/render_three.mjs --scene scene.js --duration 37 --out silent.mp4
   ```

5. Add the narration, and any music you have the rights to:

   ```bash
   ffmpeg -i silent.mp4 -i narration.wav -c:v copy -c:a aac -b:a 256k -shortest final.mp4
   ```

Then run the checks in section 5 of SKILL.md.

## Scene rules

- A scene is a pure function of time. Do all motion in `update(t)` and avoid clocks or unseeded randomness inside it, so a frame renders the same way every time and stills match the video.
- Set `frustumCulled = false` on any `InstancedMesh` whose instances move away from the origin, or they can vanish.
- Keep labels large. Text that reads well on a desktop preview can disappear on a phone.

## Characters

Copy `assets/characters.js` beside your scene. `assets/character-scene.js` is a working example.

- `makeCharacter(THREE, spec, worldHeight)` returns a plane. Call `.pose({ pose, mood, walk, dir, talk, look, blink })` in `update(t)`.
- Poses: `stand`, `point`, `cheer`, `think`, `sad`. Moods: `neutral`, `happy`, `smug`, `angry`, `worried`, `sad`, `shocked`.
- `spec` sets the design: `hair` (`none`, `short`, `spiky`, `long`), `hairColor`, `hat` (`none`, `helmet`, `crown`, `cap`), `hatColor`, `shirt`, and `skin`. Keep it fixed across a video so the character stays consistent.
- `makeFaceTag(THREE, spec, size)` makes a talking face to lay on a country or empire on a map.
- Pass `talk` as a value that moves while the character speaks, and drive `walk` from `t` so feet match the distance moved.

## Free voice

`edge-tts` is free to use but is an unofficial client for a Microsoft service, so it can stop working without notice. A recording of the user's own voice is the safest free option.

## Maps

- The template draws one merged landmass from `land-50m.json`, which avoids modern borders on historical maps. Use `countries-50m.json` only when modern borders are part of the story.
- Tell the viewer when a territory shape is approximate. Modern outlines are only a stand-in for historical frontiers.
- Do not let conquered or highlighted land use a colour close to the sea, as it will read as water. Check this in stills.
- Keep route points on the side of the coast they belong to. Smooth curves can swing out to sea between points, so add or move a stop if they do.
