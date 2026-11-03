// Free 2D cartoon cast for Three.js scenes: stick figures, soldiers and talking country faces, drawn on canvas textures.
// Every drawing is a pure function of its inputs, so a frame renders the same way each time.

const MOODS = {
  neutral: { brow: 0, mouth: 4, open: 0 },
  happy: { brow: -0.15, mouth: 16, open: 12 },
  smug: { brow: 0.12, mouth: 10, open: 0 },
  angry: { brow: 0.55, mouth: -12, open: 8 },
  worried: { brow: -0.5, mouth: -8, open: 6 },
  sad: { brow: -0.4, mouth: -16, open: 0 },
  shocked: { brow: -0.6, mouth: 0, open: 26 },
};

// g is a 2D canvas context. r = head radius; talk 0..1 opens the mouth
export function drawFace(g, x, y, r, { skin = '#fff', mood = 'neutral', look = 0, talk = 0, blink = false, ink = '#161616' } = {}) {
  const m = MOODS[mood] || MOODS.neutral, ex = r * 0.36, ey = -r * 0.1, er = r * 0.09;
  g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ink;
  g.fillStyle = skin; g.lineWidth = r * 0.07; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
  for (const s of [-1, 1]) {
    const cx = s * ex + look * r * 0.1;
    if (blink) { g.beginPath(); g.moveTo(cx - er, ey); g.lineTo(cx + er, ey); g.stroke(); }
    else { g.fillStyle = ink; g.beginPath(); g.arc(cx, ey, er, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(cx - r * 0.2, ey - r * 0.3 + s * m.brow * r * 0.12); g.lineTo(cx + r * 0.2, ey - r * 0.3 - s * m.brow * r * 0.12); g.stroke();
  }
  const my = r * 0.42, w = r * 0.32, open = m.open + talk * 16;
  g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(-w, my); g.quadraticCurveTo(0, my + m.mouth * (r / 50) * 1.4, w, my);
  if (open > 1) { g.quadraticCurveTo(0, my + (m.mouth + open) * (r / 50) * 1.4, -w, my); g.fillStyle = '#5a2020'; g.fill(); }
  g.stroke(); g.restore();
}

const HAIR = {
  none: () => {},
  short: (g, r) => { g.beginPath(); g.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.95); g.quadraticCurveTo(0, -r * 0.62, -r * 0.98, -r * 0.16); g.closePath(); g.fill(); g.stroke(); },
  spiky: (g, r) => { g.beginPath(); for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.16 + 0.68 * i / 8), k = i % 2 ? 1.34 : 0.98; g.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } g.closePath(); g.fill(); g.stroke(); },
  long: (g, r) => { g.beginPath(); g.arc(0, 0, r * 1.06, Math.PI * 0.72, Math.PI * 2.28); g.quadraticCurveTo(r * 0.5, -r * 0.5, 0, -r * 0.5); g.quadraticCurveTo(-r * 0.5, -r * 0.5, -r * 0.8, r * 0.7); g.fill(); g.stroke(); },
};
const HATS = {
  none: () => {},
  helmet: (g, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(0, -r * 0.2, r * 1.02, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#c8342f'; g.beginPath(); g.ellipse(0, -r * 1.35, r * 0.72, r * 0.2, 0, 0, Math.PI * 2); g.fill(); g.stroke(); },
  crown: (g, r) => { g.fillStyle = '#d6a53a'; g.beginPath(); g.moveTo(-r * 0.75, -r * 0.6); g.lineTo(-r * 0.9, -r * 1.4); g.lineTo(-r * 0.4, -r); g.lineTo(0, -r * 1.5); g.lineTo(r * 0.4, -r); g.lineTo(r * 0.9, -r * 1.4); g.lineTo(r * 0.75, -r * 0.6); g.closePath(); g.fill(); g.stroke(); },
  cap: (g, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(0, -r * 0.3, r * 0.94, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, -r * 0.3); g.lineTo(r * 1.5, -r * 0.3); g.stroke(); },
};

// joint targets as [shoulder/hip angle, elbow/knee bend] in radians; 0 points straight down, and arms are mirrored by side
const POSES = {
  stand: { arm: [[0.26, 0.1], [0.26, 0.1]], leg: [[0.08, 0], [0.08, 0]] },
  point: { arm: [[1.5, 0], [0.26, 0.1]], leg: [[0.08, 0], [0.08, 0]] },
  cheer: { arm: [[2.15, 0.15], [2.15, 0.15]], leg: [[0.14, 0], [0.14, 0]] },
  think: { arm: [[0.6, 2.2], [0.26, 0.1]], leg: [[0.08, 0], [0.08, 0]] },
  sad: { arm: [[0.12, 0], [0.12, 0]], leg: [[0.05, 0], [0.05, 0]] },
};

const limb = (g, x, y, a, bend, seg) => {
  const kx = x + Math.sin(a) * seg, ky = y + Math.cos(a) * seg, hx = kx + Math.sin(a - bend) * seg, hy = ky + Math.cos(a - bend) * seg;
  g.beginPath(); g.moveTo(x, y); g.lineTo(kx, ky); g.lineTo(hx, hy); g.stroke(); return [hx, hy];
};

// a full figure standing on (x, y). o = {height, skin, hair, hairColor, hat, hatColor, shirt, ink, pose, mood, look, talk, walk, blink, prop}
export function drawFigure(g, x, y, o = {}) {
  const { height = 600, skin = '#fff', hair = 'short', hairColor = '#222', hat = 'none', hatColor = '#8a6a48', shirt = null, ink = '#161616', pose = 'stand', mood = 'neutral', look = 0, talk = 0, walk = null, blink = false } = o;
  const r = height * 0.17, seg = height * 0.16, hipY = -seg * 2, neckY = hipY - height * 0.3, bob = walk === null ? 0 : Math.abs(Math.sin(walk)) * height * 0.012;
  g.save(); g.translate(x, y - bob); g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = height * 0.016;
  const P = POSES[pose] || POSES.stand, swing = walk === null ? 0 : Math.sin(walk) * 0.55;
  limb(g, 0, hipY, -P.leg[0][0] - swing, walk === null ? P.leg[0][1] : Math.max(0, swing) * -0.8, seg);
  limb(g, 0, hipY, P.leg[1][0] + swing, walk === null ? P.leg[1][1] : Math.max(0, -swing) * 0.8, seg);
  if (shirt) { g.fillStyle = shirt; g.beginPath(); g.moveTo(-height * 0.075, neckY + r * 0.3); g.lineTo(height * 0.075, neckY + r * 0.3); g.lineTo(height * 0.1, hipY + height * 0.03); g.lineTo(-height * 0.1, hipY + height * 0.03); g.closePath(); g.fill(); g.stroke(); }
  else { g.beginPath(); g.moveTo(0, neckY); g.lineTo(0, hipY); g.stroke(); }
  const sh = neckY + height * 0.05;
  const sx = height * 0.075;
  limb(g, -sx, sh, -P.arm[1][0] + (walk === null ? 0 : -swing * 0.8), -P.arm[1][1], seg * 1.08);
  limb(g, sx, sh, P.arm[0][0] + (walk === null ? 0 : swing * 0.8), P.arm[0][1], seg * 1.08);
  const hy = neckY - r * 0.82;
  drawFace(g, 0, hy, r, { skin, mood, look, talk, blink, ink });
  g.save(); g.translate(0, hy); g.fillStyle = hairColor; g.lineWidth = r * 0.06; if (hat === 'none') HAIR[hair]?.(g, r); HATS[hat]?.(g, r, hatColor); g.restore();
  g.restore();
}

// a Three.js plane that redraws one character. spec = drawFigure options; call .pose(state) each frame
export function makeCharacter(THREE, spec, worldHeight = 2) {
  const W = 512, H = 768, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldHeight * W / H, worldHeight), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02 }));
  mesh.pose = (state = {}) => { g.clearRect(0, 0, W, H); drawFigure(g, W / 2, H - 16, { ...spec, ...state, height: H * 0.8 }); tex.needsUpdate = true; mesh.scale.x = state.dir === -1 ? -1 : 1; };
  mesh.material.side = THREE.DoubleSide; mesh.pose(); return mesh;
}

// a face plane to lay on a country or empire on a map. Call .pose(state) each frame
export function makeFaceTag(THREE, spec = {}, size = 1) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
  mesh.pose = (state = {}) => { g.clearRect(0, 0, S, S); const o = { ...spec, ...state }; drawFace(g, S / 2, S * 0.56, S * 0.33, o); g.save(); g.translate(S / 2, S * 0.56); g.strokeStyle = '#161616'; g.lineWidth = 6; g.lineJoin = 'round'; HATS[o.hat || 'none'](g, S * 0.33, o.hatColor || '#8a6a48'); g.restore(); tex.needsUpdate = true; };
  mesh.pose(); return mesh;
}
