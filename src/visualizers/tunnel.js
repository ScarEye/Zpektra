import * as THREE from 'three';
import { Visualizer } from './base.js';
import { noiseGLSL } from './glsl-noise.js';

const vert =  `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const frag =  `
  precision highp float;
  varying vec2 vUv;
  uniform float uClock;     // audio-driven time
  uniform float uBass;
  uniform float uMid;
  uniform float uVocal;     // vocals / lyrics -> brightness pulse
  uniform float uTreble;
  uniform float uBeat;
  uniform float uAct;       // 0..1 master activity
  uniform vec2  uRes;
  uniform vec3  uColorA;
  uniform vec3  uColorB;

  ${noiseGLSL}

  vec3 hue(vec3 c, float a){
    const vec3 k = vec3(0.57735);
    float cosA = cos(a);
    return c*cosA + cross(k,c)*sin(a) + k*dot(k,c)*(1.0-cosA);
  }

  void main(){
    vec2 p = (vUv*2.0-1.0);
    p.x *= uRes.x/uRes.y;
    float r = length(p);
    float a = atan(p.y, p.x);

    float depth = 0.34/(r+0.06) + uClock*0.6;
    depth += sin(a*6.0 + uClock*1.5)*(0.12 + uBass*0.7);

    vec3 q = vec3(a*1.6, depth, uClock*0.3);
    float n = fbm(q*1.5);
    float bands = sin(depth*10.0 + n*3.0)*0.5+0.5;
    bands = pow(bands, 1.6 - uTreble*1.2);

    float spokes = sin(a*(8.0+uTreble*40.0) + uClock*2.0)*0.5+0.5;

    vec3 col = mix(uColorA, uColorB, bands);
    col = hue(col, uClock*0.15 + uMid*2.0);      // hue shifts with mids
    col += spokes*uTreble*0.6;                    // treble -> angular sparkle
    col *= bands*(0.5 + uBeat*1.2 + uBass*0.7 + uVocal*0.6); // vocals brighten

    col += uColorB*(0.05/(r+0.03))*(0.6 + uBeat*1.5 + uVocal*0.5);
    col += uColorA*uBeat*0.25;

    col *= smoothstep(1.35, 0.1, r);
    col *= 0.15 + 0.85*uAct;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Tunnel extends Visualizer {
  build() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.clock = 0;
    this.uniforms = {
      uClock: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uVocal: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uAct: { value: 0 },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uColorA: { value: this.palette.primary.clone() },
      uColorB: { value: this.palette.secondary.clone() },
    };
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag })
    );
    this.scene.add(this.quad);
  }

  frame(reactor, dt) {
    const punch = reactor.hit ?? reactor.beat;
    this.clock += dt * (0.5 + reactor.energy * 3.2) * Math.max(reactor.activity, 0.12);
    const u = this.uniforms;
    u.uClock.value = this.clock;
    u.uBass.value = reactor.bass;
    u.uMid.value = reactor.mid;
    u.uVocal.value = reactor.bands.vocal;
    u.uTreble.value = reactor.treble;
    u.uBeat.value = punch;
    u.uAct.value = reactor.activity;
  }

  resize(w, h) {
    if (this.uniforms) this.uniforms.uRes.value.set(w, h);
  }

  onPalette(p) {
    if (this.uniforms) {
      this.uniforms.uColorA.value.copy(p.primary);
      this.uniforms.uColorB.value.copy(p.secondary);
    }
  }
}
