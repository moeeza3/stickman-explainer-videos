// A vertical short built from a shot table: one shot per script line, cut just before the line is spoken.
// Copy this file, characters.js and shorts-kit.js into the project folder (beside script.json and timing.json),
// then edit LOOK, HERO and SHOTS. Render at --width 1080 --height 1920.
import * as K from './shorts-kit.js';

// ---------- edit for each video ----------
const LOOK = 'steps';   // steps | casefile | storybook | punchy | tale (see the shorts reference)
const HERO = { hair: 'short', hairColor: '#2b2b2b', shirt: '#d9663b', hat: 'cap', hatColor: '#3b6fb6' };
// Per shot: set + time of day, the hero (x, pose, mood, dir, walk: [fromX, toX], glow), extra people in cast,
// one card that enters on a spoken word (step, stamp, pill, mark, big, bubble), camera focus and zoom,
// and draw(g, lt, d, t) for any custom props. lt = seconds into the shot, d = shot length.
const SHOTS = [
  { set: 'forest', time: 'dusk', hero: { x: 540, pose: 'think', mood: 'worried', look: -1 }, focus: [540, 760], zoom: 0.12 },
  { set: 'forest', time: 'dusk', hero: { pose: 'stand', mood: 'shocked', walk: [200, 820] }, card: { big: '?!', on: 'same', x: 540, y: 380 } },
  { set: 'forest', time: 'dusk', hero: { x: 540, pose: 'stand', mood: 'worried' }, card: { step: 1, label: 'STOP', on: 'one' } },
  { set: 'forest', time: 'night', hero: { pose: 'stand', mood: 'worried', walk: [300, 760], glow: true }, card: { mark: 'cross', on: 'wander', x: 540, y: 420 } },
  { set: 'forest', time: 'night', hero: { x: 540, pose: 'point', mood: 'smug', glow: true }, card: { mark: 'check', on: 'stay', x: 820, y: 420 } },
  { set: 'forest', time: 'night', hero: { x: 540, pose: 'cheer', mood: 'happy', glow: true }, card: { step: 2, label: 'BE LOUD', on: 'two' } },
  { set: 'forest', time: 'night', hero: { x: 420, pose: 'point', mood: 'angry', talk: true, glow: true }, card: { pill: '3 BLASTS = HELP', on: 'three', x: 540, y: 300 }, draw: whistleWaves },
  { set: 'forest', time: 'night', hero: { x: 540, pose: 'sad', mood: 'neutral', glow: true }, card: { step: 3, label: 'STAY WARM', on: 'three' } },
  { set: 'forest', time: 'day', hero: { x: 380, pose: 'cheer', mood: 'happy' }, cast: [{ x: 780, pose: 'point', mood: 'happy', dir: -1, hat: 'helmet', hatColor: '#e0a030', shirt: '#2f6d3a' }], card: { mark: 'check', on: 'stay', x: 540, y: 380 }, focus: [540, 900] },
];
function whistleWaves(g, lt) {   // three rings leaving the hero's mouth, one per blast
  for (let i = 0; i < 3; i++) {
    const k = K.span(lt, 0.5 + i * 0.45, 1.3 + i * 0.45); if (k <= 0 || k >= 1) continue;
    g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 10; g.beginPath(); g.arc(470, 690, 60 + k * 340, -0.7, 0.7); g.stroke();
  }
}
// -----------------------------------------

export default async ({ THREE, width, height }) => {
  const T = await K.loadProject(), look = K.LOOKS[LOOK], stage = K.makeStage(THREE, width, height), g = stage.g;
  const caps = look.caption === 'single' ? K.wordChunks(T) : K.captionChunks(T);
  return {
    scene: stage.scene, camera: stage.camera,
    update(t) {
      const i = T.shotAt(t), shot = SHOTS[Math.min(i, SHOTS.length - 1)];
      const t0 = T.cut(i), d = (i + 1 < T.lines.length ? T.cut(i + 1) : T.duration) - t0, lt = t - t0;
      stage.begin(); g.save();
      K.camera(g, lt, d, shot.focus || [540, 900], shot.zoom ?? 0.06);
      K.SETS[shot.set || 'plain'](g, look, { time: shot.time || 'day', lamp: shot.lamp });
      const hero = { ...HERO, ...shot.hero }, speaking = t >= T.start(i) && t <= T.end(i);
      if (hero.walk) { const [a, b] = hero.walk; hero.x = K.mix(a, b, K.clamp01(lt / d)); hero.dir = b < a ? -1 : 1; hero.walk = lt * 7; }
      else hero.walk = null;
      hero.talk = hero.talk && speaking ? Math.abs(Math.sin(t * 12)) : 0;
      hero.blink = t % 3.3 > 3.2;
      for (const c of shot.cast || []) K.person(g, look, { blink: t % 2.9 > 2.8, ...c });
      K.person(g, look, hero);
      shot.draw?.(g, lt, d, t);
      const c = shot.card;
      if (c) {
        const at = c.on ? T.word(c.on, i) - t0 : 0.3, k = K.span(lt, at, at + 0.35);
        if (c.step) K.stepCard(g, look, c.step, c.label, c.x ?? 540, c.y ?? 300, k);
        if (c.stamp) K.stamp(g, c.stamp, c.x ?? 540, c.y ?? 420, k, look.accent);
        if (c.pill) K.pill(g, c.pill, c.x ?? 540, c.y ?? 300, k);
        if (c.mark) K.mark(g, c.mark, c.x ?? 540, c.y ?? 420, c.size ?? 220, k);
        if (c.big) K.bigWord(g, c.big, c.x ?? 540, c.y ?? 400, c.size ?? 200, k, look.accent);
        if (c.bubble) K.bubble(g, c.bubble, c.x ?? 640, c.y ?? 420, k, hero.x, 600);
      }
      g.restore();
      if (LOOK === 'casefile') K.grain(g, t);
      K.drawCaption(g, caps, t, look.caption);
      if (i > 0) K.flash(g, lt);
      stage.commit();
    },
  };
};
