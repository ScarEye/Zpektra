import * as THREE from 'three';

export class Visualizer {
  constructor(renderer) {
    this.renderer = renderer;
    this.interactive = false;
    this.rotationSpeed = 1;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 8;
    this.palette = {
      primary: new THREE.Color('#22d3ee'),
      secondary: new THREE.Color('#2dd4bf'),
      accent: new THREE.Color('#ffffff'),
    };
  }

  build() {}
  frame(_reactor, _dt) {}
  onPalette(_palette) {}

  setPalette(palette) {
    this.palette = palette;
    this.onPalette(palette);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
