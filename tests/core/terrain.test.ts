import { Rng, hash2 } from '../../src/core/rng';
import { fbm, valueNoise } from '../../src/core/noise';
import { DIRS4, distanceField, generateTerrain, inBounds, isCoastal } from '../../src/core/map/terrain';
import { T, isSea } from '../../src/core/types';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('produces values in [0,1) and int ranges inclusive', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
  it('state can be saved and restored', () => {
    const r = new Rng(77);
    r.next();
    const st = r.state;
    const v1 = r.next();
    r.state = st;
    expect(r.next()).toBe(v1);
  });
  it('hash2 and noise are stable and bounded', () => {
    expect(hash2(3, 4, 5)).toBe(hash2(3, 4, 5));
    for (let i = 0; i < 200; i++) {
      const v = valueNoise(i * 0.37, i * 0.11, 3);
      const f = fbm(i * 0.2, i * 0.3, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('generateTerrain', () => {
  const seeds = [1, 42, 777, 2024, 31337];

  it('is deterministic for a given seed', () => {
    const a = generateTerrain(64, 64, 99).map;
    const b = generateTerrain(64, 64, 99).map;
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.tin)).toEqual(Array.from(b.tin));
  });

  it('differs between seeds', () => {
    const a = generateTerrain(64, 64, 1).map;
    const b = generateTerrain(64, 64, 2).map;
    expect(Array.from(a.terrain)).not.toEqual(Array.from(b.terrain));
  });

  it.each(seeds)('seed %i: sea in the west (Straits), highlands in the east', (seed) => {
    const { map } = generateTerrain(128, 128, seed);
    let westSea = 0;
    let eastHigh = 0;
    for (let y = 0; y < 128; y++) {
      if (isSea(map.terrain[y * 128 + 2])) westSea++;
      const t = map.terrain[y * 128 + 105];
      if (t === T.HILL || t === T.MOUNTAIN) eastHigh++;
    }
    expect(westSea).toBeGreaterThan(110);
    expect(eastHigh).toBeGreaterThan(40);
  });

  it.each(seeds)('seed %i: the river is continuous and reaches the sea', (seed) => {
    const { map, info } = generateTerrain(128, 128, seed);
    const path = info.riverPath;
    expect(path.length).toBeGreaterThan(30);
    for (let k = 1; k < path.length; k++) {
      const d = Math.abs(path[k][0] - path[k - 1][0]) + Math.abs(path[k][1] - path[k - 1][1]);
      expect(d).toBe(1);
    }
    const [mx, my] = info.mouth;
    expect(isSea(map.terrain[my * 128 + mx])).toBe(true);
    // the river's source lies inland in the eastern half
    expect(path[0][0]).toBeGreaterThan(64);
  });

  it.each(seeds)('seed %i: tin occurs only in hills or the valley floor next to them', (seed) => {
    const { map } = generateTerrain(128, 128, seed);
    const hillDist = distanceField(map, (t) => t === T.HILL || t === T.MOUNTAIN);
    let tinTiles = 0;
    for (let i = 0; i < map.tin.length; i++) {
      if (!map.tin[i]) continue;
      tinTiles++;
      const t = map.terrain[i];
      expect(t === T.HILL || ((t === T.PLAIN || t === T.JUNGLE) && hillDist[i] <= 3)).toBe(true);
    }
    expect(tinTiles).toBeGreaterThan(20);
  });

  it.each(seeds)('seed %i: mangrove fringes the estuary and harbour sites exist', (seed) => {
    const { map, info } = generateTerrain(128, 128, seed);
    let mangrove = 0;
    let coastal = 0;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = y * 128 + x;
        if (map.terrain[i] === T.MANGROVE) {
          mangrove++;
          expect(Math.hypot(x - info.mouth[0], y - info.mouth[1])).toBeLessThan(13);
        }
        if (isCoastal(map, x, y)) coastal++;
      }
    expect(mangrove).toBeGreaterThan(3);
    expect(coastal).toBeGreaterThan(60);
  });

  it('fertile soil concentrates near the river', () => {
    const { map } = generateTerrain(128, 128, 42);
    const rd = distanceField(map, (t) => t === T.RIVER);
    let near = 0;
    let nearN = 0;
    let far = 0;
    let farN = 0;
    for (let i = 0; i < map.fertility.length; i++) {
      if (map.terrain[i] !== T.PLAIN) continue;
      if (rd[i] <= 3) {
        near += map.fertility[i];
        nearN++;
      } else if (rd[i] > 15) {
        far += map.fertility[i];
        farN++;
      }
    }
    expect(near / nearN).toBeGreaterThan(far / Math.max(1, farN));
  });

  it('neighbour helper stays in bounds', () => {
    const { map } = generateTerrain(16, 16, 5);
    for (const [dx, dy] of DIRS4) expect(inBounds(map, 0 + dx, 0 + dy)).toBe(dx >= 0 && dy >= 0);
  });
});
