import { buildNetwork, computeAccess, costToEfficiency, deliveryCost, linePathCost } from './transport.helpers';
import { flatEngine } from '../helpers/flat';
import { MODE } from '../../src/core/sim/transport';
import { linePath, rectTiles } from '../../src/core/sim/placement';
import { TRANSPORT } from '../../src/core/types';

describe('path helpers', () => {
  it('linePath is L-shaped and contiguous', () => {
    const p = linePath(2, 3, 6, 1);
    expect(p[0]).toEqual([2, 3]);
    expect(p[p.length - 1]).toEqual([6, 1]);
    expect(p.length).toBe(4 + 2 + 1);
    expect(linePathCost(p)).toBe(p.length - 1);
  });
  it('rectTiles covers the inclusive rectangle in any drag direction', () => {
    expect(rectTiles(3, 3, 1, 2)).toHaveLength(6);
  });
});

describe('multimodal network', () => {
  it('roads, water and hubs become network nodes', () => {
    const e = flatEngine();
    e.state.money = 1e6;
    expect(e.placeBuilding('pelabuhan', 2, 10).ok).toBe(true);
    expect(e.buildTransport('road', 4, 11, 20, 11).ok).toBe(true);
    const net = buildNetwork(e.state);
    const W = e.state.map.width;
    expect(net.modes[11 * W + 10] & MODE.ROAD).toBeTruthy();
    expect(net.modes[16 * W + 10] & MODE.WATER).toBeTruthy();
    expect(net.modes[10 * W + 2]).toBe(15); // port is a transfer hub
    expect(net.hubs.length).toBe(4);
  });

  it('delivery cost grows with distance and rail is cheaper than road', () => {
    const roadE = flatEngine();
    roadE.state.money = 1e6;
    roadE.placeBuilding('pelabuhan', 2, 4);
    roadE.buildTransport('road', 4, 5, 28, 5);
    const roadCost = deliveryCost(roadE.state, buildNetwork(roadE.state));

    const railE = flatEngine();
    railE.state.money = 1e6;
    railE.state.era = 2;
    railE.state.research.done.push('kapal_wap', 'kereta_api');
    railE.placeBuilding('pelabuhan', 2, 4);
    railE.buildTransport('rail', 4, 5, 28, 5);
    const railCost = deliveryCost(railE.state, buildNetwork(railE.state));
    const W = 32;
    expect(roadCost[5 * W + 10]).toBeLessThan(roadCost[5 * W + 25]);
    expect(railCost[5 * W + 25]).toBeLessThan(roadCost[5 * W + 25]);
  });

  it('off-network tiles pay a carting cost and far tiles are unreachable', () => {
    const e = flatEngine();
    e.state.money = 1e6;
    e.placeBuilding('pelabuhan', 2, 4);
    e.buildTransport('road', 4, 5, 20, 5);
    const cost = deliveryCost(e.state, buildNetwork(e.state));
    const W = 32;
    expect(cost[6 * W + 10]).toBeGreaterThan(cost[5 * W + 10]);
    expect(cost[9 * W + 10]).toBe(Infinity);
  });

  it('efficiency is clamped to [0.25, 1]', () => {
    expect(costToEfficiency(0, 1)).toBe(1);
    expect(costToEfficiency(Infinity, 1)).toBe(0.25);
    expect(costToEfficiency(1e6, 3)).toBe(0.25);
  });

  it('access reaches 3 tiles from roads and 1 tile from water', () => {
    const e = flatEngine();
    e.state.money = 1e6;
    e.buildTransport('road', 10, 5, 20, 5);
    const acc = computeAccess(e.state, buildNetwork(e.state));
    const W = 32;
    expect(acc[8 * W + 15]).toBe(1);
    expect(acc[9 * W + 15]).toBe(0);
    expect(acc[15 * W + 25]).toBe(1); // next to river row 16
    expect(acc[13 * W + 25]).toBe(0);
    expect(e.state.map.transport[5 * W + 12]).toBe(TRANSPORT.ROAD);
  });
});
