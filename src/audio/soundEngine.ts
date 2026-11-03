/**
 * Zero-dependency procedural sound engine built on the Web Audio API.
 *
 * Music is composed bar by bar from a seeded generator:
 *  - Eras 1-2: a gamelan-inspired texture. Metallophone (bonang / saron)
 *    patterns in slendro- and pelog-like pentatonic tunings, with paired,
 *    slightly detuned partials that beat against each other ("ombak", the
 *    shimmering wave of a gamelan), colotomic gong and kenong strokes, and a
 *    breathy bamboo-flute (seruling) melody with vibrato.
 *  - Eras 3-4: warm detuned synth pads on seventh / ninth chords, a soft sine
 *    bass and (era 4) delayed glassy arpeggios.
 * Sound effects are synthesised on demand from oscillators and filtered noise.
 *
 * The AudioContext is created lazily inside a user gesture (`unlock()`), so
 * nothing is created at page load and browsers' autoplay rules are respected.
 * Without Web Audio (tests, old browsers) every call is a silent no-op.
 */
import { Rng } from '../core/rng';

export type SfxId =
  | 'place'
  | 'road'
  | 'zone'
  | 'bulldoze'
  | 'coin'
  | 'fanfare'
  | 'thunder'
  | 'era'
  | 'error'
  | 'click'
  | 'crisis'
  | 'victory';

export const SFX_IDS: SfxId[] = ['place', 'road', 'zone', 'bulldoze', 'coin', 'fanfare', 'thunder', 'era', 'error', 'click', 'crisis', 'victory'];

export type Instrument = 'bonang' | 'saron' | 'gong' | 'kenong' | 'seruling' | 'pad' | 'bass' | 'pluck';

export interface NoteEvent {
  inst: Instrument;
  /** start, in beats from the bar start */
  beat: number;
  /** duration in beats */
  dur: number;
  /** frequencies (a chord for pads) */
  freqs: number[];
  vel: number;
}

const cents = (c: number) => 2 ** (c / 1200);

/** Approximate tunings (cents above the tonic). Gamelan tunings vary by ensemble; these are typical. */
export const TUNINGS = {
  /** slendro: five near-equal steps */
  slendro: [0, 231, 474, 717, 955],
  /** a pentatonic subset of pelog (pelog bem) */
  pelog: [0, 120, 270, 540, 670],
};

export interface EraStyle {
  bpm: number;
  tonic: number;
  kind: 'gamelan' | 'pads';
  scale: number[];
}

export const ERA_STYLES: Record<number, EraStyle> = {
  1: { bpm: 66, tonic: 293.66, kind: 'gamelan', scale: TUNINGS.slendro },
  2: { bpm: 74, tonic: 261.63, kind: 'gamelan', scale: TUNINGS.pelog },
  3: { bpm: 78, tonic: 261.63, kind: 'pads', scale: [0, 200, 400, 700, 900] },
  4: { bpm: 88, tonic: 293.66, kind: 'pads', scale: [0, 200, 400, 700, 900, 1100] },
};

/** Chord progressions for the pad eras: semitone offsets from the tonic. */
const PROGRESSIONS: Record<number, number[][]> = {
  3: [
    [0, 4, 7, 11],
    [-3, 0, 4, 7],
    [-7, -3, 0, 4],
    [-5, -1, 2, 5],
  ],
  4: [
    [0, 4, 7, 11, 14],
    [-3, 0, 4, 7, 11],
    [-7, -3, 0, 4, 9],
    [-5, -1, 2, 7, 9],
  ],
};

function scaleFreq(style: EraStyle, degree: number): number {
  const n = style.scale.length;
  const oct = Math.floor(degree / n);
  const d = ((degree % n) + n) % n;
  return style.tonic * 2 ** oct * cents(style.scale[d]);
}

/**
 * Compose one 4-beat bar. Pure and deterministic for a given (era, bar, seed),
 * so the music can be unit-tested without audio hardware.
 */
export function composeBar(era: number, bar: number, seed = 1): NoteEvent[] {
  const style = ERA_STYLES[era] ?? ERA_STYLES[1];
  const rng = new Rng((seed * 7919 + bar * 104729 + era * 31) >>> 0 || 1);
  const ev: NoteEvent[] = [];
  if (style.kind === 'gamelan') {
    // colotomic structure: the big gong closes every 4-bar gongan
    if (bar % 4 === 0) ev.push({ inst: 'gong', beat: 0, dur: 8, freqs: [style.tonic / 4], vel: 0.9 });
    ev.push({ inst: 'kenong', beat: 2, dur: 2, freqs: [scaleFreq(style, (bar % 2) * 2)], vel: 0.45 });
    // saron: balungan (skeleton melody), one note per beat, as a random walk
    let deg = 5 + ((bar * 3) % 5);
    for (let b = 0; b < 4; b++) {
      deg += rng.int(-2, 2);
      deg = Math.max(3, Math.min(11, deg));
      ev.push({ inst: 'saron', beat: b, dur: 1, freqs: [scaleFreq(style, deg)], vel: 0.5 });
      // bonang: elaborates the balungan in off-beat eighths an octave up
      if (rng.chance(0.75)) ev.push({ inst: 'bonang', beat: b + 0.5, dur: 0.5, freqs: [scaleFreq(style, deg + 5 + rng.int(-1, 1))], vel: 0.32 });
    }
    // seruling phrase on alternate bars
    if (bar % 2 === 1 || rng.chance(0.3)) {
      let d = 8 + rng.int(0, 4);
      let beat = rng.chance(0.5) ? 0 : 0.5;
      while (beat < 4) {
        const len = [0.5, 1, 1.5, 2][rng.int(0, 3)];
        ev.push({ inst: 'seruling', beat, dur: Math.min(len, 4 - beat), freqs: [scaleFreq(style, d)], vel: 0.28 });
        beat += len + (rng.chance(0.3) ? 0.5 : 0);
        d += rng.int(-1, 1);
      }
    }
  } else {
    const prog = PROGRESSIONS[era] ?? PROGRESSIONS[3];
    const chord = prog[Math.floor(bar / 2) % prog.length];
    const semi = (s: number) => style.tonic * 2 ** (s / 12);
    if (bar % 2 === 0) ev.push({ inst: 'pad', beat: 0, dur: 8, freqs: chord.map((s) => semi(s - 12)), vel: 0.22 });
    ev.push({ inst: 'bass', beat: 0, dur: 3.5, freqs: [semi(chord[0] - 24)], vel: 0.3 });
    if (era >= 4 || rng.chance(0.4)) {
      const steps = era >= 4 ? 8 : 4;
      for (let k = 0; k < steps; k++) {
        if (!rng.chance(era >= 4 ? 0.7 : 0.5)) continue;
        const s = chord[rng.int(0, chord.length - 1)] + (rng.chance(0.5) ? 12 : 0);
        ev.push({ inst: 'pluck', beat: k * (4 / steps), dur: 0.5, freqs: [semi(s)], vel: 0.16 });
      }
    }
  }
  return ev;
}

export interface AudioSettings {
  muted: boolean;
  volume: number;
  music: number;
  sfx: number;
}

const SETTINGS_KEY = 'tamadun-kota:audio';
const DEFAULTS: AudioSettings = { muted: false, volume: 0.7, music: 0.55, sfx: 0.8 };

function readSettings(): AudioSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

type CtxFactory = () => AudioContext | null;

const defaultFactory: CtxFactory = () => {
  const w = typeof window !== 'undefined' ? (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }) : null;
  const C = w?.AudioContext ?? w?.webkitAudioContext;
  return C ? new C() : null;
};

export class SoundEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  settings: AudioSettings;
  era = 1;
  playing = false;
  private bar = 0;
  private nextBarTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seed = 1;
  private lastSfx: Partial<Record<SfxId, number>> = {};
  /** number of sfx and notes scheduled (diagnostics/tests) */
  stats = { sfx: 0, notes: 0 };
  private listeners = new Set<() => void>();

  constructor(private factory: CtxFactory = defaultFactory) {
    this.settings = readSettings();
  }

  get available() {
    return this.ctx !== null;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private changed() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    for (const l of this.listeners) l();
  }

  /** Create / resume the AudioContext. Call from a user gesture. */
  unlock(): boolean {
    try {
      if (!this.ctx) {
        const ctx = this.factory();
        if (!ctx) return false;
        this.ctx = ctx;
        this.build();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);
    this.sfxBus.connect(this.master);
    this.reverb.connect(wet);
    wet.connect(this.master);
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    const rng = new Rng(4242);
    for (let i = 0; i < len; i++) d[i] = rng.next() * 2 - 1;
    this.applyVolumes();
  }

  /** Synthetic reverb impulse: decaying stereo noise. */
  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const rng = new Rng(77);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (rng.next() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  private applyVolumes() {
    if (!this.ctx || !this.master) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.volume, t, 0.05);
    this.musicBus!.gain.setTargetAtTime(s.music * 0.5, t, 0.1);
    this.sfxBus!.gain.setTargetAtTime(s.sfx, t, 0.05);
  }

  setMuted(m: boolean) {
    this.settings.muted = m;
    this.applyVolumes();
    this.changed();
  }
  toggleMute() {
    this.setMuted(!this.settings.muted);
  }
  setVolume(kind: 'volume' | 'music' | 'sfx', v: number) {
    this.settings[kind] = Math.max(0, Math.min(1, v));
    this.applyVolumes();
    this.changed();
  }

  setEra(era: number) {
    this.era = Math.max(1, Math.min(4, Math.round(era)));
  }

  // ------------------------------------------------------------------ music

  startMusic(seed = 1) {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.seed = seed;
    this.nextBarTime = this.ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  stopMusic() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const style = ERA_STYLES[this.era];
    const spb = 60 / style.bpm;
    while (this.nextBarTime < ctx.currentTime + 1.2) {
      const t0 = this.nextBarTime;
      for (const e of composeBar(this.era, this.bar, this.seed)) this.note(e, t0 + e.beat * spb, e.dur * spb);
      this.bar++;
      this.nextBarTime += 4 * spb;
    }
  }

  private osc(type: OscillatorType, freq: number, t: number, end: number, dest: AudioNode, detune = 0): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }

  private env(t: number, attack: number, peak: number, decay: number, dest: AudioNode, release = 0): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    if (release > 0) {
      g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + decay);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + release);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  private noiseSrc(t: number, dur: number, dest: AudioNode): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }

  private filter(type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }

  /** Metallophone: inharmonic partials plus a detuned twin for the gamelan "ombak" beat. */
  private metal(freq: number, t: number, decay: number, vel: number, dest: AudioNode, partials: number[] = [1, 2.76, 5.4]) {
    partials.forEach((p, k) => {
      const g = this.env(t, 0.003, (vel / (k + 1.5)) * 0.9, decay / (k * 0.8 + 1), dest);
      this.osc('sine', freq * p, t, t + decay + 0.1, g);
      if (k === 0) this.osc('sine', freq * p + 2.8, t, t + decay + 0.1, g);
    });
  }

  private note(e: NoteEvent, t: number, dur: number) {
    const bus = this.musicBus!;
    this.stats.notes++;
    const [f] = e.freqs;
    switch (e.inst) {
      case 'gong': {
        const g = this.env(t, 0.02, e.vel * 0.7, 5.5, bus);
        this.osc('sine', f, t, t + 6, g);
        this.osc('sine', f + 1.6, t, t + 6, g);
        this.osc('sine', f * 2.01, t, t + 4, this.env(t, 0.02, e.vel * 0.18, 3.5, bus));
        this.osc('sine', f * 2.9, t, t + 2, this.env(t, 0.01, e.vel * 0.06, 1.5, bus));
        break;
      }
      case 'kenong':
        this.metal(f, t, 2.2, e.vel, bus, [1, 2.4]);
        break;
      case 'saron':
        this.metal(f, t, 1.3, e.vel, bus);
        break;
      case 'bonang':
        this.metal(f, t, 0.8, e.vel, bus, [1, 3.0, 4.2]);
        break;
      case 'seruling': {
        // bamboo flute: sine + soft triangle, delayed vibrato, breath noise
        const g = this.env(t, 0.09, e.vel, Math.max(0.05, dur - 0.15), bus, 0.18);
        const o1 = this.osc('sine', f * 2, t, t + dur + 0.3, g);
        const o2 = this.osc('triangle', f * 2, t, t + dur + 0.3, this.env(t, 0.09, e.vel * 0.25, Math.max(0.05, dur - 0.15), bus, 0.18));
        const lfo = this.ctx!.createOscillator();
        const depth = this.ctx!.createGain();
        lfo.frequency.value = 5.4;
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.4, dur * 0.6));
        lfo.connect(depth);
        depth.connect(o1.frequency);
        depth.connect(o2.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.3);
        o1.frequency.setValueAtTime(f * 2 * 0.985, t);
        o1.frequency.exponentialRampToValueAtTime(f * 2, t + 0.08);
        this.noiseSrc(t, dur + 0.2, this.filter('bandpass', f * 4, 2.5, this.env(t, 0.05, e.vel * 0.12, dur, bus, 0.1)));
        break;
      }
      case 'pad': {
        const lp = this.filter('lowpass', 900, 0.7, this.env(t, 1.6, e.vel, Math.max(0.2, dur - 1.6), bus, 1.8));
        lp.frequency.setValueAtTime(600, t);
        lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
        lp.frequency.linearRampToValueAtTime(800, t + dur + 1.5);
        for (const fr of e.freqs) {
          this.osc('sawtooth', fr, t, t + dur + 2, lp, -7);
          this.osc('sawtooth', fr, t, t + dur + 2, lp, 7);
        }
        break;
      }
      case 'bass':
        this.osc('sine', f, t, t + dur + 0.6, this.env(t, 0.04, e.vel, dur, bus, 0.5));
        break;
      case 'pluck': {
        const g = this.env(t, 0.004, e.vel, 0.6, bus);
        this.osc('triangle', f * 2, t, t + 0.7, g);
        // echo
        const g2 = this.env(t + 0.27, 0.004, e.vel * 0.4, 0.5, bus);
        this.osc('sine', f * 2, t + 0.27, t + 0.9, g2);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ effects

  play(id: SfxId) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.settings.muted) return;
    const now = ctx.currentTime;
    // throttle rapid repeats of the same effect
    const last = this.lastSfx[id] ?? -1;
    if (now - last < (id === 'road' || id === 'click' ? 0.04 : 0.08)) return;
    this.lastSfx[id] = now;
    this.stats.sfx++;
    const out = this.sfxBus;
    const t = now + 0.01;
    switch (id) {
      case 'place': {
        // a solid timber "thunk": pitched body + woody click
        const g = this.env(t, 0.004, 0.7, 0.22, out);
        const o = this.osc('sine', 150, t, t + 0.3, g);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.2);
        this.noiseSrc(t, 0.06, this.filter('bandpass', 2200, 1.4, this.env(t, 0.002, 0.45, 0.05, out)));
        this.noiseSrc(t, 0.12, this.filter('lowpass', 700, 0.8, this.env(t, 0.003, 0.4, 0.1, out)));
        break;
      }
      case 'road':
        // gravel crunch
        for (let k = 0; k < 3; k++) this.noiseSrc(t + k * 0.035, 0.05, this.filter('bandpass', 1400 + k * 300, 1.8, this.env(t + k * 0.035, 0.002, 0.3, 0.04, out)));
        break;
      case 'zone': {
        const o = this.osc('sine', 420, t, t + 0.18, this.env(t, 0.005, 0.3, 0.14, out));
        o.frequency.exponentialRampToValueAtTime(640, t + 0.12);
        break;
      }
      case 'bulldoze':
        this.noiseSrc(t, 0.45, this.filter('lowpass', 380, 1.2, this.env(t, 0.02, 0.6, 0.38, out)));
        this.osc('sawtooth', 48, t, t + 0.4, this.filter('lowpass', 200, 1, this.env(t, 0.02, 0.25, 0.35, out)));
        break;
      case 'coin':
        this.osc('square', 988, t, t + 0.09, this.filter('lowpass', 4000, 0.7, this.env(t, 0.002, 0.18, 0.08, out)));
        this.osc('square', 1319, t + 0.08, t + 0.4, this.filter('lowpass', 4000, 0.7, this.env(t + 0.08, 0.002, 0.18, 0.3, out)));
        break;
      case 'fanfare':
      case 'victory': {
        const base = this.era <= 2 ? 293.66 : 261.63;
        const steps = this.era <= 2 ? [0, 474, 717, 1200] : [0, 400, 700, 1200];
        const n = id === 'victory' ? 2 : 1;
        for (let r = 0; r < n; r++)
          steps.forEach((c, k) => {
            const tt = t + r * 0.6 + k * 0.12;
            const f = base * 2 * cents(c);
            if (this.era <= 2) this.metal(f, tt, 1.4, 0.55, out);
            else {
              const lp = this.filter('lowpass', 2200, 1, this.env(tt, 0.02, 0.28, k === 3 ? 0.9 : 0.15, out, 0.2));
              this.osc('sawtooth', f, tt, tt + 1.3, lp, -5);
              this.osc('sawtooth', f, tt, tt + 1.3, lp, 5);
            }
          });
        break;
      }
      case 'thunder': {
        // crack, then a long rolling rumble
        this.noiseSrc(t, 0.25, this.filter('highpass', 1500, 0.7, this.env(t, 0.003, 0.5, 0.2, out)));
        const lp = this.filter('lowpass', 500, 0.8, this.env(t + 0.05, 0.15, 0.9, 2.6, out, 0.6));
        lp.frequency.setValueAtTime(500, t);
        lp.frequency.exponentialRampToValueAtTime(110, t + 3);
        this.noiseSrc(t + 0.05, 3.5, lp);
        break;
      }
      case 'era': {
        const g = this.env(t, 0.02, 0.6, 4.5, out);
        this.osc('sine', 73.4, t, t + 5, g);
        this.osc('sine', 75, t, t + 5, g);
        [0, 4, 7, 12].forEach((s, k) => {
          const f = 293.66 * 2 ** (s / 12);
          this.osc('triangle', f, t + 0.3 + k * 0.18, t + 3.5, this.env(t + 0.3 + k * 0.18, 0.3, 0.12, 1.8, out, 0.8));
        });
        break;
      }
      case 'crisis':
        [0, 6].forEach((s, k) => this.osc('sawtooth', 220 * 2 ** (s / 12), t + k * 0.05, t + 1.2, this.filter('lowpass', 1200, 2, this.env(t + k * 0.05, 0.01, 0.2, 0.9, out, 0.2))));
        this.osc('sine', 55, t, t + 1.5, this.env(t, 0.01, 0.5, 1.2, out));
        break;
      case 'error':
        for (let k = 0; k < 2; k++) this.osc('square', 150, t + k * 0.13, t + k * 0.13 + 0.1, this.filter('lowpass', 900, 1, this.env(t + k * 0.13, 0.003, 0.18, 0.08, out)));
        break;
      case 'click':
        this.osc('sine', 1250, t, t + 0.03, this.env(t, 0.001, 0.15, 0.025, out));
        break;
    }
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

/** Shared engine for the app. */
export const sound = new SoundEngine();
