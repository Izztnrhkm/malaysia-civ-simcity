// Browser soak test: plays 660 turns across the three scenarios (220 each)
// with the 3D view rendering, an in-page scripted player, day/night and
// monsoon toggles. Fails on any console error or numeric blow-up.
import { mkdirSync } from 'node:fs';
import { checker, frames, launch, startServer, watchErrors } from './lib.mjs';

const OUT = 'e2e/screenshots';
mkdirSync(OUT, { recursive: true });
const { check, failed, fail } = checker();
const { server, base } = await startServer(4193);
const TURNS = 220;

try {
  const browser = await launch();
  let total = 0;
  for (const scenario of ['melaka_1400', 'larut_1875', 'msc_1996']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = watchErrors(page);
    await page.goto(base);
    await page.fill('[data-testid=seed]', '2024');
    await page.click(`[data-testid=scenario-${scenario}]`);
    await page.click('[data-testid=start-game]');
    await page.waitForSelector('[data-testid=game-canvas-3d]');
    await page.click('[data-testid=speed-0]');
    // scripted player: roads, zones, research, era advances, crisis decisions
    const setup = await page.evaluate(() => {
      const { engine: e } = window.__tamadun;
      const m = e.state.map;
      let mouth = [20, 64];
      let bx = 1e9;
      for (let i = 0; i < m.terrain.length; i++)
        if (m.terrain[i] === 5 && i % m.width < bx) {
          bx = i % m.width;
          mouth = [bx, (i / m.width) | 0];
        }
      const find = (id, cx, cy, R = 30) => {
        for (let r = 0; r <= R; r++)
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && e.checkBuilding(id, cx + dx, cy + dy).ok) return [cx + dx, cy + dy];
        return null;
      };
      let hub = e.state.buildings[0] ? [e.state.buildings[0].x, e.state.buildings[0].y] : find('pelabuhan', mouth[0], mouth[1] - 3);
      if (!e.state.buildings.length && hub) e.placeBuilding('pelabuhan', hub[0], hub[1]);
      window.__soak = { hub, x: hub[0] + 3, y: hub[1] + 12, find };
      window.__tamadun.controller.current.centerOn(hub[0] + 10, hub[1] + 6);
      return hub;
    });
    check(!!setup, `${scenario}: city founded`);
    const t0 = await page.evaluate(() => window.__tamadun.engine.state.tick);
    for (let k = 0; k < TURNS / 10; k++) {
      const res = await page.evaluate((k) => {
        const T = window.__tamadun;
        const e = T.engine;
        const S = window.__soak;
        const s = e.state;
        if (s.crisis) e.resolveCrisis(0);
        for (const kind of ['tech', 'civic']) {
          const track = kind === 'tech' ? s.research : s.civics;
          if (!track.current) {
            const av = T.availableResearch(s, kind);
            if (av.length) e.setResearch(av[0]);
          }
        }
        if (k % 3 === 0 && S.y < s.map.height - 4) {
          e.buildTransport('road', S.x, S.y, S.x + 14, S.y);
          e.zone('R', S.x, S.y - 1, S.x + 14, S.y - 1, true);
          e.zone(k % 2 ? 'C' : 'I', S.x, S.y + 1, S.x + 14, S.y + 1, true);
          e.buildTransport('road', S.x, S.y - 12, S.x, S.y + 2);
          S.y += 3;
        }
        if (k % 4 === 0) for (const id of ['sawah', 'nelayan', 'pasar', 'pembalakan']) {
          const p = S.find(id, S.hub[0] + 6, S.hub[1] + 4, 25);
          if (p && s.money > 3000) e.placeBuilding(id, p[0], p[1]);
        }
        e.advanceEra();
        for (let i = 0; i < 10; i++) e.tick();
        const d = s.derived;
        const bad = [s.money, d.happiness, d.population, ...Object.values(s.stock)].some((v) => !Number.isFinite(v)) || Object.values(s.stock).some((v) => v < 0) || d.happiness < 0 || d.happiness > 100;
        return { bad, tick: s.tick };
      }, k);
      if (res.bad) {
        check(false, `${scenario}: numeric sanity at tick ${res.tick}`);
        break;
      }
      await frames(page, 1);
      for (let n = 0; n < 3 && (await page.isVisible('[role=dialog]')); n++) await page.keyboard.press('Escape');
      if (k === 6) await page.click('[data-testid=toggle-daynight]');
      if (k === 10) await page.click('[data-testid=toggle-weather]');
      if (k === 14) await page.click('[data-testid=toggle-daynight]');
      if (k === 16) await page.click('[data-testid=toggle-weather]');
      await frames(page, 2);
    }
    const end = await page.evaluate(() => {
      const s = window.__tamadun.engine.state;
      return { tick: s.tick, era: s.era, pop: s.derived.population, money: Math.round(s.money), stats: window.__tamadun.controller.current.view.world.stats() };
    });
    total += end.tick - t0;
    check(end.tick - t0 >= TURNS, `${scenario}: ${end.tick - t0} turns played (era ${end.era}, population ${end.pop}, money ${end.money})`);
    check(end.stats.chunks > 0 && end.stats.buildings > 0, `${scenario}: 3D scene still populated (${end.stats.buildings} buildings, ${end.stats.zones} lots, ${end.stats.traffic} vehicles)`);
    await frames(page, 4);
    await page.screenshot({ path: `${OUT}/soak-${scenario}.png`, timeout: 120000 });
    check(errors.length === 0, `${scenario}: no console/page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await page.close();
  }
  check(total >= 650, `soak played ${total} turns in total`);
  await browser.close();
} catch (e) {
  console.error(e);
  fail();
} finally {
  server.kill();
}
console.log(failed() ? `\n${failed()} check(s) failed` : '\nSoak test passed');
process.exit(failed() ? 1 : 0);
