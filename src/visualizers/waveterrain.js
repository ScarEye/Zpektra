import * as THREE from 'three';
import { Visualizer } from './base.js';
import { noiseGLSL } from './glsl-noise.js';

const SPEC_N = 64;

const vert =  `
  uniform float uSpec[${SPEC_N}];
  uniform float uClock;
  uniform float uAct;
  uniform float uBeat;
  varying float vH;

  ${noiseGLSL}

  void main(){
    vec3 p = position; // plane in XY, size 2 x 2

    float fx = clamp(p.x*0.5 + 0.5, 0.0, 1.0);
    int idx = int(fx*float(${SPEC_N - 1}));
    float s = uSpec[idx];

    float depth = p.y*0.5 + 0.5;
    float ripple = snoise(vec3(p.x*2.0, depth*3.0 - uClock*1.2, uClock*0.3));

    float h = s*1.6*(0.2 + 0.8*uAct) + ripple*0.12*uAct + uBeat*0.15;
    h *= mix(1.0, 0.4, depth);

    p.z += h;          // displace along local Z (becomes world up after rotation)
    vH = h;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const frag =  `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  varying float vH;
  void main(){
    float t = clamp(vH*0.8, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, t);
    col *= 0.35 + 0.65*uAct + t*0.4;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class WaveTerrain extends Visualizer {
  build() {
    this.interactive = true;
    this.specArr = new Float32Array(SPEC_N);

    this.uniforms = {
      uSpec: { value: this.specArr },
      uClock: { value: 0 },
      uAct: { value: 0 },
      uBeat: { value: 0 },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };

    const geo = new THREE.PlaneGeometry(2, 2, 120, 120);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      wireframe: true,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.scale.set(8, 8, 4);
    this.scene.add(this.mesh);

    this.camera.position.set(0, 6, 9);
    this.camera.lookAt(0, 0, 0);
    this.clock = 0;
  }

  frame(reactor, dt) {
    const punch = reactor.hit ?? reactor.beat;
    this.clock += dt * (0.3 + reactor.energy * 2.0) * Math.max(reactor.activity, 0.12);

    const src = reactor.spectrum;
    for (let i = 0; i < SPEC_N; i++) {
      this.specArr[i] = src[Math.floor((i / SPEC_N) * src.length)];
    }
    this.uniforms.uClock.value = this.clock;
    this.uniforms.uAct.value = reactor.activity;
    this.uniforms.uBeat.value = punch;
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}
