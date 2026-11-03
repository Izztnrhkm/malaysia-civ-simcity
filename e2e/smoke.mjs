// End-to-end smoke test: the production build is served with `vite preview`
// and driven through the real UI in Chromium, in the 3D view (software WebGL)
// and the 2D classic view. Fails on any console error. Run with `npm run e2e`.
import { mkdirSync } from 'node:fs';
import { checker, frames, launch, startServer, tileToScreen, watchErrors } from './lib.mjs';

const OUT = 'e2e/screenshots';
mkdirSync(OUT, { recursive: true });
const { check, failed, fail } = checker();
const { server, base: BASE } = await startServer(4190);

const stats = (page) => page.evaluate(() => window.__tamadun.controller.current?.view?.world?.stats() ?? null);

try {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = watchErrors(page);

  await page.goto(BASE);
  await page.waitForSelector('[data-testid=main-menu]');
  await page.screenshot({ path: `${OUT}/01-menu.png` });
  check(await page.isVisible('text=Tamadun & Kota'), 'main menu renders');
  check((await page.$$('[data-testid^=scenario-]')).length >= 3, 'three starting scenarios offered');

  await page.fill('[data-testid=city-name]', 'Kota Ujian E2E');
  await page.fill('[data-testid=seed]', '42');
  await page.click('[data-testid=scenario-melaka_1400]');
  await page.click('[data-testid=start-game]');
  await page.waitForSelector('[data-testid=topbar]');
  await page.click('[data-testid=speed-0]');
  check((await page.textContent('[data-testid=topbar]')).includes('Kota Ujian E2E'), 'game starts with chosen city name');

  // ---------------- 3D view ----------------
  await page.waitForSelector('[data-testid=game-canvas-3d]');
  check((await page.evaluate(() => window.__tamadun.viewMode)) === '3d', '3D view is the default when WebGL is available');
  check(await page.evaluate(() => !!document.querySelector('[data-testid=game-canvas-3d]').getContext('webgl2')), 'WebGL2 context is live');
  const glb = await page.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      const n = window.__tamadun.controller.current?.view?.world?.lib?.glbLoaded ?? 0;
      if (n > 0) return n;
      await new Promise((r) => setTimeout(r, 100));
    }
    return 0;
  });
  check(glb >= 120, `Blender .glb models loaded with GLTFLoader (${glb})`);
  const s0 = await stats(page);
  check(s0 && s0.chunks === 64 && s0.trees > 1000, `terrain chunks and instanced rainforest rendered (${s0?.trees} trees)`);

  // a harbour site near the river mouth; centre the 3D camera on the future town
  const site = await page.evaluate(() => {
    const { engine } = window.__tamadun;
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
          if (engine.checkBuilding('pelabuhan', x, y).ok) return { x, y };
        }
    return null;
  });
  check(!!site, 'found a coastal harbour site');
  await page.evaluate((s) => window.__tamadun.controller.current.centerOn(s.x + 8, s.y + 1), site);
  await frames(page, 6);
  const money0 = await page.evaluate(() => window.__tamadun.engine.state.money);

  await page.click('[data-testid=cat-trade]');
  await page.click('[data-testid=build-pelabuhan]');
  let p = await tileToScreen(page, site.x, site.y);
  await page.mouse.move(p.x - 30, p.y);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await frames(page, 2);
  const ghost = await stats(page);
  check(ghost.ghost && ghost.preview === 4, '3D ghost preview follows the raycast tile');
  await page.screenshot({ path: `${OUT}/02-ghost.png` });
  await page.mouse.down();
  await page.mouse.up();
  const after = await page.evaluate(() => ({ b: window.__tamadun.engine.state.buildings.map((b) => ({ d: b.def, x: b.x, y: b.y })), money: window.__tamadun.engine.state.money }));
  check(after.b.some((b) => b.d === 'pelabuhan' && b.x === site.x && b.y === site.y), 'harbour placed on the picked tile with the mouse');
  check(after.money < money0, 'construction cost was charged');
  await page.keyboard.press('Escape');

  await page.click('[data-testid=tool-transport-road]');
  const a = await tileToScreen(page, site.x + 2, site.y + 1);
  const b = await tileToScreen(page, site.x + 16, site.y + 1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  const roads = await page.evaluate(() => Array.from(window.__tamadun.engine.state.map.transport).filter((t) => t === 1).length);
  check(roads >= 12, `road dragged in 3D (${roads} tiles)`);

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
  check(zoned >= 20, `residential zoned in 3D (${zoned} tiles)`);
  await page.click('[data-testid=tool-inspect]');

  await page.evaluate(() => {
    const { engine } = window.__tamadun;
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
  });
  await page.click('[data-testid=open-tech]');
  await page.click('[data-testid=research-navigasi_monsun]');
  check((await page.evaluate(() => window.__tamadun.engine.state.research.current)) === 'navigasi_monsun', 'research chosen in the tech tree');
  await page.click('[data-testid=modal-close]');

  const tick0 = await page.evaluate(() => window.__tamadun.engine.state.tick);
  await page.click('[data-testid=speed-3]');
  await page.waitForTimeout(5000);
  await page.click('[data-testid=speed-0]');
  if (await page.isVisible('[data-testid=modal-crisis]')) await page.click('[data-testid=crisis-choice-0]');
  const st = await page.evaluate(() => ({ tick: window.__tamadun.engine.state.tick, pop: window.__tamadun.engine.state.derived.population }));
  check(st.tick > tick0 + 15, `simulation advanced ${st.tick - tick0} ticks with the 3D view running`);
  check(st.pop > 0, `kampung grew (population ${st.pop})`);
  await frames(page, 6);
  const s1 = await stats(page);
  check(s1.zones > 0 && s1.traffic > 0, `3D lots (${s1.zones}) and moving traffic/ships (${s1.traffic}) rendered`);
  await page.screenshot({ path: `${OUT}/03-playing-3d.png` });

  await page.selectOption('[data-testid=overlay-select]', 'landValue');
  await frames(page, 4);
  check((await stats(page)).overlay > 0, '3D land value overlay drawn');
  await page.screenshot({ path: `${OUT}/04-overlay-3d.png` });
  await page.selectOption('[data-testid=overlay-select]', 'none');

  p = await tileToScreen(page, site.x, site.y);
  await page.mouse.click(p.x, p.y);
  check(await page.isVisible('[data-testid=info-panel]'), 'inspector shows the clicked tile in 3D');

  // camera: orbit with the right button, zoom with the wheel, then reset
  const cam0 = await page.evaluate(() => window.__tamadun.controller.current.view.camera.position.toArray());
  await page.mouse.move(720, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(820, 420, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.wheel(0, -400);
  await frames(page, 10);
  const cam1 = await page.evaluate(() => window.__tamadun.controller.current.view.camera.position.toArray());
  check(cam0.some((v, i) => Math.abs(v - cam1[i]) > 0.5), 'orbit/zoom moves the 3D camera');
  await page.click('[data-testid=camera-reset]');
  check(await page.isVisible('[data-testid=camera-reset]'), 'camera reset button available');

  await page.click('[data-testid=toggle-daynight]');
  await page.click('[data-testid=toggle-weather]');
  const nightRain = await page.evaluate(async () => {
    const w = window.__tamadun.controller.current.view.world;
    for (let i = 0; i < 100 && (w.night < 0.9 || w.rain.intensity < 0.5); i++) await new Promise((r) => setTimeout(r, 100));
    return { night: w.night, rain: w.rain.intensity, glow: w.lib.materials.window.emissiveIntensity };
  });
  check(nightRain.night > 0.6 && nightRain.glow > 0.6, `night falls and windows glow (night ${nightRain.night.toFixed(2)})`);
  check(nightRain.rain > 0.3, `monsoon rain falls (${nightRain.rain.toFixed(2)})`);
  await page.screenshot({ path: `${OUT}/05-night-rain-3d.png` });
  await page.click('[data-testid=toggle-daynight]');
  await page.click('[data-testid=toggle-daynight]');
  await page.click('[data-testid=toggle-weather]');

  // sound: unlocks Web Audio from the click and toggles mute
  await page.click('[data-testid=sound-button]');
  check((await page.getAttribute('[data-testid=sound-button]', 'aria-pressed')) === 'true', 'sound mutes');
  await page.click('[data-testid=sound-button]');
  check((await page.getAttribute('[data-testid=sound-button]', 'aria-pressed')) === 'false', 'sound unmutes');

  // panels, including the new advisors and timeline
  await page.evaluate(() => (window.__tamadun.engine.state.money += 5000));
  for (const id of ['civics', 'advisors', 'diplomacy', 'economy', 'timeline', 'encyclopedia']) {
    await page.click(`[data-testid=open-${id}]`);
    check(await page.isVisible('[role=dialog]'), `${id} panel opens`);
    if (id === 'advisors') {
      await page.click('[data-testid=recruit-tun_perak]');
      check((await page.evaluate(() => window.__tamadun.engine.state.advisors)).includes('tun_perak'), 'advisor Tun Perak recruited');
      await page.screenshot({ path: `${OUT}/06-advisors.png` });
    }
    if (id === 'timeline') await page.screenshot({ path: `${OUT}/07-timeline.png` });
    await page.click('[data-testid=modal-close]');
  }

  // a historical crisis with a policy choice
  await page.evaluate(() => {
    const { engine } = window.__tamadun;
    engine.state.era = 2;
    engine.state.year = 1926;
    engine.tick();
  });
  await page.waitForSelector('[data-testid=modal-crisis]');
  check(await page.isVisible('text=1926'), 'the 1926 Great Flood crisis asks for a decision');
  await page.screenshot({ path: `${OUT}/08-crisis.png` });
  await page.click('[data-testid=crisis-choice-2]');
  check((await page.evaluate(() => window.__tamadun.engine.state.crisis)) === null, 'crisis resolved from the dialog');
  await page.evaluate(() => {
    const { engine } = window.__tamadun;
    engine.state.era = 1;
    engine.state.year = 1460;
  });

  // ---------------- 2D classic view ----------------
  await page.click('[data-testid=toggle-view]');
  await page.waitForSelector('[data-testid=game-canvas]');
  check((await page.evaluate(() => window.__tamadun.viewMode)) === '2d', 'switched to the 2D classic view');
  await page.evaluate((s) => window.__tamadun.controller.current.centerOn(s.x + 8, s.y + 4), site);
  await page.click('[data-testid=tool-transport-road]');
  const r2a = await tileToScreen(page, site.x + 4, site.y + 6);
  const r2b = await tileToScreen(page, site.x + 12, site.y + 6);
  const roadsBefore = await page.evaluate(() => Array.from(window.__tamadun.engine.state.map.transport).filter((t) => t === 1).length);
  await page.mouse.move(r2a.x, r2a.y);
  await page.mouse.down();
  await page.mouse.move(r2b.x, r2b.y, { steps: 6 });
  await page.mouse.up();
  const roads2 = await page.evaluate(() => Array.from(window.__tamadun.engine.state.map.transport).filter((t) => t === 1).length);
  check(roads2 > roadsBefore + 4, `road dragged in the 2D view (${roads2 - roadsBefore} tiles)`);
  await page.click('[data-testid=tool-inspect]');
  await page.screenshot({ path: `${OUT}/09-classic-2d.png` });
  await page.click('[data-testid=toggle-view]');
  await page.waitForSelector('[data-testid=game-canvas-3d]');
  check((await page.evaluate(() => window.__tamadun.viewMode)) === '3d', 'switched back to 3D');

  // save, reload, load
  await page.click('[data-testid=open-save]');
  await page.click('[data-testid=save-slot1]');
  await page.click('[data-testid=modal-close]');
  const saved = await page.evaluate(() => ({ tick: window.__tamadun.engine.state.tick, adv: window.__tamadun.engine.state.advisors }));
  await page.reload();
  await page.waitForSelector('[data-testid=main-menu]');
  await page.click('[data-testid=menu-load]');
  await page.click('[data-testid=load-slot1]');
  await page.waitForSelector('[data-testid=topbar]');
  const loaded = await page.evaluate(() => ({ tick: window.__tamadun.engine.state.tick, name: window.__tamadun.engine.state.name, b: window.__tamadun.engine.state.buildings.length, adv: window.__tamadun.engine.state.advisors, view: window.__tamadun.viewMode }));
  check(loaded.tick === saved.tick && loaded.name === 'Kota Ujian E2E' && loaded.b >= 1, 'saved game restored after page reload');
  check(JSON.stringify(loaded.adv) === JSON.stringify(saved.adv), 'advisors survive save/load');
  check(loaded.view === '3d', '3D view preference persisted');

  await page.click('[data-testid=open-settings]');
  await page.click('[data-testid=lang-en]');
  await page.click('[data-testid=modal-close]');
  check(await page.isVisible('text=Diplomacy') || (await page.getAttribute('[data-testid=open-diplomacy]', 'title')) === 'Diplomacy', 'UI switched to English');
  await frames(page, 4);
  await page.screenshot({ path: `${OUT}/10-english-3d.png` });

  // ---------------- phone layout ----------------
  await page.close();
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const perrors = watchErrors(phone);
  await phone.goto(BASE);
  await phone.click('[data-testid=start-game]');
  await phone.waitForSelector('[data-testid=topbar]');
  await phone.click('[data-testid=speed-0]');
  check(await phone.isVisible('[data-testid=menu-drawer]'), 'phone: panels collapse into a drawer');
  await phone.click('[data-testid=menu-drawer]');
  await phone.click('[data-testid=drawer-open-economy]');
  check(await phone.isVisible('[data-testid=modal-economy]'), 'phone: drawer opens a panel');
  await phone.click('[data-testid=modal-close]');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `phone: no horizontal scrolling (${overflow}px)`);
  if (await phone.isVisible('[data-testid=toolbar-expand]')) await phone.click('[data-testid=toolbar-expand]');
  check(await phone.isVisible('[data-testid=tool-inspect]'), 'phone: toolbar drawer expands');
  await frames(phone, 4);
  await phone.screenshot({ path: `${OUT}/11-phone.png` });
  errors.push(...perrors);

  check(errors.length === 0, `no console/page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await browser.close();
} catch (e) {
  console.error(e);
  fail();
} finally {
  server.kill();
}
console.log(failed() ? `\n${failed()} check(s) failed` : '\nAll E2E checks passed');
process.exit(failed() ? 1 : 0);
