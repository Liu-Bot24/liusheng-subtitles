import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/content/page-sniffer.js", import.meta.url), "utf8");

{
  const harness = createHarness({
    html: `
      <html>
        <body>
          <a href="https://t.co/BmJcY2BZXu">pic.twitter.com/BmJcY2BZXu</a>
          <script>
            {"playlist":"https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag&#x3D;27"}
            {"mp4":"https://video.twimg.com/amplify_video/2049886560490053635/vid/avc1/1280x720/Lx5E_J_ePkKL_Nwf.mp4?tag&#x3D;27"}
          </script>
        </body>
      </html>
    `
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(
    media.some(item => item.kind === "hls" && item.ext === "m3u8" && item.url === "https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag=27"),
    "X initial HTML HLS playlist should be discovered and HTML entities should be decoded"
  );
  assert.ok(
    media.some(item => item.kind === "media" && item.ext === "mp4" && item.url === "https://video.twimg.com/amplify_video/2049886560490053635/vid/avc1/1280x720/Lx5E_J_ePkKL_Nwf.mp4?tag=27"),
    "X initial HTML MP4 fallback should be discovered"
  );
  assert.equal(
    media.some(item => item.url.startsWith("https://t.co/")),
    false,
    "ordinary social links must not be reported as media"
  );
}

{
  const harness = createHarness();
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  harness.context.JSON.parse(JSON.stringify({
    rest_id: "2059183692569071878",
    legacy: {
      extended_entities: {
        media: [{
          sizes: {
            large: { w: 650, h: 360 }
          },
          video_info: {
            duration_millis: 82000,
            variants: [{
              url: "https://video.twimg.com/amplify_video/2058970000000000153/pl/avc1/650x360/status-82s.m3u8?tag=16",
              content_type: "application/x-mpegURL",
              bitrate: 832000
            }, {
              url: "https://video.twimg.com/amplify_video/2058970000000000153/audio/128000/audio-track.mp4",
              content_type: "audio/mp4",
              bitrate: 128000
            }]
          }
        }]
      }
    }
  }));

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  const statusMedia = media.find(item => /status-82s\.m3u8/.test(item.url));
  assert.equal(statusMedia?.statusId, "2059183692569071878");
  assert.equal(statusMedia?.duration, 82);
  assert.equal(statusMedia?.videoWidth, 650);
  assert.equal(statusMedia?.videoHeight, 360);
  assert.equal(statusMedia?.role, "video");
  const audioMedia = media.find(item => /audio-track\.mp4/.test(item.url));
  assert.equal(audioMedia?.role, "audio");
  assert.equal(audioMedia?.kind, "audio");
}

{
  const harness = createHarness();
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  const extensionFetch = harness.context.window.fetch;
  const pageFetch = function pageFetch() {
    return extensionFetch.apply(this, arguments);
  };
  harness.context.window.fetch = pageFetch;

  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  assert.equal(
    harness.context.window.fetch,
    pageFetch,
    "re-activating the sniffer must not remove a page-installed fetch wrapper"
  );
  assert.equal(harness.context.window.__fuguangPageSnifferRevision, "20261122-capped-site-reads");
  assert.doesNotThrow(() => vm.runInContext(`
    JSON.parse('{"value":1}', (_key, value) =>
      value && value.value === 1
        ? new Proxy(value, { ownKeys() { throw new Error("inspection-only failure"); } })
        : value
    )
  `, harness.context));

  harness.context.window.__fuguangPageSnifferCleanup();
  assert.equal(
    harness.context.window.fetch,
    pageFetch,
    "cleanup must not overwrite a fetch wrapper installed after the sniffer"
  );
}

{
  const staleAudioUrl = "https://upos-sz-mirror.example.test/41176599114-1-30232.m4s";
  const currentAudioUrl = "https://upos-sz-mirror.example.test/37852677660-1-30232.m4s";
  const requestedUrls = [];
  const harness = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1zxovBrE2u",
    html: `<html><body><script>window.__playinfo__={"baseUrl":"${staleAudioUrl}"}</script></body></html>`,
    fetchResponses(url) {
      requestedUrls.push(String(url));
      if (String(url).includes("/x/web-interface/view?bvid=BV1zxovBrE2u")) {
        return createFakeResponse(url, {
          code: 0,
          data: {
            bvid: "BV1zxovBrE2u",
            aid: 116471258745656,
            cid: 37852677660,
            duration: 87,
            pages: [{ page: 1, cid: 37852677660 }]
          }
        }, { "content-type": "application/json" });
      }
      if (String(url).includes("/x/player/playurl?") && String(url).includes("bvid=BV1zxovBrE2u") && String(url).includes("cid=37852677660")) {
        return createFakeResponse(url, {
          code: 0,
          data: {
            dash: {
              duration: 87,
              audio: [{ baseUrl: currentAudioUrl, mimeType: "audio/mp4", id: 30232 }]
            }
          }
        }, { "content-type": "application/json" });
      }
      return null;
    },
    mediaElements: [{
      tagName: "VIDEO",
      duration: 87,
      currentTime: 12,
      readyState: 4,
      clientWidth: 1280,
      clientHeight: 720,
      videoWidth: 1920,
      videoHeight: 1080
    }],
    windowOverrides: {
      __INITIAL_STATE__: {
        videoData: { bvid: "BV1RG8S6GEGr", aid: 1140001, cid: 41176599114 }
      },
      __playinfo__: {
        data: {
          dash: {
            duration: 441,
            audio: [{ baseUrl: staleAudioUrl, mimeType: "audio/mp4", id: 30232 }]
          }
        }
      }
    }
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  await flushPromises();
  assert.deepEqual(
    requestedUrls.filter(url => url.includes("api.bilibili.com")),
    [],
    "Bilibili API probes must not run before the user opens the extension on this page"
  );
  activateSniffer(harness);
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.equal(
    media.some(item => item.url === staleAudioUrl),
    false,
    "Bilibili SPA navigation must not relabel the previous video's playinfo as the current BVID"
  );
  assert.ok(
    media.some(item => item.url === currentAudioUrl && item.source === "bilibili-playurl"),
    `Bilibili SPA navigation should resolve the current route's CID and emit its current playurl; requested=${requestedUrls.join(",")}`
  );
}

{
  const currentAudioUrl = "https://upos-sz-mirror.example.test/current-1-30232.m4s";
  const harness = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1zxovBrE2u",
    mediaElements: [{
      tagName: "VIDEO",
      duration: 87,
      currentTime: 12,
      readyState: 4,
      clientWidth: 1280,
      clientHeight: 720,
      videoWidth: 1920,
      videoHeight: 1080
    }],
    windowOverrides: {
      __INITIAL_STATE__: {
        videoData: { bvid: "BV1zxovBrE2u", aid: 1140002, cid: 4220002 }
      },
      __playinfo__: {
        data: {
          dash: {
            duration: 87,
            audio: [{ baseUrl: currentAudioUrl, mimeType: "audio/mp4", id: 30232 }]
          }
        }
      }
    }
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(
    media.some(item => item.url === currentAudioUrl),
    "matching Bilibili playinfo must remain available to the existing media-selection pipeline"
  );
}

{
  const staleAudioUrl = "https://upos-sz-mirror.example.test/old-duration-1-30232.m4s";
  const harness = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1zxovBrE2u",
    mediaElements: [{
      tagName: "VIDEO",
      duration: 87,
      currentTime: 12,
      readyState: 4,
      clientWidth: 1280,
      clientHeight: 720
    }],
    windowOverrides: {
      __INITIAL_STATE__: {
        videoData: { bvid: "BV1zxovBrE2u", aid: 1140002, cid: 4220002 }
      },
      __playinfo__: {
        data: {
          dash: {
            duration: 441,
            audio: [{ baseUrl: staleAudioUrl, mimeType: "audio/mp4", id: 30232 }]
          }
        }
      }
    }
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.equal(
    media.some(item => item.url === staleAudioUrl),
    false,
    "Bilibili playinfo with the current BVID but a clearly different live-player duration must be treated as transitional stale state"
  );
}

{
  const partTwoAudioUrl = "https://upos-sz-mirror.example.test/part-two-1-30232.m4s";
  const requestedUrls = [];
  const harness = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1MultiPart?p=2",
    fetchResponses(url) {
      requestedUrls.push(String(url));
      if (String(url).includes("/x/player/playurl?") && String(url).includes("bvid=BV1MultiPart") && String(url).includes("cid=222")) {
        return createFakeResponse(url, {
          code: 0,
          data: {
            dash: {
              duration: 120,
              audio: [{ baseUrl: partTwoAudioUrl, mimeType: "audio/mp4", id: 30232 }]
            }
          }
        }, { "content-type": "application/json" });
      }
      return null;
    },
    windowOverrides: {
      __INITIAL_STATE__: {
        videoData: {
          bvid: "BV1MultiPart",
          aid: 987,
          cid: 111,
          pages: [{ page: 1, cid: 111 }, { page: 2, cid: 222 }]
        }
      }
    }
  });
  harness.context.window.__fuguangPageSnifferActivationPending = true;
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  await flushPromises();
  assert.equal(
    "__fuguangPageSnifferActivationPending" in harness.context.window,
    false,
    "the sniffer must consume the activation flag"
  );

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(requestedUrls.some(url => url.includes("cid=222")), "Bilibili p=2 must request the second page CID");
  assert.equal(requestedUrls.some(url => url.includes("cid=111")), false, "Bilibili p=2 must not fall back to the first page CID");
  assert.ok(media.some(item => item.url === partTwoAudioUrl && item.source === "bilibili-playurl"));
}

{
  const harness = createHarness();
  const pageFetchResult = { pageOwned: true };
  harness.context.window.fetch = () => pageFetchResult;
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  assert.equal(
    harness.context.window.fetch("https://example.test/not-a-standard-fetch"),
    pageFetchResult,
    "inspection must preserve a page-owned fetch wrapper's non-Promise return value"
  );
}

{
  const masterUrl = "https://video.twimg.com/amplify_video/2059183631126667264/pl/ujqQBpTjKwgRUz5h.m3u8?tag=14&v=cfc";
  const master = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-32000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/32000/GbDAND4wQKvzaKjK.m3u8"
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-64000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/64000/nYblN7k8RN5JSUbL.m3u8"
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-128000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8"
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=499344,BANDWIDTH=663810,RESOLUTION=1280x720,CODECS="mp4a.40.2,avc1.64001F",AUDIO="audio-128000"
/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8`;
  const harness = createHarness({
    fetchResponse: createFakeResponse(masterUrl, master, {
      "content-type": "application/vnd.apple.mpegurl",
      "content-length": String(master.length)
    })
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  await harness.context.window.fetch(masterUrl);
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  const audio = media.filter(item => /\/pl\/mp4a\//.test(item.url));
  assert.equal(audio.length, 3);
  assert.ok(
    audio.some(item => item.url === "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8" && item.role === "audio"),
    "HLS master audio renditions should be emitted as executable audio candidates"
  );
  assert.ok(
    media.some(item => item.url === "https://video.twimg.com/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8"),
    "HLS master video variants should still be discovered for grouping"
  );
}

{
  const audioInitUrl = "https://video.twimg.com/amplify_video/2059183692569071878/track/init-001.m4s";
  const harness = createHarness({
    fetchResponse: createFakeResponse(audioInitUrl, createFmp4InitSegment("soun"), {
      "content-type": "video/iso.segment",
      "content-length": "96"
    })
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  await harness.context.window.fetch(audioInitUrl);
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  const init = media.find(item => item.url === audioInitUrl && item.segmentType === "init");
  assert.equal(init?.segmentType, "init");
  assert.equal(init?.role, "audio");
  assert.equal(init?.contentType, "audio/mp4");
}

{
  const masterUrl = "https://video.twimg.com/amplify_video/2059183631126667264/pl/ujqQBpTjKwgRUz5h.m3u8?tag=14&v=cfc";
  const mainScriptUrl = "https://abs.twimg.com/responsive-web/client-web/main.test.js";
  const mainScript = `
    const token = "Bearer TEST_PUBLIC_TOKEN";
    e.exports={queryId:"TweetResultQueryId",operationName:"TweetResultByRestId",operationType:"query",metadata:{featureSwitches:["view_counts_everywhere_api_enabled"],fieldToggles:["withArticlePlainText"]}};
  `;
  const tweetJson = JSON.stringify({
    data: {
      tweetResult: {
        result: {
          rest_id: "2059183692569071878",
          legacy: {
            extended_entities: {
              media: [{
                id_str: "2059183631126667264",
                media_url_https: "https://pbs.twimg.com/amplify_video_thumb/2059183631126667264/img/9DBL3kfKP41LFG2H.jpg",
                sizes: { large: { w: 1280, h: 720 } },
                video_info: {
                  duration_millis: 81915,
                  variants: [{
                    content_type: "application/x-mpegURL",
                    url: masterUrl
                  }, {
                    bitrate: 2176000,
                    content_type: "video/mp4",
                    url: "https://video.twimg.com/amplify_video/2059183631126667264/vid/avc1/1280x720/6B5Ja8knj279z4U-.mp4?tag=14"
                  }]
                }
              }]
            }
          }
        }
      }
    }
  });
  const master = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-MEDIA:NAME="Audio",TYPE=AUDIO,GROUP-ID="audio-128000",AUTOSELECT=YES,URI="/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8"
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=499344,BANDWIDTH=663810,RESOLUTION=1280x720,CODECS="mp4a.40.2,avc1.64001F",AUDIO="audio-128000"
/amplify_video/2059183631126667264/pl/avc1/1280x720/px2HLtDW23cRvY8h.m3u8`;
  const requestedUrls = [];
  const harness = createHarness({
    locationHref: "https://x.com/jaynitx/status/2059183692569071878",
    scripts: [{ src: mainScriptUrl, textContent: "" }],
    fetchResponses(url) {
      requestedUrls.push(String(url));
      if (url === mainScriptUrl) {
        return createFakeResponse(url, mainScript, { "content-type": "application/javascript" });
      }
      if (String(url).includes("/i/api/graphql/TweetResultQueryId/TweetResultByRestId")) {
        return createFakeResponse(url, tweetJson, { "content-type": "application/json" });
      }
      if (url === masterUrl) {
        return createFakeResponse(url, master, { "content-type": "application/vnd.apple.mpegurl" });
      }
      return null;
    }
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  await flushPromises();
  await flushPromises();
  assert.deepEqual(requestedUrls, [], "X API probes must not run before the user opens the extension on this page");
  activateSniffer(harness);
  await flushPromises();
  await flushPromises();

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(
    media.some(item => item.url === masterUrl && item.statusId === "2059183692569071878"),
    "X GraphQL probe should emit only the current status media playlist"
  );
  assert.ok(
    media.some(item => item.url === "https://video.twimg.com/amplify_video/2059183631126667264/pl/mp4a/128000/8gx0bryi1XnA-oNu.m3u8" && item.role === "audio"),
    "X GraphQL probe should fetch the HLS master and expose the audio rendition"
  );
  {
    // Route change while the guest token is still being fetched: the probe for the old status stops.
    let releaseGuest;
    const guestGate = new Promise(resolve => {
      releaseGuest = resolve;
    });
    const routedUrls = [];
    const routed = createHarness({
      locationHref: "https://x.com/jaynitx/status/2059183692569071878",
      scripts: [{ src: mainScriptUrl, textContent: "" }],
      fetchResponses(url) {
        routedUrls.push(String(url));
        if (url === mainScriptUrl) {
          return createFakeResponse(url, mainScript, { "content-type": "application/javascript" });
        }
        if (String(url).includes("guest/activate")) {
          return guestGate.then(() => createFakeResponse(url, { guest_token: "1" }, { "content-type": "application/json" }));
        }
        if (String(url).includes("/i/api/graphql/")) {
          return createFakeResponse(url, tweetJson, { "content-type": "application/json" });
        }
        return null;
      }
    });
    activateSniffer(routed);
    await flushPromises();
    await flushPromises();
    routed.context.location.href = "https://x.com/someone/status/1111111111111111111";
    routed.context.location.pathname = "/someone/status/1111111111111111111";
    releaseGuest();
    await flushPromises();
    await flushPromises();
    assert.ok(routedUrls.some(url => url.includes("guest/activate")), "the guest token step was reached");
    assert.equal(routedUrls.some(url => url.includes("/i/api/graphql/")), false,
      "a probe started on one status must not query X after the page moved to another route");
  }
}

{
  const manifestUrl = "https://cdn.example.test/stream/master.m3u8";
  const body = JSON.stringify({ playlist: manifestUrl });
  const cases = [
    { label: "server-sent events", headers: { "content-type": "text/event-stream" }, url: "https://example.test/events" },
    { label: "ndjson stream", headers: { "content-type": "application/x-ndjson" }, url: "https://example.test/feed" },
    { label: "oversized JSON", headers: { "content-type": "application/json", "content-length": String(64 * 1024 * 1024) }, url: "https://example.test/huge.json" }
  ];
  for (const item of cases) {
    const response = createFakeResponse(item.url, body, item.headers);
    let clones = 0;
    response.clone = () => {
      clones += 1;
      return createFakeResponse(item.url, body, item.headers);
    };
    const harness = createHarness({ locationHref: "https://example.test/watch", fetchResponse: response });
    vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
    await harness.context.window.fetch(item.url);
    await flushPromises();
    assert.equal(clones, 0, `${item.label} bodies must not be cloned and buffered for inspection`);
  }
  {
    // No Content-Length: the cap must apply to the bytes actually read from the stream.
    const encoder = new TextEncoder();
    const chunks = [encoder.encode(" ".repeat(9 * 1024 * 1024)), encoder.encode(body)];
    let cancelled = false;
    const streamed = createFakeResponse("https://example.test/unbounded.json", body, { "content-type": "application/json" });
    streamed.clone = () => ({
      ...createFakeResponse("https://example.test/unbounded.json", body, { "content-type": "application/json" }),
      body: {
        getReader() {
          let index = 0;
          return {
            async read() {
              return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true, value: undefined };
            },
            async cancel() {
              cancelled = true;
            }
          };
        }
      }
    });
    const harness = createHarness({ locationHref: "https://example.test/watch", fetchResponse: streamed });
    vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
    await harness.context.window.fetch("https://example.test/unbounded.json");
    await flushPromises();
    assert.equal(cancelled, true, "a body that grows past the cap is cancelled");
    assert.equal(
      harness.messages.some(message => message.media?.url === manifestUrl),
      false,
      "media addresses beyond the read cap are not scanned"
    );
  }
  const normal = createFakeResponse("https://example.test/api.json", body, { "content-type": "application/json", "content-length": String(body.length) });
  const harness = createHarness({ locationHref: "https://example.test/watch", fetchResponse: normal });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  await harness.context.window.fetch("https://example.test/api.json");
  await flushPromises();
  assert.ok(
    harness.messages.some(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA" && message.media?.url === manifestUrl),
    "ordinary JSON responses are still scanned for media addresses"
  );
}

{
  const requestedUrls = [];
  const harness = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1RouteA",
    fetchResponses(url) {
      requestedUrls.push(String(url));
      return null;
    },
    windowOverrides: {
      __INITIAL_STATE__: { videoData: { bvid: "BV1RouteA", aid: 1, cid: 11 } }
    }
  });
  activateSniffer(harness);
  await flushPromises();
  const requestsOnActivatedRoute = requestedUrls.filter(url => url.includes("api.bilibili.com")).length;
  assert.ok(requestsOnActivatedRoute > 0, "the activated route is probed");
  harness.context.location.href = "https://www.bilibili.com/video/BV1RouteB";
  harness.context.location.pathname = "/video/BV1RouteB";
  harness.context.window.__INITIAL_STATE__ = { videoData: { bvid: "BV1RouteB", aid: 2, cid: 22 } };
  harness.context.window.__fuguangLastBilibiliPlayurlProbe = null;
  for (const callback of harness.timerCallbacks.splice(0)) {
    callback();
  }
  await flushPromises();
  assert.equal(
    requestedUrls.filter(url => url.includes("api.bilibili.com")).length,
    requestsOnActivatedRoute,
    "delayed probes must not reach a route the extension was never opened on"
  );
}
{
  const requestedUrls = [];
  const harness = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1RouteB",
    fetchResponses(url) {
      requestedUrls.push(String(url));
      return null;
    },
    windowOverrides: {
      __INITIAL_STATE__: { videoData: { bvid: "BV1RouteB", aid: 2, cid: 22 } },
      __fuguangPageSnifferActivationPending: { href: "https://www.bilibili.com/video/BV1RouteA" }
    }
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
  await flushPromises();
  assert.equal(requestedUrls.some(url => url.includes("api.bilibili.com")), false,
    "an activation issued for another address is ignored");
  assert.equal("__fuguangPageSnifferActivationPending" in harness.context.window, false, "the flag is consumed");
}
function activateSniffer(harness) {
  harness.context.window.__fuguangPageSnifferActivationPending = true;
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });
}

function createHarness({
  html = "",
  fetchResponse = null,
  fetchResponses = null,
  scripts = [],
  locationHref = "https://x.com/AndrewYNg/status/2049886895530967534",
  mediaElements = [],
  windowOverrides = {}
} = {}) {
  const messages = [];
  const timerCallbacks = [];
  let nextTimer = 1;
  const window = {
    fetch(input) {
      const url = typeof input === "string" ? input : input?.url || "";
      if (fetchResponses) {
        const matched = fetchResponses(url);
        if (matched) {
          return Promise.resolve(matched);
        }
      }
      if (fetchResponse) {
        return Promise.resolve(fetchResponse);
      }
      return Promise.reject(new Error("fetch not used by this test"));
    },
    postMessage(message) {
      messages.push(message);
    },
    ...windowOverrides
  };
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function open() {};
  XMLHttpRequest.prototype.send = function send() {};
  const document = {
    title: "X test page",
    documentElement: { innerHTML: html, lang: "en" },
    querySelectorAll() {
      return mediaElements;
    },
    querySelector() {
      return null;
    },
    scripts,
    createElement() {
      return {
        value: "",
        set innerHTML(value) {
          this.value = String(value || "")
            .replace(/&#x3D;/gi, "=")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, "\"")
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">");
        }
      };
    }
  };
  const locationUrl = new URL(locationHref);
  const context = vm.createContext({
    window,
    document,
    location: {
      href: locationHref,
      hostname: locationUrl.hostname,
      protocol: locationUrl.protocol,
      pathname: locationUrl.pathname,
      search: locationUrl.search
    },
    XMLHttpRequest,
    URL,
    URLSearchParams,
    Headers,
    TextDecoder,
    JSON,
    Number,
    String,
    Boolean,
    encodeURIComponent,
    Promise,
    WeakSet,
    Set,
    setInterval() {
      const id = nextTimer;
      nextTimer += 1;
      return id;
    },
    clearTimeout() {},
    setTimeout(callback) {
      timerCallbacks.push(callback);
      const id = nextTimer;
      nextTimer += 1;
      return id;
    }
  });
  return { context, messages, timerCallbacks };
}

function createFakeResponse(url, body, headers = {}) {
  const textBody = typeof body === "string" ? body : body && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer) ? JSON.stringify(body) : "";
  return {
    url,
    body,
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return headers[String(name || "").toLowerCase()] || "";
      }
    },
    clone() {
      return createFakeResponse(url, body, headers);
    },
    async text() {
      return textBody;
    },
    async json() {
      return typeof body === "string" ? JSON.parse(body) : body;
    },
    async arrayBuffer() {
      const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

function createFmp4InitSegment(handlerType) {
  return concatBytes(
    box("ftyp", Uint8Array.from([0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 1, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x36])),
    box("moov", box("trak", box("mdia", box("hdlr", concatBytes(new Uint8Array(8), asciiBytes(handlerType), new Uint8Array(12))))))
  );
}

function box(type, payload) {
  const output = new Uint8Array(8 + payload.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, output.length);
  output.set(asciiBytes(type), 4);
  output.set(payload, 8);
  return output;
}

function asciiBytes(value) {
  return Uint8Array.from(String(value).split("").map(char => char.charCodeAt(0) & 0xff));
}

function concatBytes(...chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

function createStreamedResponse(url, chunks, headers, onCancel) {
  return {
    ...createFakeResponse(url, "", headers),
    body: {
      getReader() {
        let index = 0;
        return {
          async read() {
            return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true, value: undefined };
          },
          async cancel() {
            onCancel();
          }
        };
      }
    }
  };
}

{
  // Site lookups read through the same capped reader as page traffic.
  const encoder = new TextEncoder();
  const padding = encoder.encode(" ".repeat(9 * 1024 * 1024));
  const audioUrl = "https://upos-sz-mirror.example.test/oversized-1-30232.m4s";
  let bilibiliCancelled = false;
  const bilibili = createHarness({
    locationHref: "https://www.bilibili.com/video/BV1Oversized",
    fetchResponses(url) {
      if (String(url).includes("/x/player/playurl?")) {
        const tail = encoder.encode(JSON.stringify({ code: 0, data: { dash: { duration: 120, audio: [{ baseUrl: audioUrl, mimeType: "audio/mp4", id: 30232 }] } } }));
        return createStreamedResponse(url, [encoder.encode("{\"pad\":\""), padding, encoder.encode("\",\"x\":"), tail, encoder.encode("}")],
          { "content-type": "application/json" }, () => { bilibiliCancelled = true; });
      }
      return null;
    },
    windowOverrides: { __INITIAL_STATE__: { videoData: { bvid: "BV1Oversized", aid: 1, cid: 2, pages: [{ page: 1, cid: 2 }] } } }
  });
  activateSniffer(bilibili);
  await flushPromises();
  assert.equal(bilibiliCancelled, true, "an oversized Bilibili response is cancelled");
  assert.equal(bilibili.messages.some(message => message.media?.url === audioUrl), false,
    "media beyond the read cap of a Bilibili lookup is not reported");

  const masterUrl = "https://video.twimg.com/amplify_video/1/pl/oversized.m3u8";
  let xCancelled = false;
  const x = createHarness({
    locationHref: "https://x.com/someone/status/123456789",
    scripts: [{ src: "", textContent: 'e={queryId:"OversizedQuery",operationName:"TweetResultByRestId",metadata:{featureSwitches:[],fieldToggles:[]}};t="Bearer AAAAOversized"' }],
    fetchResponses(url) {
      if (String(url).includes("/i/api/graphql/OversizedQuery/")) {
        const tail = encoder.encode(JSON.stringify({ video_info: { variants: [{ content_type: "application/x-mpegURL", url: masterUrl }] } }));
        return createStreamedResponse(url, [encoder.encode("{\"pad\":\""), padding, encoder.encode("\",\"x\":"), tail, encoder.encode("}")],
          { "content-type": "application/json" }, () => { xCancelled = true; });
      }
      return null;
    }
  });
  activateSniffer(x);
  await flushPromises();
  await flushPromises();
  assert.equal(xCancelled, true, "an oversized X GraphQL response is cancelled");
  assert.equal(x.messages.some(message => message.media?.url === masterUrl), false,
    "media beyond the read cap of an X lookup is not reported");
}

{
  // XHR bodies: the cap counts UTF-8 bytes, and streaming responses are not scanned.
  const manifestUrl = "https://cdn.example.test/xhr/master.m3u8";
  function sendXhr(harness, { body, contentType }) {
    const xhr = new harness.context.XMLHttpRequest();
    const listeners = [];
    xhr.addEventListener = (type, callback) => {
      if (type === "load") {
        listeners.push(callback);
      }
    };
    xhr.responseURL = "https://example.test/api";
    xhr.response = body;
    xhr.getResponseHeader = name => (String(name).toLowerCase() === "content-type" ? contentType : "");
    xhr.send();
    listeners.forEach(callback => callback());
  }
  const reported = harness => harness.messages.some(message => message.media?.url === manifestUrl);

  const normal = createHarness({ locationHref: "https://example.test/watch" });
  vm.runInContext(source, normal.context, { filename: "page-sniffer.js" });
  sendXhr(normal, { body: JSON.stringify({ src: manifestUrl }), contentType: "application/json" });
  await flushPromises();
  assert.equal(reported(normal), true, "an ordinary XHR body is still scanned");

  const wide = createHarness({ locationHref: "https://example.test/watch" });
  vm.runInContext(source, wide.context, { filename: "page-sniffer.js" });
  sendXhr(wide, { body: `${"字".repeat(3 * 1024 * 1024)} ${manifestUrl}`, contentType: "text/plain" });
  await flushPromises();
  assert.equal(reported(wide), false, "an XHR body over the cap in UTF-8 bytes is not scanned");

  const streaming = createHarness({ locationHref: "https://example.test/watch" });
  vm.runInContext(source, streaming.context, { filename: "page-sniffer.js" });
  sendXhr(streaming, { body: `data: {"src":"${manifestUrl}"}\n\n`, contentType: "text/event-stream" });
  await flushPromises();
  assert.equal(reported(streaming), false, "a streaming XHR body is not scanned");
}

{
  // An X client script over 8 MB keeps the query configuration found near its start.
  const encoder = new TextEncoder();
  const scriptUrl = "https://abs.twimg.com/responsive-web/client-web/main.big1234.js";
  const masterUrl = "https://video.twimg.com/amplify_video/2/pl/big-script.m3u8";
  const requested = [];
  const x = createHarness({
    locationHref: "https://x.com/someone/status/223456789",
    scripts: [{ src: scriptUrl, textContent: "" }],
    fetchResponses(url) {
      requested.push(String(url));
      if (url === scriptUrl) {
        const head = encoder.encode('e={queryId:"BigScriptQuery",operationName:"TweetResultByRestId",metadata:{featureSwitches:[],fieldToggles:[]}};t="Bearer AAAABigScript";');
        return createStreamedResponse(url, [head, encoder.encode(" ".repeat(9 * 1024 * 1024))], { "content-type": "application/javascript" }, () => {});
      }
      if (String(url).includes("/i/api/graphql/BigScriptQuery/")) {
        return createFakeResponse(url, { video_info: { variants: [{ content_type: "application/x-mpegURL", url: masterUrl }] } }, { "content-type": "application/json" });
      }
      return null;
    }
  });
  activateSniffer(x);
  await flushPromises();
  await flushPromises();
  assert.ok(requested.some(url => url.includes("/i/api/graphql/BigScriptQuery/")),
    "the query id from a large script is used");
  assert.ok(x.messages.some(message => message.media?.url === masterUrl), "the status media is found");
}

{
  const manifestUrl = "https://cdn.example.test/xhr2/master.m3u8";
  function sendXhr(harness, { body, contentType }) {
    const xhr = new harness.context.XMLHttpRequest();
    const listeners = [];
    xhr.addEventListener = (type, callback) => {
      if (type === "load") {
        listeners.push(callback);
      }
    };
    xhr.responseURL = "https://example.test/api";
    xhr.response = body;
    xhr.getResponseHeader = name => (String(name).toLowerCase() === "content-type" ? contentType : "");
    xhr.send();
    listeners.forEach(callback => callback());
  }
  const reported = harness => harness.messages.some(message => message.media?.url === manifestUrl);

  const ndjson = createHarness({ locationHref: "https://example.test/watch" });
  vm.runInContext(source, ndjson.context, { filename: "page-sniffer.js" });
  sendXhr(ndjson, { body: { src: manifestUrl }, contentType: "application/x-ndjson" });
  await flushPromises();
  assert.equal(reported(ndjson), false, "a streaming XHR body parsed as JSON is not scanned");

  const unpaired = createHarness({ locationHref: "https://example.test/watch" });
  vm.runInContext(source, unpaired.context, { filename: "page-sniffer.js" });
  sendXhr(unpaired, { body: `${"\ud800".repeat(2900 * 1024)} ${manifestUrl}`, contentType: "text/plain" });
  await flushPromises();
  assert.equal(reported(unpaired), false, "unpaired surrogates count as 3 bytes each toward the cap");
}

{
  // A script cut at the 32 MB cap: a field crossing the cut is not used, and a full read returns at once.
  const encoder = new TextEncoder();
  const cap = 32 * 1024 * 1024;
  const scriptUrl = "https://abs.twimg.com/responsive-web/client-web/main.cut1234.js";
  function runCutScript(chunksFor, label) {
    const authorizations = [];
    const requested = [];
    const harness = createHarness({
      locationHref: "https://x.com/someone/status/323456789",
      scripts: [{ src: scriptUrl, textContent: "" }],
      windowOverrides: {
        fetch(input, init = {}) {
          const url = typeof input === "string" ? input : input?.url || "";
          requested.push(url);
          if (url === scriptUrl) {
            const chunks = chunksFor();
            let index = 0;
            return Promise.resolve({
              ...createFakeResponse(url, "", { "content-type": "application/javascript" }),
              body: {
                getReader() {
                  return {
                    read() {
                      return index < chunks.length ? Promise.resolve({ done: false, value: chunks[index++] }) : new Promise(() => {});
                    },
                    async cancel() {}
                  };
                }
              }
            });
          }
          if (url.includes("/i/api/graphql/")) {
            authorizations.push(init.headers?.authorization || "");
            return Promise.resolve(createFakeResponse(url, {}, { "content-type": "application/json" }));
          }
          return Promise.reject(new Error(`unexpected ${label} request`));
        }
      }
    });
    activateSniffer(harness);
    return { authorizations, requested };
  }
  const head = encoder.encode('e={queryId:"CutQuery",operationName:"TweetResultByRestId",metadata:{featureSwitches:[],fieldToggles:[]}};' + " ".repeat(5000));

  const bearerChunk = encoder.encode('t="Bearer AAAAFullRead";');
  const full = runCutScript(() => [head, bearerChunk, new Uint8Array(cap - head.length - bearerChunk.length).fill(32)], "full");
  await flushPromises();
  await flushPromises();
  assert.ok(full.requested.some(url => url.includes("/i/api/graphql/CutQuery/")), "a script read exactly to the cap is used without waiting");
  assert.equal(full.authorizations[0], "Bearer AAAAFullRead");

  const crossing = runCutScript(() => [head, new Uint8Array(cap - head.length - 10).fill(32), encoder.encode("Bearer AAAAHalfOfAToken")], "crossing");
  await flushPromises();
  await flushPromises();
  assert.ok(crossing.authorizations.length > 0, "the query is still sent");
  assert.equal(crossing.authorizations.includes("Bearer AAA"), false, "a token cut at the cap is not used");
}
