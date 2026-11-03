// Parts for vertical shorts drawn on one 2D canvas inside the Three.js renderer: timing, captions, sets, cards, camera.
// Everything is laid out on a 1080 x 1920 design canvas and scaled to the render size, and every call is a pure
// function of time, so a frame renders the same way every time.
import { drawFigure } from './characters.js';

export const DW = 1080, DH = 1920, GROUND = 1310;   // design size; GROUND is where feet stand
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const span = (t, a, b) => clamp01((t - a) / (b - a));
export const mix = (a, b, k) => a + (b - a) * k;
export const ease = {
  out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2,
};
const key = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ---------- the canvas the whole short is drawn on ----------
export function makeStage(THREE, width, height) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex })));
  camera.position.z = 0.5;
  return {
    scene, camera, g,
    begin() { g.setTransform(width / DW, 0, 0, height / DH, 0, 0); g.clearRect(0, 0, DW, DH); },
    commit() { tex.needsUpdate = true; },
  };
}

// ---------- timing.json from time_words.py ----------
export async function loadProject(base = '/') {
  const [script, timing] = await Promise.all(['script.json', 'timing.json'].map((f) => fetch(base + f).then((r) => r.json())));
  const words = timing.words;
  const T = {
    script, duration: timing.duration, lines: timing.lines, words,
    start: (i) => timing.lines[i].start,
    end: (i) => timing.lines[i].end,
    // when the first word in line i that starts with these letters is spoken
    word(prefix, i) {
      const w = words.find((w) => w.line === i && key(w.w).startsWith(key(prefix)));
      if (!w) throw new Error(`line ${i} has no word starting with "${prefix}"`);
      return w.s;
    },
    // shots cut a moment before their line is spoken
    cut: (i, early = 0.12) => (i === 0 ? 0 : timing.lines[i].start - early),
    shotAt(t) { let i = 0; while (i + 1 < timing.lines.length && t >= T.cut(i + 1)) i++; return i; },
  };
  return T;
}

// ---------- captions ----------
// In script.json, "cap" splits a line into on-screen chunks with "/", and [brackets] mark the highlighted word:
//   "say": "Step one: stop walking.", "cap": "Step [one] / stop [walking]"
// A line with no "cap" is chunked automatically (2-3 words, longest word highlighted).
function tokens(text) {
  const out = []; let open = false;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const starts = raw.includes('['), ends = raw.includes(']');
    out.push({ text: raw.replace(/[[\]]/g, ''), hot: open || starts });
    open = (open || starts) && !ends;
  }
  return out;
}

export function captionChunks(T) {
  const chunks = [];
  T.script.lines.forEach((ln, i) => {
    const ws = T.words.filter((w) => w.line === i);
    let parts = ln.cap ? ln.cap.split('/').map((s) => s.trim()).filter(Boolean) : null;
    if (!parts) {
      parts = []; let cur = [];
      ws.forEach((w, k) => {
        cur.push(w.w);
        if (cur.length === 3 || (cur.length === 2 && /[,.?!:;]$/.test(w.w)) || k === ws.length - 1) {
          const long = cur.reduce((a, b) => (key(b).length > key(a).length ? b : a));
          parts.push(cur.map((x) => (x === long ? `[${x}]` : x)).join(' ')); cur = [];
        }
      });
    }
    let cursor = 0;
    for (const p of parts) {
      const toks = tokens(p), first = key(toks[0].text);
      let at = ws.findIndex((w, k) => k >= cursor && key(w.w) === first);
      if (at < 0) at = Math.min(cursor, ws.length - 1);
      chunks.push({ line: i, toks, start: ws[at].s });
      cursor = at + toks.length;
    }
  });
  chunks.forEach((c, k) => {
    const next = chunks[k + 1];
    const lineEnd = T.end(c.line) + 0.35;
    c.end = next ? (next.start - lineEnd > 0.6 ? lineEnd : next.start) : T.duration;
  });
  return chunks;
}

// one or two words at a time, short words riding with the next one
export function wordChunks(T) {
  const out = [], ws = T.words;
  for (let k = 0; k < ws.length; k++) {
    const pair = key(ws[k].w).length <= 3 && !/[,.?!]$/.test(ws[k].w) && ws[k + 1]?.line === ws[k].line;
    const group = pair ? [ws[k], ws[++k]] : [ws[k]];
    out.push({ line: group[0].line, toks: group.map((w) => ({ text: w.w, hot: false })), start: group[0].s, end: 0 });
  }
  out.forEach((c, k) => { c.end = out[k + 1] && out[k + 1].start - c.start < 1.2 ? out[k + 1].start : c.start + 0.9; });
  return out;
}

export const CAPTION_THEMES = {
  punch: { font: '900 118px "Arial Black", Impact, sans-serif', fill: '#ffffff', hot: '#ffd23f', stroke: '#111', line: 24, y: 1500, upper: true },
  bar: { font: 'bold 82px "Trebuchet MS", "Segoe UI", sans-serif', fill: '#ffffff', hot: '#f2b630', box: 'rgba(18,18,24,.86)', y: 1640 },
  type: { font: 'bold 74px "Courier New", Courier, monospace', fill: '#efe6d2', hot: '#e0453a', y: 1600, typed: true, shadow: true },
  paper: { font: 'bold 84px Georgia, "Times New Roman", serif', fill: '#2b2016', hot: '#a3262a', strip: '#f1e4c4', y: 1630 },
  single: { font: '900 140px "Arial Black", Impact, sans-serif', fill: '#ffffff', hot: '#ffffff', stroke: '#111', line: 26, y: 1460, upper: true },
};

export function drawCaption(g, chunks, t, themeName) {
  const th = CAPTION_THEMES[themeName], c = chunks.find((c) => t >= c.start && t < c.end);
  if (!c) return;
  const pop = th.typed ? 1 : mix(0.82, 1, ease.back(span(t, c.start, c.start + 0.2)));
  let size = parseInt(th.font.match(/(\d+)px/)[1], 10), rows;
  const words = c.toks.map((k) => ({ ...k, text: th.upper ? k.text.toUpperCase() : k.text }));
  for (;;) {   // wrap into at most two rows, shrinking the font until it fits
    g.font = th.font.replace(/\d+px/, `${size}px`);
    const space = g.measureText(' ').width, widths = words.map((w) => g.measureText(w.text).width);
    rows = [[]]; let x = 0;
    words.forEach((w, k) => { if (x && x + widths[k] > 900) { rows.push([]); x = 0; } rows.at(-1).push({ ...w, w: widths[k] }); x += widths[k] + space; });
    if (rows.length <= 2 || size < 50) break;
    size -= 6;
  }
  const space = g.measureText(' ').width, lh = size * 1.12;
  let typed = th.typed ? Math.floor((t - c.start) / 0.035) : Infinity;
  g.save(); g.translate(540, th.y); g.scale(pop, pop); g.textBaseline = 'middle'; g.lineJoin = 'round';
  const rowW = rows.map((r) => r.reduce((s, w) => s + w.w, 0) + space * (r.length - 1));
  const top = -((rows.length - 1) * lh) / 2;
  if (th.box || th.strip) {
    const bw = Math.max(...rowW) + 80, bh = rows.length * lh + 40;
    g.fillStyle = th.box || th.strip; g.beginPath();
    if (th.box) g.roundRect(-bw / 2, top - lh / 2 - 20, bw, bh, 34);
    else { const r = seeded(c.start * 1000 + 9); g.moveTo(-bw / 2, top - lh / 2 - 20); for (let x = -bw / 2; x <= bw / 2; x += 30) g.lineTo(x, top - lh / 2 - 20 + r() * 9); for (let x = bw / 2; x >= -bw / 2; x -= 30) g.lineTo(x, top - lh / 2 - 20 + bh - r() * 9); }
    g.closePath(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18; g.shadowOffsetY = 6; g.fill(); g.shadowColor = 'transparent';
  }
  rows.forEach((r, ri) => {
    let x = -rowW[ri] / 2; const y = top + ri * lh;
    for (const w of r) {
      const shown = w.text.slice(0, Math.max(0, typed)); typed -= w.text.length + 1;
      if (th.shadow) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(shown, x + 4, y + 4); }
      if (th.stroke) { g.strokeStyle = th.stroke; g.lineWidth = th.line; g.strokeText(shown, x, y); }
      g.fillStyle = w.hot ? th.hot : th.fill; g.fillText(shown, x, y);
      x += w.w + space;
    }
  });
  g.restore();
}

// ---------- looks: one palette + caption theme each ----------
export const LOOKS = {
  steps: { caption: 'bar', wall: '#e9dcc4', floor: '#b88c5a', accent: '#f2b630', figure: {}, nightGlow: 'rgba(255,214,150,.9)' },
  casefile: { caption: 'type', wall: '#1b1d22', floor: '#121316', accent: '#e0453a', figure: { skin: '#18191c', ink: '#050506' }, nightGlow: 'rgba(170,40,36,.85)' },
  storybook: { caption: 'paper', wall: '#efe0bd', floor: '#c9a46b', accent: '#a3262a', figure: { shirt: '#6d5a3a' }, nightGlow: 'rgba(255,214,150,.8)' },
  punchy: { caption: 'punch', wall: '#f4f1ea', floor: '#d9cfbd', accent: '#ffd23f', figure: { shirt: '#3b7dd8' }, nightGlow: 'rgba(255,230,160,.9)' },
  tale: { caption: 'single', wall: '#f6e7c8', floor: '#8fbf5a', accent: '#ff7a3d', figure: { shirt: '#e05a47', hair: 'short' }, nightGlow: 'rgba(255,214,150,.9)' },
};

// ---------- sets (backgrounds), each drawn over the full design canvas ----------
const NIGHT = { day: 0, dusk: 0.35, night: 0.62 };
function skyGrad(g, time) {
  const s = g.createLinearGradient(0, 0, 0, GROUND);
  const top = { day: '#8ccbee', dusk: '#f08a5d', night: '#0e1a3a' }[time], low = { day: '#d9f0fb', dusk: '#f7c87b', night: '#28345e' }[time];
  s.addColorStop(0, top); s.addColorStop(1, low); g.fillStyle = s; g.fillRect(-200, -200, DW + 400, GROUND + 200);
}
function shade(g, time) { if (NIGHT[time]) { g.fillStyle = `rgba(8,12,34,${NIGHT[time]})`; g.fillRect(-200, -200, DW + 400, DH + 400); } }

export const SETS = {
  plain(g, look) { g.fillStyle = look.wall; g.fillRect(-200, -200, DW + 400, DH + 400); },
  room(g, look, { time = 'day', lamp = false } = {}) {
    g.fillStyle = look.wall; g.fillRect(-200, -200, DW + 400, GROUND + 200);
    g.fillStyle = look.floor; g.fillRect(-200, GROUND, DW + 400, DH);
    g.save(); g.beginPath(); g.rect(650, 330, 320, 380); g.clip(); skyGrad(g, time);
    if (time === 'night') { g.fillStyle = '#f3efd6'; g.beginPath(); g.arc(880, 420, 40, 0, 7); g.fill(); }
    g.restore(); g.strokeStyle = '#5b4632'; g.lineWidth = 18; g.strokeRect(650, 330, 320, 380); g.beginPath(); g.moveTo(810, 330); g.lineTo(810, 710); g.stroke();
    g.fillStyle = '#7c5a8c'; g.beginPath(); g.roundRect(60, 1060, 440, 250, 40); g.fill(); g.fillStyle = '#6a4b79'; g.beginPath(); g.roundRect(60, 960, 440, 160, 40); g.fill();
    g.fillStyle = '#5b4632'; g.fillRect(890, 900, 14, 410); g.fillStyle = '#e9c46a'; g.beginPath(); g.moveTo(840, 900); g.lineTo(954, 900); g.lineTo(925, 820); g.lineTo(869, 820); g.closePath(); g.fill();
    shade(g, time);
    if (lamp) { const r = g.createRadialGradient(897, 860, 10, 897, 860, 520); r.addColorStop(0, 'rgba(255,214,140,.55)'); r.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = r; g.fillRect(300, 300, 1000, 1200); }
  },
  street(g, look, { time = 'day' } = {}) {
    skyGrad(g, time); const r = seeded(5);
    if (time === 'day') { g.fillStyle = '#fff4c2'; g.beginPath(); g.arc(860, 260, 80, 0, 7); g.fill(); }
    ['#e07a5f', '#81b29a', '#f2cc8f', '#3d5a80'].forEach((c, i) => {
      const x = -60 + i * 300, h = 420 + r() * 160;
      g.fillStyle = c; g.fillRect(x, GROUND - h, 280, h); g.fillStyle = '#5b3b2a'; g.beginPath(); g.moveTo(x - 20, GROUND - h); g.lineTo(x + 140, GROUND - h - 140); g.lineTo(x + 300, GROUND - h); g.fill();
      g.fillStyle = '#fdf6e3'; g.fillRect(x + 40, GROUND - h + 70, 80, 90); g.fillRect(x + 160, GROUND - h + 70, 80, 90); g.fillStyle = '#4a3226'; g.fillRect(x + 105, GROUND - 170, 70, 170);
    });
    g.fillStyle = '#8d8a84'; g.fillRect(-200, GROUND, DW + 400, DH); g.fillStyle = '#6d6a64'; g.fillRect(-200, GROUND + 120, DW + 400, 400);
    shade(g, time);
  },
  forest(g, look, { time = 'day' } = {}) {
    skyGrad(g, time); const r = seeded(17);
    g.fillStyle = '#2c4a30'; g.fillRect(-200, GROUND - 200, DW + 400, 200);   // undergrowth behind the trunks
    for (let layer = 0; layer < 3; layer++) {
      const tone = ['#4f7a52', '#3b6343', '#2a4d33'][layer], y0 = GROUND - 120 + layer * 60;
      for (let i = 0; i < 9; i++) {
        const x = -80 + i * 140 + r() * 80, h = 520 + r() * 380 + layer * 80, w = 150 + r() * 70;
        g.fillStyle = '#4b3524'; g.fillRect(x - 12, y0 - 90, 24, 90);
        g.fillStyle = tone; g.beginPath(); g.moveTo(x, y0 - h); g.lineTo(x + w / 2, y0 - 40); g.lineTo(x - w / 2, y0 - 40); g.closePath(); g.fill();
      }
    }
    g.fillStyle = '#3f5b2e'; g.fillRect(-200, GROUND, DW + 400, DH);
    shade(g, time);
  },
  spotlight(g, look) {
    g.fillStyle = look.wall; g.fillRect(-200, -200, DW + 400, DH + 400);
    const cone = g.createLinearGradient(0, 0, 0, GROUND + 80); cone.addColorStop(0, 'rgba(255,236,200,.05)'); cone.addColorStop(1, 'rgba(255,236,200,.22)');
    g.fillStyle = cone; g.beginPath(); g.moveTo(470, -50); g.lineTo(610, -50); g.lineTo(900, GROUND + 80); g.lineTo(180, GROUND + 80); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,236,200,.18)'; g.beginPath(); g.ellipse(540, GROUND + 60, 380, 70, 0, 0, 7); g.fill();
  },
  page(g, look) {
    g.fillStyle = look.wall; g.fillRect(-200, -200, DW + 400, DH + 400); const r = seeded(29);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,80,30,${0.03 + r() * 0.05})`; g.beginPath(); g.arc(r() * DW, r() * DH, 30 + r() * 140, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = 6; g.strokeRect(40, 40, DW - 80, DH - 80);
  },
};

// ---------- people ----------
// opts: everything drawFigure takes (pose, mood, walk, look, talk, blink, hair, hat, shirt ...) plus x, y, h, dir, glow
export function person(g, look, opts) {
  const { x = 540, y = GROUND, h = 760, dir = 1, glow = null, ...rest } = opts;
  g.save(); g.translate(x, 0); g.scale(dir, 1);
  if (glow) { g.shadowColor = glow === true ? look.nightGlow : glow; g.shadowBlur = 36; }
  drawFigure(g, 0, y, { height: h, ...look.figure, ...rest });
  g.restore();
}

// ---------- cards and marks; k is how far the entrance has played (0..1) ----------
export function stepCard(g, look, n, label, x, y, k) {
  if (k <= 0) return; const s = ease.back(clamp01(k));
  g.save(); g.translate(x, y); g.scale(s, s); g.font = 'bold 64px "Trebuchet MS", sans-serif';
  const w = g.measureText(label).width + 200;
  g.fillStyle = look.accent; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 20; g.shadowOffsetY = 8;
  g.beginPath(); g.roundRect(-w / 2, -70, w, 140, 36); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = '#1b1b1f'; g.beginPath(); g.arc(-w / 2 + 75, 0, 46, 0, 7); g.fill();
  g.fillStyle = look.accent; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), -w / 2 + 75, 2);
  g.fillStyle = '#1b1b1f'; g.textAlign = 'left'; g.fillText(label, -w / 2 + 140, 2); g.restore();
}

export function stamp(g, text, x, y, k, color = '#c0392b', rot = -0.18) {
  if (k <= 0) return; const s = mix(2.2, 1, ease.out(clamp01(k)));
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.globalAlpha = clamp01(k * 3);
  g.font = '900 96px "Arial Black", Impact, sans-serif'; const w = g.measureText(text).width + 70;
  g.strokeStyle = color; g.lineWidth = 12; g.strokeRect(-w / 2, -70, w, 140);
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 4); g.restore();
}

export function pill(g, text, x, y, k, bg = '#1b1b1f', fg = '#fff') {
  if (k <= 0) return; const s = ease.back(clamp01(k));
  g.save(); g.translate(x, y); g.scale(s, s); g.font = 'bold 54px "Trebuchet MS", sans-serif';
  const w = g.measureText(text).width + 70; g.fillStyle = bg; g.beginPath(); g.roundRect(-w / 2, -48, w, 96, 48); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2); g.restore();
}

export function mark(g, kind, x, y, size, k) {
  if (k <= 0) return; const p = ease.out(clamp01(k));
  g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = kind === 'check' ? '#2fa84f' : '#d63a2f';
  g.beginPath();
  if (kind === 'check') { g.moveTo(-size * 0.45, 0); g.lineTo(-size * 0.45 + size * 0.3 * Math.min(1, p * 2), size * 0.3 * Math.min(1, p * 2)); if (p > 0.5) g.lineTo(-size * 0.15 + size * 0.65 * (p - 0.5) * 2, size * 0.3 - size * 0.75 * (p - 0.5) * 2); }
  else { const a = Math.min(1, p * 2), b = Math.max(0, p * 2 - 1); g.moveTo(-size / 2, -size / 2); g.lineTo(-size / 2 + size * a, -size / 2 + size * a); if (b) { g.moveTo(size / 2, -size / 2); g.lineTo(size / 2 - size * b, -size / 2 + size * b); } }
  g.stroke(); g.restore();
}

export function bubble(g, text, x, y, k, tailX, tailY) {
  if (k <= 0) return; const s = ease.back(clamp01(k));
  g.save(); g.translate(x, y); g.scale(s, s); g.font = 'bold 56px "Comic Sans MS", "Segoe Print", cursive';
  const w = g.measureText(text).width + 80;
  g.fillStyle = '#fff'; g.strokeStyle = '#161616'; g.lineWidth = 7; g.beginPath(); g.roundRect(-w / 2, -60, w, 120, 50);
  if (tailX !== undefined) { g.moveTo(-30, 55); g.lineTo((tailX - x) / s, (tailY - y) / s); g.lineTo(30, 55); }
  g.fill(); g.stroke(); g.fillStyle = '#161616'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2); g.restore();
}

export function bigWord(g, text, x, y, size, k, color = '#fff', rot = -0.06) {
  if (k <= 0) return; const s = ease.back(clamp01(k));
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = '#111'; g.lineWidth = size * 0.18;
  g.strokeText(text, 0, 0); g.fillStyle = color; g.fillText(text, 0, 0); g.restore();
}

export function dateTag(g, text, sub, x, y, t0, t) {
  const n = Math.floor((t - t0) / 0.05); if (n <= 0) return;
  g.save(); g.font = 'bold 64px "Courier New", monospace'; g.fillStyle = '#efe6d2'; g.textBaseline = 'top';
  g.fillText(text.slice(0, n), x, y);
  if (sub) { g.font = 'bold 36px "Courier New", monospace'; g.fillStyle = 'rgba(239,230,210,.7)'; g.fillText(sub.slice(0, Math.max(0, n - text.length)), x, y + 80); }
  g.restore();
}

// ---------- camera ----------
// a slow push toward focus over the shot, plus a quick punch-in right after the cut
export function camera(g, lt, d, focus = [540, 900], zoom = 0.06, punch = 0.05) {
  const s = 1 + zoom * ease.inOut(clamp01(lt / d)) + punch * (1 - ease.out(span(lt, 0, 0.3)));
  g.translate(focus[0], focus[1]); g.scale(s, s); g.translate(-focus[0], -focus[1]);
}
export function flash(g, lt, strength = 0.35) {
  const a = strength * (1 - span(lt, 0, 0.14)); if (a <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
}
export function grain(g, t, amount = 0.06) {   // film grain for darker looks, seeded by frame time
  const r = seeded(Math.floor(t * 24) + 3); g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${amount})` : `rgba(0,0,0,${amount})`; g.fillRect(r() * g.canvas.width, r() * g.canvas.height, 2, 2); }
  const v = g.createRadialGradient(g.canvas.width / 2, g.canvas.height / 2, g.canvas.height * 0.3, g.canvas.width / 2, g.canvas.height / 2, g.canvas.height * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
}
