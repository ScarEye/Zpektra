// Audio capture with two selectable sources, both feeding a shared AnalyserNode:
//
//   1) Audio INPUT device (getUserMedia)  -> a microphone OR a virtual loopback
//      device (e.g. VB-Audio Cable / VoiceMeeter / "Stereo Mix"). Routing
//      Spotify into a loopback device and selecting it here gives clean, direct,
//      digital audio with NO screen share and a one-time permission. This is the
//      recommended "straight from Spotify" path.
//
//   2) DISPLAY/tab audio (getDisplayMedia) -> share a screen/tab with audio.
//      No install, but re-prompts each session.
//
// Switch sources or devices at any time; the analyser is rebuilt transparently.

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let mediaStream = null;

let currentSource = 'none'; // 'input' | 'display' | 'none'
let currentDeviceId = null;
let endedCb = null;

async function buildAnalyser(stream) {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    throw new Error('No audio track in the selected source.');
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const audioOnly = new MediaStream(audioTracks);
  sourceNode = audioCtx.createMediaStreamSource(audioOnly);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.6;
  sourceNode.connect(analyser);
  // We never connect to destination: the audio already plays via Spotify;
  // re-routing it would cause an echo.

  // If the track ends (user revokes share / unplugs device), clean up + notify.
  audioTracks[0].addEventListener('ended', () => {
    Capture.stop();
    if (endedCb) endedCb();
  });
}

export const Capture = {
  isActive() {
    return Boolean(analyser);
  },
  getAnalyser() {
    return analyser;
  },
  info() {
    return { source: currentSource, deviceId: currentDeviceId };
  },

  // One-time permission so device labels become visible.
  async requestPermission() {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  },

  // List selectable audio input devices (labels need permission first).
  async listInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Audio input' }));
  },

  // Capture from a chosen input device (mic or virtual loopback).
  async startFromDevice(deviceId, onEnded) {
    this.stop();
    endedCb = onEnded || null;
    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    await buildAnalyser(mediaStream);
    currentSource = 'input';
    currentDeviceId = deviceId || null;
    return true;
  },

  // Capture from a shared screen/tab (must tick "share audio").
  async startDisplay(onEnded) {
    this.stop();
    endedCb = onEnded || null;
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    // Drop the video track; we only want audio.
    mediaStream.getVideoTracks().forEach((t) => t.stop());
    await buildAnalyser(mediaStream);
    currentSource = 'display';
    currentDeviceId = null;
    return true;
  },

  stop() {
    try {
      sourceNode?.disconnect();
      mediaStream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    } catch {
      /* ignore */
    }
    sourceNode = null;
    analyser = null;
    mediaStream = null;
    audioCtx = null;
    currentSource = 'none';
  },
};
