import { Capture } from './capture.js';

const SR = 44100;

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

    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
    this.beat = 0;
    this.level = 0;
    this.activity = 0;
    this.playing = true;

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

    const k = 0.5;
    let bandSum = 0;
    for (const [name, lo, hi] of BAND_DEFS) {
      const v = this._bandAvg(lo, hi);
      this.bands[name] += (v - this.bands[name]) * k;
      bandSum += this.bands[name];
    }

    this.bass = Math.max(this.bands.subBass, this.bands.bass);
    this.mid = (this.bands.lowMid + this.bands.mid + this.bands.vocal) / 3;
    this.treble = (this.bands.presence + this.bands.brilliance + this.bands.air) / 3;
    this.energy = bandSum / BAND_DEFS.length;

    const step = this.bins / this.spectrum.length;
    for (let i = 0; i < this.spectrum.length; i++) {
      const v = this.freq[Math.floor(i * step)] / 255;
      this.spectrum[i] += (v - this.spectrum[i]) * 0.6;
    }

    const inst = this.energy;
    this.level += (inst - this.level) * (inst > this.level ? 0.5 : 0.06);

    let target = Math.min(1, Math.max(0, (this.level - 0.02) * 6));
    if (!this.playing) target = 0;
    this.activity += (target - this.activity) * (target < this.activity ? 0.12 : 0.3);

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
