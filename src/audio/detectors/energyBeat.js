/** Improved bass-energy beat detector (legacy-style, less laggy). */
export class EnergyBeatDetector {
  constructor() {
    this.pulse = 0;
    this._hist = new Array(48).fill(0);
    this._idx = 0;
    this._cooldown = 0;
  }

  reset() {
    this.pulse = 0;
    this._hist.fill(0);
    this._idx = 0;
    this._cooldown = 0;
  }

  update(bass, activity, dt, minGap = 0.1) {
    const inst = bass * bass;
    const hist = this._hist;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < hist.length; i++) {
      sum += hist[i];
      sumSq += hist[i] * hist[i];
    }
    const avg = sum / hist.length;
    const variance = sumSq / hist.length - avg * avg;
    const threshold = avg * (1.25 + Math.max(0, variance) * 0.4) + 0.004;

    this._cooldown -= dt;
    if (inst > threshold && this._cooldown <= 0 && activity > 0.12) {
      this.pulse = 1;
      this._cooldown = minGap;
    } else {
      this.pulse *= Math.exp(-dt * 10);
    }

    hist[this._idx] = inst;
    this._idx = (this._idx + 1) % hist.length;
    return this.pulse;
  }
}
