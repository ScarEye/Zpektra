export class PlaybackClock {
  constructor() {
    this.progressMs = 0;
    this.durationMs = 0;
    this.playing = false;
    this._anchorPerf = 0;
    this.trackId = null;
  }

  sync(track, isPlaying) {
    if (!track) {
      this.playing = false;
      return;
    }
    this.trackId = track.track_id;
    this.durationMs = track.duration_ms || 0;
    this.progressMs = track.progress_ms || 0;
    this.playing = Boolean(isPlaying);
    this._anchorPerf = performance.now();
  }

  nowMs() {
    if (!this.playing) return this.progressMs;
    const elapsed = performance.now() - this._anchorPerf;
    const t = this.progressMs + elapsed;
    if (this.durationMs > 0) return Math.min(this.durationMs, t);
    return t;
  }
}
