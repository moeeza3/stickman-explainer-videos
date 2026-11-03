// Tilted parchment map with a growing route, marching tokens and timed labels. Copy this file, then edit the block below.
// Real coastlines come from world-atlas, drawn as one landmass so no modern borders appear.
import { feature } from 'topojson-client';

// ---------- edit for each video ----------
const VIEW = [20, 15, 90, 50];                       // west, south, east, north, in degrees
const ROUTE = [[23, 38], [36, 37], [44, 33], [53, 30], [66, 33], [75, 31]];   // [lon, lat] stops in travel order
const MARCH = [2, 12];                               // seconds when the route starts and finishes growing
const LABELS = [{ text: 'Example city', at: [44, 33], from: 4, to: 8 }];      // text, [lon, lat], visible seconds
const CAMERA = [[0, 48, 33, 6, 0.55], [6, 44, 33, 5, 0.75], [12, 66, 32, 5, 0.75]];  // seconds, lon, lat, height, tilt
const COLORS = { sea: '#5d8c90', land: '#cfb886', coast: '#3b3322', route: '#c8342f', token: '#2f2a4a', label: '#fff6d8' };
// -----------------------------------------

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { const k = clamp(v); return k * k * (3 - 2 * k); };
const MAP_W = 16, MAP_H = MAP_W * (VIEW[3] - VIEW[1]) / ((VIEW[2] - VIEW[0]) * Math.cos(((VIEW[1] + VIEW[3]) / 2) * Math.PI / 180));
const toWorld = (lon, lat) => [((lon - VIEW[0]) / (VIEW[2] - VIEW[0]) - 0.5) * MAP_W, ((lat - VIEW[1]) / (VIEW[3] - VIEW[1]) - 0.5) * MAP_H];

function paper(size) {   // layered random blotches, used for parchment mottling and relief
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const r = 4 + Math.random() * size * (i < 300 ? 0.09 : 0.012), v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.012 + Math.random() * 0.03})`; g.beginPath(); g.arc(Math.random() * size, Math.random() * size, r, 0, 7); g.fill();
  }
  const soft = document.createElement('canvas'); soft.width = soft.height = size;   // one blur at the end hides the circles
  const s = soft.getContext('2d'); s.filter = 'blur(12px)'; s.drawImage(c, 0, 0); return soft;
}

async function mapTexture(THREE) {
  const topo = await (await fetch('/node_modules/world-atlas/land-50m.json')).json();
  const land = feature(topo, topo.objects.land).features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
  const W = 4096, H = Math.round(W * MAP_H / MAP_W), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), X = (lon) => (lon - VIEW[0]) / (VIEW[2] - VIEW[0]) * W, Y = (lat) => (1 - (lat - VIEW[1]) / (VIEW[3] - VIEW[1])) * H;
  g.fillStyle = COLORS.sea; g.fillRect(0, 0, W, H);
  const path = () => { g.beginPath(); for (const poly of land) { poly[0].forEach(([a, b], i) => (i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b)))); g.closePath(); } };
  g.save(); g.filter = 'blur(14px)'; g.strokeStyle = '#7fa8a6'; g.lineWidth = 34; path(); g.stroke(); g.restore();
  g.fillStyle = COLORS.land; path(); g.fill();
  g.strokeStyle = COLORS.coast; g.lineWidth = 2.5; path(); g.stroke();
  const noise = paper(1024); g.globalCompositeOperation = 'multiply'; g.drawImage(noise, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const bump = new THREE.CanvasTexture(noise);
  return { tex, bump };
}

function labelSprite(THREE, str) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), font = 'bold 72px Georgia, serif';
  g.font = font; c.width = Math.ceil(g.measureText(str).width) + 60; c.height = 120;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.fillStyle = COLORS.label;
  g.strokeText(str, c.width / 2, 60); g.fillText(str, c.width / 2, 60);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(c.width / 120 * 0.32, 0.32, 1); return s;
}

export default async ({ THREE, width, height }) => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(COLORS.sea);
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100); camera.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight('#fff4dc', '#5a4a38', 1.5));
  const sun = new THREE.DirectionalLight('#ffe9c4', 2.2); sun.position.set(-6, -4, 8); scene.add(sun);

  const { tex, bump } = await mapTexture(THREE);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 1.2, roughness: 0.95 })));

  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([a, b]) => new THREE.Vector3(...toWorld(a, b), 0.03)));
  const tube = new THREE.TubeGeometry(curve, 400, 0.022, 8, false), total = tube.index.count;
  scene.add(new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ color: COLORS.route, roughness: 0.5 })));

  const COUNT = 24, geo = new THREE.ConeGeometry(0.035, 0.11, 10); geo.rotateX(Math.PI / 2);
  const tokens = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.token, roughness: 0.6 }), COUNT), m = new THREE.Matrix4();
  tokens.frustumCulled = false; scene.add(tokens);

  const labels = LABELS.map((l) => { const s = labelSprite(THREE, l.text); s.position.set(...toWorld(...l.at), 0.3); scene.add(s); return { ...l, s }; });

  function cameraAt(t) {
    let i = 0; while (i < CAMERA.length - 2 && t > CAMERA[i + 1][0]) i++;
    const a = CAMERA[i], b = CAMERA[i + 1], k = smooth((t - a[0]) / (b[0] - a[0])), v = a.map((n, j) => n + (b[j] - n) * k);
    const [x, y] = toWorld(v[1], v[2]), h = v[3], tilt = v[4];
    camera.position.set(x, y - h * Math.sin(tilt), h * Math.cos(tilt)); camera.lookAt(x, y, 0);
  }

  return {
    scene, camera,
    update(t) {
      const p = smooth((t - MARCH[0]) / (MARCH[1] - MARCH[0]));
      tube.setDrawRange(0, Math.floor(total * p / 3) * 3);
      for (let i = 0; i < COUNT; i++) {
        const u = p - i * 0.006, q = curve.getPointAt(clamp(u)), side = ((i % 3) - 1) * 0.06;
        m.makeTranslation(q.x + side, q.y - side, u > 0 ? 0.06 + Math.abs(Math.sin(t * 7 + i)) * 0.015 : -1);
        tokens.setMatrixAt(i, m);
      }
      tokens.instanceMatrix.needsUpdate = true;
      for (const l of labels) l.s.material.opacity = smooth((t - l.from) / 0.4) * (1 - smooth((t - l.to) / 0.4));
      cameraAt(t);
    },
  };
};
