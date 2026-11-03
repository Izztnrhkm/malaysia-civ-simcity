// Shared helpers for the browser tests: a `vite preview` server and a Chromium
// with software WebGL (SwiftShader) so the 3D view renders headlessly.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

export async function startServer(port) {
  const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) {
    const ok = await new Promise((resolve) => {
      http.get(base, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
    });
    if (ok) return { server, base };
    await new Promise((r) => setTimeout(r, 250));
  }
  server.kill();
  throw new Error('preview server did not start');
}

export function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

/** Collect page errors and console errors (and WebGL warnings, which signal broken rendering). */
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    const txt = m.text();
    if (m.type() === 'error') errors.push(txt);
    else if (m.type() === 'warning' && /WebGL|GL_|THREE\./.test(txt)) errors.push(`warning: ${txt}`);
  });
  return errors;
}

export function checker() {
  let failed = 0;
  const check = (cond, msg) => {
    console.log(`${cond ? '✓' : '✗'} ${msg}`);
    if (!cond) failed++;
  };
  return { check, failed: () => failed, fail: () => failed++ };
}

/** Page coordinates of a tile centre through whichever view (3D or 2D) is active. */
export function tileToScreen(page, x, y) {
  return page.evaluate(([x, y]) => window.__tamadun.controller.current.tileToScreen(x, y), [x, y]);
}

/** Let a few animation frames render. */
export const frames = (page, n = 4) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
