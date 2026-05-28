# Media Site Fixtures

These fixtures keep only minimal, non-secret media structure for parser and
resolver tests. Do not place cookies, bearer tokens, signed query strings, or
full production manifests here.

Covered scenarios:

- Bilibili: DASH audio/video m4s tracks and 30216/30232/30280 audio preference.
- X/Twitter: video-only avc1 HLS plus mp4a audio from an amplify master.
- NicoNico: split audio-aac/video-h264 HLS and CMAF-style segment extensions.
- TED: f9-v1 video-only HLS and f8-a1 audio sibling.
- YouTube: placeholder no_input audio and player response entries that may
  require signature deciphering later.
- Generic DASH: MPD adaptation sets and SegmentTemplate parsing.
