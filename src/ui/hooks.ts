import { useEffect, useRef, useSyncExternalStore } from 'react';
import { GameEngine } from '../core/engine';

/** Re-render whenever the engine emits a change. */
export function useEngineVersion(engine: GameEngine): number {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
}

/** Runs the simulation at `tps` ticks per second (0 = paused). */
export function useGameLoop(engine: GameEngine | null, tps: number, onError?: (e: unknown) => void) {
  const errRef = useRef(onError);
  errRef.current = onError;
  useEffect(() => {
    if (!engine || tps <= 0) return;
    const ms = 1000 / tps;
    const id = window.setInterval(() => {
      try {
        engine.tick();
      } catch (e) {
        errRef.current?.(e);
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [engine, tps]);
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}
