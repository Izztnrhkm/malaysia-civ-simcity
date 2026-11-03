import { ERA_STYLES, SFX_IDS, SoundEngine, TUNINGS, composeBar } from '../../src/audio/soundEngine';

/** Minimal recording stand-in for the Web Audio API. */
class FakeParam {
  value = 0;
  events: Array<[string, number, number]> = [];
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.events.push(['set', v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['lin', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('exponential ramp to non-positive value');
    this.events.push(['exp', v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.value = v;
    this.events.push(['target', v, t]);
    return this;
  }
}
class FakeNode {
  connections: unknown[] = [];
  connect(n: unknown) {
    this.connections.push(n);
    return n;
  }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  created: Record<string, number> = {};
  private count(k: string) {
    this.created[k] = (this.created[k] ?? 0) + 1;
  }
  createGain() {
    this.count('gain');
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createOscillator() {
    this.count('osc');
    return Object.assign(new FakeNode(), { type: 'sine', frequency: new FakeParam(), detune: new FakeParam(), start() {}, stop() {} });
  }
  createBiquadFilter() {
    this.count('filter');
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createConvolver() {
    this.count('convolver');
    return Object.assign(new FakeNode(), { buffer: null });
  }
  createBuffer(ch: number, len: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { getChannelData: (i: number) => data[i] };
  }
  createBufferSource() {
    this.count('noise');
    return Object.assign(new FakeNode(), { buffer: null, loop: false, start() {}, stop() {} });
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

const make = () => {
  const ctx = new FakeCtx();
  const se = new SoundEngine(() => ctx as unknown as AudioContext);
  return { ctx, se };
};

beforeEach(() => localStorage.clear());

describe('procedural composition', () => {
  it('is deterministic for era, bar and seed', () => {
    expect(composeBar(1, 3, 7)).toEqual(composeBar(1, 3, 7));
    expect(composeBar(1, 3, 7)).not.toEqual(composeBar(1, 4, 7));
  });

  it('eras 1-2 are gamelan: gong closes each 4-bar gongan and melody notes are in the pentatonic tuning', () => {
    for (const era of [1, 2]) {
      const style = ERA_STYLES[era];
      const allowed = new Set(style.scale.map((c) => Math.round(c) % 1200));
      for (let bar = 0; bar < 16; bar++) {
        const ev = composeBar(era, bar, 3);
        expect(ev.some((e) => e.inst === 'gong')).toBe(bar % 4 === 0);
        expect(ev.filter((e) => e.inst === 'saron')).toHaveLength(4);
        for (const e of ev.filter((x) => x.inst === 'saron' || x.inst === 'bonang' || x.inst === 'seruling')) {
          const c = Math.round(1200 * Math.log2(e.freqs[0] / style.tonic));
          expect(allowed.has(((c % 1200) + 1200) % 1200)).toBe(true);
        }
        expect(ev.some((e) => e.inst === 'pad')).toBe(false);
      }
    }
    expect(ERA_STYLES[1].scale).toBe(TUNINGS.slendro);
    expect(ERA_STYLES[2].scale).toBe(TUNINGS.pelog);
  });

  it('eras 3-4 switch to synth pads and bass, with arpeggios in era 4', () => {
    for (const era of [3, 4]) {
      const bars = Array.from({ length: 8 }, (_, b) => composeBar(era, b, 1));
      expect(bars.every((ev) => !ev.some((e) => e.inst === 'gong' || e.inst === 'saron'))).toBe(true);
      expect(bars.filter((ev) => ev.some((e) => e.inst === 'pad'))).toHaveLength(4);
      expect(bars.every((ev) => ev.some((e) => e.inst === 'bass'))).toBe(true);
    }
    const plucks = Array.from({ length: 8 }, (_, b) => composeBar(4, b, 1).filter((e) => e.inst === 'pluck').length).reduce((a, b) => a + b);
    expect(plucks).toBeGreaterThan(8);
  });

  it('every event sits inside its bar with positive velocity and audible frequency', () => {
    for (const era of [1, 2, 3, 4])
      for (let bar = 0; bar < 12; bar++)
        for (const e of composeBar(era, bar, 9)) {
          expect(e.beat).toBeGreaterThanOrEqual(0);
          expect(e.beat).toBeLessThan(4);
          expect(e.vel).toBeGreaterThan(0);
          for (const f of e.freqs) {
            expect(f).toBeGreaterThan(20);
            expect(f).toBeLessThan(8000);
          }
        }
  });
});

describe('SoundEngine', () => {
  it('is a silent no-op without Web Audio', () => {
    const se = new SoundEngine(() => null);
    expect(se.unlock()).toBe(false);
    expect(() => {
      se.play('place');
      se.startMusic();
      se.setMuted(true);
    }).not.toThrow();
    expect(se.available).toBe(false);
  });

  it('creates nothing until unlocked from a gesture, then builds the mixer graph', () => {
    let calls = 0;
    const ctx = new FakeCtx();
    const se = new SoundEngine(() => {
      calls++;
      return ctx as unknown as AudioContext;
    });
    se.play('coin');
    expect(calls).toBe(0);
    expect(se.unlock()).toBe(true);
    expect(se.unlock()).toBe(true);
    expect(calls).toBe(1);
    expect(ctx.created.convolver).toBe(1);
  });

  it.each(SFX_IDS)('synthesises the %s effect', (id) => {
    const { ctx, se } = make();
    se.unlock();
    const before = { ...ctx.created };
    se.play(id);
    const made = Object.entries(ctx.created).reduce((n, [k, v]) => n + v - (before[k] ?? 0), 0);
    expect(made).toBeGreaterThan(1);
    expect(se.stats.sfx).toBe(1);
  });

  it('throttles rapid repeats and stays silent when muted', () => {
    const { se } = make();
    se.unlock();
    se.play('place');
    se.play('place');
    expect(se.stats.sfx).toBe(1);
    se.setMuted(true);
    se.play('coin');
    expect(se.stats.sfx).toBe(1);
  });

  it('persists mute and volume settings', () => {
    const { se } = make();
    se.unlock();
    se.setVolume('music', 0.2);
    se.toggleMute();
    const saved = JSON.parse(localStorage.getItem('tamadun-kota:audio')!);
    expect(saved).toMatchObject({ muted: true, music: 0.2 });
    const again = new SoundEngine(() => null);
    expect(again.settings.muted).toBe(true);
    expect(again.settings.music).toBe(0.2);
    se.setVolume('sfx', 7);
    expect(se.settings.sfx).toBe(1);
  });

  it('schedules music ahead of time and follows the era', () => {
    vi.useFakeTimers();
    const { ctx, se } = make();
    se.unlock();
    se.setEra(1);
    se.startMusic(5);
    expect(se.stats.notes).toBeGreaterThan(3);
    const n1 = se.stats.notes;
    ctx.currentTime = 10;
    vi.advanceTimersByTime(400);
    expect(se.stats.notes).toBeGreaterThan(n1);
    se.setEra(4);
    expect(se.era).toBe(4);
    se.setEra(9);
    expect(se.era).toBe(4);
    se.stopMusic();
    const n2 = se.stats.notes;
    ctx.currentTime = 30;
    vi.advanceTimersByTime(1000);
    expect(se.stats.notes).toBe(n2);
    vi.useRealTimers();
  });
});
