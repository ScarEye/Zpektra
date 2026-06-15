// Turns raw FFT data into a reactive object that visualizers read each frame.
//
// Eight named frequency bands let different parts of the music drive different
// visual features:
//   subBass  (20-60Hz)    kick / rumble
//   bass     (60-160Hz)   bass guitar / low drums
//   lowMid   (160-400Hz)  body / low instruments
//   mid      (400-1kHz)   instruments
//   vocal    (1k-3kHz)    vocals / lyrics presence
//   presence (3k-6kHz)    consonants / attack / clarity
//   brilliance (6k-12kHz) cymbals / hats / shimmer
//   air      (12k-18kHz)  air / sparkle
//
// Also exposes: bass/mid/treble (grouped, for convenience), energy, beat,
// level, activity (master gate -> freezes motion on silence/pause), and a
// 96-bin spectrum.

import { Capture } from './capture.js';

const SR = 44100;

// [name, lowHz, highHz]
const BAND_DEFS = [
  ['subBass', 20, 60],
  ['bass', 60, 160],
  ['lowMid', 160, 400],
  ['mid', 400, 1000],
  ['vocal', 1000, 3000],
  ['presence', 3000, 6000],
  ['brilliance', 6000, 12000],
  ['air', 12000, 18000],
];

export const BAND_NAMES = BAND_DEFS.map((b) => b[0]);

export class Reactor {
  constructor() {
    this.freq = null;
    this.bins = 0;

    // grouped (compat with existing visualizers)
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
    this.beat = 0;
    this.level = 0;
    this.activity = 0;
    this.playing = true;

    // per-band, 0..1, smoothed
    this.bands = {};
    BAND_NAMES.forEach((n) => (this.bands[n] = 0));

    this.spectrum = new Float32Array(96);

    this._energyHistory = new Array(43).fill(0);
    this._histIdx = 0;
    this._beatCooldown = 0;
    this._t = 0;
  }

  setPlaying(p) {
    this.playing = p;
  }

  _ensureBuffer(analyser) {
    if (!this.freq || this.bins !== analyser.frequencyBinCount) {
      this.bins = analyser.frequencyBinCount;
      this.freq = new Uint8Array(this.bins);
    }
  }

  _bandAvg(fromHz, toHz) {
    const nyquist = SR / 2;
    const lo = Math.floor((fromHz / nyquist) * this.bins);
    const hi = Math.min(this.bins - 1, Math.ceil((toHz / nyquist) * this.bins));
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += this.freq[i];
    return sum / Math.max(1, hi - lo + 1) / 255;
  }

  update(dt) {
    this._t += dt;
    const analyser = Capture.getAnalyser();

    if (!analyser) {
      // No audio captured: everything goes still. We do NOT fake any motion —
      // if there's no live sound, the visuals must not move.
      BAND_NAMES.forEach((n) => (this.bands[n] = 0));
      this.bass = 0;
      this.mid = 0;
      this.treble = 0;
      this.energy = 0;
      this.beat *= Math.exp(-dt * 6);
      this.level += (0 - this.level) * 0.1;
      this.activity += (0 - this.activity) * 0.1;
      for (let i = 0; i < this.spectrum.length; i++) {
        this.spectrum[i] += (0 - this.spectrum[i]) * 0.1;
      }
      return this;
    }

    this._ensureBuffer(analyser);
    analyser.getByteFrequencyData(this.freq);

    // Per-band with light smoothing (snappy but not jittery).
    const k = 0.5;
    let bandSum = 0;
    for (const [name, lo, hi] of BAND_DEFS) {
      const v = this._bandAvg(lo, hi);
      this.bands[name] += (v - this.bands[name]) * k;
      bandSum += this.bands[name];
    }

    // Grouped convenience values.
    this.bass = Math.max(this.bands.subBass, this.bands.bass);
    this.mid = (this.bands.lowMid + this.bands.mid + this.bands.vocal) / 3;
    this.treble = (this.bands.presence + this.bands.brilliance + this.bands.air) / 3;
    this.energy = bandSum / BAND_DEFS.length;

    // Spectrum (96 bins) across the audible range.
    const step = this.bins / this.spectrum.length;
    for (let i = 0; i < this.spectrum.length; i++) {
      const v = this.freq[Math.floor(i * step)] / 255;
      this.spectrum[i] += (v - this.spectrum[i]) * 0.6;
    }

    // Smoothed loudness: fast attack, slow release.
    const inst = this.energy;
    this.level += (inst - this.level) * (inst > this.level ? 0.5 : 0.06);

    // Master activity gate (0 when paused/silent).
    let target = Math.min(1, Math.max(0, (this.level - 0.02) * 6));
    if (!this.playing) target = 0;
    this.activity += (target - this.activity) * (target < this.activity ? 0.12 : 0.3);

    // Beat detection on low-frequency energy.
    const bInst = this.bass * this.bass;
    const hist = this._energyHistory;
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    const variance = hist.reduce((a, b) => a + (b - avg) ** 2, 0) / hist.length;
    const threshold = avg * (1.3 + variance * 0.5) + 0.005;

    this._beatCooldown -= dt;
    if (bInst > threshold && this._beatCooldown <= 0 && this.activity > 0.15) {
      this.beat = 1;
      this._beatCooldown = 0.1;
    } else {
      this.beat *= Math.exp(-dt * 8);
    }
    hist[this._histIdx] = bInst;
    this._histIdx = (this._histIdx + 1) % hist.length;

    return this;
  }
}
