const MESSAGE = {
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  START_REALTIME: "FUGUANG_START_REALTIME",
  STOP_REALTIME: "FUGUANG_STOP_REALTIME",
  START_PRELOAD: "FUGUANG_START_PRELOAD"
};

const DEFAULT_HELPER_HTTP = "http://127.0.0.1:8766";
const DEFAULT_HELPER_WS = "ws://127.0.0.1:8765/realtime";

const elements = {
  status: document.querySelector("#status"),
  message: document.querySelector("#message"),
  candidates: document.querySelector("#candidates"),
  helperHttp: document.querySelector("#helperHttp"),
  helperWs: document.querySelector("#helperWs"),
  startRealtime: document.querySelector("#startRealtime"),
  stopRealtime: document.querySelector("#stopRealtime"),
  startPreload: document.querySelector("#startPreload"),
  saveHelper: document.querySelector("#saveHelper"),
  refresh: document.querySelector("#refresh")
};

let activeTab = null;
let candidates = [];

document.addEventListener("DOMContentLoaded", init);
elements.startRealtime.addEventListener("click", () => startRealtime());
elements.stopRealtime.addEventListener("click", () => stopRealtime());
elements.startPreload.addEventListener("click", () => startPreload());
elements.saveHelper.addEventListener("click", () => saveHelperConfig());
elements.refresh.addEventListener("click", () => refreshStatus());

async function init() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const config = await chrome.storage.sync.get({
    helperHttpUrl: DEFAULT_HELPER_HTTP,
    helperWsUrl: DEFAULT_HELPER_WS
  });
  elements.helperHttp.value = config.helperHttpUrl;
  elements.helperWs.value = config.helperWsUrl;
  await refreshStatus();
}

async function refreshStatus() {
  if (!activeTab?.id) {
    setMessage("没有可用的当前标签页。");
    return;
  }
  const response = await send({ type: MESSAGE.GET_STATUS, tabId: activeTab.id });
  if (!response.ok) {
    setMessage(response.error);
    return;
  }
  elements.status.textContent = statusLabel(response);
  candidates = response.candidates || [];
  renderCandidates(candidates);
}

async function startRealtime() {
  setMessage("正在启动实时字幕...");
  const response = await send({ type: MESSAGE.START_REALTIME, tabId: activeTab.id });
  setMessage(response.ok ? "实时字幕已启动。" : response.error);
  await refreshStatus();
}

async function stopRealtime() {
  const response = await send({ type: MESSAGE.STOP_REALTIME, tabId: activeTab.id });
  setMessage(response.ok ? "实时字幕已停止。" : response.error);
  await refreshStatus();
}

async function startPreload() {
  const candidate = candidates[elements.candidates.selectedIndex];
  if (!candidate) {
    setMessage("请先选择一个媒体候选。");
    return;
  }
  setMessage("正在发送预加载任务...");
  const response = await send({
    type: MESSAGE.START_PRELOAD,
    tabId: activeTab.id,
    candidate
  });
  setMessage(response.ok ? "预加载任务已提交。" : response.error);
  await refreshStatus();
}

async function saveHelperConfig() {
  await chrome.storage.sync.set({
    helperHttpUrl: elements.helperHttp.value.trim() || DEFAULT_HELPER_HTTP,
    helperWsUrl: elements.helperWs.value.trim() || DEFAULT_HELPER_WS
  });
  setMessage("Helper 地址已保存。");
}

function renderCandidates(items) {
  elements.candidates.replaceChildren();
  for (const item of items) {
    const option = document.createElement("option");
    option.textContent = `[${item.kind}] ${shorten(item.url)}`;
    option.title = item.url;
    elements.candidates.appendChild(option);
  }
}

function statusLabel(status) {
  if (status.realtime === "running") {
    return "实时中";
  }
  if (status.preload && status.preload !== "idle") {
    return "预加载";
  }
  return "待机";
}

function setMessage(text = "") {
  elements.message.textContent = text;
}

function shorten(url) {
  if (url.length <= 92) {
    return url;
  }
  return `${url.slice(0, 44)}...${url.slice(-34)}`;
}

function send(message) {
  return chrome.runtime.sendMessage(message);
}
