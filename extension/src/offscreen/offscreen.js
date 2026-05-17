const MESSAGE = {
  OFFSCREEN_START_REALTIME: "FUGUANG_OFFSCREEN_START_REALTIME",
  OFFSCREEN_STOP_REALTIME: "FUGUANG_OFFSCREEN_STOP_REALTIME",
  OFFSCREEN_REALTIME_CAPTION: "FUGUANG_OFFSCREEN_REALTIME_CAPTION",
  OFFSCREEN_REALTIME_ERROR: "FUGUANG_OFFSCREEN_REALTIME_ERROR"
};

let currentCapture = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE.OFFSCREEN_START_REALTIME) {
    startRealtimeCapture(message)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === MESSAGE.OFFSCREEN_STOP_REALTIME) {
    stopRealtimeCapture();
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

async function startRealtimeCapture({ tabId, streamId, helperWsUrl }) {
  stopRealtimeCapture();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const monitor = context.createGain();
  monitor.gain.value = 1;
  source.connect(monitor).connect(context.destination);

  const processor = context.createScriptProcessor(4096, 1, 1);
  const socket = new WebSocket(helperWsUrl);
  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({
      type: "start",
      sampleRate: 16000,
      inputFormat: "pcm16"
    }));
  });

  socket.addEventListener("message", event => {
    const data = parseJson(event.data);
    if (data?.type === "caption" && data.text) {
      chrome.runtime.sendMessage({
        type: MESSAGE.OFFSCREEN_REALTIME_CAPTION,
        tabId,
        text: data.text
      });
    }
    if (data?.type === "error") {
      chrome.runtime.sendMessage({
        type: MESSAGE.OFFSCREEN_REALTIME_ERROR,
        tabId,
        error: data.error || "Realtime helper error."
      });
    }
  });

  socket.addEventListener("error", () => {
    chrome.runtime.sendMessage({
      type: MESSAGE.OFFSCREEN_REALTIME_ERROR,
      tabId,
      error: "Cannot connect to local realtime helper."
    });
  });

  processor.onaudioprocess = event => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const input = event.inputBuffer.getChannelData(0);
    const downsampled = downsample(input, event.inputBuffer.sampleRate, 16000);
    socket.send(encodePcm16(downsampled));
  };

  source.connect(processor);
  processor.connect(context.destination);

  currentCapture = { context, processor, socket, stream };
}

function stopRealtimeCapture() {
  if (!currentCapture) {
    return;
  }
  currentCapture.processor.disconnect();
  currentCapture.stream.getTracks().forEach(track => track.stop());
  currentCapture.socket.close();
  currentCapture.context.close();
  currentCapture = null;
}

function downsample(input, inputRate, outputRate) {
  if (outputRate === inputRate) {
    return input;
  }
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
    }
    output[i] = sum / Math.max(end - start, 1);
  }
  return output;
}

function encodePcm16(samples) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
