# 浮光译影 Web FFmpeg

这是给浏览器插件调用的静态 WebAssembly FFmpeg 端点。它不需要服务器运行 FFmpeg，服务器只托管 HTML、CSS 和 JS；实际音频提取在用户浏览器本地执行。

## 宝塔部署

1. 在宝塔里新增一个 HTML 静态站点，例如 `ffmpeg.liu-qi.cn`。
2. 把本目录里的文件上传到站点根目录，例如 `/www/wwwroot/ffmpeg.liu-qi.cn`。
3. 在宝塔站点设置里配置 SSL 证书。
4. 浏览器访问部署地址，看到“等待插件连接”即部署成功。

## 插件通信

插件通过 `postMessage` 发送任务：

```js
iframe.contentWindow.postMessage({
  app: "fuguang-web-ffmpeg",
  type: "extract-audio",
  id: "job-1",
  file: {
    name: "input.mp4",
    mime: "video/mp4",
    buffer
  },
  options: {
    format: "mp3"
  }
}, "https://ffmpeg.liu-qi.cn", [buffer]);
```

返回结果是 16 kHz、单声道、64 kbps 的 MP3，适合 ASR 使用。
