/** Raw FFT + waveform snapshot for one analysis tick. */
export class AudioFrame {
  constructor() {
    this.freq = null;
    this.time = null;
    this.bins = 0;
    this.sampleRate = 44100;
  }

  ensure(analyser) {
    const n = analyser.frequencyBinCount;
    if (!this.freq || this.bins !== n) {
      this.bins = n;
      this.freq = new Uint8Array(n);
      this.time = new Uint8Array(analyser.fftSize);
      this._prevMag = new Float32Array(n);
    }
  }

  read(analyser, sampleRate) {
    this.ensure(analyser);
    this.sampleRate = sampleRate || 44100;
    analyser.getByteFrequencyData(this.freq);
    analyser.getByteTimeDomainData(this.time);
    return this;
  }

  /** Mean magnitude in [fromHz, toHz], 0–1. */
  bandAvg(fromHz, toHz) {
    const nyquist = this.sampleRate / 2;
    const lo = Math.max(0, Math.floor((fromHz / nyquist) * this.bins));
    const hi = Math.min(this.bins - 1, Math.ceil((toHz / nyquist) * this.bins));
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += this.freq[i];
    return sum / Math.max(1, hi - lo + 1) / 255;
  }

  /** Sum of positive bin-to-bin magnitude diffs (spectral flux), normalized. */
  spectralFlux() {
    let flux = 0;
    const n = this.bins;
    const prev = this._prevMag;
    for (let i = 0; i < n; i++) {
      const m = this.freq[i] / 255;
      const d = m - prev[i];
      if (d > 0) flux += d;
      prev[i] = m;
    }
    return flux / n;
  }

  /** Flux restricted to a Hz range. */
  bandFlux(fromHz, toHz) {
    const nyquist = this.sampleRate / 2;
    const lo = Math.max(0, Math.floor((fromHz / nyquist) * this.bins));
    const hi = Math.min(this.bins - 1, Math.ceil((toHz / nyquist) * this.bins));
    let flux = 0;
    const prev = this._prevMag;
    // Use current freq vs prev (prev already updated by spectralFlux if called first —
    // callers should use bandFlux before full flux, or we compute from stored prev).
    for (let i = lo; i <= hi; i++) {
      const m = this.freq[i] / 255;
      const d = m - prev[i];
      if (d > 0) flux += d;
    }
    return flux / Math.max(1, hi - lo + 1);
  }
}
