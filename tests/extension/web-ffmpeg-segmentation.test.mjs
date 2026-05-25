import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

import {
  buildConcatAudioArgs,
  buildExtractAudioArgs,
  inferExtensionFromMime,
  normalizeOutputFormat,
  safeFileStem,
  safeVirtualFileName,
  uniqueVirtualFileName
} from "../../extension/web-ffmpeg/src/ffmpeg-options.js";

const node = {
  appendChild: () => {},
  scrollTop: 0,
  scrollHeight: 0,
  textContent: ""
};

const context = vm.createContext({
  console,
  URL,
  Date,
  Map,
  Set,
  String,
  Number,
  Boolean,
  Math,
  ArrayBuffer,
  Uint8Array,
  location: { href: "chrome-extension://fuguang-test/web-ffmpeg/index.html" },
  document: {
    querySelector: () => ({ ...node }),
    createElement: () => ({ ...node })
  },
  window: {
    addEventListener: () => {},
    parent: { postMessage: () => {} },
    opener: null
  },
  FFmpeg: class {},
  buildConcatAudioArgs,
  buildExtractAudioArgs,
  inferExtensionFromMime,
  normalizeOutputFormat,
  safeFileStem,
  safeVirtualFileName,
  uniqueVirtualFileName
});

const appSource = fs.readFileSync(new URL("../../extension/web-ffmpeg/src/app.js", import.meta.url), "utf8")
  .replace(/import \{[\s\S]*?\} from "\.\/ffmpeg-options\.js";\n\n/, "")
  .replace('import { FFmpeg } from "../vendor/@ffmpeg/ffmpeg/index.js";\n\n', "")
  .replace(
    'const CORE_BASE_URL = new URL("../vendor/@ffmpeg/core", import.meta.url).href.replace(/\\/$/, "");',
    'const CORE_BASE_URL = "chrome-extension://fuguang-test/web-ffmpeg/vendor/@ffmpeg/core";'
  );

vm.runInContext(appSource, context, { filename: "web-ffmpeg-app.js" });

{
  const specs = context.buildOverlappedSegmentSpecs("episode-%03d.mp3", 30, 65, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(specs)), [
    {
      index: 0,
      name: "episode-000.mp3",
      start: 0,
      end: 28,
      duration: 28,
      coreStart: 0,
      coreEnd: 26,
      coreDuration: 26
    },
    {
      index: 1,
      name: "episode-001.mp3",
      start: 24,
      end: 54,
      duration: 30,
      coreStart: 26,
      coreEnd: 52,
      coreDuration: 26
    },
    {
      index: 2,
      name: "episode-002.mp3",
      start: 50,
      end: 65,
      duration: 15,
      coreStart: 52,
      coreEnd: 65,
      coreDuration: 13
    }
  ]);
}

{
  const specs = context.buildOverlappedSegmentSpecs("episode-%03d.mp3", 30, 90, 2);
  assert.equal(
    specs.every(spec => spec.duration <= 30),
    true,
    "overlap-aware fixed-window helper must keep each generated file within the requested window"
  );
  assert.deepEqual(JSON.parse(JSON.stringify(specs.slice(0, 2))), [
    {
      index: 0,
      name: "episode-000.mp3",
      start: 0,
      end: 28,
      duration: 28,
      coreStart: 0,
      coreEnd: 26,
      coreDuration: 26
    },
    {
      index: 1,
      name: "episode-001.mp3",
      start: 24,
      end: 54,
      duration: 30,
      coreStart: 26,
      coreEnd: 52,
      coreDuration: 26
    }
  ]);
}

{
  const specs = context.buildOverlappedSegmentSpecs("internal-%03d.mp3", 30, 182, 2, {
    coreStart: 2,
    coreEnd: 182
  });
  assert.deepEqual(JSON.parse(JSON.stringify(specs.slice(0, 2))), [
    {
      index: 0,
      name: "internal-000.mp3",
      start: 0,
      end: 30,
      duration: 30,
      coreStart: 2,
      coreEnd: 28,
      coreDuration: 26
    },
    {
      index: 1,
      name: "internal-001.mp3",
      start: 26,
      end: 56,
      duration: 30,
      coreStart: 28,
      coreEnd: 54,
      coreDuration: 26
    }
  ]);
  assert.equal(specs.at(-1).coreEnd, 182);
  assert.equal(specs.every(spec => spec.duration <= 30), true);
}

{
  const specs = context.buildSpeechAwareOverlappedSegmentSpecs(
    "speech-%03d.mp3",
    30,
    120,
    2,
    [
      { start: 2, end: 8 },
      { start: 10, end: 16 },
      { start: 62, end: 68 }
    ]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(specs)), [
    {
      index: 0,
      name: "speech-000.mp3",
      start: 0,
      end: 18,
      duration: 18,
      coreStart: 2,
      coreEnd: 16,
      coreDuration: 14
    },
    {
      index: 1,
      name: "speech-001.mp3",
      start: 60,
      end: 70,
      duration: 10,
      coreStart: 62,
      coreEnd: 68,
      coreDuration: 6
    }
  ]);
}

{
  const specs = context.buildSpeechAwareOverlappedSegmentSpecs(
    "speech-%03d.mp3",
    30,
    65,
    2,
    [{ start: 0, end: 65 }]
  );
  assert.deepEqual(JSON.parse(JSON.stringify(specs)), [
    {
      index: 0,
      name: "speech-000.mp3",
      start: 0,
      end: 28,
      duration: 28,
      coreStart: 0,
      coreEnd: 26,
      coreDuration: 26
    },
    {
      index: 1,
      name: "speech-001.mp3",
      start: 24,
      end: 54,
      duration: 30,
      coreStart: 26,
      coreEnd: 52,
      coreDuration: 26
    },
    {
      index: 2,
      name: "speech-002.mp3",
      start: 50,
      end: 65,
      duration: 15,
      coreStart: 52,
      coreEnd: 65,
      coreDuration: 13
    }
  ]);
}

{
  const emptySpeechSpecs = context.buildSpeechAwareOverlappedSegmentSpecs(
    "speech-%03d.mp3",
    30,
    120,
    2,
    []
  );
  assert.deepEqual(JSON.parse(JSON.stringify(emptySpeechSpecs)), []);

  const unknownSpeechSpecs = context.buildSpeechAwareOverlappedSegmentSpecs(
    "speech-%03d.mp3",
    30,
    65,
    2,
    null
  );
  assert.equal(unknownSpeechSpecs.length, 3);
}

{
  const specs = context.buildCollectedSpeechSegmentSpecs(
    "collected-%03d.mp3",
    [
      { start: 31, end: 32 },
      { start: 58, end: 59 },
      { start: 75, end: 76 }
    ],
    2,
    60,
    { sourceStart: 30 }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(specs)), [
    {
      index: 0,
      name: "collected-000.mp3",
      sourceStart: 31,
      sourceEnd: 59,
      duration: 2,
      parts: [
        {
          relativeStart: 1,
          relativeEnd: 2,
          sourceStart: 31,
          sourceEnd: 32,
          outputStart: 0,
          outputEnd: 1,
          duration: 1
        },
        {
          relativeStart: 28,
          relativeEnd: 29,
          sourceStart: 58,
          sourceEnd: 59,
          outputStart: 1,
          outputEnd: 2,
          duration: 1
        }
      ]
    },
    {
      index: 1,
      name: "collected-001.mp3",
      sourceStart: 75,
      sourceEnd: 76,
      duration: 1,
      parts: [
        {
          relativeStart: 45,
          relativeEnd: 46,
          sourceStart: 75,
          sourceEnd: 76,
          outputStart: 0,
          outputEnd: 1,
          duration: 1
        }
      ]
    }
  ]);
}

{
  assert.equal(context.normalizeSegmentOverlapSeconds(2, 30), 2);
  assert.equal(context.normalizeSegmentOverlapSeconds(20, 30), 15);
  assert.equal(context.normalizeSegmentOverlapSeconds(-1, 30), 0);
}

{
  const args = buildExtractAudioArgs({
    inputName: "input.mp4",
    outputName: "chunk-001.mp3",
    trimStart: 28,
    trimDuration: 34,
    detectSpeech: false
  });
  assert.deepEqual(args.slice(0, 6), ["-ss", "28", "-i", "input.mp4", "-t", "34"]);
  assert.equal(args.at(-1), "chunk-001.mp3");
}

{
  const args = buildExtractAudioArgs({
    inputName: "input.mp4",
    outputName: "audio.mp3",
    detectSpeech: true
  });
  assert.ok(args.includes("silencedetect=n=-55dB:d=0.16"));
}

{
  const intervals = context.speechIntervalsFromFfmpegLogs([
    "[silencedetect @ 0x1] silence_start: 2",
    "[silencedetect @ 0x1] silence_end: 3 | silence_duration: 1"
  ], 10);
  assert.deepEqual(JSON.parse(JSON.stringify(intervals)), [
    { start: 0, end: 2.4 },
    { start: 2.6, end: 10 }
  ]);
}

{
  const intervals = context.speechIntervalsFromFfmpegLogs([
    "[silencedetect @ 0x1] silence_start: 2",
    "[silencedetect @ 0x1] silence_end: 2.5 | silence_duration: 0.5"
  ], 10);
  assert.deepEqual(JSON.parse(JSON.stringify(intervals)), [
    { start: 0, end: 10 }
  ]);
}

{
  const commands = [];
  const files = new Map([
    ["audio.mp3", Uint8Array.from([1, 2, 3, 4])]
  ]);
  const ffmpeg = {
    async exec(command) {
      commands.push([...command]);
      const outputName = command.at(-1);
      files.set(outputName, Uint8Array.from([commands.length, commands.length + 1]));
      return 0;
    },
    async readFile(name) {
      return files.get(name);
    }
  };
  const chunks = await context.extractOverlappedSegmentOutputs(
    ffmpeg,
    "audio.mp3",
    "speech-%03d.mp3",
    30,
    120,
    2,
    [
      { start: 2, end: 8 },
      { start: 62, end: 68 }
    ],
    new Set()
  );
  assert.deepEqual(JSON.parse(JSON.stringify(chunks.map(chunk => ({
    start: chunk.start,
    end: chunk.end,
    coreStart: chunk.coreStart,
    coreEnd: chunk.coreEnd,
    speechIntervals: chunk.speechIntervals
  })))), [
    {
      start: 0,
      end: 10,
      coreStart: 2,
      coreEnd: 8,
      speechIntervals: [{ start: 2, end: 8 }]
    },
    {
      start: 60,
      end: 70,
      coreStart: 62,
      coreEnd: 68,
      speechIntervals: [{ start: 62, end: 68 }]
    }
  ]);
  assert.equal(commands.length, 2);
  assert.equal(commands.every(command => command.includes("-t")), true);
  assert.equal(commands[0].includes("-ss"), false);
  assert.equal(commands[1].includes("-ss"), true);
}

{
  const commands = [];
  const files = new Map();
  const ffmpeg = {
    async exec(command) {
      commands.push([...command]);
      files.set(command.at(-1), Uint8Array.from([commands.length, commands.length + 1]));
      return 0;
    },
    async readFile(name) {
      return files.get(name);
    }
  };
  const spec = context.buildCollectedSpeechSegmentSpecs(
    "collected-%03d.mp3",
    [
      { start: 31, end: 32 },
      { start: 58, end: 59 }
    ],
    30,
    60,
    { sourceStart: 30 }
  )[0];
  const chunk = await context.collectSpeechSegmentOutput(ffmpeg, "audio.mp3", spec, new Set());
  assert.equal(chunk.start, 31);
  assert.equal(chunk.end, 59);
  assert.equal(chunk.duration, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(chunk.speechIntervals)), [
    { start: 31, end: 32 },
    { start: 58, end: 59 }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(chunk.timeMap)), [
    { outputStart: 0, outputEnd: 1, sourceStart: 31, sourceEnd: 32 },
    { outputStart: 1, outputEnd: 2, sourceStart: 58, sourceEnd: 59 }
  ]);
  assert.equal(commands.length, 3);
  assert.equal(commands[0].includes("-ss"), true);
  assert.equal(commands[2].some(item => String(item).includes("concat=n=2:v=0:a=1[aout]")), true);
}

{
  const commands = [];
  const ffmpeg = {
    async exec(command) {
      commands.push([...command]);
      return 0;
    },
    async readFile() {
      return Uint8Array.from([1, 2]);
    }
  };
  const chunks = await context.extractOverlappedSegmentOutputs(
    ffmpeg,
    "audio.mp3",
    "speech-%03d.mp3",
    30,
    120,
    2,
    [],
    new Set(),
    { speechIntervalsReliable: false }
  );
  assert.equal(chunks.length, 5);
  assert.equal(commands.length, 5);
  assert.equal(chunks.every(chunk => chunk.duration <= 30), true);
  assert.equal(chunks.every(chunk => chunk.speechIntervalsReliable === false), true);
  assert.equal(chunks.every(chunk => chunk.speechIntervals === undefined), true);
}
