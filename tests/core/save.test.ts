import { GameEngine } from '../../src/core/engine';
import { decodeLayer, encodeLayer, fromBase64, rleDecode, rleEncode, toBase64 } from '../../src/core/save/codec';
import { SaveError, deserialize, listSlots, loadFromSlot, saveToSlot, serialize, toJSON, deleteSlot } from '../../src/core/save/save';
import { Bot } from '../helpers/bot';

function playedGame(ticks = 60) {
  const e = GameEngine.newGame(42);
  const bot = new Bot(e);
  bot.setup();
  for (let i = 0; i < ticks; i++) {
    bot.step();
    e.tick();
  }
  return e;
}

describe('codec', () => {
  it('base64 round-trips arbitrary bytes', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 100, 1001]) {
      const b = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255);
      expect(Array.from(fromBase64(toBase64(b)))).toEqual(Array.from(b));
    }
    expect(toBase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
  });

  it('RLE compresses runs and round-trips', () => {
    const a = new Uint8Array(1000);
    a.fill(3, 100, 700);
    const enc = rleEncode(a);
    expect(enc.length).toBeLessThan(20);
    expect(Array.from(rleDecode(enc, 1000))).toEqual(Array.from(a));
    expect(Array.from(decodeLayer(encodeLayer(a), 1000))).toEqual(Array.from(a));
  });

  it('rejects corrupt streams', () => {
    expect(() => rleDecode(Uint8Array.from([1, 0]), 5)).toThrow();
    expect(() => rleDecode(Uint8Array.from([1, 9]), 5)).toThrow();
    expect(() => fromBase64('abc')).toThrow();
  });
});

describe('save / load', () => {
  it('round-trips a played game exactly and the simulation continues identically', () => {
    const e = playedGame();
    const json = toJSON(e.state);
    const restored = new GameEngine(deserialize(json));
    const s1 = e.state;
    const s2 = restored.state;
    expect(s2.tick).toBe(s1.tick);
    expect(s2.money).toBe(s1.money);
    expect(s2.buildings).toEqual(s1.buildings);
    expect(Array.from(s2.map.zone)).toEqual(Array.from(s1.map.zone));
    expect(Array.from(s2.map.building)).toEqual(Array.from(s1.map.building));
    expect(Array.from(s2.map.terrain)).toEqual(Array.from(s1.map.terrain));
    for (let i = 0; i < 20; i++) {
      e.tick();
      restored.tick();
    }
    expect(restored.state.money).toBeCloseTo(e.state.money, 6);
    expect(Array.from(restored.state.map.density)).toEqual(Array.from(e.state.map.density));
  });

  it('keeps the save small', () => {
    const e = playedGame(30);
    expect(toJSON(e.state).length).toBeLessThan(200_000);
  });

  it('rejects invalid JSON, wrong formats, newer versions and corrupt data', () => {
    expect(() => deserialize('{not json')).toThrow(SaveError);
    expect(() => deserialize(JSON.stringify({ hello: 1 }))).toThrow(/Invalid save/);
    const f = serialize(GameEngine.newGame(3, 'x', 32).state);
    expect(() => deserialize({ ...f, version: 999 })).toThrow(/newer/);
    const bad = structuredClone(f);
    bad.map.layers.zone = 'AAAA';
    expect(() => deserialize(bad)).toThrow(/Corrupt/);
    const bad2 = structuredClone(f);
    bad2.state.buildings.push({ id: 1, def: 'ufo', x: 0, y: 0, w: 1, h: 1, built: 0, efficiency: 1 });
    expect(() => deserialize(bad2)).toThrow(/Unknown building/);
    const bad3 = structuredClone(f);
    (bad3.state as { money: unknown }).money = 'lots';
    expect(() => deserialize(bad3)).toThrow(/state.money/);
  });

  it('stores and lists localStorage slots', () => {
    localStorage.clear();
    const e = GameEngine.newGame(5, 'Kota Ujian', 32);
    expect(listSlots().every((s) => s.empty)).toBe(true);
    saveToSlot(e.state, 'slot2');
    const slots = listSlots();
    const s2 = slots.find((s) => s.id === 'slot2')!;
    expect(s2.empty).toBe(false);
    expect(s2.name).toBe('Kota Ujian');
    expect(loadFromSlot('slot2').name).toBe('Kota Ujian');
    deleteSlot('slot2');
    expect(() => loadFromSlot('slot2')).toThrow(/empty/);
  });
});
