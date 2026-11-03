/**
 * A recording stand-in for CanvasRenderingContext2D. jsdom has no canvas
 * implementation, so sprite generators and the renderer draw into this proxy;
 * tests inspect the call log.
 */
export interface MockCtx {
  calls: Array<[string, unknown[]]>;
  [k: string]: unknown;
}

export function createMockContext(): CanvasRenderingContext2D & MockCtx {
  const calls: Array<[string, unknown[]]> = [];
  const target: Record<string, unknown> = {
    calls,
    canvas: null,
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (s: string) => ({ width: s.length * 6 }),
    setLineDash: (d: number[]) => calls.push(['setLineDash', [d]]),
    getLineDash: () => [],
  };
  const proxy = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        calls.push([prop, args]);
      };
    },
    set(t, prop: string, value) {
      t[prop] = value;
      if (typeof value !== 'function') calls.push([`set:${prop}`, [value]]);
      return true;
    },
  });
  return proxy as unknown as CanvasRenderingContext2D & MockCtx;
}

/** Canvas factory producing plain objects with a mock context. */
export function mockCanvasFactory(w: number, h: number): HTMLCanvasElement {
  const ctx = createMockContext();
  const c = { width: w, height: h, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,' } as unknown as HTMLCanvasElement;
  return c;
}

/** Count drawing calls that actually put pixels on the canvas. */
export function paintCalls(ctx: MockCtx): number {
  return ctx.calls.filter(([n]) => ['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'putImageData'].includes(n)).length;
}
