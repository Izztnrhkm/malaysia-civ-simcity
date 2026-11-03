// End-to-end smoke test: builds are served with `vite preview` and driven
// through the real UI in Chromium. Run with `npm run e2e`.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import http from 'node:http';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = 'e2e/screenshots';
const PORT = 4190;
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
let failed = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    const ok = await new Promise((resolve) => {
      http.get(BASE, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

/** Screen position (page coords) of a tile centre. */
async function tileToScreen(page, x, y) {
  return page.evaluate(
    ([x, y]) => {
      const { renderer } = window.__tamadun;
      const c = document.querySelector('[data-testid=game-canvas]');
      const r = c.getBoundingClientRect();
      const wx = (x - y) * 32;
      const wy = (x + y) * 16 + 16;
      const cam = renderer.camera;
      return { x: r.left + (wx - cam.x) * cam.zoom + r.width / 2, y: r.top + (wy - cam.y) * cam.zoom + r.height / 2 };
    },
    [x, y],
  );
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(BASE);
  await page.waitForSelector('[data-testid=main-menu]');
  await page.screenshot({ path: `${OUT}/01-menu.png` });
  check(await page.isVisible('text=Tamadun & Kota'), 'main menu renders');

  await page.fill('[data-testid=city-name]', 'Kota Ujian E2E');
  await page.fill('[data-testid=seed]', '42');
  await page.click('[data-testid=start-game]');
  await page.waitForSelector('[data-testid=topbar]');
  await page.click('[data-testid=speed-0]');
  check((await page.textContent('[data-testid=topbar]')).includes('Kota Ujian E2E'), 'game starts with chosen city name');

  // find a valid harbour site near the river mouth and centre the camera there
  const site = await page.evaluate(() => {
    const { engine, renderer } = window.__tamadun;
    const m = engine.state.map;
    let mouth = [20, 64];
    let bx = 1e9;
    for (let i = 0; i < m.terrain.length; i++)
      if (m.terrain[i] === 5) {
        const x = i % m.width;
        if (x < bx) {
          bx = x;
          mouth = [x, (i / m.width) | 0];
        }
      }
    for (let r = 0; r < 30; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = mouth[0] + dx;
          const y = mouth[1] - 3 + dy;
          if (engine.checkBuilding('pelabuhan', x, y).ok) {
            renderer.centerOn(x + 6, y + 2);
            renderer.camera = { ...renderer.camera, zoom: 1 };
            engine.emit();
            return { x, y };
          }
        }
    return null;
  });
  check(!!site, 'found a coastal harbour site');
  const money0 = await page.evaluate(() => window.__tamadun.engine.state.money);

  // place the harbour through the build menu
  await page.click('[data-testid=cat-trade]');
  await page.click('[data-testid=build-pelabuhan]');
  let p = await tileToScreen(page, site.x, site.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  const after = await page.evaluate(() => ({ b: window.__tamadun.engine.state.buildings.map((b) => b.def), money: window.__tamadun.engine.state.money }));
  check(after.b.includes('pelabuhan'), 'harbour placed with the mouse');
  check(after.money < money0, 'construction cost was charged');
  await page.keyboard.press('Escape');

  // drag a road eastwards from the harbour
  await page.click('[data-testid=tool-transport-road]');
  const a = await tileToScreen(page, site.x + 2, site.y + 1);
  const b = await tileToScreen(page, site.x + 16, site.y + 1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  const roads = await page.evaluate(() => Array.from(window.__tamadun.engine.state.map.transport).filter((t) => t === 1).length);
  check(roads >= 10, `road dragged (${roads} tiles)`);

  // zone kampung on both sides of the road
  await page.click('[data-testid=tool-zone-R]');
  for (const dy of [-2, 2]) {
    const z1 = await tileToScreen(page, site.x + 3, site.y + 1 + dy);
    const z2 = await tileToScreen(page, site.x + 15, site.y + 1 + (dy > 0 ? dy + 1 : dy + 1));
    await page.mouse.move(z1.x, z1.y);
    await page.mouse.down();
    await page.mouse.move(z2.x, z2.y, { steps: 6 });
    await page.mouse.up();
  }
  const zoned = await page.evaluate(() => Array.from(window.__tamadun.engine.state.map.zone).filter((z) => z === 1).length);
  check(zoned >= 20, `residential zoned (${zoned} tiles)`);

  // food and research
  await page.evaluate(() => {
    const { engine } = window.__tamadun;
    const m = engine.state.map;
    const b = engine.state.buildings[0];
    for (let r = 2; r < 25; r++) {
      let done = 0;
      for (let dy = -r; dy <= r && done < 2; dy++)
        for (let dx = -r; dx <= r && done < 2; dx++)
          if (engine.checkBuilding('sawah', b.x + dx, b.y + dy).ok) {
            engine.placeBuilding('sawah', b.x + dx, b.y + dy);
            done++;
          }
      if (done) break;
    }
    void m;
  });
  await page.click('[data-testid=open-tech]');
  await page.click('[data-testid=research-navigasi_monsun]');
  check((await page.evaluate(() => window.__tamadun.engine.state.research.current)) === 'navigasi_monsun', 'research chosen in the tech tree');
  await page.click('[data-testid=modal-close]');

  // run time
  const tick0 = await page.evaluate(() => window.__tamadun.engine.state.tick);
  await page.click('[data-testid=speed-3]');
  await page.waitForTimeout(5000);
  await page.click('[data-testid=speed-0]');
  const st = await page.evaluate(() => ({ tick: window.__tamadun.engine.state.tick, pop: window.__tamadun.engine.state.derived.population, year: window.__tamadun.engine.state.year }));
  check(st.tick > tick0 + 15, `simulation advanced ${st.tick - tick0} ticks`);
  check(st.pop > 0, `kampung grew (population ${st.pop})`);
  await page.screenshot({ path: `${OUT}/02-playing.png` });

  // overlays and inspector
  await page.selectOption('[data-testid=overlay-select]', 'landValue');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03-overlay.png` });
  await page.selectOption('[data-testid=overlay-select]', 'none');
  await page.click('[data-testid=tool-inspect]');
  p = await tileToScreen(page, site.x, site.y);
  await page.mouse.click(p.x, p.y);
  check(await page.isVisible('[data-testid=info-panel]'), 'inspector shows the selected tile');

  // open every panel
  for (const id of ['civics', 'diplomacy', 'economy', 'encyclopedia']) {
    await page.click(`[data-testid=open-${id}]`);
    check(await page.isVisible('[role=dialog]'), `${id} panel opens`);
    if (id === 'encyclopedia') await page.screenshot({ path: `${OUT}/04-sejarahpedia.png` });
    if (id === 'diplomacy') await page.screenshot({ path: `${OUT}/05-diplomacy.png` });
    await page.click('[data-testid=modal-close]');
  }
  await page.click('[data-testid=open-tech]');
  await page.screenshot({ path: `${OUT}/06-tech.png` });
  await page.click('[data-testid=modal-close]');

  // save, reload, load
  await page.click('[data-testid=open-save]');
  await page.click('[data-testid=save-slot1]');
  await page.click('[data-testid=modal-close]');
  const savedTick = await page.evaluate(() => window.__tamadun.engine.state.tick);
  await page.reload();
  await page.waitForSelector('[data-testid=main-menu]');
  await page.click('[data-testid=menu-load]');
  await page.click('[data-testid=load-slot1]');
  await page.waitForSelector('[data-testid=topbar]');
  const loaded = await page.evaluate(() => ({ tick: window.__tamadun.engine.state.tick, name: window.__tamadun.engine.state.name, b: window.__tamadun.engine.state.buildings.length }));
  check(loaded.tick === savedTick && loaded.name === 'Kota Ujian E2E' && loaded.b >= 1, 'saved game restored after page reload');

  // language toggle
  await page.click('[data-testid=open-settings]');
  await page.click('[data-testid=lang-en]');
  await page.click('[data-testid=modal-close]');
  check(await page.isVisible('text=Diplomacy'), 'UI switched to English');
  await page.screenshot({ path: `${OUT}/07-english.png` });

  check(errors.length === 0, `no console/page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await browser.close();
} catch (e) {
  console.error(e);
  failed++;
} finally {
  server.kill();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll E2E checks passed');
process.exit(failed ? 1 : 0);
