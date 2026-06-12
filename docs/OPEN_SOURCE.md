# 开源组件与第三方库声明

VoiceCanvas 项目的实现离不开开源社区与各类基础服务的支持。在此对以下优秀的框架、组件和公共 API 表达诚挚的感谢：

## 前端生态 (Frontend)

* **[React](https://react.dev/) (v19)**: 驱动整个前端用户界面的核心库。
* **[Vite](https://vitejs.dev/)**: 极致速度的前端构建工具。
* **[tldraw](https://tldraw.dev/) (v5.1)**: 提供核心绘图引擎、SVG 渲染以及手绘风格矢量图支持的出色画图板组件。
* **[Tailwind CSS](https://tailwindcss.com/) (v4.3)**: 高效的实用优先 CSS 框架。
* **[Ant Design](https://ant.design/)**: 优雅的企业级 UI 设计语言。
* **[Zustand](https://zustand-demo.pmnd.rs/)**: 轻量高效的全局状态管理工具。

## 后端生态 (Backend)

* **[Go](https://golang.org/)**: 高性能服务端编程语言。
* **[Eino](https://github.com/cloudwego/eino)**: CloudWeGo 团队开源的优秀 LLM 应用开发框架，本项目深度使用了其 ReAct Agent 范式、流式解析与工具回调系统。
* **[Gorilla WebSocket](https://github.com/gorilla/websocket)**: 稳定且高性能的 WebSocket 通信库。
* **[go-openai](https://github.com/sashabaranov/go-openai)**: OpenAI API 格式的 Go 语言适配客户端。

## 大模型与公共服务 (AI & APIs)

* **[阿里云百炼 (DashScope)](https://help.aliyun.com/zh/dashscope/)**: 提供了强大的 **qwen-plus**（通义千问）模型进行意图推理与坐标计算，并使用 **wanx-v1**（通义万相）模型支持文生图功能。
* **[Wikipedia Media API](https://www.mediawiki.org/wiki/API:Main_page)**: 免费开放的维基媒体接口，为白板提供无版权图片的公共检索。
* **Web Speech API**: 现代浏览器原生的语音识别标准，保障端侧的高效 ASR 解析。

*(其他间接依赖请参考源代码中的 `package.json` 与 `go.mod` 文件。)*
