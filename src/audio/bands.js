export const BAND_DEFS = [
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

const SPECTRUM_BINS = 96;
const SPECTRUM_FMIN = 40;
const SPECTRUM_FMAX = 16000;

function envelope(cur, target, attack, release) {
  const k = target > cur ? attack : release;
  return cur + (target - cur) * k;
}

/** Log/Mel-ish band envelopes + perceptual spectrum. */
export class BandEnvelopes {
  constructor() {
    this.bands = {};
    BAND_NAMES.forEach((n) => {
      this.bands[n] = 0;
    });
    this.spectrum = new Float32Array(SPECTRUM_BINS);
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
  }

  reset() {
    BAND_NAMES.forEach((n) => {
      this.bands[n] = 0;
    });
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
    this.spectrum.fill(0);
  }

  update(frame, attack = 0.85, release = 0.18) {
    let bandSum = 0;
    for (const [name, lo, hi] of BAND_DEFS) {
      const v = frame.bandAvg(lo, hi);
      this.bands[name] = envelope(this.bands[name], v, attack, release);
      bandSum += this.bands[name];
    }

    this.bass = Math.max(this.bands.subBass, this.bands.bass);
    this.mid = (this.bands.lowMid + this.bands.mid + this.bands.vocal) / 3;
    this.treble = (this.bands.presence + this.bands.brilliance + this.bands.air) / 3;
    this.energy = bandSum / BAND_DEFS.length;

    const sr = frame.sampleRate;
    const nyquist = sr / 2;
    const bins = frame.bins;
    const logMin = Math.log(SPECTRUM_FMIN);
    const logMax = Math.log(Math.min(SPECTRUM_FMAX, nyquist * 0.98));

    for (let i = 0; i < SPECTRUM_BINS; i++) {
      const t0 = i / SPECTRUM_BINS;
      const t1 = (i + 1) / SPECTRUM_BINS;
      const f0 = Math.exp(logMin + (logMax - logMin) * t0);
      const f1 = Math.exp(logMin + (logMax - logMin) * t1);
      const lo = Math.floor((f0 / nyquist) * bins);
      const hi = Math.min(bins - 1, Math.ceil((f1 / nyquist) * bins));
      let sum = 0;
      for (let b = lo; b <= hi; b++) sum += frame.freq[b];
      const v = sum / Math.max(1, hi - lo + 1) / 255;
      this.spectrum[i] = envelope(this.spectrum[i], v, 0.7, 0.25);
    }
  }

  fade(dt) {
    const k = Math.min(1, dt * 4);
    BAND_NAMES.forEach((n) => {
      this.bands[n] *= 1 - k;
    });
    this.bass *= 1 - k;
    this.mid *= 1 - k;
    this.treble *= 1 - k;
    this.energy *= 1 - k;
    for (let i = 0; i < this.spectrum.length; i++) {
      this.spectrum[i] *= 1 - k;
    }
  }
}
