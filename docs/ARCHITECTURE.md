# VoiceCanvas 系统架构设计 (Architecture)

## 整体架构总览

VoiceCanvas 是一个前后端分离的 Agentic 白板系统。

- **前端 (Frontend)**：基于 React + tldraw，负责录音、原生语音识别、渲染白板内容，并打包当前画布的空间状态（State）发送。
- **后端 (Backend)**：基于 Go + Eino，维护了一个大模型智能体（Agent）循环，负责分析用户意图、处理多轮对话并生成规范的操作指令流。

## 数据流向 (Data Flow)

1. **语音转录**: 前端调用浏览器 Web Speech API 将语音转化为文字（Text）。
2. **状态观测 (Observation)**: 前端提取出目前画布上的所有图形元素，并计算它们的位置和大小（x, y, w, h），将其打包为 `canvas_state`。
3. **网络传输**: 通过 Gorilla WebSocket，以长链接的方式将 `(text, canvas_state)` 推送给后端。
4. **Agent 推理 (ReAct)**: 后端 Eino Agent 接收到上下文后，开始思考（Thought）：
   - 判断需要新建、修改还是删除图形。
   - 分析 Observation，使用数学计算避免新图形与原有图形发生重叠。
   - 如果遇到需要外部介入的需求（如生成/搜索图片），自动调用绑定的 Tools 扩展能力。
5. **指令下发 (Action)**: Agent 最终输出一段规范的 JSON 动作序列，后端通过 WebSocket 将解析后的对象流传回给前端。
6. **画布响应**: 前端 ActionEngine 拦截到 JSON 动作流，将其精确转换为 tldraw 内部的对象更新、删除或创建逻辑，完成实时渲染。
