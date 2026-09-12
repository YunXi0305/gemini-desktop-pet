# ✦ Gemini 哈基米桌宠 (Gemini Desktop Pet)

> **专为 Google Gemini 与 Antigravity 打造的超轻量、纯净透明桌面看板娘 & 伴侣**  
> 100% 独立绿色运行 · 零侵入代码检测 · 真实配额同步 · 键盘连击伴舞 · 极致解压果冻触感

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-0078d7.svg)](https://github.com/)
[![Runtime](https://img.shields.io/badge/Runtime-Electron%20Portable-47848f.svg)](https://www.electronjs.org/)
[![Status](https://img.shields.io/badge/Zero--Intrusion-100%25-brightgreen.svg)](https://github.com/)

---

## ✨ 核心特性

- 🐾 **100% 独立绿色运行**：
  无需安装任何运行环境，解压即可运行。支持随 U 盘携带，零注册表残留，数据完全隔离于本地应用目录。

- ⚡ **零侵入自主感知 (Zero-Intrusion)**：
  **不修改**任何反重力（Antigravity）或官方程序文件！桌宠自带后台心跳探针，自动侦测反重力开发工具状态：
  - **未开启反重力**：作为纯粹元气的桌面萌宠陪伴摸鱼；
  - **反重力开启**：自动感知并连线变身专属 AI 助手，头顶气泡实时提醒；
  - **反重力关闭**：自动感知并平滑回退为待机伴侣模式。

- 📊 **真实 Gemini 5h & 每周额度透视**：
  实时拉取官方本地引擎额度，精确掌握 Gemini 5 小时速率限制与每周总额度剩余百分比及刷新倒计时。

- ⌨️ **沉浸式结对编程伴侣 (Typing Combo)**：
  小巧原生的全局按键捕获，敲击键盘时小人会随你的打字节奏轻快起舞！键盘连击达 15+ Combo 还会触发爆击火花与程序员元气语音气泡。

- 🍮 **解压级物理按压与果冻 Q 弹**：
  - 鼠标左键按下：以足底为支点受力挤压扁平，伴随小黄鸭捏捏音效；
  - 鼠标松开：多段阻尼果冻回弹震荡，萌态十足。

- 🎈 **真实窗口穿透与边缘吸附**：
  人物透明区域支持鼠标完全穿透，不遮挡任何工作区；任意拖拽并在松手后具备抛掷物理重力下落。

- 🎨 **自适应亚克力毛玻璃设置面板**：
  右键点击人物随时呼出设置菜单。以人物身体实际像素为基准智能避障，绝不遮挡角色。支持 0.6x ~ 2.5x 无级缩放、音效包切换、音量调节等。

- 🪟 **原生系统托盘常驻**：
  右下角任务栏托盘常驻，支持双击显示、一键打开设置与安全退出。

---

## 🚀 快速使用

### 方式一：下载即用（绿色免安装版，推荐）

1. 前往 GitHub [Releases](../../releases) 页面下载最新版：  
   `GeminiPet-v1.0.0-win-x64.zip`
2. 解压到电脑任意目录（如 `D:\Tools\GeminiPet\`）；
3. 双击运行 **`GeminiPet.exe`** 即可立即唤醒哈基米！

> 提示：如果电脑上开启了 Antigravity，桌宠会自动接入并同步您的 Gemini 配额！

---

### 方式二：开发者源码运行与二次开发

如果你想二次修改贴图、动作或新增逻辑：

```bash
# 1. 克隆本仓库
git clone https://github.com/your-username/gemini-pet.git
cd gemini-pet

# 2. 安装依赖
npm install

# 3. 本地启动运行
npm start

# 4. 自动化打包绿色发布版 (生成免安装可执行程序与 ZIP 包)
npm run pack
```

---

## 🎮 操作指南

| 操作动作 | 触发效果 |
| :--- | :--- |
| **鼠标左键单击** | 捏捏角色（触发果冻压扁音效与 Gemini 配额 / 逗趣对话气泡） |
| **鼠标左键按住拖拽** | 拎起后颈肉（小人悬空摇晃，松手后自由落体） |
| **鼠标右键单击** | 呼出亚克力自适应设置面板（调节尺寸、音效、工况等） |
| **敲击任意键盘按键** | 触发打字伴舞与敲击 Combo 计数 |
| **任务栏托盘图标** | 托盘右键菜单可随时重新显示、打开设置或安全退出 |

---

## 📁 目录结构说明

```text
gemini-pet/
├── main.js             # Electron 独立绿色版主进程 (自主探针、IPC调度、托盘、单实例锁)
├── pet.html            # 桌宠透明主视窗 HTML
├── gemini-pet.js       # 桌宠前端核心引擎 (74KB，骨骼姿态、物理引擎、穿透算法)
├── settings.html       # 独立毛玻璃右键设置面板
├── key_watcher.exe     # 4KB 超轻量全局按键监听辅助进程
├── app.ico             # 应用程序与托盘高清图标
├── assets/             # 精修无白边透明立绘素材与音效
│   ├── idle.png        # 端庄温柔站立形态
│   ├── chill.png       # 惬意品茗工况
│   ├── happy.png       # 开心扑腾萌爪
│   ├── dragged.png     # 悬空挣扎形态
│   ├── typing.png      # 敲键盘打字形态
│   └── fall.png        # 摔倒萌态
├── pack_release.js     # 自动化绿色免安装发布打包脚本
├── package.json        # 模块元数据与构建脚本
├── LICENSE             # MIT 开源许可证
└── README.md           # 本说明文档
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。立绘与音效素材版权归原作者所有，仅供个人学习与开源陪伴使用。
