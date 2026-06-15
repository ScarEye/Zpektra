// Controls the active color palette with three modes:
//   album  -> colors extracted from the current song's album art (default)
//   custom -> user-chosen primary/secondary (color picker or hex code)
//   cycle  -> hue rotates over time on its own
//
// tick(dt) returns a fresh palette when it changes (every frame in cycle mode,
// once after a change otherwise), or null when nothing changed.

import * as THREE from 'three';

const FALLBACK = {
  primary: '#22d3ee',
  secondary: '#2dd4bf',
};

export function isHex(v) {
  return /^#?[0-9a-fA-F]{6}$/.test(v || '');
}
export function normHex(v) {
  v = String(v || '').trim();
  if (!v.startsWith('#')) v = '#' + v;
  return v.toLowerCase();
}

export class ColorController {
  constructor() {
    this.mode = 'album';
    this.album = {
      primary: new THREE.Color(FALLBACK.primary),
      secondary: new THREE.Color(FALLBACK.secondary),
      accent: new THREE.Color('#ffffff'),
    };
    this.custom = {
      primary: new THREE.Color(FALLBACK.primary),
      secondary: new THREE.Color(FALLBACK.secondary),
      accent: new THREE.Color('#ffffff'),
    };
    this.cyclePhase = 0;
    this.cycleSpeed = 0.4; // hue revolutions per second
    this._dirty = true;
  }

  setMode(m) {
    this.mode = m;
    this._dirty = true;
  }

  setAlbum(pal) {
    this.album = pal;
    if (this.mode === 'album') this._dirty = true;
  }

  setCustomPrimary(hex) {
    if (isHex(hex)) this.custom.primary = new THREE.Color(normHex(hex));
    if (this.mode === 'custom') this._dirty = true;
  }
  setCustomSecondary(hex) {
    if (isHex(hex)) this.custom.secondary = new THREE.Color(normHex(hex));
    if (this.mode === 'custom') this._dirty = true;
  }

  setCycleSpeed(v) {
    this.cycleSpeed = v;
  }

  _cyclePalette() {
    const h = ((this.cyclePhase % 1) + 1) % 1;
    return {
      primary: new THREE.Color().setHSL(h, 0.85, 0.55),
      secondary: new THREE.Color().setHSL((h + 0.5) % 1, 0.85, 0.55),
      accent: new THREE.Color('#ffffff'),
    };
  }

  current() {
    if (this.mode === 'album') return this.album;
    if (this.mode === 'custom') return this.custom;
    return this._cyclePalette();
  }

  tick(dt) {
    if (this.mode === 'cycle') {
      this.cyclePhase += dt * this.cycleSpeed;
      return this._cyclePalette();
    }
    if (this._dirty) {
      this._dirty = false;
      return this.current();
    }
    return null;
  }
}
