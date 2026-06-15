// App bootstrap: wires screens, auth, now-playing metadata, audio capture, and
// the engine. NOTE: we intentionally do NOT use the Web Playback SDK, so your
// music keeps playing wherever you started it (desktop app / phone). We only
// READ what's playing for metadata and visualize the captured audio.

import { Session } from './auth/session.js';
import { NowPlaying } from './spotify/nowplaying.js';
import { Capture } from './audio/capture.js';
import { Engine } from './engine.js';
import { buildPicker, buildDock } from './ui/picker.js';
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

const audioHint = el('audio-hint');
const sourceSelect = el('audio-source');
const LAST_DEVICE_KEY = 'zpektra.lastInput';

function show(name) {
  screens.welcome.classList.toggle('hidden', name !== 'welcome');
  screens.login.classList.toggle('hidden', name !== 'login');
  screens.picker.classList.toggle('hidden', name !== 'picker');
  hud.classList.toggle('hidden', name !== 'visualizer');
  // Prompt to connect audio whenever we're on a visualizer but not capturing.
  const needAudio = name === 'visualizer' && !Capture.isActive();
  audioHint.classList.toggle('hidden', !needAudio);
}

function refreshAudioHint() {
  const onVisualizer = hud.classList.contains('hidden') === false;
  audioHint.classList.toggle('hidden', !(onVisualizer && !Capture.isActive()));
}

let appReady = false;

async function enterApp() {
  if (!appReady) {
    if (!engine) engine = new Engine(el('stage'));
    setupColors();

    NowPlaying.start();
    NowPlaying.subscribe(async (track, changed, isPlaying) => {
      engine.setPlaying(Boolean(isPlaying));
      updateHud(track, isPlaying);
      if (changed && track?.art) {
        const palette = await paletteFromImage(track.art);
        engine.colors.setAlbum(palette); // applied automatically when in album mode
      }
    });

    buildPicker((id) => selectVisualizer(id));
    setDockActive = buildDock((id) => selectVisualizer(id));
    appReady = true;
  }

  // Resume the running visualizer if there is one, else show the chooser.
  if (currentVisId) show('visualizer');
  else show('picker');
}

// Switch to a visualizer (used by both the picker grid and the bottom dock).
async function selectVisualizer(id) {
  currentVisId = id;
  engine.setVisualizer(id);
  engine.start();
  if (setDockActive) setDockActive(id);
  show('visualizer');

  // If audio permission was already granted earlier, auto-resume the saved input
  // device so the user doesn't have to re-enable each time.
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

// Fill the device dropdown. If withPermission, prompt once so labels appear.
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

// "Enable audio input": get permission, list devices, start the saved/first one.
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

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(COLOR_KEY)) || {};
  } catch {
    /* ignore */
  }
  if (saved.mode) modeSel.value = saved.mode;
  if (saved.primary) { cp.value = saved.primary; hp.value = saved.primary; }
  if (saved.secondary) { cs.value = saved.secondary; hs.value = saved.secondary; }
  if (saved.speed != null) speed.value = saved.speed;

  const persist = () =>
    localStorage.setItem(
      COLOR_KEY,
      JSON.stringify({
        mode: modeSel.value,
        primary: cp.value,
        secondary: cs.value,
        speed: speed.value,
      })
    );

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

  // seed controller from current control values
  engine.colors.setCustomPrimary(cp.value);
  engine.colors.setCustomSecondary(cs.value);
  engine.colors.setCycleSpeed((Number(speed.value) / 100) * 1.2);
  applyMode();

  el('btn-colors').addEventListener('click', () => panel.classList.toggle('hidden'));
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
}

function wireButtons() {
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
  sourceSelect.addEventListener('change', () => {
    if (sourceSelect.value) useDevice(sourceSelect.value);
  });
  // Back navigation
  el('btn-login-back').addEventListener('click', () => show('welcome'));
  el('btn-picker-back').addEventListener('click', () => show('welcome'));
  el('btn-home').addEventListener('click', () => show('welcome'));
}

async function main() {
  wireButtons();
  const { justLoggedIn } = await Session.init();
  // If we just came back from the Spotify login redirect, go straight in;
  // otherwise start at the achievement / welcome screen.
  if (justLoggedIn) enterApp();
  else show('welcome');
}

main();
