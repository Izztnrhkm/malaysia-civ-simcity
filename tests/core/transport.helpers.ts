export { buildNetwork, computeAccess, costToEfficiency, deliveryCost } from '../../src/core/sim/transport';

/** Manhattan length of a tile path. */
export function linePathCost(p: Array<[number, number]>): number {
  let c = 0;
  for (let i = 1; i < p.length; i++) c += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]);
  return c;
}
