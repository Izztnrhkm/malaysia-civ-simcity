/** Compact binary codecs for map layers: run-length encoding + base64. */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length % 4 !== 0) throw new Error('Invalid base64 length');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c = clean[i + 2] === '=' ? 0 : B64_LOOKUP[clean.charCodeAt(i + 2)];
    const d = clean[i + 3] === '=' ? 0 : B64_LOOKUP[clean.charCodeAt(i + 3)];
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Invalid base64 character');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** RLE as (value, runLength<=255) byte pairs. */
export function rleEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const v = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === v && run < 255) run++;
    out.push(v, run);
    i += run;
  }
  return Uint8Array.from(out);
}

export function rleDecode(data: Uint8Array, expectedLength: number): Uint8Array {
  if (data.length % 2 !== 0) throw new Error('Corrupt RLE stream');
  const out = new Uint8Array(expectedLength);
  let o = 0;
  for (let i = 0; i < data.length; i += 2) {
    const v = data[i];
    const run = data[i + 1];
    if (run === 0 || o + run > expectedLength) throw new Error('Corrupt RLE stream');
    out.fill(v, o, o + run);
    o += run;
  }
  if (o !== expectedLength) throw new Error('RLE length mismatch');
  return out;
}

export const encodeLayer = (a: Uint8Array) => toBase64(rleEncode(a));
export const decodeLayer = (s: string, n: number) => rleDecode(fromBase64(s), n);

export function encodeInt32Layer(a: Int32Array): string {
  return encodeLayer(new Uint8Array(a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength)));
}
export function decodeInt32Layer(s: string, n: number): Int32Array {
  const bytes = decodeLayer(s, n * 4);
  return new Int32Array(bytes.buffer);
}
