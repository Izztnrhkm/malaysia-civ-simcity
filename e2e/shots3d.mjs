// 3D showcase screenshots for the README: node e2e/shots3d.mjs <outdir> [quality]
// Builds a showcase city for each era through the engine, then frames it in the 3D view.
import { frames, launch, startServer, watchErrors } from './lib.mjs';

const out = process.argv[2] ?? 'e2e/screenshots';
const quality = process.argv[3] ?? 'low';
const { server, base } = await startServer(4185);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = watchErrors(page);
await page.goto(base);
await page.evaluate((q) => localStorage.setItem('tamadun-kota:gfx', q), quality);
await page.reload();
await page.fill('[data-testid=seed]', '42');
await page.click('[data-testid=start-game]');
await page.waitForSelector('[data-testid=game-canvas-3d]');
await page.click('[data-testid=speed-0]');
await page.click('[data-testid=toolbar-collapse]');
await page.addStyleTag({ content: '[data-testid=notifications],[data-testid=minimap],[data-testid=view-controls]{display:none!important}' });
// wait for the Blender .glb models
await page.evaluate(async () => {
  for (let i = 0; i < 100 && !(window.__tamadun.controller.current?.view?.world?.lib?.glbLoaded > 0); i++) await new Promise((r) => setTimeout(r, 100));
});

const shots = [
  { era: 1, name: '3d-era1', focus: [10, -3], rot: 0, dist: 1.0 },
  { era: 2, name: '3d-era2', focus: [16, -6], rot: -0.4, dist: 1.0 },
  { era: 3, name: '3d-era3', focus: [16, -6], rot: 0.5, dist: 1.0 },
  { era: 4, name: '3d-era4', focus: [18, -10], rot: -0.6, dist: 0.7, polar: 0.75 },
  { era: 4, name: '3d-era4-night', focus: [18, -10], rot: 0.9, dist: 0.8, night: true },
];
for (const shot of shots) {
  await page.evaluate((shot) => {
    const { engine: e } = window.__tamadun;
    const s = e.state;
    const era = shot.era;
    s.money = 1e9;
    s.era = era;
    s.crisis = null;
    const m = s.map;
    s.buildings = [];
    m.building.fill(-1);
    m.transport.fill(0);
    m.zone.fill(0);
    m.density.fill(0);
    let mouth = [20, 64], bx = 1e9;
    for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === 5) { const x = i % m.width; if (x < bx) { bx = x; mouth = [x, (i / m.width) | 0]; } }
    const all = ['sistem_gudang','peleburan_besi','pendulangan','pertanian_lada','tulisan_jawi','pembinaan_jong','navigasi_monsun','kapal_wap','kereta_api','getah_para','perlombongan_timah','kapal_korek','seni_bina_moorish','pendidikan','perubatan_tropika','telegraf','elektrik_negara','bekalan_air','kuasa_hidro','semikonduktor','kontena','lebuhraya','automotif','pengajian_tinggi','kesihatan_luar_bandar','internet','msc_koridor','pengkomputeran_awan','mrt','penerbangan','tenaga_solar','teknologi_hijau','pencakar_langit'];
    s.research.done = all;
    s.civics.done = ['pentadbiran_residen','kemerdekaan','felda','gotong_royong','kedah_tua','islam_melaka','empat_syahbandar','kesultanan_melaka','pembentukan_malaysia'];
    const find = (id, cx, cy, R = 40) => { for (let r = 0; r <= R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (e.checkBuilding(id, cx + dx, cy + dy).ok) return [cx + dx, cy + dy]; } return null; };
    const place = (id, cx, cy) => { const p = find(id, cx, cy); if (p) e.placeBuilding(id, p[0], p[1]); return p; };
    const port = place(era === 1 ? 'pelabuhan' : era === 2 ? 'pelabuhan_dagang' : 'pelabuhan_kontena', mouth[0], mouth[1] - 3);
    const [px, py] = port;
    for (const y of [py - 6, py + 6]) e.buildTransport('road', px + 3, y, px + 30, y);
    e.buildTransport(era >= 3 ? 'highway' : 'road', px + 3, py, px + 30, py);
    for (let x = px + 6; x <= px + 30; x += 8) e.buildTransport('road', x, py - 6, x, py + 6);
    if (era >= 2) e.buildTransport('rail', px + 3, py - 9, px + 36, py - 9);
    if (era === 4) e.buildTransport('mrt', px + 3, py + 9, px + 32, py + 9);
    e.zone('R', px + 4, py - 5, px + 29, py - 4);
    e.zone('C', px + 4, py - 2, px + 29, py - 1);
    e.zone('I', px + 4, py + 1, px + 29, py + 2);
    e.zone('R', px + 4, py + 4, px + 29, py + 5);
    const maxD = [0, 2, 3, 4, 4][era];
    for (let i = 0; i < m.zone.length; i++) if (m.zone[i]) { const x = i % m.width; m.density[i] = 1 + Math.min(maxD - 1, Math.floor(((x - px) / 26) * maxD)); m.style[i] = era === 4 && x < px + 12 ? 3 : era; }
    const sets = {
      1: ['pasar', 'masjid', 'istana', 'candi', 'syahbandar', 'menara_tinjau', 'gudang', 'limbungan', 'sawah', 'madrasah', 'kebun_lada'],
      2: ['stesen', 'bangunan_moorish', 'sekolah', 'hospital', 'pejabat_pos', 'estet_getah', 'lombong', 'kapal_korek'],
      3: ['parlimen', 'janakuasa', 'loji_air', 'universiti', 'ftz', 'kilang_kereta', 'stadium', 'ladang_sawit', 'tebatan_banjir'],
      4: ['menara_berkembar', 'menara_118', 'pusat_data', 'hab_inovasi', 'stesen_mrt', 'ladang_solar', 'menara_telekom', 'lapangan_terbang'],
    }[era];
    for (const id of sets) place(id, px + 14, py - 12);
    e.refreshNetwork();
    e.updateDerivedOnly();
    e.emit();
    const v = window.__tamadun.controller.current.view;
    v.setDayMode(shot.night ? 'night' : 'day');
    v.world.timeOfDay = shot.night ? 0.86 : 0.36;
    v.resetCamera();
    v.centerOn(px + shot.focus[0], py + shot.focus[1]);
    v.rotateBy(shot.rot);
    v.zoomBy(1 / shot.dist);
    if (shot.polar) {
      // raise the camera: clamp the orbit's polar angle once, then restore the limit
      v.controls.minPolarAngle = shot.polar;
      v.controls.update();
      v.controls.minPolarAngle = 0.05;
    }
  }, shot);
  await frames(page, 20);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${shot.name}.jpg`, type: 'jpeg', quality: 84, timeout: 120000 });
  console.log('wrote', `${out}/${shot.name}.jpg`);
}
console.log('errors:', JSON.stringify(errors));
await browser.close();
server.kill();
