#!/usr/bin/env node
// Deterministic Three.js video renderer: draws each frame at an exact time in headless Chromium and pipes it to ffmpeg.
// Run from a folder whose node_modules has three, playwright, topojson-client and world-atlas.
//   node <skill>/scripts/render_three.mjs --scene scene.js --duration 30 --out silent.mp4
//   node <skill>/scripts/render_three.mjs --scene scene.js --at 1,5,9 --out stills/
// Options: --fps 24  --width 1920  --height 1080  --crf 18
// A scene is an ES module: export default async ({ THREE, renderer, width, height }) => ({ scene, camera, update(t) {} })
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const args = {}; { const a = process.argv.slice(2); for (let i = 0; i < a.length; i += 2) args[a[i].replace(/^--/, '')] = a[i + 1]; }
if (!args.scene || !args.out || !(args.duration || args.at)) { console.error('usage: render_three.mjs --scene scene.js --out FILE (--duration SECONDS | --at T1,T2)'); process.exit(1); }
const { chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright');
const ROOT = process.cwd(), SCENE = path.resolve(args.scene), fps = +(args.fps || 24), width = +(args.width || 1920), height = +(args.height || 1080);

const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","topojson-client":"/node_modules/topojson-client/src/index.js"}}</script>
<script type="module">
import * as THREE from 'three';
import make from '/__scene/${path.basename(SCENE)}';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(${width}, ${height}); document.body.append(renderer.domElement);
const s = await make({ THREE, renderer, width: ${width}, height: ${height} });
await document.fonts.ready;
window.__frame = (t) => { s.update(t); renderer.render(s.scene, s.camera); return renderer.domElement.toDataURL('image/jpeg', 0.96).split(',')[1]; };
window.__ready = true;
</script>`;
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  const inScene = url.startsWith('/__scene/'), base = inScene ? path.dirname(SCENE) : ROOT;   // the scene folder is served so its relative imports work
  const file = path.resolve(path.join(base, inScene ? url.slice(9) : url));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const grab = async (t) => Buffer.from(await page.evaluate(v => window.__frame(v), t), 'base64');

if (args.at) {
  fs.mkdirSync(args.out, { recursive: true });
  for (const t of String(args.at).split(',').map(Number)) { fs.writeFileSync(path.join(args.out, `t${t}.jpg`), await grab(t)); console.log(`still at ${t}s`); }
} else {
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', fps, '-i', '-', '-c:v', 'libx264', '-crf', args.crf || 18, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', args.out].map(String), { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(+args.duration * fps);
  for (let i = 0; i < total; i++) {
    if (!ff.stdin.write(await grab(i / fps))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (fps * 5) === 0) console.log(`frame ${i}/${total}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`wrote ${args.out}`);
}
await browser.close(); server.close();
