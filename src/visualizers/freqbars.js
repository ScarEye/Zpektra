import * as THREE from 'three';
import { Visualizer } from './base.js';

const COUNT = 64;

/**
 * Classic 2D equalizer — log spectrum bars + peak caps + floor reflection.
 */
export class FreqBars extends Visualizer {
  build() {
    this.interactive = false;
    this.scene.background = new THREE.Color(0x06060a);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 5;

    this.heights = new Float32Array(COUNT);
    this.peaks = new Float32Array(COUNT);
    this.peakHold = new Float32Array(COUNT);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // scale from bottom

    this.bars = [];
    this.caps = [];
    this.mirrors = [];

    for (let i = 0; i < COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: this.palette.primary.clone(),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const bar = new THREE.Mesh(geo, mat);
      this.group.add(bar);
      this.bars.push(bar);

      const capMat = new THREE.MeshBasicMaterial({
        color: this.palette.secondary.clone(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const cap = new THREE.Mesh(geo, capMat);
      this.group.add(cap);
      this.caps.push(cap);

      const mirMat = new THREE.MeshBasicMaterial({
        color: this.palette.primary.clone(),
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const mir = new THREE.Mesh(geo, mirMat);
      mir.scale.y = -1; // flip downward from baseline
      this.group.add(mir);
      this.mirrors.push(mir);
    }

    // Baseline
    const baseGeo = new THREE.PlaneGeometry(2.2, 0.008);
    this.baseline = new THREE.Mesh(
      baseGeo,
      new THREE.MeshBasicMaterial({
        color: this.palette.accent || this.palette.secondary,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    this.group.add(this.baseline);

    this._layout(window.innerWidth, window.innerHeight);
  }

  _layout(w, h) {
    const aspect = w / Math.max(1, h);
    const halfH = 1;
    const halfW = aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    const margin = halfW * 0.08;
    const usable = halfW * 2 - margin * 2;
    const gap = usable * 0.012;
    const barW = (usable - gap * (COUNT - 1)) / COUNT;
    const baseY = -0.08;

    this._barW = barW;
    this._gap = gap;
    this._baseY = baseY;
    this._halfW = halfW;
    this._maxH = halfH * 0.78;

    for (let i = 0; i < COUNT; i++) {
      const x = -halfW + margin + i * (barW + gap) + barW / 2;
      this.bars[i].position.set(x, baseY, 0);
      this.bars[i].scale.x = barW * 0.92;
      this.caps[i].position.x = x;
      this.caps[i].scale.x = barW * 0.92;
      this.caps[i].scale.y = 0.012;
      this.mirrors[i].position.set(x, baseY, 0);
      this.mirrors[i].scale.x = barW * 0.92;
    }
    this.baseline.position.set(0, baseY, 0);
    this.baseline.scale.set(halfW * 2 * 0.96, 1, 1);
  }

  resize(w, h) {
    this._layout(w, h);
  }

  frame(reactor, dt) {
    const spec = reactor.spectrum;
    const a = Math.max(0.05, reactor.activity);
    const punch = reactor.hit ?? reactor.beat;
    const maxH = this._maxH || 0.75;
    const baseY = this._baseY || 0;

    for (let i = 0; i < COUNT; i++) {
      // Map bar index across log spectrum (already log-spaced in reactor)
      const t = i / (COUNT - 1);
      const si = Math.min(spec.length - 1, Math.floor(t * (spec.length - 1)));
      // Light neighbor blend for smoother EQ look
      const s0 = spec[Math.max(0, si - 1)] || 0;
      const s1 = spec[si] || 0;
      const s2 = spec[Math.min(spec.length - 1, si + 1)] || 0;
      let v = (s0 * 0.2 + s1 * 0.6 + s2 * 0.2);

      // Mild perceptual boost toward mids so bars read clearly
      const boost = 0.85 + 0.35 * Math.sin(t * Math.PI);
      v = Math.min(1, v * boost * (0.35 + 0.65 * a));

      // Fast attack / medium release
      const cur = this.heights[i];
      const k = v > cur ? 0.72 : 0.18;
      this.heights[i] = cur + (v - cur) * k;

      // Peak hold
      if (this.heights[i] >= this.peaks[i]) {
        this.peaks[i] = this.heights[i];
        this.peakHold[i] = 0.35;
      } else {
        this.peakHold[i] -= dt;
        if (this.peakHold[i] <= 0) {
          this.peaks[i] = Math.max(0, this.peaks[i] - dt * 0.55);
        }
      }

      const h = 0.02 + this.heights[i] * maxH;
      const bar = this.bars[i];
      bar.scale.y = h;
      bar.position.y = baseY;

      const cap = this.caps[i];
      const peakH = 0.02 + this.peaks[i] * maxH;
      cap.position.y = baseY + peakH;
      cap.scale.y = Math.max(0.008, maxH * 0.018);

      const mir = this.mirrors[i];
      mir.scale.y = -h * 0.45;
      mir.position.y = baseY;
      mir.material.opacity = (0.08 + this.heights[i] * 0.28) * a;

      const c = this.palette.primary.clone().lerp(this.palette.secondary, t);
      // Flash brighter on hits, especially low bars on kick
      const flash = punch * (0.25 + (1 - t) * 0.35);
      c.offsetHSL(0, 0, flash * 0.25);
      bar.material.color.copy(c);
      bar.material.opacity = 0.55 + 0.45 * a + punch * 0.2;
      mir.material.color.copy(c);

      const capC = this.palette.secondary.clone().lerp(this.palette.primary, 1 - t);
      capC.offsetHSL(0, 0, punch * 0.15);
      cap.material.color.copy(capC);
      cap.material.opacity = 0.5 + 0.5 * a;
    }

    if (this.baseline) {
      this.baseline.material.opacity = 0.2 + punch * 0.35 + a * 0.15;
      this.baseline.material.color.copy(this.palette.secondary);
    }
  }

  onPalette(p) {
    if (!this.bars) return;
    this.bars.forEach((b, i) => {
      const t = i / (COUNT - 1);
      b.material.color.copy(p.primary.clone().lerp(p.secondary, t));
    });
    this.caps.forEach((c) => c.material.color.copy(p.secondary));
    this.mirrors.forEach((m, i) => {
      const t = i / (COUNT - 1);
      m.material.color.copy(p.primary.clone().lerp(p.secondary, t));
    });
    if (this.baseline) this.baseline.material.color.copy(p.secondary);
  }
}
