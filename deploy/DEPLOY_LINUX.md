# Linux 部署文档 (VoiceCanvas)

本文档旨在指导您在 Linux 环境（如 Ubuntu、CentOS、Debian 等）下完成 VoiceCanvas 的快速部署。

---

## 方案一：Docker 自动化部署（推荐）

这是最简单、最不易出错的部署方式，能够将前后端运行环境隔离并一键拉起。

### 1. 准备工作

确保您的服务器已经安装了 [Docker](https://docs.docker.com/engine/install/) 以及 [Docker Compose](https://docs.docker.com/compose/install/)。

### 2. 配置环境变量

项目中的智能体需要调用大语言模型 API。在开始部署前，请先进入 `backend` 目录，复制 `.env.example` 为 `.env` 并填入密钥：

```bash
cd backend
cp .env.example .env
nano .env # 填入您的 DASHSCOPE_API_KEY
cd ..
```

### 3. 运行一键部署脚本

进入项目根目录的 `deploy` 文件夹，执行交互式部署脚本：

```bash
cd deploy
bash deploy.sh
```

在弹出的终端菜单中，输入 `1`（Deploy using Docker）。脚本会自动执行构建镜像、映射端口以及启动后台容器的完整流程。

### 4. 验证服务

部署完成后，直接在浏览器中访问 `http://<您的服务器IP>` 即可打开画板，后端 WebSocket 将自动监听本地。

---

## 方案二：手动编译部署

适用于对服务器环境有强定制需求，或无法使用 Docker 的场景。

### 1. 前置依赖检查

- **Go 环境** (v1.21+)：用于编译后端服务。
- **Node.js** (v18+) 与 **npm**：用于编译前端资源。

### 2. 自动编译构建

进入 `deploy` 目录并运行脚本：

```bash
cd deploy
bash deploy.sh
```

选择 `2`（Deploy Manually）。脚本将自动为您：

- 在 `backend` 下执行 `go build -o voice-canvas-backend main.go`。
- 在 `frontend` 下执行 `npm install` 与 `npm run build`。

### 3. 运行后端服务

构建完成后，建议使用 `nohup` 或编写 `systemd` 服务脚本让后端常驻后台运行：

```bash
cd backend
# 确保已经配置好 .env 文件
nohup ./voice-canvas-backend > backend.log 2>&1 &
```

### 4. 部署前端静态文件 (Nginx)

执行构建后，在 `frontend/dist` 目录会生成所有静态页面。请安装并配置 Nginx 作为 Web 服务器：

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    # 指向您的前端构建产物目录
    root /path/to/VoiceCanvas/frontend/dist;
    index index.html;

    # 关键配置：防止 SPA 单页应用刷新报 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 代理 WebSocket 与 API 请求至后端服务
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

配置完成后，重启 Nginx 即可正常访问。
