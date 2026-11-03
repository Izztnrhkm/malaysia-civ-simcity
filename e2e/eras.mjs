// Era showcase screenshots: node e2e/eras.mjs <outdir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? 'e2e/screenshots';
const server = spawn('npx', ['vite', 'preview', '--port', '4182', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4182/');
await page.fill('[data-testid=seed]', '42');
await page.click('[data-testid=start-game]');
await page.waitForTimeout(500);
for (const era of [2, 3, 4]) {
  await page.evaluate((era) => {
    const { engine: e, renderer, setSpeed } = window.__tamadun;
    setSpeed(0);
    const s = e.state;
    s.money = 1e9;
    s.era = era;
    const m = s.map;
    // wipe previous showcase
    s.buildings = [];
    m.building.fill(-1);
    m.transport.fill(0);
    m.zone.fill(0);
    m.density.fill(0);
    let mouth = [20, 64], bx = 1e9;
    for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === 5) { const x = i % m.width; if (x < bx) { bx = x; mouth = [x, (i / m.width) | 0]; } }
    const all = ['kapal_wap','kereta_api','getah_para','perlombongan_timah','kapal_korek','seni_bina_moorish','pendidikan','perubatan_tropika','telegraf','elektrik_negara','bekalan_air','kuasa_hidro','semikonduktor','kontena','lebuhraya','automotif','pengajian_tinggi','kesihatan_luar_bandar','internet','msc_koridor','pengkomputeran_awan','mrt','penerbangan','tenaga_solar','teknologi_hijau','pencakar_langit'];
    s.research.done = all;
    s.civics.done = ['pentadbiran_residen','kemerdekaan','felda','gotong_royong'];
    const find = (id, cx, cy, R = 40) => { for (let r = 0; r <= R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (e.checkBuilding(id, cx + dx, cy + dy).ok) return [cx + dx, cy + dy]; } return null; };
    const place = (id, cx, cy) => { const p = find(id, cx, cy); if (p) e.placeBuilding(id, p[0], p[1]); return p; };
    const port = place(era === 2 ? 'pelabuhan_dagang' : 'pelabuhan_kontena', mouth[0], mouth[1] - 3);
    const [px, py] = port;
    const roadKind = era >= 3 ? 'highway' : 'road';
    for (const y of [py - 6, py + 6]) e.buildTransport('road', px + 3, y, px + 34, y);
    e.buildTransport(roadKind, px + 3, py, px + 34, py);
    if (era >= 2) e.buildTransport('rail', px + 3, py - 9, px + 40, py - 9);
    if (era === 4) e.buildTransport('mrt', px + 3, py + 9, px + 34, py + 9);
    e.zone('R', px + 4, py - 5, px + 33, py - 4);
    e.zone('C', px + 4, py - 2, px + 33, py - 1);
    e.zone('I', px + 4, py + 1, px + 33, py + 2);
    e.zone('R', px + 4, py + 4, px + 33, py + 5);
    for (let i = 0; i < m.zone.length; i++) if (m.zone[i]) { const x = i % m.width; m.density[i] = 1 + Math.min(3, Math.floor(((x - px) / 30) * 4)); m.style[i] = era; }
    const sets = {
      2: ['stesen', 'sekolah', 'hospital', 'balai_polis', 'pejabat_pos', 'bangunan_moorish', 'estet_getah', 'lombong', 'kapal_korek'],
      3: ['janakuasa', 'loji_air', 'universiti', 'ftz', 'kilang_kereta', 'klinik_desa', 'stadium', 'ladang_sawit', 'empangan'],
      4: ['pusat_data', 'hab_inovasi', 'ladang_solar', 'stesen_mrt', 'lapangan_terbang', 'menara_telekom', 'kitar_semula', 'menara_berkembar'],
    }[era];
    for (const id of sets) place(id, px + 14, py - 14);
    e.updateDerivedOnly();
    renderer.centerOn(px + 18, py - 4);
    renderer.camera = { ...renderer.camera, zoom: 0.95 };
    e.emit();
    return s.buildings.map((b) => b.def);
  }, era);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/era${era}.jpg`, type: 'jpeg', quality: 82 });
}
console.log('errors:', JSON.stringify(errors));
await browser.close();
server.kill();
