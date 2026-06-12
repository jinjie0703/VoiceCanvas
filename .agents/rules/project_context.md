# VoiceCanvas Agent Context

## 项目概述 (Project Overview)
VoiceCanvas 是一个基于语音指令控制的智能手绘白板系统。前后端分离：
1. **前端**通过 Web Speech API 采集语音并转录为文字，通过 WebSocket 发送给后端。
2. **后端**调用大语言模型将自然语言解析为标准的 JSON 动作流（Actions），并下发给前端。
3. **前端**接收 Action 序列驱动 TLDraw 白板进行实时绘制，同时更新右侧 Debug 日志面板。

## 技术栈与版本 (Tech Stack)
- **Frontend**: React 19, TypeScript, Vite, TLDraw, Ant Design, Tailwind CSS v4.
- **Backend**: Go (1.21+), gorilla/websocket, ModelScope API (DeepSeek-V4).

## 架构与目录约定 (Architecture Conventions)
- **前端 (`frontend/src/`)**:
  - `/components`: 存放独立的 React UI 组件。组件需保持纯粹，网络通信状态交给外层统一协调。
  - `/hooks`: 存放副作用与底层接口封装，例如 `useWebSocket.ts`、`useSpeechRecognition.ts`。
  - 样式约定：强烈优先使用 **Tailwind CSS v4** 实用类进行排版与间距控制。主配色体系为 **Sky Blue (天蓝)** 与 **Slate (石板灰)**，禁止使用俗套的“AI紫”色系。
- **后端 (`backend/`)**:
  - `/internal/handler`: 负责对外暴露协议层逻辑（如 `ws.go` 处理 WebSocket 生命周期）。
  - `/internal/service`: 负责核心业务计算（如 `ParserService` 将文本交给 LLM 解析）。
  - `/internal/model`: 统一通信数据结构（Action、Props）。
  - 模块间需通过依赖注入进行调用，不推荐使用全局变量（Global State）。

## 最佳实践与避坑 (Best Practices)
1. **类型导入闭环**：因为前端 `tsconfig.json` 配置了 `verbatimModuleSyntax: true`，所以在引入纯 Type 时，必须使用 `import type { xxx }`，严禁遗漏 `type` 关键字，否则构建必报错。
2. **DOM / CSS 避坑**：右侧与左侧的控制面板采用标准 `div` 与 Tailwind CSS `flex-shrink-0` 及动态宽度的方案处理折叠，禁止混用 Ant Design 自带的 `Sider` 折叠以避免 Flexbox Reflow 错位 Bug。

## Git & PR Guidelines
1. **Commit Messages**: 强制使用 Conventional Commits 规范。所有 commit message 必须以 `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, 或 `chore:` 开头。
2. **Branch Naming**: 新分支必须遵循 `类型/简短描述` 格式（如 `feat/voice-controls` 或 `fix/layout-bug`）。
3. **No Direct Main Push**: 永远不要尝试向 `main` 分支直接 push 业务代码，必须通过创建分支和提 PR 的方式合并。
4. **PR Description**: 在生成 PR 描述时，必须包含 "标题"、"功能描述"、"实现思路"、"测试方式" 四个核心段落。
