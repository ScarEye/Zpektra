function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Split low vs mid-high transients into kick / snare pulses. */
export class KickSnareDetector {
  constructor() {
    this.kick = 0;
    this.snare = 0;
    this._kickHist = new Array(32).fill(0);
    this._snareHist = new Array(32).fill(0);
    this._kIdx = 0;
    this._sIdx = 0;
    this._kCd = 0;
    this._sCd = 0;
    this._ready = false;
  }

  reset() {
    this.kick = 0;
    this.snare = 0;
    this._kickHist.fill(0);
    this._snareHist.fill(0);
    this._kIdx = 0;
    this._sIdx = 0;
    this._kCd = 0;
    this._sCd = 0;
    this._ready = false;
  }

  _fire(hist, idxKey, cdKey, valueKey, raw, dt, minGap, strength) {
    hist[this[idxKey]] = raw;
    this[idxKey] = (this[idxKey] + 1) % hist.length;
    const med = median(hist);
    const threshold = med * 1.8 + 0.003;
    this[cdKey] -= dt;
    if (raw > threshold && this[cdKey] <= 0 && raw > 0.002) {
      this[valueKey] = Math.min(1, strength);
      this[cdKey] = minGap;
    } else {
      this[valueKey] *= Math.exp(-dt * 12);
    }
  }

  update(frame, dt, minGap = 0.09) {
    // Must run before SpectralFluxDetector mutates _prevMag via spectralFlux().
    const kickFlux = frame.bandFlux(40, 180);
    const snareFlux = frame.bandFlux(200, 5000);

    if (!this._ready) {
      this._ready = true;
      this.kick *= Math.exp(-dt * 12);
      this.snare *= Math.exp(-dt * 12);
      return { kick: this.kick, snare: this.snare };
    }

    this._fire(this._kickHist, '_kIdx', '_kCd', 'kick', kickFlux, dt, minGap, 0.9 + kickFlux * 8);
    this._fire(this._snareHist, '_sIdx', '_sCd', 'snare', snareFlux, dt, minGap * 0.85, 0.85 + snareFlux * 6);

    return { kick: this.kick, snare: this.snare };
  }
}
