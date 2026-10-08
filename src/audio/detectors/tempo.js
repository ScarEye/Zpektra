/**
 * Lightweight BPM + beat-phase tracker from onset timestamps.
 * Estimates tempo via inter-onset interval clustering (60–180 BPM).
 */
export class TempoTracker {
  constructor() {
    this.bpm = 0;
    this.confidence = 0;
    this.beatPhase = 0;
    this._times = [];
    this._period = 0.5;
    this._phase = 0;
    this._lastOnset = -1;
    this._t = 0;
  }

  reset() {
    this.bpm = 0;
    this.confidence = 0;
    this.beatPhase = 0;
    this._times = [];
    this._period = 0.5;
    this._phase = 0;
    this._lastOnset = -1;
    this._t = 0;
  }

  /** Call when a strong onset fires (onset strength 0–1). */
  noteOnset(strength) {
    if (strength < 0.55) return;
    const t = this._t;
    if (this._lastOnset >= 0 && t - this._lastOnset < 0.08) return;
    this._lastOnset = t;
    this._times.push(t);
    // Keep ~8s of history
    const cutoff = t - 8;
    while (this._times.length && this._times[0] < cutoff) this._times.shift();
    this._estimate();

    // Soft phase snap toward grid when confident
    if (this.confidence > 0.35 && this._period > 0) {
      const target = Math.round(this._phase) ; // nearest integer beat
      // pull phase toward integer
      const err = target - this._phase;
      this._phase += err * 0.35;
    }
  }

  _estimate() {
    const ts = this._times;
    if (ts.length < 4) {
      this.confidence *= 0.95;
      return;
    }

    // Histogram of IOIs mapped into 60–180 BPM (period 0.333–1.0s)
    const bins = new Array(24).fill(0);
    const minP = 60 / 180;
    const maxP = 60 / 60;
    let pairs = 0;

    for (let i = 1; i < ts.length; i++) {
      let ioi = ts[i] - ts[i - 1];
      // Fold double/half tempo
      while (ioi > maxP) ioi *= 0.5;
      while (ioi < minP && ioi > 0) ioi *= 2;
      if (ioi < minP || ioi > maxP) continue;
      const bi = Math.min(23, Math.floor(((ioi - minP) / (maxP - minP)) * 24));
      bins[bi] += 1;
      pairs++;
    }

    if (pairs < 3) return;

    let best = 0;
    let bestI = 0;
    for (let i = 0; i < bins.length; i++) {
      const score = bins[i] + (bins[i - 1] || 0) * 0.4 + (bins[i + 1] || 0) * 0.4;
      if (score > best) {
        best = score;
        bestI = i;
      }
    }

    const period = minP + ((bestI + 0.5) / 24) * (maxP - minP);
    this._period = this._period * 0.7 + period * 0.3;
    this.bpm = 60 / this._period;
    this.confidence = Math.min(1, best / Math.max(6, pairs * 0.5));
  }

  update(dt) {
    this._t += dt;
    if (this._period > 0) {
      this._phase += dt / this._period;
      // keep phase in a comfortable range
      if (this._phase > 1000) this._phase -= 1000;
    }
    this.beatPhase = this._phase - Math.floor(this._phase);
    return {
      bpm: this.bpm,
      confidence: this.confidence,
      beatPhase: this.beatPhase,
      period: this._period,
    };
  }

  /** 1 near expected beat slots when tempo is locked. */
  gridGate(width = 0.18) {
    if (this.confidence < 0.3) return 1;
    const d = Math.min(this.beatPhase, 1 - this.beatPhase);
    return d < width ? 1 - d / width : 0;
  }
}
