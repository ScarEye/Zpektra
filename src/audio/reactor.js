import { Capture } from './capture.js';
import { AudioFrame } from './frame.js';
import { BandEnvelopes, BAND_NAMES } from './bands.js';
import { SpectralFluxDetector } from './detectors/spectralFlux.js';
import { EnergyBeatDetector } from './detectors/energyBeat.js';
import { KickSnareDetector } from './detectors/kickSnare.js';
import { TempoTracker } from './detectors/tempo.js';
import {
  applyPreset,
  DEFAULT_PRESET,
  PRESET_STORAGE_KEY,
  ANALYSIS_PRESETS,
} from './presets.js';

export { BAND_NAMES, ANALYSIS_PRESETS, DEFAULT_PRESET, PRESET_STORAGE_KEY };

export class Reactor {
  constructor() {
    this.frame = new AudioFrame();
    this.envelopes = new BandEnvelopes();
    this.fluxDet = new SpectralFluxDetector();
    this.energyDet = new EnergyBeatDetector();
    this.kickSnare = new KickSnareDetector();
    this.tempo = new TempoTracker();

    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.energy = 0;
    this.beat = 0;
    this.level = 0;
    this.activity = 0;
    this.playing = true;

    this.onset = 0;
    this.kick = 0;
    this.snare = 0;
    this.flux = 0;
    this.bpm = 0;
    this.beatPhase = 0;
    this.tempoConfidence = 0;
    /** Sharpest punch for visualizers. */
    this.hit = 0;

    this.bands = this.envelopes.bands;
    this.spectrum = this.envelopes.spectrum;

    this.preset = DEFAULT_PRESET;
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY);
      if (saved && ANALYSIS_PRESETS.some((p) => p.id === saved)) this.preset = saved;
    } catch {
      /* ignore */
    }

    this._t = 0;
    this._hadAnalyser = false;
  }

  _resetDetectors() {
    this.fluxDet.reset();
    this.energyDet.reset();
    this.kickSnare.reset();
    this.tempo.reset();
    if (this.frame._prevMag) this.frame._prevMag.fill(0);
  }

  setPlaying(p) {
    this.playing = p;
  }

  setPreset(id) {
    if (!ANALYSIS_PRESETS.some((p) => p.id === id)) return this.preset;
    this.preset = id;
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    return this.preset;
  }

  getPreset() {
    return this.preset;
  }

  update(dt) {
    this._t += dt;
    const analyser = Capture.getAnalyser();

    if (!analyser) {
      this._hadAnalyser = false;
      this.envelopes.fade(dt);
      this.bass = this.envelopes.bass;
      this.mid = this.envelopes.mid;
      this.treble = this.envelopes.treble;
      this.energy = this.envelopes.energy;
      this.beat *= Math.exp(-dt * 6);
      this.onset *= Math.exp(-dt * 6);
      this.kick *= Math.exp(-dt * 6);
      this.snare *= Math.exp(-dt * 6);
      this.hit *= Math.exp(-dt * 6);
      this.level += (0 - this.level) * 0.1;
      this.activity += (0 - this.activity) * 0.1;
      this.tempo.update(dt);
      this.bpm = this.tempo.bpm;
      this.beatPhase = this.tempo.beatPhase;
      this.tempoConfidence = this.tempo.confidence;
      return this;
    }

    if (!this._hadAnalyser) {
      this._resetDetectors();
      this._hadAnalyser = true;
    }

    const sampleRate = Capture.getSampleRate();
    this.frame.read(analyser, sampleRate);

    // Kick/snare must run before full spectralFlux() mutates prev mags.
    this.kickSnare.update(this.frame, dt, 0.09);
    this.kick = this.kickSnare.kick;
    this.snare = this.kickSnare.snare;

    const minGap =
      this.tempo.confidence > 0.35 && this.tempo._period > 0
        ? Math.max(0.07, this.tempo._period * 0.42)
        : 0.09;

    this.fluxDet.update(this.frame, dt, minGap);
    this.onset = this.fluxDet.onset;
    this.flux = this.fluxDet.flux;

    // Envelope speeds depend on preset — apply twice lightly via preset params
    const probe = applyPreset(this.preset, {
      onset: this.onset,
      kick: this.kick,
      snare: this.snare,
      energyPulse: 0,
      gridGate: 1,
    });
    this.envelopes.update(this.frame, probe.attack, probe.release);

    this.bass = this.envelopes.bass;
    this.mid = this.envelopes.mid;
    this.treble = this.envelopes.treble;
    this.energy = this.envelopes.energy;
    this.bands = this.envelopes.bands;
    this.spectrum = this.envelopes.spectrum;

    const inst = this.energy;
    this.level += (inst - this.level) * (inst > this.level ? 0.55 : 0.07);

    let target = Math.min(1, Math.max(0, (this.level - 0.02) * 6));
    if (!this.playing) target = 0;
    this.activity += (target - this.activity) * (target < this.activity ? 0.12 : 0.35);

    const energyPulse = this.energyDet.update(this.bass, this.activity, dt, minGap);

    // Tempo from strong onsets
    const onsetForTempo = Math.max(this.onset, this.kick);
    if (onsetForTempo > 0.55 && this.activity > 0.1) {
      this.tempo.noteOnset(onsetForTempo);
    }
    const tempoState = this.tempo.update(dt);
    this.bpm = tempoState.bpm;
    this.beatPhase = tempoState.beatPhase;
    this.tempoConfidence = tempoState.confidence;

    const mapped = applyPreset(this.preset, {
      onset: this.onset * probe.onsetScale,
      kick: this.kick,
      snare: this.snare,
      energyPulse,
      gridGate: this.tempo.gridGate(0.2),
    });

    // Beat is an impulse envelope — take max with decay so we don't stick at 1
    if (mapped.beat > this.beat) this.beat = mapped.beat;
    else this.beat *= Math.exp(-dt * 10);

    // Groove: further suppress off-grid residual
    if (this.preset === 'groove' && this.tempoConfidence > 0.35) {
      this.beat *= 0.4 + 0.6 * this.tempo.gridGate(0.22);
    }

    const scale = probe.onsetScale;
    this.hit = Math.max(
      this.beat,
      this.kick * scale,
      this.onset * 0.9 * scale,
      this.snare * 0.7 * scale
    );

    return this;
  }
}
