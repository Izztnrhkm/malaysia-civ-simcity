import { GameEngine } from '../../src/core/engine';
import { createGame } from '../../src/core/sim/context';
import { GameState, T } from '../../src/core/types';

/**
 * A deterministic hand-made map for unit tests: sea in column 0-1, a river
 * along row `riverY` from the east edge to the sea, the rest flat fertile plain.
 */
export function flatState(size = 32, riverY = 16): GameState {
  const s = createGame(1, 'Ujian', size);
  const m = s.map;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      m.terrain[i] = x < 2 ? T.SEA : y === riverY && x >= 2 ? T.RIVER : T.PLAIN;
      m.elevation[i] = x < 2 ? 60 : 120;
      m.fertility[i] = 200;
      m.tin[i] = 0;
    }
  return s;
}

export function flatEngine(size = 32, riverY = 16): GameEngine {
  return new GameEngine(flatState(size, riverY));
}
