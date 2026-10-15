import { COPYRIGHT_LINE } from './meta.js';
import { Session } from './auth/session.js';
import { NowPlaying } from './spotify/nowplaying.js';
import { PlaybackClock } from './spotify/playbackClock.js';
import { fetchLyrics } from './spotify/lyrics.js';
import { Engine } from './engine.js';
import { LyricsPanel } from './ui/lyrics.js';
import { paletteFromImage } from './visualizers/palette.js';
import { mountLibrary, mountDock, mountCatalog, closeCatalog } from './ui/library.js';
import { bindChrome } from './ui/chrome.js';

const $ = (id) => document.getElementById(id);

const screens = {
  welcome: $('screen-welcome'),
  login: $('screen-login'),
  library: $('screen-library'),
};
const hud = $('hud');

let engine = null;
let lyricsPanel = null;
let setDockActive = null;
let currentVisId = null;
let ready = false;
const playbackClock = new PlaybackClock();
let lyricsFetchId = 0;

const chrome = bindChrome({
  getEngine: () => engine,
  onHome: () => show('welcome'),
});

function show(name) {
  const onStage = name === 'stage';
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle('hidden', key !== name);
  });
  hud.classList.toggle('hidden', !onStage);
  document.body.classList.toggle('on-stage', onStage);

  if (engine) {
    if (onStage) engine.start();
    else engine.stop();
  }

  lyricsPanel?.setOnStage(onStage);

  if (!onStage) closeCatalog();
  chrome.close();
  chrome.refreshHint();
}

function updateHud(track, isPlaying) {
  const art = $('hud-art');
  if (!track) {
    $('hud-title').textContent = 'Nothing playing';
    $('hud-artist').textContent = 'Start a track in Spotify';
    art.removeAttribute('src');
    art.alt = '';
    return;
  }
  $('hud-title').textContent = (isPlaying ? '' : 'Paused · ') + (track.title || '—');
  $('hud-artist').textContent = track.artists || '—';
  art.alt = track.title || '';
  if (track.art) art.src = track.art;
}

async function loadLyricsForTrack(track) {
  if (!lyricsPanel || !track?.track_id) {
    lyricsPanel?.clear();
    return;
  }
  const id = ++lyricsFetchId;
  lyricsPanel.elStatus.textContent = 'Loading lyrics';
  lyricsPanel.elPrev.textContent = '';
  lyricsPanel.elCurr.textContent = '';
  lyricsPanel.elNext.textContent = '';
  lyricsPanel.refreshVisibility();
  const payload = await fetchLyrics(track);
  if (id !== lyricsFetchId) return;
  lyricsPanel.setLyrics(payload);
}

async function selectVisualizer(id) {
  if (!engine) return;
  currentVisId = id;
  engine.setVisualizer(id);
  if (setDockActive) setDockActive(id);
  chrome.syncMesh();
  lyricsPanel?.setVisualizer(id);
  show('stage');
  await chrome.ensureInput();
}

function ensureRuntime() {
  if (ready) return;
  engine = new Engine($('stage'));
  lyricsPanel = new LyricsPanel();
  lyricsPanel.setClock(playbackClock);

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
      lyricsPanel.clear();
    }
  });

  chrome.attach(engine, lyricsPanel);
  ready = true;
}

function enter() {
  ensureRuntime();
  if (currentVisId) show('stage');
  else show('library');
}

function bindSession() {
  $('btn-enter-welcome').addEventListener('click', () => {
    if (Session.isValid()) enter();
    else show('login');
  });
  $('btn-login').addEventListener('click', () => Session.login());
  $('btn-logout').addEventListener('click', () => {
    Session.logout();
    location.reload();
  });
  $('btn-login-back').addEventListener('click', () => show('welcome'));
  $('btn-library-back').addEventListener('click', () => show('welcome'));
}

async function main() {
  document.querySelectorAll('[data-legal]').forEach((node) => {
    node.textContent = COPYRIGHT_LINE;
  });
  mountLibrary(selectVisualizer);
  setDockActive = mountDock(selectVisualizer);
  mountCatalog(selectVisualizer);
  bindSession();

  const { justLoggedIn } = await Session.init();
  if (justLoggedIn) enter();
  else show('welcome');
}

main();
