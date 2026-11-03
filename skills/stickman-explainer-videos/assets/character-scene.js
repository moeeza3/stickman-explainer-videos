// A hand-drawn style story shot with no paid services: painted backdrop, one character, a speech bubble and a caption.
// Copy this file with characters.js beside it, then edit the block below. Make one copy per scene, or switch BEATS on time.
import { makeCharacter } from './characters.js';

// ---------- edit for each video ----------
const HERO = { hair: 'spiky', hairColor: '#3a2a20', shirt: '#9c6a3c' };
const BEATS = [   // from seconds, pose, mood, walking, facing, bubble text
  { from: 0, pose: 'stand', mood: 'neutral', walk: true, dir: 1, say: '' },
  { from: 3.5, pose: 'point', mood: 'shocked', walk: false, dir: 1, say: 'What is that?' },
  { from: 6, pose: 'cheer', mood: 'happy', walk: false, dir: 1, say: '' },
];
const CAPTION = 'The first long road home';
const SKY = ['#f4d9a6', '#e9b77a'], HILLS = ['#c9a06a', '#a97f4f', '#7f6a3f'], GROUND = '#d9b77e';
// -----------------------------------------

const hand = '"Segoe Print", "Comic Sans MS", cursive';
const clamp = (v) => Math.min(1, Math.max(0, v));

function backdrop(THREE) {   // a seeded painted scene, so every render gets the same hills
  const W = 2048, H = 1152, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sky = g.createLinearGradient(0, 0, 0, H * 0.7); sky.addColorStop(0, SKY[0]); sky.addColorStop(1, SKY[1]); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff3d0'; g.beginPath(); g.arc(W * 0.78, H * 0.2, 90, 0, Math.PI * 2); g.fill();
  HILLS.forEach((col, i) => {
    const base = H * (0.46 + i * 0.1), a = 60 + rnd() * 50, f = 0.002 + rnd() * 0.002, p = rnd() * 9;
    g.fillStyle = col; g.strokeStyle = '#2a2118'; g.lineWidth = 4; g.beginPath(); g.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 14) g.lineTo(x, base + Math.sin(x * f + p) * a + Math.sin(x * f * 3 + p) * a * 0.3);
    g.lineTo(W + 10, H); g.closePath(); g.fill(); g.stroke();
  });
  g.fillStyle = GROUND; g.fillRect(0, H * 0.76, W, H * 0.24); g.strokeStyle = '#2a2118'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, H * 0.76); g.lineTo(W, H * 0.76); g.stroke();
  g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 3; for (let i = 0; i < 90; i++) { const x = rnd() * W, y = H * 0.78 + rnd() * H * 0.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 + rnd() * 26, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function textPlane(THREE, draw, w, h, worldW) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * h / w), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
  mesh.paint = (...a) => { g.clearRect(0, 0, w, h); draw(g, w, h, ...a); tex.needsUpdate = true; }; return mesh;
}

export default async ({ THREE, width, height }) => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: backdrop(THREE) })); scene.add(bg);
  const hero = makeCharacter(THREE, HERO, 3.4); hero.position.set(0, -1.8, 0.2); scene.add(hero);

  const bubble = textPlane(THREE, (g, w, h, str) => {
    g.fillStyle = '#fff'; g.strokeStyle = '#161616'; g.lineWidth = 7; g.beginPath(); g.roundRect(10, 10, w - 20, h - 60, 44); g.moveTo(90, h - 52); g.lineTo(60, h - 8); g.lineTo(150, h - 52); g.fill(); g.stroke();
    g.fillStyle = '#161616'; g.font = `bold 58px ${hand}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(str, w / 2, (h - 50) / 2);
  }, 720, 220, 3.2);
  bubble.position.z = 0.3; scene.add(bubble);

  const caption = textPlane(THREE, (g, w, h) => {
    g.font = `bold 64px ${hand}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.65)'; g.fillStyle = '#fff6d8'; g.strokeText(CAPTION, w / 2, h / 2); g.fillText(CAPTION, w / 2, h / 2);
  }, 1400, 130, 7);
  caption.position.set(0, -3.35, 0.4); caption.paint(); scene.add(caption);

  let shown = null;
  return {
    scene, camera,
    update(t) {
      const beat = BEATS.filter(b => t >= b.from).pop() || BEATS[0], next = BEATS[BEATS.indexOf(beat) + 1];
      const walked = BEATS.reduce((sum, b, i) => { const end = BEATS[i + 1]?.from ?? Infinity; return b.walk ? sum + Math.max(0, Math.min(t, end) - b.from) : sum; }, 0);
      hero.position.x = -5 + walked * 1.2;
      hero.pose({ pose: beat.pose, mood: beat.mood, dir: beat.dir, walk: beat.walk ? t * 7 : null, talk: beat.say ? Math.abs(Math.sin(t * 11)) : 0, blink: t % 3.4 > 3.28 });
      if (beat.say !== shown) { shown = beat.say; if (beat.say) bubble.paint(beat.say); }
      bubble.material.opacity = beat.say ? clamp((t - beat.from) / 0.2) * (next ? clamp((next.from - t) / 0.2) : 1) : 0;
      bubble.position.x = hero.position.x + 1.7; bubble.position.y = 0.55;
      caption.material.opacity = clamp((t - 0.4) / 0.4);
      const z = 15.2 - t * 0.05; camera.position.set(0, 0, z); camera.lookAt(0, 0, 0);
    },
  };
};
