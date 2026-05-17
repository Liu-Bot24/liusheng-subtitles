(() => {
  const MESSAGE = {
    PAGE_MEDIA_FOUND: "FUGUANG_PAGE_MEDIA_FOUND",
    SET_CAPTION: "FUGUANG_SET_CAPTION",
    CLEAR_CAPTION: "FUGUANG_CLEAR_CAPTION",
    ATTACH_VTT: "FUGUANG_ATTACH_VTT",
    GET_VIDEO_STATE: "FUGUANG_GET_VIDEO_STATE"
  };

  const OVERLAY_ID = "fuguang-caption-overlay";
  let lastMediaUrl = "";
  let clearTimer = 0;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE.SET_CAPTION) {
      setCaption(message.text, message.mode);
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === MESSAGE.CLEAR_CAPTION) {
      clearCaption();
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === MESSAGE.ATTACH_VTT) {
      attachVtt(message.vtt, message.label || "浮光译影");
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === MESSAGE.GET_VIDEO_STATE) {
      sendResponse({ ok: true, state: getVideoState() });
      return false;
    }
    return false;
  });

  reportPageMedia();
  setInterval(reportPageMedia, 2000);

  function setCaption(text, mode = "realtime") {
    const overlay = ensureOverlay();
    overlay.textContent = text;
    overlay.dataset.mode = mode;
    overlay.hidden = false;
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(() => {
      overlay.hidden = true;
    }, 9000);
  }

  function clearCaption() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.hidden = true;
      overlay.textContent = "";
    }
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      return overlay;
    }
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    Object.assign(overlay.style, {
      position: "fixed",
      left: "50%",
      bottom: "8vh",
      transform: "translateX(-50%)",
      maxWidth: "min(88vw, 980px)",
      padding: "10px 18px",
      borderRadius: "6px",
      background: "rgba(0, 0, 0, 0.72)",
      color: "#fff",
      fontSize: "clamp(18px, 2.2vw, 34px)",
      lineHeight: "1.35",
      textAlign: "center",
      textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
      zIndex: "2147483647",
      pointerEvents: "none",
      whiteSpace: "pre-wrap"
    });
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function attachVtt(vtt, label) {
    const video = findPrimaryVideo();
    if (!video || !vtt) {
      return;
    }
    const existing = video.querySelector("track[data-fuguang-track]");
    if (existing) {
      existing.remove();
    }
    const blob = new Blob([vtt], { type: "text/vtt" });
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = label;
    track.srclang = "zh";
    track.default = true;
    track.dataset.fuguangTrack = "true";
    track.src = URL.createObjectURL(blob);
    video.appendChild(track);
    track.addEventListener("load", () => {
      for (const textTrack of video.textTracks) {
        textTrack.mode = textTrack.label === label ? "showing" : textTrack.mode;
      }
    });
  }

  function getVideoState() {
    const media = findPrimaryVideo();
    if (!media) {
      return null;
    }
    return {
      currentSrc: media.currentSrc || media.src || "",
      currentTime: media.currentTime,
      duration: media.duration,
      paused: media.paused,
      playbackRate: media.playbackRate
    };
  }

  function reportPageMedia() {
    const media = findPrimaryVideo();
    const url = media?.currentSrc || media?.src || "";
    if (!url || url === lastMediaUrl) {
      return;
    }
    lastMediaUrl = url;
    chrome.runtime.sendMessage({
      type: MESSAGE.PAGE_MEDIA_FOUND,
      media: {
        url,
        kind: media.tagName.toLowerCase(),
        title: document.title,
        duration: Number.isFinite(media.duration) ? media.duration : null
      }
    }).catch(() => {});
  }

  function findPrimaryVideo() {
    const media = [...document.querySelectorAll("video, audio")];
    if (media.length === 0) {
      return null;
    }
    return media
      .map(element => ({
        element,
        area: (element.clientWidth || 0) * (element.clientHeight || 0)
      }))
      .sort((a, b) => b.area - a.area)[0].element;
  }
})();
