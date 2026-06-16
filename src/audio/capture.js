let audioCtx = null;
let analyser = null;
let sourceNode = null;
let mediaStream = null;

let currentSource = 'none';
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

  async requestPermission() {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  },

  async listInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Audio input' }));
  },

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

  async startDisplay(onEnded) {
    this.stop();
    endedCb = onEnded || null;
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

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
          }
    sourceNode = null;
    analyser = null;
    mediaStream = null;
    audioCtx = null;
    currentSource = 'none';
  },
};
