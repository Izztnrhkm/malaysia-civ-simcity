import { flatEngine } from '../helpers/flat';
import { BUILDING_MAP, CLEAR_JUNGLE_COST, ZONE_COST } from '../../src/core/data/buildings';
import { T, TRANSPORT, ZONE } from '../../src/core/types';

describe('building placement', () => {
  it('places a starting building and charges its cost', () => {
    const e = flatEngine();
    const before = e.state.money;
    const r = e.placeBuilding('pasar', 10, 10);
    expect(r.ok).toBe(true);
    expect(e.state.money).toBe(before - BUILDING_MAP.pasar.cost);
    const W = e.state.map.width;
    expect(e.state.map.building[10 * W + 10]).toBeGreaterThan(0);
    expect(e.state.map.building[11 * W + 11]).toBe(e.state.map.building[10 * W + 10]);
  });

  it('rejects locked, overlapping, out-of-bounds and water placements', () => {
    const e = flatEngine();
    expect(e.placeBuilding('lombong', 10, 10).reason).toBe('err.locked');
    expect(e.placeBuilding('pasar', 10, 10).ok).toBe(true);
    expect(e.placeBuilding('pasar', 11, 11).reason).toBe('err.occupied');
    expect(e.placeBuilding('pasar', 31, 31).reason).toBe('err.bounds');
    expect(e.placeBuilding('surau', 10, 16).reason).toBe('err.terrain');
  });

  it('enforces coast, water and fertility requirements', () => {
    const e = flatEngine();
    expect(e.placeBuilding('pelabuhan', 10, 4).reason).toBe('err.needCoast');
    expect(e.placeBuilding('pelabuhan', 2, 4).ok).toBe(true);
    expect(e.placeBuilding('nelayan', 20, 4).reason).toBe('err.needWater');
    expect(e.placeBuilding('nelayan', 20, 15).ok).toBe(true);
    const W = e.state.map.width;
    for (let i = 0; i < W * W; i++) e.state.map.fertility[i] = 20;
    expect(e.placeBuilding('sawah', 20, 20).reason).toBe('err.needFertile');
  });

  it('tin buildings need tin ore', () => {
    const e = flatEngine();
    e.state.research.done.push('pendulangan');
    expect(e.placeBuilding('pendulang', 20, 20).reason).toBe('err.needTin');
    e.state.map.tin[20 * 32 + 20] = 200;
    expect(e.placeBuilding('pendulang', 20, 20).ok).toBe(true);
  });

  it('landmarks are unique', () => {
    const e = flatEngine();
    e.state.money = 1e6;
    e.state.civics.done.push('gotong_royong', 'kesultanan_melaka');
    expect(e.placeBuilding('istana', 10, 4).ok).toBe(true);
    expect(e.placeBuilding('istana', 20, 4).reason).toBe('err.unique');
  });

  it('fails with err.money when broke', () => {
    const e = flatEngine();
    e.state.money = 10;
    expect(e.placeBuilding('pasar', 10, 10).reason).toBe('err.money');
  });
});

describe('zoning, transport and bulldozing', () => {
  it('zones land tiles, skips water and charges per tile plus jungle clearing', () => {
    const e = flatEngine();
    const W = e.state.map.width;
    e.state.map.terrain[5 * W + 5] = T.JUNGLE;
    const before = e.state.money;
    const r = e.zone('R', 4, 4, 6, 6);
    expect(r.ok).toBe(true);
    expect(before - e.state.money).toBe(9 * ZONE_COST + CLEAR_JUNGLE_COST);
    expect(e.state.map.zone[5 * W + 5]).toBe(ZONE.R);
    expect(e.state.map.terrain[5 * W + 5]).toBe(T.PLAIN);
    e.zone('C', 20, 15, 20, 17);
    expect(e.state.map.zone[16 * W + 20]).toBe(0); // river
  });

  it('builds roads with bridges over the river at triple cost', () => {
    const e = flatEngine();
    const before = e.state.money;
    expect(e.buildTransport('road', 10, 15, 10, 17).ok).toBe(true);
    expect(before - e.state.money).toBe(8 + 8 * 3 + 8);
    expect(e.state.map.transport[16 * 32 + 10]).toBe(TRANSPORT.ROAD);
  });

  it('rail is locked until researched', () => {
    const e = flatEngine();
    expect(e.buildTransport('rail', 4, 4, 10, 4).reason).toBe('err.locked');
  });

  it('bulldozing removes whole buildings, roads and zones', () => {
    const e = flatEngine();
    e.placeBuilding('pasar', 10, 10);
    e.buildTransport('road', 4, 4, 8, 4);
    e.zone('R', 4, 6, 6, 6);
    expect(e.bulldoze(11, 11, 11, 11).ok).toBe(true);
    expect(e.state.buildings).toHaveLength(0);
    expect(e.state.map.building[10 * 32 + 10]).toBe(-1);
    e.bulldoze(4, 4, 8, 6);
    expect(e.state.map.transport[4 * 32 + 5]).toBe(0);
    expect(e.state.map.zone[6 * 32 + 5]).toBe(0);
    expect(e.bulldoze(20, 20, 20, 20).reason).toBe('err.nothing');
  });
});
