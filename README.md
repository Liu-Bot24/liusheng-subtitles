# 浮光译影

浮光译影是一个网页视频字幕翻译插件。它面向两种观看场景：

- 实时模式：捕获当前 Chrome 标签页音频，发送给实时语音翻译模型，立即显示翻译字幕。
- 预加载模式：嗅探网页视频的媒体流，交给本地 helper 使用 ffmpeg 抽取临时音频，生成可随进度条跳转的字幕轨。

当前主线是浏览器插件版本。旧的 PyQt6 桌面版保留在 `desktop-pyqt6` 分支。

## 项目结构

```text
extension/   Chrome Manifest V3 插件
helper/      本地音频处理与实时模型桥接服务
docs/        架构与开发说明
```

## 开发运行

### 1. 启动本地 helper

```bash
cd helper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DASHSCOPE_API_KEY="your-api-key"
python -m fuguang_helper.server
```

如果没有配置 `DASHSCOPE_API_KEY`，实时模式会返回 mock 字幕，方便调试插件链路。

### 2. 加载 Chrome 插件

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择本仓库的 `extension/` 目录

## 模式说明

实时模式适合直播和马上开始观看的内容。它捕获当前标签页的音频，发送给本地 helper，再由 helper 连接实时翻译模型。

预加载模式适合点播视频。插件先嗅探 m3u8、mpd 或音频源，本地 helper 再抽取临时音频并生成 WebVTT 字幕。字幕挂回原网页播放器后，会跟随播放器的 `currentTime` 跳转。

## 本地处理

本地 helper 只监听 `127.0.0.1`。默认端口：

- WebSocket：`ws://127.0.0.1:8765/realtime`
- HTTP：`http://127.0.0.1:8766`

预加载模式需要本机安装 `ffmpeg`。实时模式需要可用的实时翻译模型 API key。
