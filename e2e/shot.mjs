// quick visual check: node e2e/shot.mjs <outdir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? 'e2e/screenshots';
const server = spawn('npx', ['vite', 'preview', '--port', '4180', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:4180/');
await page.evaluate(() => localStorage.setItem('tamadun-kota:view', '2d')); // classic 2D shots
await page.reload();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/menu.jpg`, type: 'jpeg', quality: 82 });
await page.fill('[data-testid=seed]', '42');
await page.click('[data-testid=start-game]');
await page.waitForTimeout(800);
// script a small city through the engine for a visual check
await page.evaluate(async () => {
  const { engine, renderer, setSpeed } = window.__tamadun;
  setSpeed(0);
  const e = engine;
  e.state.money = 1e7;
  const m = e.state.map;
  let mouth = [20, 64], bx = 1e9;
  for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === 5) { const x = i % m.width; if (x < bx) { bx = x; mouth = [x, (i / m.width) | 0]; } }
  const find = (id, cx, cy, R = 30) => { for (let r = 0; r <= R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (e.checkBuilding(id, cx + dx, cy + dy).ok) return [cx + dx, cy + dy]; } return null; };
  const place = (id, cx, cy) => { const p = find(id, cx, cy); if (p) e.placeBuilding(id, p[0], p[1]); return p; };
  const port = place('pelabuhan', mouth[0], mouth[1] - 3);
  const [px, py] = port;
  for (const y of [py - 5, py + 1, py + 7]) e.buildTransport('road', px + 2, y, px + 30, y);
  for (let x = px + 2; x <= px + 30; x += 7) e.buildTransport('road', x, py - 5, x, py + 7);
  e.zone('R', px + 3, py - 4, px + 20, py - 3);
  e.zone('C', px + 3, py + 2, px + 14, py + 3);
  e.zone('I', px + 22, py + 2, px + 30, py + 3);
  e.zone('R', px + 3, py - 1, px + 29, py);
  for (const id of ['pasar', 'surau', 'masjid', 'istana', 'candi', 'gudang', 'syahbandar', 'madrasah', 'balai', 'taman', 'limbungan']) {
    e.state.research.done.push('sistem_gudang', 'tulisan_jawi', 'pembinaan_jong', 'navigasi_monsun');
    e.state.civics.done.push('kesultanan_melaka', 'gotong_royong', 'islam_melaka', 'kedah_tua', 'empat_syahbandar');
    place(id, px + 10, py - 9);
  }
  for (let k = 0; k < 4; k++) place('sawah', px + 8 + k * 3, py + 10);
  place('nelayan', mouth[0], mouth[1] + 2);
  for (let i = 0; i < m.zone.length; i++) if (m.zone[i]) { m.density[i] = 1 + (i % 2); m.style[i] = 1; }
  e.updateDerivedOnly();
  renderer.centerOn(px + 12, py);
  renderer.camera = { ...renderer.camera, zoom: 1.1 };
  e.emit();
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/era1.jpg`, type: 'jpeg', quality: 82 });
await page.evaluate(() => { const { engine, renderer } = window.__tamadun; const b = engine.state.buildings[0]; renderer.centerOn(b.x + 16, b.y + 4); renderer.camera = { ...renderer.camera, zoom: 2.2 }; const m = engine.state.map; const out = []; for (let y = b.y; y < b.y + 9; y++) { let s=''; for (let x = b.x + 10; x < b.x + 24; x++) { const i = y*m.width+x; s += m.terrain[i] + (m.transport[i]?'r':m.zone[i]?'z':'.') + ' '; } out.push(s);} window.__dump = out; engine.emit(); });
await page.waitForTimeout(500);

await page.screenshot({ path: `${out}/era1-closeup.jpg`, type: 'jpeg', quality: 82 });
console.log('errors:', JSON.stringify(errors));
await browser.close();
server.kill();
