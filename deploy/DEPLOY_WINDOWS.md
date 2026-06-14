# Windows 部署文档 (VoiceCanvas)

本文档旨在指导您在 Windows 操作系统（如 Windows 10 / 11 或 Server 系列）下完成 VoiceCanvas 的环境搭建与部署。

---

## 方案一：Docker 自动化部署（推荐）

借助 Docker Desktop，您可以在 Windows 系统中快速拉起高度一致的隔离环境，免去配置环境变量与安装各种底层工具的烦恼。

### 1. 准备工作

请前往官网下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，并在设置中开启 WSL2 引擎。启动 Docker Desktop 后，确保它正在后台正常运行。

### 2. 配置环境变量

在使用一键部署前，请先进入 `backend` 目录，将 `.env.example` 文件复制一份并重命名为 `.env`，然后在其中填入您的 API 密钥：

- 打开 `backend/.env` 文件
- 找到 `DASHSCOPE_API_KEY=your_dashscope_api_key_here` 并替换为您真实的密钥。

### 3. 执行一键部署脚本

进入项目的 `deploy` 目录，直接**双击运行 `deploy.bat` 文件**。
在弹出的黑色命令行窗口中，输入 `1` 并按回车。脚本会自动检测 Docker 状态，并执行 `docker-compose up -d --build` 进行编译打包及拉起前后端服务。

### 4. 验证服务

启动完成后，直接打开浏览器并访问：`http://localhost` 即可开始使用。

---

## 方案二：手动编译与部署

适用于需要在本地开发调试，或者部分受限 Windows 机器上无法运行 Docker 虚拟化的场景。

### 1. 前置依赖准备

- 下载并安装 [Go 语言环境 (Windows 版)](https://go.dev/dl/)。
- 下载并安装 [Node.js (Windows 版)](https://nodejs.org/)。

### 2. 自动编译构建

进入 `deploy` 目录，**双击运行 `deploy.bat` 文件**，并选择选项 `2`（Deploy Manually）。
脚本会自动为您执行以下工作：

- 检查您的 Node.js 和 Go 环境配置。
- 自动进入 `backend` 目录编译出原生的 `voice-canvas-backend.exe` 执行文件。
- 自动进入 `frontend` 目录下载 npm 依赖，并打包前端静态代码。

### 3. 手动启动后端服务端

请打开一个新的 PowerShell 窗口（或 CMD），进入到 `backend` 目录：

```powershell
cd backend
# 确保已复制 .env.example 为 .env 并填入密钥
# 启动后端程序，开始监听 8080 端口的 WebSocket
.\voice-canvas-backend.exe
```

### 4. 前端测试与生产部署

**（本地调试）** 如果只是希望在本地快速测试运行效果，直接打开新的终端进入前端目录执行开发服务器：

```powershell
cd frontend
npm run dev
```

**（生产服务器）** 如果需要将应用部署在 Windows Server 生产环境对外提供服务，推荐配置 **IIS (Internet Information Services)** 或 **Nginx for Windows**，并将站点的物理路径指向刚刚编译好的 `frontend/dist` 文件夹，并确保在路由配置中设置了 URL Rewrite (重写) 将 404 请求转发至 `index.html`。
> **注意**：您还需要配置反向代理，将 `/ws` 和 `/api` 路径转发至后端的 `127.0.0.1:8080`，否则前端无法连接到后端服务。
