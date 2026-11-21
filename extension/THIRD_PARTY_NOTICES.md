# Third-party notices

流声字幕 itself is released under the MIT License (see `LICENSE` in the source repository). The extension also ships the third-party components below, each under its own license.

## FFmpeg (WebAssembly build)

- Files: `web-ffmpeg/vendor/@ffmpeg/core/ffmpeg-core.wasm`, `web-ffmpeg/vendor/@ffmpeg/core/ffmpeg-core.js`
- What it is: the unmodified `@ffmpeg/core` 0.12.6 build published by the ffmpeg.wasm project. It contains FFmpeg 5.1.4 configured with `--enable-gpl` and linked with x264 and x265, so the combined binary is licensed under the **GNU General Public License, version 2 or later**. The license text is in `web-ffmpeg/vendor/@ffmpeg/core/COPYING.GPLv2`.
- Corresponding source:
  - FFmpeg 5.1.4: <https://github.com/FFmpeg/FFmpeg/tree/n5.1.4>
  - Build recipe used for this binary (Dockerfile and build scripts, commit `e0d4c62a229ba58ea0c6e6b881e289f2fefe97c4`): <https://github.com/ffmpegwasm/ffmpeg.wasm/tree/e0d4c62a229ba58ea0c6e6b881e289f2fefe97c4>
  - Libraries built into it, at the branches or tags named in that recipe: x264 (`4-cores`) <https://github.com/ffmpegwasm/x264>, x265 (`3.4`) <https://github.com/ffmpegwasm/x265>, libvpx (`v1.13.1`) <https://github.com/ffmpegwasm/libvpx>, LAME <https://github.com/ffmpegwasm/lame>, libogg (`v1.3.4`) <https://github.com/ffmpegwasm/Ogg>, libtheora (`v1.1.1`) <https://github.com/ffmpegwasm/theora>, Opus (`v1.3.1`) <https://github.com/ffmpegwasm/opus>, libvorbis (`v1.3.3`) <https://github.com/ffmpegwasm/vorbis>, zlib (`v1.2.11`) <https://github.com/ffmpegwasm/zlib>, libwebp (`v1.3.2`) <https://github.com/ffmpegwasm/libwebp>, FreeType (`VER-2-10-4`) <https://github.com/ffmpegwasm/freetype2>, FriBidi (`v1.0.9`) <https://github.com/fribidi/fribidi>, HarfBuzz (`5.2.0`) <https://github.com/harfbuzz/harfbuzz>, libass (`0.15.0`) <https://github.com/libass/libass>, zimg (`release-3.0.5`) <https://github.com/sekrit-twc/zimg>
- FFmpeg configure flags recorded in the binary:

  ```text
  --target-os=none --arch=x86_32 --enable-cross-compile --disable-asm --disable-stripping --disable-programs --disable-doc --disable-debug --disable-runtime-cpudetect --disable-autodetect --nm=emnm --ar=emar --ranlib=emranlib --cc=emcc --cxx=em++ --objcc=emcc --dep-cc=emcc --extra-cflags='-I/opt/include -O3 -msimd128' --extra-cxxflags='-I/opt/include -O3 -msimd128' --disable-pthreads --disable-w32threads --disable-os2threads --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libmp3lame --enable-libtheora --enable-libvorbis --enable-libopus --enable-zlib --enable-libwebp --enable-libfreetype --enable-libfribidi --enable-libass --enable-libzimg
  ```

## ffmpeg.wasm JavaScript wrapper

- Files: `web-ffmpeg/vendor/@ffmpeg/ffmpeg/*.js`, and the JavaScript glue in `web-ffmpeg/vendor/@ffmpeg/core/ffmpeg-core.js`
- License: MIT, Copyright (c) 2019 Jerome Wu. Full text in `web-ffmpeg/vendor/@ffmpeg/LICENSE`.
- Source: <https://github.com/ffmpegwasm/ffmpeg.wasm>

## Mediabunny

- File: `src/vendor/mediabunny/mediabunny.min.mjs` (unmodified release build)
- License: Mozilla Public License 2.0, Copyright (c) Vanilagy and contributors. Full text in `src/vendor/mediabunny/LICENSE`.
- Source: <https://github.com/Vanilagy/mediabunny>
