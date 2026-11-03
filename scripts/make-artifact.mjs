// Turns the single-file Vite build (dist-artifact/index.html) into a page body
// for hosts that wrap content in their own <html>/<head>/<body> skeleton.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-artifact/index.html', 'utf8');
const title = src.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>Tamadun &amp; Kota</title>';
const description = src.match(/<meta name="description"[^>]*>/)?.[0] ?? '';
const styles = [...src.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...src.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]);
if (!styles.length || !scripts.length) throw new Error('unexpected build output');

const page = [
  title,
  description,
  '<meta name="theme-color" content="#0b2733">',
  ...styles,
  '<div id="root"></div>',
  ...scripts,
  '',
].join('\n');
writeFileSync('dist-artifact/tamadun-kota.html', page);
console.log(`dist-artifact/tamadun-kota.html written (${(page.length / 1024).toFixed(0)} KiB)`);
