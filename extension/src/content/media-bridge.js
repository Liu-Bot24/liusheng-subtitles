(() => {
  if (typeof window.__fuguangMediaBridgeCleanup === "function") {
    window.__fuguangMediaBridgeCleanup();
  }

  const PAGE_MEDIA_FOUND = "FUGUANG_PAGE_MEDIA_FOUND";
  const PAGE_CONTEXT_FOUND = "FUGUANG_PAGE_CONTEXT_FOUND";
  const PAGE_SNIFFER_MESSAGE = "FUGUANG_PAGE_SNIFFER_MEDIA";
  const PAGE_SNIFFER_CONTEXT = "FUGUANG_PAGE_SNIFFER_CONTEXT";
  let lastMediaUrl = "";
  let lastContextSignature = "";
  let active = true;
  const timers = [];

  window.addEventListener("message", handlePageMessage);
  window.__fuguangMediaBridgeCleanup = stopBridge;

  timers.push(setInterval(reportPageMedia, 2000));
  timers.push(setInterval(reportPageContext, 1200));
  reportPageMedia();
  reportPageContext();

  function handlePageMessage(event) {
    if (!active) {
      return;
    }
    if (event.source !== window) {
      return;
    }
    if (event.data?.type === PAGE_SNIFFER_MESSAGE) {
      sendMedia(event.data.media);
    } else if (event.data?.type === PAGE_SNIFFER_CONTEXT) {
      sendContext(event.data.context);
    }
  }

  function reportPageMedia() {
    if (!active) {
      return;
    }
    const media = findPrimaryMedia();
    const url = media?.currentSrc || media?.src || "";
    if (!url || url === lastMediaUrl) {
      return;
    }
    lastMediaUrl = url;
    sendMedia({
      url,
      kind: media.tagName.toLowerCase(),
      source: "media-element",
      href: location.href,
      title: document.title,
      duration: Number.isFinite(media.duration) ? media.duration : null
    });
  }

  function reportPageContext() {
    if (!active) {
      return;
    }
    const media = findPrimaryMedia();
    const context = {
      href: location.href,
      title: document.title,
      description: readMetaDescription(),
      language: readPageLanguage(),
      hasMedia: Boolean(media),
      duration: media && Number.isFinite(media.duration) ? media.duration : null,
      currentTime: media && Number.isFinite(media.currentTime) ? media.currentTime : null,
      videoWidth: media?.videoWidth || null,
      videoHeight: media?.videoHeight || null,
      elementWidth: media?.clientWidth || null,
      elementHeight: media?.clientHeight || null,
      mediaTag: media?.tagName?.toLowerCase() || "",
      poster: media?.poster || "",
      currentSrc: media?.currentSrc || media?.src || "",
      readyState: media?.readyState || 0
    };
    const signature = JSON.stringify(context);
    if (signature === lastContextSignature) {
      return;
    }
    lastContextSignature = signature;
    safeRuntimeSend({
      type: PAGE_CONTEXT_FOUND,
      context
    });
  }

  function sendContext(context) {
    if (!active || !context) {
      return;
    }
    safeRuntimeSend({
      type: PAGE_CONTEXT_FOUND,
      context
    });
  }

  function sendMedia(media) {
    if (!active || !media?.url || media.url.startsWith("blob:") || media.url.startsWith("data:")) {
      return;
    }
    safeRuntimeSend({
      type: PAGE_MEDIA_FOUND,
      media
    });
  }

  function safeRuntimeSend(message) {
    if (!active || !hasRuntimeContext()) {
      stopBridge();
      return;
    }
    try {
      const pending = chrome.runtime.sendMessage(message);
      if (pending?.catch) {
        pending.catch(error => {
          if (isContextInvalidated(error)) {
            stopBridge();
          }
        });
      }
    } catch (error) {
      if (isContextInvalidated(error)) {
        stopBridge();
      }
    }
  }

  function hasRuntimeContext() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function isContextInvalidated(error) {
    return String(error?.message || error).includes("Extension context invalidated");
  }

  function stopBridge() {
    if (!active) {
      return;
    }
    active = false;
    timers.forEach(timer => clearInterval(timer));
    timers.length = 0;
    window.removeEventListener("message", handlePageMessage);
    if (window.__fuguangMediaBridgeCleanup === stopBridge) {
      delete window.__fuguangMediaBridgeCleanup;
    }
  }

  function findPrimaryMedia() {
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

  function readMetaDescription() {
    return (
      document.querySelector('meta[property="og:description"]')?.content ||
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[name="twitter:description"]')?.content ||
      ""
    ).trim();
  }

  function readPageLanguage() {
    return (
      document.documentElement.lang ||
      document.querySelector('meta[http-equiv="content-language"]')?.content ||
      document.querySelector('meta[property="og:locale"]')?.content ||
      ""
    ).trim();
  }
})();
