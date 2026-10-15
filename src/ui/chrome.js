import { Capture } from '../audio/capture.js';
import { ANALYSIS_PRESETS, DEFAULT_PRESET, PRESET_STORAGE_KEY } from '../audio/presets.js';
import { isHex, normHex } from './colors.js';

const LAST_DEVICE_KEY = 'zpektra.lastInput';
const COLOR_KEY = 'zpektra.colors';

const $ = (id) => document.getElementById(id);

const MENUS = [
  ['btn-audio', 'audio-panel'],
  ['btn-lyrics', 'lyrics-panel'],
  ['btn-colors', 'colors-panel'],
];

export function bindChrome(ctx) {
  const hud = $('hud');
  let lyrics = null;
  let lookBound = false;

  function closeMenus(exceptId) {
    for (const [btnId, panelId] of MENUS) {
      if (panelId === exceptId) continue;
      $(panelId)?.classList.add('hidden');
      const btn = $(btnId);
      btn?.classList.remove('open');
      btn?.setAttribute('aria-expanded', 'false');
    }
    paintLyrics();
  }

  function toggleMenu(btnId, panelId) {
    const panel = $(panelId);
    const willOpen = panel.classList.contains('hidden');
    closeMenus(willOpen ? panelId : null);
    panel.classList.toggle('hidden', !willOpen);
    const btn = $(btnId);
    btn.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    paintLyrics();
  }

  function paintLyrics() {
    const btn = $('btn-lyrics');
    if (!btn || !lyrics) return;
    const open = !$('lyrics-panel').classList.contains('hidden');
    btn.classList.toggle('active', lyrics.isEnabled());
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-pressed', lyrics.isEnabled() ? 'true' : 'false');
    const toggle = $('btn-lyrics-toggle');
    if (toggle) {
      toggle.textContent = lyrics.isEnabled() ? 'On' : 'Off';
      toggle.classList.toggle('active', lyrics.isEnabled());
    }
  }

  function paintMesh() {
    const engine = ctx.getEngine();
    const btn = $('btn-mesh-mode');
    if (!btn) return;
    const supported = Boolean(engine && engine.supportsMeshMode());
    btn.classList.toggle('hidden', !supported);
    if (supported) btn.textContent = engine.meshMode === 'dots' ? 'Dots' : 'Grid';
  }

  function setAudioLive(on) {
    $('audio-dot')?.classList.toggle('on', on);
    const status = $('audio-status');
    if (status) status.textContent = on ? 'Live' : 'Off';
  }

  function refreshHint() {
    const onStage = hud && !hud.classList.contains('hidden');
    $('audio-hint')?.classList.toggle('hidden', !(onStage && !Capture.isActive()));
  }

  function onCaptureEnded() {
    setAudioLive(false);
    refreshHint();
  }

  async function populateDevices(withPermission) {
    const sourceSelect = $('audio-source');
    try {
      if (withPermission) await Capture.requestPermission();
      const inputs = await Capture.listInputs();
      sourceSelect.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = inputs.length ? 'Select input' : 'No inputs found';
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
      console.error('[audio] device list failed', e);
      return [];
    }
  }

  async function useDevice(deviceId) {
    try {
      await Capture.startFromDevice(deviceId, onCaptureEnded);
      if (deviceId) localStorage.setItem(LAST_DEVICE_KEY, deviceId);
      setAudioLive(true);
      refreshHint();
    } catch (e) {
      console.error('[audio] input failed', e);
      window.alert('Could not open that input. Pick another device, or use screen audio.');
      setAudioLive(false);
      refreshHint();
    }
  }

  async function enableInput() {
    const inputs = await populateDevices(true);
    if (!inputs.length) {
      window.alert('No audio inputs found. Use a virtual cable, or share screen audio.');
      return;
    }
    const sourceSelect = $('audio-source');
    const chosen = sourceSelect.value || inputs[0].deviceId;
    sourceSelect.value = chosen;
    await useDevice(chosen);
  }

  async function shareScreenAudio() {
    try {
      await Capture.startDisplay(onCaptureEnded);
      setAudioLive(true);
      refreshHint();
    } catch (e) {
      console.error('[audio] screen capture failed', e);
      window.alert(
        (e.message || 'Could not capture screen audio.') +
          '\n\nChoose Entire Screen and share system audio, or a tab and share tab audio.'
      );
      setAudioLive(false);
      refreshHint();
    }
  }

  async function ensureInput() {
    if (Capture.isActive()) {
      setAudioLive(true);
      refreshHint();
      return;
    }
    const inputs = await populateDevices(false);
    const last = localStorage.getItem(LAST_DEVICE_KEY);
    const labelled = inputs.some((d) => d.label && d.label !== 'Audio input');
    if (last && labelled && inputs.some((d) => d.deviceId === last)) {
      await useDevice(last);
      return;
    }
    setAudioLive(false);
    refreshHint();
  }

  function bindPreset() {
    const sel = $('analysis-preset');
    const hint = $('preset-hint');
    sel.replaceChildren();
    ANALYSIS_PRESETS.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    });
    let saved = DEFAULT_PRESET;
    try {
      saved = localStorage.getItem(PRESET_STORAGE_KEY) || DEFAULT_PRESET;
    } catch {
      saved = DEFAULT_PRESET;
    }
    if (!ANALYSIS_PRESETS.some((p) => p.id === saved)) saved = DEFAULT_PRESET;
    sel.value = saved;

    const apply = () => {
      const engine = ctx.getEngine();
      const meta = ANALYSIS_PRESETS.find((p) => p.id === sel.value);
      if (hint) hint.textContent = meta?.hint || '';
      if (engine) engine.setAnalysisPreset(sel.value);
    };
    sel.addEventListener('change', apply);
    apply();
    return apply;
  }

  const applyPreset = bindPreset();

  function bindLook(engine) {
    if (lookBound) return;
    lookBound = true;

    const panel = $('colors-panel');
    const modeSel = $('color-mode');
    const cp = $('color-primary');
    const hp = $('hex-primary');
    const cs = $('color-secondary');
    const hs = $('hex-secondary');
    const speed = $('cycle-speed');
    const intensity = $('color-intensity');
    const intensityVal = $('intensity-val');
    const rotation = $('rotation-speed');
    const rotationVal = $('rotation-val');

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(COLOR_KEY)) || {};
    } catch {
      saved = {};
    }
    if (saved.mode) modeSel.value = saved.mode;
    if (saved.primary) {
      cp.value = saved.primary;
      hp.value = saved.primary;
    }
    if (saved.secondary) {
      cs.value = saved.secondary;
      hs.value = saved.secondary;
    }
    if (saved.speed != null) speed.value = saved.speed;
    if (saved.intensity != null) intensity.value = saved.intensity;
    if (saved.rotation != null) rotation.value = saved.rotation;

    const persist = () => {
      try {
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
      } catch {
        return;
      }
    };

    const applyRotation = () => {
      engine.setRotationSpeed(rotation.value);
      rotationVal.textContent = (Number(rotation.value) / 50).toFixed(1) + '×';
    };

    const applyIntensity = () => {
      const k = Number(intensity.value) / 100;
      engine.colors.setIntensity(k);
      intensityVal.textContent = k.toFixed(1) + '×';
    };

    const applyMode = () => {
      const m = modeSel.value;
      engine.colors.setMode(m);
      panel.querySelectorAll('.cp-custom').forEach((row) => {
        row.classList.toggle('hidden', m !== 'custom');
      });
      panel.querySelector('.cp-cycle').classList.toggle('hidden', m !== 'cycle');
      persist();
    };

    const switchToCustom = () => {
      if (modeSel.value === 'custom') return;
      modeSel.value = 'custom';
      applyMode();
    };

    const applyCustom = () => {
      engine.colors.setCustomPrimary(cp.value);
      engine.colors.setCustomSecondary(cs.value);
      persist();
    };

    engine.colors.setCustomPrimary(cp.value);
    engine.colors.setCustomSecondary(cs.value);
    engine.colors.setCycleSpeed((Number(speed.value) / 100) * 1.2);
    applyIntensity();
    applyRotation();
    applyMode();

    modeSel.addEventListener('change', applyMode);
    cp.addEventListener('input', () => {
      hp.value = cp.value;
      switchToCustom();
      applyCustom();
    });
    hp.addEventListener('input', () => {
      if (!isHex(hp.value)) return;
      const v = normHex(hp.value);
      cp.value = v;
      hp.value = v;
      switchToCustom();
      applyCustom();
    });
    cs.addEventListener('input', () => {
      hs.value = cs.value;
      switchToCustom();
      applyCustom();
    });
    hs.addEventListener('input', () => {
      if (!isHex(hs.value)) return;
      const v = normHex(hs.value);
      cs.value = v;
      hs.value = v;
      switchToCustom();
      applyCustom();
    });
    speed.addEventListener('input', () => {
      engine.colors.setCycleSpeed((Number(speed.value) / 100) * 1.2);
      persist();
    });
    intensity.addEventListener('input', () => {
      applyIntensity();
      persist();
    });
    rotation.addEventListener('input', () => {
      applyRotation();
      persist();
    });
  }

  MENUS.forEach(([btnId, panelId]) => {
    $(btnId)?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(btnId, panelId);
    });
    $(panelId)?.addEventListener('click', (e) => e.stopPropagation());
  });

  document.addEventListener('click', () => closeMenus());
  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') closeMenus();
      return;
    }
    const catalogOpen = !$('catalog-modal')?.classList.contains('hidden');
    if (e.key === 'Escape') {
      closeMenus();
      return;
    }
    if (catalogOpen) return;
    if ((e.key === 'h' || e.key === 'H') && hud && !hud.classList.contains('hidden')) {
      const on = hud.classList.toggle('chrome-hidden');
      if (on) closeMenus();
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      const engine = ctx.getEngine();
      if (!engine?.supportsMeshMode()) return;
      engine.toggleMeshMode();
      paintMesh();
    }
  });

  $('btn-enable-input')?.addEventListener('click', enableInput);
  $('btn-enable-input-menu')?.addEventListener('click', enableInput);
  $('btn-share-audio')?.addEventListener('click', shareScreenAudio);
  $('btn-share-audio-main')?.addEventListener('click', shareScreenAudio);
  $('audio-source')?.addEventListener('change', () => {
    const id = $('audio-source').value;
    if (id) useDevice(id);
  });
  $('btn-mesh-mode')?.addEventListener('click', () => {
    const engine = ctx.getEngine();
    if (!engine?.supportsMeshMode()) return;
    engine.toggleMeshMode();
    paintMesh();
  });
  $('btn-home')?.addEventListener('click', () => ctx.onHome());
  $('btn-lyrics-toggle')?.addEventListener('click', () => {
    if (!lyrics) return;
    lyrics.setEnabled(!lyrics.isEnabled());
    paintLyrics();
  });
  $('lyrics-place')?.addEventListener('change', (e) => {
    lyrics?.setPlace(e.target.value);
  });
  $('lyrics-follow')?.addEventListener('change', (e) => {
    lyrics?.setFollowTheme(e.target.checked);
  });

  return {
    attach(engine, lyricsPanel) {
      lyrics = lyricsPanel;
      const place = $('lyrics-place');
      if (place) place.value = lyrics.getPlace();
      const follow = $('lyrics-follow');
      if (follow) follow.checked = lyrics.followsTheme();
      lyrics.setColors(engine.colors);
      bindLook(engine);
      applyPreset();
      paintLyrics();
      paintMesh();
    },
    syncMesh: paintMesh,
    refreshHint,
    ensureInput,
    close: () => closeMenus(),
  };
}
