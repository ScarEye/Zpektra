function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mad(arr, med) {
  const devs = arr.map((v) => Math.abs(v - med));
  return median(devs) || 0.0001;
}

/** Broadband spectral-flux onset detector. */
export class SpectralFluxDetector {
  constructor() {
    this.flux = 0;
    this.onset = 0;
    this._hist = new Array(40).fill(0);
    this._idx = 0;
    this._cooldown = 0;
    this._prevReady = false;
  }

  reset() {
    this.flux = 0;
    this.onset = 0;
    this._hist.fill(0);
    this._idx = 0;
    this._cooldown = 0;
    this._prevReady = false;
  }

  update(frame, dt, minGap = 0.08) {
    // Compute flux before mutating prev mags used by band detectors —
    // Frame.spectralFlux updates _prevMag; kick/snare should run bandFlux first.
    const raw = frame.spectralFlux();
    this.flux = raw;

    if (!this._prevReady) {
      this._prevReady = true;
      this.onset *= Math.exp(-dt * 14);
      return this.onset;
    }

    this._hist[this._idx] = raw;
    this._idx = (this._idx + 1) % this._hist.length;

    const med = median(this._hist);
    const m = mad(this._hist, med);
    const threshold = med + Math.max(0.0025, m * 3.2);

    this._cooldown -= dt;
    if (raw > threshold && this._cooldown <= 0 && raw > 0.0015) {
      this.onset = Math.min(1, (raw - threshold) / (threshold + 0.01) * 0.55 + 0.65);
      this._cooldown = minGap;
    } else {
      this.onset *= Math.exp(-dt * 14);
    }
    return this.onset;
  }
}
