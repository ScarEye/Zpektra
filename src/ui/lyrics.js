import { activeLineIndex } from '../spotify/lyrics.js';
import { getVisualizer } from '../visualizers/registry.js';

export const LYRICS_ENABLED_KEY = 'zpektra.lyricsEnabled';
export const LYRICS_PLACE_KEY = 'zpektra.lyricsPlace';

const PLACES = ['auto', 'bottom', 'top', 'right', 'left'];

/**
 * DOM lyrics overlay — placement modes + sync loop.
 */
export class LyricsPanel {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'lyrics-overlay';
    this.root.className = 'lyrics-overlay place-bottom hidden';
    this.root.innerHTML = `
      <div class="lyrics-inner">
        <div class="lyrics-prev"></div>
        <div class="lyrics-curr"></div>
        <div class="lyrics-next"></div>
        <div class="lyrics-status"></div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.elPrev = this.root.querySelector('.lyrics-prev');
    this.elCurr = this.root.querySelector('.lyrics-curr');
    this.elNext = this.root.querySelector('.lyrics-next');
    this.elStatus = this.root.querySelector('.lyrics-status');

    this.enabled = true;
    this.place = 'auto';
    this.visId = null;
    this.lines = [];
    this.plain = null;
    this.synced = false;
    this.instrumental = false;
    this.found = false;
    this._idx = -2;
    this._raf = 0;
    this._clock = null;
    this._userOverride = false;

    try {
      const en = localStorage.getItem(LYRICS_ENABLED_KEY);
      if (en === '0') this.enabled = false;
      const pl = localStorage.getItem(LYRICS_PLACE_KEY);
      if (pl && PLACES.includes(pl)) this.place = pl;
    } catch {
      /* ignore */
    }

    this._applyPlacement();
    this.refreshVisibility();
  }

  refreshVisibility() {
    this._updateVisibility();
  }

  setClock(clock) {
    this._clock = clock;
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    try {
      localStorage.setItem(LYRICS_ENABLED_KEY, this.enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
    this._updateVisibility();
    if (this.enabled) this.start();
    else this.stop();
  }

  isEnabled() {
    return this.enabled;
  }

  setPlace(place) {
    if (!PLACES.includes(place)) return;
    this.place = place;
    this._userOverride = place !== 'auto';
    try {
      localStorage.setItem(LYRICS_PLACE_KEY, place);
    } catch {
      /* ignore */
    }
    this._applyPlacement();
  }

  getPlace() {
    return this.place;
  }

  setVisualizer(id) {
    this.visId = id;
    this._applyPlacement();
  }

  setLyrics(payload) {
    this.found = Boolean(payload?.found);
    this.instrumental = Boolean(payload?.instrumental);
    this.synced = Boolean(payload?.synced);
    this.lines = payload?.lines || [];
    this.plain = payload?.plain || null;
    this._idx = -2;

    if (this.instrumental) {
      this.elStatus.textContent = 'Instrumental';
      this.elPrev.textContent = '';
      this.elCurr.textContent = '';
      this.elNext.textContent = '';
    } else if (!this.found) {
      this.elStatus.textContent = 'No lyrics found';
      this.elPrev.textContent = '';
      this.elCurr.textContent = '';
      this.elNext.textContent = '';
    } else if (!this.synced && this.plain) {
      this.elStatus.textContent = '';
      this.elPrev.textContent = '';
      this.elCurr.textContent = this.plain.split('\n').slice(0, 4).join('\n');
      this.elCurr.classList.add('unsynced');
      this.elNext.textContent = '';
    } else {
      this.elStatus.textContent = '';
      this.elCurr.classList.remove('unsynced');
      this.elPrev.textContent = '';
      this.elCurr.textContent = '';
      this.elNext.textContent = '';
    }
    this._updateVisibility();
  }

  clear() {
    this.setLyrics({ found: false, lines: [], plain: null, synced: false });
  }

  start() {
    if (this._raf) return;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._tick();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _resolvedPlace() {
    if (this.place !== 'auto') return this.place;
    const def = getVisualizer(this.visId)?.lyricsSlot || 'bottom';
    return def;
  }

  _applyPlacement() {
    const slot = this._resolvedPlace();
    this.root.classList.remove('place-bottom', 'place-top', 'place-right', 'place-left');
    this.root.classList.add(`place-${slot}`);
  }

  _updateVisibility() {
    const show =
      this.enabled &&
      (this.found || this.instrumental || this.elStatus.textContent);
    this.root.classList.toggle('hidden', !show);
  }

  _tick() {
    if (!this.enabled || !this.synced || !this.lines.length || !this._clock) return;
    const now = this._clock.nowMs();
    const idx = activeLineIndex(this.lines, now);
    if (idx === this._idx) return;
    this._idx = idx;

    const prev = idx > 0 ? this.lines[idx - 1].text : '';
    const curr = idx >= 0 ? this.lines[idx].text : '';
    const next = idx >= 0 && idx + 1 < this.lines.length ? this.lines[idx + 1].text : '';

    this.elPrev.textContent = prev;
    this.elCurr.textContent = curr || (idx < 0 ? '…' : '');
    this.elNext.textContent = next;
  }
}
