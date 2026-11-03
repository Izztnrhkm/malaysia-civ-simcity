import '@testing-library/jest-dom/vitest';
import { createMockContext } from './helpers/mockCanvas';

// jsdom has no 2D canvas: give every canvas a recording mock context.
if (typeof HTMLCanvasElement !== 'undefined') {
  const ctxs = new WeakMap<HTMLCanvasElement, ReturnType<typeof createMockContext>>();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let c = ctxs.get(this);
    if (!c) {
      c = createMockContext();
      (c as unknown as { canvas: HTMLCanvasElement }).canvas = this;
      ctxs.set(this, c);
    }
    return c;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
}

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
  }
}
