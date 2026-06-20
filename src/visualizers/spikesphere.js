import * as THREE from 'three';
import { Visualizer } from './base.js';
import { noiseGLSL } from './glsl-noise.js';

const vert =  `
  uniform float uClock;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uBeat;
  uniform float uAct;
  varying float vSpike;

  ${noiseGLSL}

  void main(){
    vec3 n = normalize(position);
    float slow = snoise(position * 0.8 + vec3(0.0, 0.0, uClock));
    float fast = snoise(position * 2.2 + vec3(uClock * 1.7));
    float spike = slow * (0.35 + uMid * 2.2) + fast * (0.1 + uHigh * 1.2);
    spike = max(spike, 0.0);
    vSpike = spike;

    float radius = 1.0 + uBass * 0.5 + uBeat * 0.4;
    vec3 p = n * radius + n * spike * (0.6 + uBeat * 1.2);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const frag =  `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  uniform float uBeat;
  varying float vSpike;
  void main(){
    vec3 col = mix(uColorA, uColorB, clamp(vSpike, 0.0, 1.0));
    col += uBeat * 0.4;
    col *= 0.5 + 0.5 * uAct;
    gl_FragColor = vec4(col, 0.85);
  }
`;

export class SpikeSphere extends Visualizer {
  build() {
    this.interactive = true;
    const geo = new THREE.IcosahedronGeometry(1, 5);

    this.clock = 0;
    this.uniforms = {
      uClock: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uBeat: { value: 0 },
      uAct: { value: 0 },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      wireframe: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);
    this.camera.position.set(0, 0, 4.2);
    this.camera.lookAt(0, 0, 0);
  }

  frame(reactor, dt) {
    const b = reactor.bands;
    this.clock += dt * (0.2 + reactor.energy * 1.6) * reactor.activity;
    const u = this.uniforms;
    u.uClock.value = this.clock;
    u.uBass.value = reactor.bass;
    u.uMid.value = (b.mid + b.vocal) * 0.5;
    u.uHigh.value = (b.presence + b.brilliance + b.air) / 3;
    u.uBeat.value = reactor.beat;
    u.uAct.value = reactor.activity;

    const rs = this.rotationSpeed;
    this.mesh.rotation.y += dt * 0.3 * (0.3 + reactor.activity) * rs;
    this.mesh.rotation.x += dt * 0.12 * (0.3 + reactor.activity) * rs;
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}
