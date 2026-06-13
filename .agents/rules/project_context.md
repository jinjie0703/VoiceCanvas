---
trigger: always_on
---

# VoiceCanvas Agent Context

## 项目概述 (Project Overview)

VoiceCanvas 是一个基于语音指令控制的智能手绘白板系统。前后端分离：

1. **前端**通过 Web Speech API 采集语音并转录为文字，通过 WebSocket 发送给后端。
2. **后端**调用大语言模型将自然语言解析为标准的 JSON 动作流（Actions），并下发给前端。
3. **前端**接收 Action 序列驱动 TLDraw 白板进行实时绘制，同时更新右侧 Debug 日志面板。

## 技术栈与版本 (Tech Stack)

- **Frontend**: React 19, TypeScript, Vite, TLDraw, Ant Design, Tailwind CSS v4.
- **Backend**: Go (1.26+), gorilla/websocket, ModelScope API (DeepSeek-V4).

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

## Safety (安全与权限红线)

1. **禁止破坏性清理**：绝对不要执行 `rm -rf` 等破坏性命令来清理项目目录或删除未知文件。
2. **依赖防破坏**：严禁擅自覆盖 `frontend/package.json` 或 `backend/go.mod` 导致大版本依赖降级或丢失，如果要新增包，请仅使用 `npm install <pkg>` 或 `go get <pkg>`。
3. **敏感信息保护**：生成代码或日志演示时，禁止明文打印或硬编码包含真实的 DashScope / ModelScope API Key 字符串。

## Style (代码与审美规范)

1. **UI 审美边界**：前端必须采用“专业工程/极简设计”风格，大量使用 `slate` (石板灰)、`sky` (天蓝)、`emerald` (翠绿)。**严格禁止使用 `violet/purple/fuchsia` (紫色系)** 等泛滥的 AI 感配色。
2. **产品文案基调 (Copywriting Tone)**：【极其重要】所有交互提示、Slogan、状态描述必须遵循**“大道至简、意在言外”**的隐喻风格，控制在单行以内。文案必须隐晦而高级地映射 VoiceCanvas 的核心动作——即“声音（Voice）”转化为“形状/架构（Canvas）”。例如使用 `「 循声而往，化意为形 」`、`静候回声`、`凝音成形`、`跃然纸上` 等充满禅意与现代极客浪漫的词汇。绝对禁止使用大白话说明书式文案，或过于中二的古代战争词汇。
3. **CSS 规范**：优先在 TSX 内直接书写 Tailwind CSS v4 的 class。如果必须在 `index.css` 写全局样式，必须加前缀，防止污染 TLDraw 原生节点。
4. **TypeScript 类型规范 (绝对禁止使用 any)**：【重点强调】严格遵守业界规范，**禁止在 TypeScript 代码中使用 `any` 类型**。若类型不确定，必须使用 `unknown` 并进行类型收窄，或通过泛型工具（如 `Record<string, unknown>`）提取精确类型。必须保证项目无 `@typescript-eslint/no-explicit-any` 报错。
5. **Go 代码标准**：遵循标准 `gofmt`。业务层返回的错误必须由外层 Handle 统一记录，业务方法避免滥用 `panic`。

## Workflow (操作流规范)

1. **构建校验强制性**：如果在前端添加了未使用的变量或导入项，或者调整了 TypeScript 接口，必须立刻在终端执行 `npm run build` 进行静默校验，通过后才能报告任务完成。
2. **测试边界**：如果要测试后端的 LLM 通信能力，可以使用 Mock Parser 模式运行以免无端消耗 API 账单额度。

## Advanced Standards (进阶开发规范)

1. **状态管理规范 (State Management)**：前端全局状态统一使用 Zustand，严禁滥用 React Context 或进行深层 Prop-drilling（属性透传）。本地表单或简单 UI 状态才允许使用 `useState`。
2. **错误捕获与提示 (Error Handling)**：所有关键渲染区域必须被 `ErrorBoundary` 包裹。网络请求和 WebSocket 断线等异常，必须在 UI 层有优雅的兜底（例如 Toast 提示），绝不允许应用白屏或无提示死锁。
3. **AI 与协作注释规范 (Documentation)**：所有跨模块调用的核心业务逻辑或工具函数，必须编写完整的 JSDoc / TSDoc 注释（包括参数用途和返回类型）。复杂的算法段落需要写清“为什么这么做”（Why），而不仅仅是“做了什么”。
4. **自动化测试边界 (Testing)**：对于 `frontend/src/core/` 目录下的核心引擎或状态处理逻辑，在提 PR 前应当补充对应的单元测试（Vitest/Jest）。纯 UI 组件如无特殊逻辑可豁免。

## Vibe Coding 协同编程规范 (Agent-Human Collaboration)

1. **防回滚快照 (Auto-Snapshot)**：在执行任何跨文件的重大重构、依赖升级或大模块删除前，智能体必须先执行 `git commit -m "chore: snapshot before refactor"` 进行本地快照备份，以便随时撤销。
2. **文档同步更新 (README Sync)**：【核心要求】每次完成大版本更新或新增重要功能后，智能体必须同步更新项目根目录的 `README.md`，保证架构文档和代码功能永远处于一致状态。
3. **自我修复循环 (Self-Healing Loop)**：当运行构建命令（如 `npm run build`）遭遇报错或遇到 TS 类型报错时，智能体应利用工具自动排查并闭环修复错误，直到终端零报错，不要中途放弃。
4. **设计令牌强约束 (Design Tokens)**：进行界面设计时，严格仅使用 Tailwind 预定义的规范类名（如 `slate`, `sky`, `emerald`），绝对禁止凭空捏造非标准的色值或随意拼接 CSS，确保 UI 的绝对统一。