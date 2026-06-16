<div align="center">
  <h1>CloudSSH</h1>
  <p>一个基于 Cloudflare Workers 的 Serverless Web SSH 终端：通过浏览器直接连接和管理你的服务器。</p>
  <p><b>极致轻量 · 开箱即用 · 赛博朋克 UI</b></p>
  <p>
    <a href="https://github.com/newbietan/CloudSSH/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/newbietan/CloudSSH?style=flat&logo=github"></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/newbietan/CloudSSH?style=flat"></a>
    <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white">
    <img alt="React" src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black">
  </p>
  <p>
    <a href="#highlights">核心优势</a> ·
    <a href="#features">功能特性</a> ·
    <a href="#quick-start">部署指南</a> ·
    <a href="#architecture">架构设计</a> ·
    <a href="#license">开源协议</a>
  </p>
  <p>
    <a href="README.md">简体中文</a> |
    <a href="README_en.md">English</a>
  </p>
</div>

> [!TIP]
> **CloudSSH** 利用 Cloudflare Workers 的 TCP Sockets 支持，在边缘节点实现 SSH 协议的解析与转发，提供低延迟的 Web 终端体验。

## 效果演示

> 想象一下，随时随地打开浏览器，就能以极具科技感的赛博朋克 UI 连接你的服务器，无需安装任何 SSH 客户端。

![Demo 1](./demo1.png)
![Demo 2](./demo2.png)

## 目录

- [核心优势](#highlights)
- [核心特性](#features)
- [架构说明](#architecture)
- [快速部署](#quick-start)
- [开发说明](#development)
- [开源协议](#license)

<a id="highlights"></a>
## 核心优势

### 极致 Serverless

- **零服务器成本**：纯前端部署 + Cloudflare Workers，无需自建后端服务器。
- **边缘加速**：得益于 Cloudflare 的全球边缘网络，随时随地享受低延迟的 SSH 连接。

### 开箱即用

- **一键部署**：通过 Wrangler 工具，一句命令即可完成项目构建与部署。
- **现代化前端技术栈**：React + TypeScript + Vite + Tailwind CSS，配合 xterm.js 提供丝滑的终端体验。

### 安全可靠

- **端到端加密**：完整的 SSH-2.0 协议实现，包括 ECDH 密钥交换、Ed25519 签名认证以及 AES-256-GCM 数据加密。
- **安全加固体系**：内置针对 IPv6 与保留地址的 SSRF 防护、API 请求频率限制（防爆破），并在本地使用 AES-GCM 算法加密存储您的服务器凭证。
- **人机验证**：支持 Cloudflare Turnstile 验证，防止恶意机器人滥用。
- **隔离的会话状态**：借助 Cloudflare Durable Objects 和 Hibernation API，每个终端会话都在沙盒内安全、持久地运行。

<a id="features"></a>
## 核心特性

- **完整的 SSH 握手**：原生 TypeScript 实现 SSH 传输层协议与用户认证协议。
- **IPv4/IPv6 双栈**：完整支持 IPv4 和 IPv6 地址连接，包括 IPv6 方括号格式自动处理。
- **多种认证方式**：支持标准 SSH 密码认证以及基于 Ed25519 的纯文本私钥认证。
- **防范中间人攻击 (TOFU)**：首次连接自动提取服务器 Host Key（SHA-256 指纹）并显示，防止被恶意节点窃听。
- **全功能极客终端**：基于 `@xterm/xterm` 与 `@xterm/addon-webgl` 硬件加速渲染引擎，保证海量日志输出顺滑不卡顿。
- **个性化 UI**：提供 Cyberpunk、Glacier、Gruvbox 等经典终端主题一键切换，支持移动端适配。
- **原生文件传输**：集成 zmodem.js，只需在终端中执行 `rz` / `sz` 命令，即可在浏览器直接与服务器双向拖放/下载文件。

<a id="architecture"></a>
## 架构说明

```mermaid
flowchart TB
    Browser["浏览器客户端<br/>(React + xterm.js)"]
    CF["Cloudflare Edge Network"]
    DO["Durable Object<br/>(SSH 会话管理)"]
    Server["目标 SSH 服务器<br/>(如 Linux VPS)"]

    Browser <-->|"WebSocket<br/>(前端 UI 输入与终端输出)"| CF
    CF <-->|"WebSocket"<br/>路由与长连接| DO
    DO <-->|"TCP Socket<br/>@cloudflare/sockets"| Server
```

1. 用户在前端输入主机 IP、账号和密码。
2. 前端与后端的 Durable Object 建立 WebSocket 连接。
3. DO 接收凭据，使用 `@cloudflare/sockets` 与目标 SSH 服务器建立 TCP 连接。
4. DO 纯代码实现 SSH 协议协商（密钥交换、密码认证等），并将加密后的终端数据通过 WebSocket 转发给前端。

<a id="quick-start"></a>
## 快速部署

### 前置要求

- 一个 Cloudflare 账号。
- Node.js 环境 (v18+)。
- 启用 Cloudflare Workers 免费计划（TCP Sockets 和 Durable Objects 功能需要）。

### 部署步骤

#### 方式一：通过 GitHub 绑定自动部署（推荐）

1. **Fork 本仓库** 到你的 GitHub 账号。
2. **修改域名**：在进行部署前，请先将 `wrangler.toml` 中的自定义域名改成你自己的域名（要求：域名需要先在 Cloudflare 中完成注册或接入）。
3. **一键部署**：登录 Cloudflare，进入 Workers & Pages 绑定你的 GitHub 账号，选择刚才 Fork 的仓库进行应用创建。
4. **填写构建命令**：在部署设置中，请务必将“构建命令”（Build command）填写为 `npm install && npm run build:frontend`，然后点击保存并部署（无需填写构建输出目录）。

#### 方式二：本地命令行部署

1. **克隆仓库**
   ```bash
   git clone https://github.com/newbietan/CloudSSH.git
   cd CloudSSH
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **登录 Cloudflare**
   ```bash
   npx wrangler login
   ```

4. **一键部署**
   ```bash
   npm run deploy
   ```

部署完成后，Wrangler 会输出你的 Worker URL。打开浏览器访问该 URL，即可开始使用你的 Web SSH 终端。

#### 可选：配置 Turnstile 人机验证

为防止恶意机器人滥用，建议启用 Cloudflare Turnstile 验证：

1. **创建 Turnstile Widget**：登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 Turnstile 页面创建一个新的 Widget。
2. **获取密钥**：创建后会获得一个 **Site Key**（公开）和一个 **Secret Key**（保密）。
3. **配置环境变量**：
   - **方式一部署**：在 Cloudflare Dashboard 的 Workers 设置中，添加环境变量 `TURNSTILE_SECRET`，值为你的 Secret Key。
   - **方式二部署**：取消 `wrangler.toml` 中 `TURNSTILE_SECRET` 的注释，填入你的 Secret Key。
4. **更新前端代码**：在 `frontend/src/auth-form.ts` 中，将 `sitekey` 替换为你的 Site Key。
5. **重新部署**：运行部署命令使配置生效。

<a id="development"></a>
## 开发说明

本项目分为两部分：
1. **Frontend (前端)**：在 `frontend/` 目录下，使用 Vite 构建。
2. **Worker (后端)**：在 `src/` 目录下，包含 Cloudflare Worker 入口与 SSH 协议的核心实现。

在本地开发时，可以运行：
```bash
npm run dev
```
此命令将启动 Wrangler 的本地开发环境服务器。

<a id="license"></a>
## 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。

**特别声明**：本项目允许商业使用及二次修改，但必须明确注明原作者。

欢迎提交 Issue 和 Pull Request 共建社区。如果这个项目对你有帮助，恳求大家给本项目点个 ⭐ Star 支持一下，非常感谢！

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=newbietan/CloudSSH&type=Date)](https://star-history.com/#newbietan/CloudSSH&Date)

