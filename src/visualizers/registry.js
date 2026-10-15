import { Bars } from './bars.js';
import { FreqBars } from './freqbars.js';
import { Particles } from './particles.js';
import { Tunnel } from './tunnel.js';
import { Blob } from './blob.js';
import { WaveTerrain } from './waveterrain.js';
import { Rings } from './rings.js';
import { Starfield } from './starfield.js';
import { SpikeSphere } from './spikesphere.js';
import { Oscilloscope } from './oscilloscope.js';
import { SphereNet, CubeNet, CylinderNet, CapsuleNet, PyramidNet } from './meshshapes.js';
import { GoldenSeal } from './goldenseal.js';
import { StarryNight } from './starrynight.js';
import { Dna } from './dna.js';

export const VISUALIZERS = [
  {
    id: 'freqbars',
    name: 'Frequency Bars',
    kind: '2d',
    tier: 'release',
    blurb: 'Equalizer bars across the spectrum, with peak caps and a mirrored floor.',
    lyricsSlot: 'top',
    create: (renderer) => new FreqBars(renderer),
  },
  {
    id: 'blob',
    name: 'Audio Blob',
    kind: '3d',
    tier: 'release',
    blurb: 'A liquid organism that morphs, spikes, and pulses with the sound.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Blob(renderer),
  },
  {
    id: 'terrain',
    name: 'Wave Terrain',
    kind: '3d',
    tier: 'release',
    blurb: 'A landscape that rises with the spectrum and ripples forward.',
    lyricsSlot: 'top',
    create: (renderer) => new WaveTerrain(renderer),
  },
  {
    id: 'rings',
    name: 'Frequency Rings',
    kind: '3d',
    tier: 'release',
    blurb: 'Eight rings, one per frequency band, lifting on the music.',
    lyricsSlot: 'right',
    create: (renderer) => new Rings(renderer),
  },
  {
    id: 'particles',
    name: 'Particle Storm',
    kind: '3d',
    tier: 'prototype',
    blurb: 'A drifting nebula that swirls on noise and bursts on every beat.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Particles(renderer),
  },
  {
    id: 'spikesphere',
    name: 'Spike Sphere',
    kind: '3d',
    tier: 'release',
    blurb: 'A wireframe sphere that grows spikes on the spectrum and punches out on beats.',
    lyricsSlot: 'bottom',
    create: (renderer) => new SpikeSphere(renderer),
  },
  {
    id: 'starfield',
    name: 'Starfield Warp',
    kind: '3d',
    tier: 'release',
    blurb: 'Stars streaking past at warp speed, accelerating with energy.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Starfield(renderer),
  },
  {
    id: 'oscilloscope',
    name: 'Oscilloscope Ribbon',
    kind: '3d',
    tier: 'release',
    blurb: 'A glowing waveform that flows into the distance, stacking every past frame.',
    lyricsSlot: 'top',
    create: (renderer) => new Oscilloscope(renderer),
  },
  {
    id: 'bars',
    name: 'Spectrum Ring',
    kind: '3d',
    tier: 'release',
    blurb: 'Glowing frequency bars around a pulsing core.',
    lyricsSlot: 'bottom',
    create: (renderer) => new Bars(renderer),
  },
  {
    id: 'tunnel',
    name: 'Warp Tunnel',
    kind: '2d',
    tier: 'release',
    blurb: 'A shader tunnel that races, warps, and shifts hue with the music.',
    lyricsSlot: 'right',
    create: (renderer) => new Tunnel(renderer),
  },
  {
    id: 'goldenseal',
    name: 'Golden Sigil',
    kind: '2d',
    tier: 'prototype',
    blurb: 'A floor seal that pulses golden light outward, with sparkles on the beat.',
    lyricsSlot: 'bottom',
    create: (renderer) => new GoldenSeal(renderer),
  },
  {
    id: 'starrynight',
    name: 'Starry Night',
    kind: '3d',
    tier: 'release',
    blurb: 'Each frequency band drives its own stars — bass swells, treble flickers.',
    lyricsSlot: 'bottom',
    create: (renderer) => new StarryNight(renderer),
  },
  {
    id: 'dna',
    name: 'DNA Helix',
    kind: '3d',
    tier: 'release',
    blurb: 'A double helix that scrolls upward, with strands and rungs reacting to the music.',
    lyricsSlot: 'right',
    create: (renderer) => new Dna(renderer),
  },
  {
    id: 'sphere',
    name: 'Sphere Net',
    kind: '3d',
    tier: 'prototype',
    blurb: 'A grid sphere that breathes with the music. Grid or dots with M.',
    lyricsSlot: 'bottom',
    create: (renderer) => new SphereNet(renderer),
  },
  {
    id: 'cube',
    name: 'Cube Net',
    kind: '3d',
    tier: 'prototype',
    blurb: 'A wireframe cube whose faces pulse and warp. Grid or dots with M.',
    lyricsSlot: 'bottom',
    create: (renderer) => new CubeNet(renderer),
  },
  {
    id: 'cylinder',
    name: 'Cylinder Net',
    kind: '3d',
    tier: 'prototype',
    blurb: 'A grid cylinder that swells with the spectrum. Grid or dots with M.',
    lyricsSlot: 'right',
    create: (renderer) => new CylinderNet(renderer),
  },
  {
    id: 'capsule',
    name: 'Capsule Net',
    kind: '3d',
    tier: 'prototype',
    blurb: 'A capsule mesh that flexes to the beat. Grid or dots with M.',
    lyricsSlot: 'right',
    create: (renderer) => new CapsuleNet(renderer),
  },
  {
    id: 'pyramid',
    name: 'Pyramid Net',
    kind: '3d',
    tier: 'prototype',
    blurb: 'A grid pyramid that rises and ripples. Grid or dots with M.',
    lyricsSlot: 'bottom',
    create: (renderer) => new PyramidNet(renderer),
  },
];

export function getVisualizer(id) {
  return VISUALIZERS.find((v) => v.id === id) || VISUALIZERS[0];
}

export function byTier(tier) {
  return VISUALIZERS.filter((v) => v.tier === tier);
}
