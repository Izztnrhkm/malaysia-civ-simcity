// Procedural era music:
//  - Eras 1-2: gamelan-inspired. Saron/bonang metallophones in slendro- and pelog-like
//    tunings with paired, slightly detuned partials (the shimmering "ombak" beat), a gong
//    closing each 4-bar gongan, kenong strokes and a breathy seruling (bamboo flute).
//  - Eras 3-4: warm detuned pads on seventh / ninth chords, soft bass, era-4 arpeggios.
// RenderLoop() produces a mono float buffer that AudioAtmosphereManager loads into an AudioClip.
using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    public enum Instrument { Bonang, Saron, Gong, Kenong, Seruling, Pad, Bass, Pluck }

    public struct NoteEvent
    {
        public Instrument inst;
        public double beat, dur, vel;
        public double[] freqs;
    }

    public static class ProceduralMusic
    {
        public static readonly int[] Slendro = { 0, 231, 474, 717, 955 };
        public static readonly int[] Pelog = { 0, 120, 270, 540, 670 };

        public struct EraStyle
        {
            public double bpm, tonic;
            public bool gamelan;
            public int[] scale;
        }

        public static EraStyle Style(int era)
        {
            switch (era)
            {
                case 2: return new EraStyle { bpm = 74, tonic = 261.63, gamelan = true, scale = Pelog };
                case 3: return new EraStyle { bpm = 78, tonic = 261.63, gamelan = false, scale = new[] { 0, 200, 400, 700, 900 } };
                case 4: return new EraStyle { bpm = 88, tonic = 293.66, gamelan = false, scale = new[] { 0, 200, 400, 700, 900, 1100 } };
                default: return new EraStyle { bpm = 66, tonic = 293.66, gamelan = true, scale = Slendro };
            }
        }

        static readonly int[][] Prog3 = { new[] { 0, 4, 7, 11 }, new[] { -3, 0, 4, 7 }, new[] { -7, -3, 0, 4 }, new[] { -5, -1, 2, 5 } };
        static readonly int[][] Prog4 = { new[] { 0, 4, 7, 11, 14 }, new[] { -3, 0, 4, 7, 11 }, new[] { -7, -3, 0, 4, 9 }, new[] { -5, -1, 2, 7, 9 } };

        static double Cents(double c) => Math.Pow(2, c / 1200);

        public static double ScaleFreq(EraStyle s, int degree)
        {
            int n = s.scale.Length;
            int oct = (int)Math.Floor(degree / (double)n);
            int d = ((degree % n) + n) % n;
            return s.tonic * Math.Pow(2, oct) * Cents(s.scale[d]);
        }

        /// <summary>Compose one 4-beat bar; deterministic for (era, bar, seed). Port of composeBar.</summary>
        public static List<NoteEvent> ComposeBar(int era, int bar, int seed = 1)
        {
            var s = Style(era);
            var rng = new Rng((uint)(seed * 7919 + bar * 104729 + era * 31) == 0 ? 1u : (uint)(seed * 7919 + bar * 104729 + era * 31));
            var ev = new List<NoteEvent>(24);
            if (s.gamelan)
            {
                if (bar % 4 == 0) ev.Add(new NoteEvent { inst = Instrument.Gong, beat = 0, dur = 8, freqs = new[] { s.tonic / 4 }, vel = 0.9 });
                ev.Add(new NoteEvent { inst = Instrument.Kenong, beat = 2, dur = 2, freqs = new[] { ScaleFreq(s, (bar % 2) * 2) }, vel = 0.45 });
                int deg = 5 + (bar * 3) % 5;
                for (int b = 0; b < 4; b++)
                {
                    deg = Math.Max(3, Math.Min(11, deg + rng.Int(-2, 2)));
                    ev.Add(new NoteEvent { inst = Instrument.Saron, beat = b, dur = 1, freqs = new[] { ScaleFreq(s, deg) }, vel = 0.5 });
                    if (rng.Chance(0.75)) ev.Add(new NoteEvent { inst = Instrument.Bonang, beat = b + 0.5, dur = 0.5, freqs = new[] { ScaleFreq(s, deg + 5 + rng.Int(-1, 1)) }, vel = 0.32 });
                }
                if (bar % 2 == 1 || rng.Chance(0.3))
                {
                    int d = 8 + rng.Int(0, 4);
                    double beat = rng.Chance(0.5) ? 0 : 0.5;
                    double[] lens = { 0.5, 1, 1.5, 2 };
                    while (beat < 4)
                    {
                        double len = lens[rng.Int(0, 3)];
                        ev.Add(new NoteEvent { inst = Instrument.Seruling, beat = beat, dur = Math.Min(len, 4 - beat), freqs = new[] { ScaleFreq(s, d) }, vel = 0.28 });
                        beat += len + (rng.Chance(0.3) ? 0.5 : 0);
                        d += rng.Int(-1, 1);
                    }
                }
            }
            else
            {
                var prog = era >= 4 ? Prog4 : Prog3;
                var chord = prog[(bar / 2) % prog.Length];
                double Semi(int st) => s.tonic * Math.Pow(2, st / 12.0);
                if (bar % 2 == 0)
                {
                    var f = new double[chord.Length];
                    for (int i = 0; i < chord.Length; i++) f[i] = Semi(chord[i] - 12);
                    ev.Add(new NoteEvent { inst = Instrument.Pad, beat = 0, dur = 8, freqs = f, vel = 0.22 });
                }
                ev.Add(new NoteEvent { inst = Instrument.Bass, beat = 0, dur = 3.5, freqs = new[] { Semi(chord[0] - 24) }, vel = 0.3 });
                if (era >= 4 || rng.Chance(0.4))
                {
                    int steps = era >= 4 ? 8 : 4;
                    for (int k = 0; k < steps; k++)
                    {
                        if (!rng.Chance(era >= 4 ? 0.7 : 0.5)) continue;
                        int st = chord[rng.Int(0, chord.Length - 1)] + (rng.Chance(0.5) ? 12 : 0);
                        ev.Add(new NoteEvent { inst = Instrument.Pluck, beat = k * (4.0 / steps), dur = 0.5, freqs = new[] { Semi(st) }, vel = 0.16 });
                    }
                }
            }
            return ev;
        }

        /// <summary>Render <paramref name="bars"/> bars of an era's music into a mono buffer (seamless loop: tails wrap around).</summary>
        public static float[] RenderLoop(int era, int bars, int sampleRate, int seed = 1)
        {
            var s = Style(era);
            double spb = 60.0 / s.bpm;
            int len = (int)(bars * 4 * spb * sampleRate);
            var buf = new float[len];
            for (int bar = 0; bar < bars; bar++)
            {
                double t0 = bar * 4 * spb;
                foreach (var e in ComposeBar(era, bar, seed)) RenderNote(buf, sampleRate, e, t0 + e.beat * spb, e.dur * spb);
            }
            // soft limiter
            float peak = 0;
            for (int i = 0; i < len; i++) peak = Math.Max(peak, Math.Abs(buf[i]));
            float gain = peak > 0.9f ? 0.9f / peak : 1f;
            for (int i = 0; i < len; i++) buf[i] = (float)Math.Tanh(buf[i] * gain);
            return buf;
        }

        static void AddSine(float[] buf, int sr, double t, double dur, double freq, double amp, double attack, double decay, double vibrato = 0)
        {
            int start = (int)(t * sr);
            int n = (int)((dur + decay) * sr);
            double phase = 0;
            for (int k = 0; k < n; k++)
            {
                double time = k / (double)sr;
                double env = time < attack ? time / attack : Math.Exp(-(time - attack) / Math.Max(1e-3, decay / 4));
                if (env < 1e-4 && time > attack) break;
                double f = freq * (1 + vibrato * Math.Sin(2 * Math.PI * 5.4 * time) * Math.Min(1, time / 0.4));
                phase += 2 * Math.PI * f / sr;
                int idx = (start + k) % buf.Length;
                buf[idx] += (float)(amp * env * Math.Sin(phase));
            }
        }

        static void RenderNote(float[] buf, int sr, NoteEvent e, double t, double dur)
        {
            double f = e.freqs[0];
            switch (e.inst)
            {
                case Instrument.Gong:
                    AddSine(buf, sr, t, 0.1, f, e.vel * 0.5, 0.02, 5.5);
                    AddSine(buf, sr, t, 0.1, f + 1.6, e.vel * 0.5, 0.02, 5.5);
                    AddSine(buf, sr, t, 0.1, f * 2.01, e.vel * 0.15, 0.02, 3.5);
                    break;
                case Instrument.Kenong:
                case Instrument.Saron:
                case Instrument.Bonang:
                    double decay = e.inst == Instrument.Kenong ? 2.2 : e.inst == Instrument.Saron ? 1.3 : 0.8;
                    double[] partials = e.inst == Instrument.Bonang ? new[] { 1, 3.0, 4.2 } : new[] { 1, 2.76, 5.4 };
                    for (int k = 0; k < partials.Length; k++)
                    {
                        AddSine(buf, sr, t, 0.01, f * partials[k], e.vel / (k + 1.5) * 0.6, 0.003, decay / (k * 0.8 + 1));
                        if (k == 0) AddSine(buf, sr, t, 0.01, f + 2.8, e.vel / 1.5 * 0.6, 0.003, decay); // ombak beat
                    }
                    break;
                case Instrument.Seruling:
                    AddSine(buf, sr, t, dur, f * 2, e.vel * 0.7, 0.09, 0.3, 0.012);
                    AddSine(buf, sr, t, dur, f * 4, e.vel * 0.08, 0.09, 0.2, 0.012);
                    break;
                case Instrument.Pad:
                    foreach (var pf in e.freqs)
                    {
                        AddSine(buf, sr, t, dur, pf * 0.996, e.vel * 0.18, 1.6, 2.0);
                        AddSine(buf, sr, t, dur, pf * 1.004, e.vel * 0.18, 1.6, 2.0);
                        AddSine(buf, sr, t, dur, pf * 2, e.vel * 0.05, 1.6, 2.0);
                    }
                    break;
                case Instrument.Bass:
                    AddSine(buf, sr, t, dur, f, e.vel * 0.8, 0.04, 0.6);
                    break;
                default:
                    AddSine(buf, sr, t, 0.01, f * 2, e.vel, 0.004, 0.6);
                    AddSine(buf, sr, t + 0.27, 0.01, f * 2, e.vel * 0.4, 0.004, 0.5);
                    break;
            }
        }

        /// <summary>Ambient bed: tropical rainforest (cicada shimmer + bird chirps) or the sea (swell). Seamless loop.</summary>
        public static float[] RenderAmbience(bool sea, int seconds, int sampleRate, int seed = 7)
        {
            int n = seconds * sampleRate;
            var buf = new float[n];
            var rng = new Rng((uint)seed);
            double lp = 0, lp2 = 0;
            for (int i = 0; i < n; i++)
            {
                double white = rng.Next() * 2 - 1;
                double t = i / (double)sampleRate;
                if (sea)
                {
                    lp += (white - lp) * 0.02;
                    lp2 += (lp - lp2) * 0.05;
                    double swell = 0.55 + 0.45 * Math.Sin(2 * Math.PI * t / seconds * 3);
                    buf[i] = (float)(lp2 * 3.5 * swell);
                }
                else
                {
                    lp += (white - lp) * 0.6;
                    double cicada = (white - lp) * 0.05 * (0.6 + 0.4 * Math.Sin(2 * Math.PI * t * 0.25));
                    buf[i] = (float)cicada;
                }
            }
            if (!sea)
            {
                for (int c = 0; c < seconds / 2; c++)
                {
                    double at = rng.Range(0, seconds - 1);
                    double f0 = rng.Range(1800, 3400);
                    int start = (int)(at * sampleRate);
                    int len = (int)(0.18 * sampleRate);
                    double phase = 0;
                    for (int k = 0; k < len; k++)
                    {
                        double tt = k / (double)sampleRate;
                        double f = f0 * (1 + 0.25 * Math.Sin(2 * Math.PI * 14 * tt));
                        phase += 2 * Math.PI * f / sampleRate;
                        buf[(start + k) % n] += (float)(0.05 * Math.Sin(Math.PI * tt / 0.18) * Math.Sin(phase));
                    }
                }
            }
            return buf;
        }
    }
}
