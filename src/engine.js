// Owns the renderer + animation loop, swaps visualizers, manages orbit
// interaction for 3D visualizers, and drives the color palette each frame.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reactor } from './audio/analyser.js';
import { getVisualizer } from './visualizers/registry.js';
import { Debug } from './ui/debug.js';
import { ColorController } from './ui/colors.js';

export class Engine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.reactor = new Reactor();
    this.colors = new ColorController();
    this.palette = this.colors.current();
    this.active = null;
    this.controls = null;
    this._last = performance.now();
    this._running = false;
    this.debug = new Debug();

    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') this.debug.toggle();
    });
  }

  setVisualizer(id) {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    if (this.active) {
      this.active.dispose();
      this.active = null;
    }
    const def = getVisualizer(id);
    const vis = def.create(this.renderer);
    vis.build();
    vis.setPalette(this.palette);
    vis.resize(window.innerWidth, window.innerHeight);
    this.active = vis;

    // Enable mouse orbit for 3D visualizers (drag to rotate, scroll to zoom).
    if (vis.interactive) {
      this.controls = new OrbitControls(vis.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = false;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.5;
      this.controls.minDistance = 3;
      this.controls.maxDistance = 40;
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  setPalette(palette) {
    this.palette = palette;
    if (this.active) this.active.setPalette(palette);
  }

  setPlaying(isPlaying) {
    this.reactor.setPlaying(isPlaying);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;

      this.reactor.update(dt);

      const pal = this.colors.tick(dt);
      if (pal) this.setPalette(pal);

      if (this.controls) {
        // gentle auto-spin that speeds up with the music; user drag overrides it
        this.controls.autoRotateSpeed = 0.25 + this.reactor.activity * 1.6;
        this.controls.update();
      }

      if (this.active) {
        this.active.frame(this.reactor, dt);
        this.active.render();
      }
      this.debug.draw(this.reactor);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
  }

  _onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.active) this.active.resize(window.innerWidth, window.innerHeight);
  }
}
