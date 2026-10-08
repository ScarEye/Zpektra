import { Session } from './auth/session.js';
import { NowPlaying } from './spotify/nowplaying.js';
import { PlaybackClock } from './spotify/playbackClock.js';
import { fetchLyrics } from './spotify/lyrics.js';
import { Capture } from './audio/capture.js';
import { ANALYSIS_PRESETS, DEFAULT_PRESET, PRESET_STORAGE_KEY } from './audio/analyser.js';
import { Engine } from './engine.js';
import { buildPicker, buildDock, buildModal } from './ui/picker.js';
import { LyricsPanel } from './ui/lyrics.js';
import { paletteFromImage } from './visualizers/palette.js';
import { isHex, normHex } from './ui/colors.js';

const el = (id) => document.getElementById(id);
const screens = {
  welcome: el('screen-welcome'),
  login: el('screen-login'),
  picker: el('screen-picker'),
};
const hud = el('hud');

let engine = null;
let setDockActive = null;
let currentVisId = null;
const playbackClock = new PlaybackClock();
let lyricsPanel = null;
let lyricsFetchId = 0;

const audioHint = el('audio-hint');
const sourceSelect = el('audio-source');
const LAST_DEVICE_KEY = 'zpektra.lastInput';

function show(name) {
  screens.welcome.classList.toggle('hidden', name !== 'welcome');
  screens.login.classList.toggle('hidden', name !== 'login');
  screens.picker.classList.toggle('hidden', name !== 'picker');
  hud.classList.toggle('hidden', name !== 'visualizer');

  if (engine) {
    if (name === 'visualizer') engine.start();
    else engine.stop();
  }

  if (lyricsPanel) {
    if (name === 'visualizer') lyricsPanel.start();
    else lyricsPanel.stop();
    if (name !== 'visualizer') lyricsPanel.root.classList.add('hidden');
    else lyricsPanel.refreshVisibility();
  }

  const needAudio = name === 'visualizer' && !Capture.isActive();
  audioHint.classList.toggle('hidden', !needAudio);
}

function updateLyricsBtn() {
  const btn = el('btn-lyrics');
  if (!btn || !lyricsPanel) return;
  btn.classList.toggle('active', lyricsPanel.isEnabled());
  btn.textContent = lyricsPanel.isEnabled() ? 'Lyrics' : 'Lyrics off';
}

async function loadLyricsForTrack(track) {
  if (!lyricsPanel || !track?.track_id) {
    lyricsPanel?.clear();
    return;
  }
  const id = ++lyricsFetchId;
  lyricsPanel.elStatus.textContent = 'Loading lyrics…';
  lyricsPanel.elPrev.textContent = '';
  lyricsPanel.elCurr.textContent = '';
  lyricsPanel.elNext.textContent = '';
  lyricsPanel.refreshVisibility();
  const payload = await fetchLyrics(track);
  if (id !== lyricsFetchId) return;
  lyricsPanel.setLyrics(payload);
}

function refreshAudioHint() {
  const onVisualizer = hud.classList.contains('hidden') === false;
  audioHint.classList.toggle('hidden', !(onVisualizer && !Capture.isActive()));
}

let appReady = false;

async function enterApp() {
  if (!appReady) {
    if (!engine) engine = new Engine(el('stage'));
    if (!lyricsPanel) {
      lyricsPanel = new LyricsPanel();
      lyricsPanel.setClock(playbackClock);
      const placeSel = el('lyrics-place');
      if (placeSel) placeSel.value = lyricsPanel.getPlace();
      updateLyricsBtn();
    }
    setupColors();

    NowPlaying.start();
    NowPlaying.subscribe(async (track, changed, isPlaying) => {
      engine.setPlaying(Boolean(isPlaying));
      playbackClock.sync(track, isPlaying);
      updateHud(track, isPlaying);
      if (changed && track) {
        if (track.art) {
          const palette = await paletteFromImage(track.art);
          engine.colors.setAlbum(palette);
        }
        await loadLyricsForTrack(track);
      } else if (!track) {
        lyricsPanel?.clear();
      }
    });

    buildPicker((id) => selectVisualizer(id));
    setDockActive = buildDock((id) => selectVisualizer(id));
    buildModal((id) => selectVisualizer(id));
    if (applyAnalysisPreset) applyAnalysisPreset();
    appReady = true;
  }

  if (currentVisId) show('visualizer');
  else show('picker');
}

function updateMeshModeBtn() {
  const btn = el('btn-mesh-mode');
  if (!btn) return;
  const supported = engine && engine.supportsMeshMode();
  btn.classList.toggle('hidden', !supported);
  if (supported) {
    btn.textContent = engine.meshMode === 'dots' ? '⣿ Dots' : '▦ Grid';
  }
}

async function selectVisualizer(id) {
  currentVisId = id;
  engine.setVisualizer(id);
  engine.start();
  if (setDockActive) setDockActive(id);
  updateMeshModeBtn();
  if (lyricsPanel) lyricsPanel.setVisualizer(id);
  show('visualizer');

  if (!Capture.isActive()) {
    const inputs = await populateDevices(false);
    const last = localStorage.getItem(LAST_DEVICE_KEY);
    const labelled = inputs.some((d) => d.label && d.label !== 'Audio input');
    if (last && labelled && inputs.some((d) => d.deviceId === last)) {
      await useDevice(last);
    }
  }
}

function updateHud(track, isPlaying) {
  if (!track) {
    el('hud-title').textContent = 'Nothing playing';
    el('hud-artist').textContent = 'Start a track in Spotify';
    return;
  }
  el('hud-title').textContent = (isPlaying ? '' : '⏸ ') + (track.title || '—');
  el('hud-artist').textContent = track.artists || '—';
  if (track.art) el('hud-art').src = track.art;
}

function setAudioBadge(on) {
  const b = el('hud-audio-state');
  b.textContent = on ? 'audio: live' : 'audio: off';
  b.classList.toggle('on', on);
}

function onCaptureEnded() {
  setAudioBadge(false);
  refreshAudioHint();
}

async function populateDevices(withPermission) {
  try {
    if (withPermission) await Capture.requestPermission();
    const inputs = await Capture.listInputs();
    sourceSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = inputs.length ? 'Select input…' : 'No inputs found';
    sourceSelect.appendChild(placeholder);
    inputs.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label;
      sourceSelect.appendChild(o);
    });
    const last = localStorage.getItem(LAST_DEVICE_KEY);
    if (last && inputs.some((d) => d.deviceId === last)) sourceSelect.value = last;
    return inputs;
  } catch (e) {
    console.error('[main] populateDevices failed', e);
    return [];
  }
}

async function useDevice(deviceId) {
  try {
    await Capture.startFromDevice(deviceId, onCaptureEnded);
    if (deviceId) localStorage.setItem(LAST_DEVICE_KEY, deviceId);
    setAudioBadge(true);
    refreshAudioHint();
  } catch (e) {
    console.error('[main] useDevice failed', e);
    alert('Could not open that audio input. Pick another device or use screen audio.');
    setAudioBadge(false);
    refreshAudioHint();
  }
}

async function enableInput() {
  const inputs = await populateDevices(true);
  if (!inputs.length) {
    alert('No audio input devices found. Install a virtual audio cable, or use screen audio.');
    return;
  }
  const chosen = sourceSelect.value || inputs[0].deviceId;
  sourceSelect.value = chosen;
  await useDevice(chosen);
}

async function shareScreenAudio() {
  try {
    await Capture.startDisplay(onCaptureEnded);
    setAudioBadge(true);
    refreshAudioHint();
  } catch (e) {
    console.error('[main] screen audio failed', e);
    alert(
      (e.message || 'Could not capture screen audio.') +
        '\n\nTip: pick "Entire Screen" + tick "Share system audio" for the desktop ' +
        'app, or the Spotify tab + "Share tab audio".'
    );
    setAudioBadge(false);
    refreshAudioHint();
  }
}

const COLOR_KEY = 'zpektra.colors';

function setupColors() {
  const panel = el('colors-panel');
  const modeSel = el('color-mode');
  const cp = el('color-primary');
  const hp = el('hex-primary');
  const cs = el('color-secondary');
  const hs = el('hex-secondary');
  const speed = el('cycle-speed');
  const intensity = el('color-intensity');
  const intensityVal = el('intensity-val');
  const rotation = el('rotation-speed');
  const rotationVal = el('rotation-val');
  const colorsBtn = el('btn-colors');

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(COLOR_KEY)) || {};
  } catch {
      }
  if (saved.mode) modeSel.value = saved.mode;
  if (saved.primary) { cp.value = saved.primary; hp.value = saved.primary; }
  if (saved.secondary) { cs.value = saved.secondary; hs.value = saved.secondary; }
  if (saved.speed != null) speed.value = saved.speed;
  if (saved.intensity != null) intensity.value = saved.intensity;
  if (saved.rotation != null) rotation.value = saved.rotation;

  const persist = () =>
    localStorage.setItem(
      COLOR_KEY,
      JSON.stringify({
        mode: modeSel.value,
        primary: cp.value,
        secondary: cs.value,
        speed: speed.value,
        intensity: intensity.value,
        rotation: rotation.value,
      })
    );

  function applyRotation() {
    engine.setRotationSpeed(rotation.value);
    rotationVal.textContent = (Number(rotation.value) / 50).toFixed(1) + '×';
  }

  function applyIntensity() {
    const k = Number(intensity.value) / 100;
    engine.colors.setIntensity(k);
    intensityVal.textContent = k.toFixed(1) + '×';
  }

  function applyMode() {
    const m = modeSel.value;
    engine.colors.setMode(m);
    panel.querySelectorAll('.cp-custom').forEach((r) => r.classList.toggle('hidden', m !== 'custom'));
    panel.querySelector('.cp-cycle').classList.toggle('hidden', m !== 'cycle');
    persist();
  }
  function switchToCustom() {
    if (modeSel.value !== 'custom') {
      modeSel.value = 'custom';
      applyMode();
    }
  }
  function applyCustom() {
    engine.colors.setCustomPrimary(cp.value);
    engine.colors.setCustomSecondary(cs.value);
    persist();
  }

  engine.colors.setCustomPrimary(cp.value);
  engine.colors.setCustomSecondary(cs.value);
  engine.colors.setCycleSpeed((Number(speed.value) / 100) * 1.2);
  applyIntensity();
  applyRotation();
  applyMode();

  function openPanel() {
    panel.classList.remove('hidden');
    colorsBtn.classList.add('active');
  }
  function closePanel() {
    panel.classList.add('hidden');
    colorsBtn.classList.remove('active');
  }
  colorsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('hidden') ? openPanel() : closePanel();
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => {
    if (!panel.classList.contains('hidden')) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) closePanel();
  });

  modeSel.addEventListener('change', applyMode);

  cp.addEventListener('input', () => { hp.value = cp.value; switchToCustom(); applyCustom(); });
  hp.addEventListener('input', () => {
    if (isHex(hp.value)) { const v = normHex(hp.value); cp.value = v; hp.value = v; switchToCustom(); applyCustom(); }
  });
  cs.addEventListener('input', () => { hs.value = cs.value; switchToCustom(); applyCustom(); });
  hs.addEventListener('input', () => {
    if (isHex(hs.value)) { const v = normHex(hs.value); cs.value = v; hs.value = v; switchToCustom(); applyCustom(); }
  });
  speed.addEventListener('input', () => {
    engine.colors.setCycleSpeed((Number(speed.value) / 100) * 1.2);
    persist();
  });
  intensity.addEventListener('input', () => { applyIntensity(); persist(); });
  rotation.addEventListener('input', () => { applyRotation(); persist(); });
}

function setupAnalysisPreset() {
  const sel = el('analysis-preset');
  if (!sel) return;
  sel.innerHTML = '';
  ANALYSIS_PRESETS.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    o.title = p.hint;
    sel.appendChild(o);
  });
  let saved = DEFAULT_PRESET;
  try {
    saved = localStorage.getItem(PRESET_STORAGE_KEY) || DEFAULT_PRESET;
  } catch {
    /* ignore */
  }
  if (!ANALYSIS_PRESETS.some((p) => p.id === saved)) saved = DEFAULT_PRESET;
  sel.value = saved;
  sel.title = ANALYSIS_PRESETS.find((p) => p.id === saved)?.hint || 'Analysis preset';

  const apply = () => {
    if (!engine) return;
    engine.setAnalysisPreset(sel.value);
    const meta = ANALYSIS_PRESETS.find((p) => p.id === sel.value);
    sel.title = meta?.hint || 'Analysis preset';
  };
  sel.addEventListener('change', apply);
  if (engine) apply();
  return apply;
}

let applyAnalysisPreset = null;

function wireButtons() {
  applyAnalysisPreset = setupAnalysisPreset();

  el('btn-enter-welcome').addEventListener('click', () => {
    if (Session.isValid()) enterApp();
    else show('login');
  });
  el('btn-login').addEventListener('click', () => Session.login());
  el('btn-logout').addEventListener('click', () => {
    Session.logout();
    location.reload();
  });
  el('btn-share-audio').addEventListener('click', shareScreenAudio);
  el('btn-share-audio-main').addEventListener('click', shareScreenAudio);
  el('btn-enable-input').addEventListener('click', enableInput);

  el('btn-lyrics').addEventListener('click', () => {
    if (!lyricsPanel) return;
    lyricsPanel.setEnabled(!lyricsPanel.isEnabled());
    updateLyricsBtn();
  });
  el('lyrics-place').addEventListener('change', (e) => {
    if (!lyricsPanel) return;
    lyricsPanel.setPlace(e.target.value);
  });

  el('btn-mesh-mode').addEventListener('click', () => {
    if (!engine || !engine.supportsMeshMode()) return;
    engine.toggleMeshMode();
    updateMeshModeBtn();
  });
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if ((e.key === 'm' || e.key === 'M') && engine && engine.supportsMeshMode()) {
      engine.toggleMeshMode();
      updateMeshModeBtn();
      return;
    }

    // H — toggle immersive chrome (hide dock / options, keep song + visualizer)
    if ((e.key === 'h' || e.key === 'H') && !hud.classList.contains('hidden')) {
      const on = hud.classList.toggle('chrome-hidden');
      if (on) {
        const panel = el('colors-panel');
        const colorsBtn = el('btn-colors');
        if (panel) panel.classList.add('hidden');
        if (colorsBtn) colorsBtn.classList.remove('active');
      }
    }
  });
  sourceSelect.addEventListener('change', () => {
    if (sourceSelect.value) useDevice(sourceSelect.value);
  });

  el('btn-login-back').addEventListener('click', () => show('welcome'));
  el('btn-picker-back').addEventListener('click', () => show('welcome'));
  el('btn-home').addEventListener('click', () => show('welcome'));
}

async function main() {
  wireButtons();
  const { justLoggedIn } = await Session.init();

  if (justLoggedIn) enterApp();
  else show('welcome');
}

main();
