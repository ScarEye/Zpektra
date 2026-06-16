import * as THREE from 'three';
import { Visualizer } from './base.js';
import { noiseGLSL } from './glsl-noise.js';

const vert =  `
  uniform float uClock;
  uniform float uBass;   // radial pulse
  uniform float uMid;    // noise displacement amount (movement)
  uniform float uHigh;   // sparkle size
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uAct;
  attribute float aSeed;
  varying float vMix;
  varying float vGlow;

  ${noiseGLSL}

  void main(){
    vec3 p = position;
    float r = length(p);
    vMix = clamp(r/6.0, 0.0, 1.0);

    vec3 np = p*0.35 + vec3(uClock*0.3, uClock*0.2, aSeed);
    vec3 disp = vec3(snoise(np), snoise(np+31.4), snoise(np+57.7));
    p += disp * (0.3 + uMid*3.0);

    p *= 1.0 + uBass*0.6 + uBeat*0.6;

    vGlow = uBeat + uHigh*0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (3.0 + uBeat*9.0 + uHigh*10.0 + uEnergy*4.0) * (300.0/-mv.z);
  }
`;

const frag =  `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uAct;
  varying float vMix;
  varying float vGlow;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float dist = length(d);
    float a = smoothstep(0.5, 0.0, dist);
    vec3 col = mix(uColorA, uColorB, vMix);
    col += vGlow * 0.6;                 // flash white-ish on beat
    col *= 0.55 + 0.45*uAct;           // visible at idle, brighter with audio
    gl_FragColor = vec4(col, a*(0.6+0.4*uAct));
  }
`;

export class Particles extends Visualizer {
  build() {
    this.interactive = true;
    const COUNT = 4000;
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const u = Math.random(), v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 2.6 + Math.random() * 3.2;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      seeds[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.clock = 0;
    this.uniforms = {
      uClock: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uEnergy: { value: 0 },
      uBeat: { value: 0 },
      uAct: { value: 0 },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.points);
    this.camera.position.set(0, 0, 11);
  }

  frame(reactor, dt) {
    const b = reactor.bands;

    this.clock += dt * (0.4 + reactor.energy * 2.2) * reactor.activity;
    const u = this.uniforms;
    u.uClock.value = this.clock;
    u.uBass.value = reactor.bass;
    u.uMid.value = (b.mid + b.vocal) * 0.5;
    u.uHigh.value = (b.presence + b.brilliance + b.air) / 3;
    u.uEnergy.value = reactor.energy;
    u.uBeat.value = reactor.beat;
    u.uAct.value = reactor.activity;

  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}
