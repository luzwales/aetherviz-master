# AetherViz Master

<p align="center">
  <img src="https://img.shields.io/badge/version-5.1-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Three.js-r134-orange.svg" alt="Three.js">
  <img src="https://img.shields.io/badge/Tailwind-v3.4+-cyan.svg" alt="Tailwind">
  <img src="https://img.shields.io/badge/GeoGebra-Embedded-brightgreen.svg" alt="GeoGebra">
  <img src="https://img.shields.io/badge/SVG-Enabled-purple.svg" alt="SVG">
  <img src="https://img.shields.io/badge/AI-Powered-red.svg" alt="AI Powered">
</p>

<p align="center">
  <img width="800" alt="AetherViz Master Demo" src="https://github.com/user-attachments/assets/763cc0d4-3dc3-4b0b-8109-016e89d51ff2" />
</p>

<p align="center">
  <strong>互动教育可视化建筑师</strong><br>
  把任意教学主题瞬间转化为沉浸式3D交互教学网页
</p>

---

## 📖 项目简介

AetherViz Master 是一个基于 AI 的互动教育可视化工具，专注于将抽象的教学概念转化为生动、直观的交互式网页。无论你是教师、学生还是教育内容创作者，只需输入一个主题，它就能为你生成一个完整的、可交互的教学页面。

### 核心能力

- **一键生成**：输入主题 → 自动生成交互网页
- **智能适配**：自动识别学科领域，匹配最佳配色和可视化方案
- **零门槛使用**：无需编程基础，生成的 HTML 直接可用
- **专业品质**：Three.js + SVG + GeoGebra 三引擎，60fps 流畅体验

---

## ✨ 核心特性

### 1. 3D 可视化引擎
- 基于 Three.js r134 的专业级 3D 场景
- 支持物理模拟、粒子系统、矢量箭头
- 内置 OrbitControls，支持鼠标拖拽旋转、滚轮缩放
- 触控设备支持：触摸旋转、双指缩放

### 2. SVG 增强渲染
- 可在 3D 场景上叠加 SVG 2D 图表
- 函数图像、坐标系、流程图
- D3.js 数据驱动图表（可选）
- 3D-2D 坐标实时同步

### 3. GeoGebra 动态几何图 🆕
- 数学几何/函数主题自动路由到 GeoGebra
- **真交互**：学生可拖动顶点、滑动参数，图形实时联动
- `.ggb` 以 base64 内联，教案仍是**单个 HTML 文件**
- **视窗用 contain-fit 控制**（`ggb_embed.js --view`）：框内元素保证可见、圆不变椭圆、随容器自适应
- 内置 6 条中小学教案构造配方（勾股定理、三角形外心与重心、抛物线、单位圆、切线导数、相似三角形）
- 附带 `scripts/ggb_embed.js` 命令行工具，可脱离 AI 单独把 `.ggb` 转成嵌入片段

> 「勾股定理」「三角形的外心与内心」「抛物线的平移」这类主题，
> 图形价值在于**拖一拖看变化**——手工用 Three.js 模拟几何约束既慢又不可靠，
> 所以直接用 GeoGebra（几何动态图的事实标准）。

### 4. 智能自动识别

| 识别维度 | 说明 |
|----------|------|
| **学科识别** | 物理/化学/生物/数学/天文/编程，自动切换配色主题 |
| **渲染方案** | 根据关键词自动选择 Three.js / SVG / GeoGebra / 混合模式 |
| **语言适配** | 自动检测中文/英文，输出对应语言 |

### 5. 现代化 UI 设计
- 玻璃拟态（Glassmorphism）风格
- 赛博教育风 + 霓虹强调色
- 响应式布局，适配桌面/平板/手机
- 侧边栏 + 控制面板 + HUD 数据展示

### 6. 完整教学功能
- 学习目标（可勾选追踪）
- KaTeX 数学公式实时渲染
- 原理讲解（生动比喻，高中-大学水平）
- 可折叠小测验面板
- 播放/暂停/单步/速度控制

---

## 🚀 快速开始

### 环境要求

- 现代浏览器（Chrome/Edge/Firefox/Safari）
- 支持 WebGL
- Node.js（仅在使用 `scripts/ggb_embed.js` 与生成 `.ggb` 时需要）

> GeoGebra 模式需要**联网**加载 CDN 资源。内网机房场景请改用 `geogebra-geometry` 技能出静态 PNG 插图。

### 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/luzwales/aetherviz-master.git
cd aetherviz-master

# 2. 启动本地服务器（任选一种）
python -m http.server 8080
# 或
npx serve .
# 或
php -S localhost:8080

# 3. 访问 http://localhost:8080
```

### 通过 Claude Code 使用

```bash
# 1. 启动 Claude Code
claude

# 2. 输入主题
/aetherviz-master
# 或直接输入：
牛顿第二定律
# 或：
匀速运动
# 或：
光合作用
```

系统将自动生成完整的 HTML 文件。

### 命令行工具：`ggb_embed.js` 🆕

数学主题会用到 `scripts/ggb_embed.js`。它把 `.ggb` 转成可直接粘进教案的 `<div> + <script>` 片段，
`.ggb` 以 base64 内联，所以**教案仍然是单个 HTML 文件**，不需要附带 `.ggb`。

```bash
node scripts/ggb_embed.js --in fig.ggb --id ggbFig --height 420 \
  --view -0.8,5.8,-0.8,3.8 --caption "三角形与外接圆"
```

| 参数 | 说明 |
|------|------|
| `--in <file.ggb>` | 必填，输入的 .ggb 文件 |
| `--out <file>` | 把片段写入文件；css 仍打印到 stderr |
| `--id <name>` | 宿主 div 的 id，默认 `ggb` |
| `--height <80..2000>` | 图形 CSS 高度（像素），默认 `420` |
| `--view x0,x1,y0,y1` | **必须可见的世界坐标内容框**，语义是 **contain-fit**（不是坐标轴上下限）。框内元素保证可见、圆不变椭圆、随容器尺寸自适应。负数值可直接写 |
| `--caption <text>` | 图下方的说明文字 |
| `--app <name>` | GeoGebra `appName`，默认 `classic`（**不要改成 `geometry`**，它会强制显示代数面板） |
| `--json` | 输出 `{ok, input, id, height, view, app, ggbBytes, base64Bytes, deployJs, snippet, css}` |

退出码：`0` 成功 / `1` 输入文件问题 / `2` 参数用法错误。

> ⚠️ **不要给 `geogebra-file-generator` 的 `generate.js` 传 `--view`** —— 该参数实测会错位到
> 看不见原点（它用 1200×800 计算缩放，却把 applet 实测尺寸写进文件，两者不同源）。
> 视窗控制统一放在 `ggb_embed.js --view` 这一步。

---

## 📚 支持的主题领域

### 物理
- 牛顿第二定律
- 匀速运动 / 匀变速运动
- 电磁感应
- 相对论时间膨胀
- 量子隧穿效应

### 化学
- 光合作用
- 酸碱中和
- 氧化还原反应
- 分子结构

### 生物
- DNA复制
- 细胞呼吸
- 有丝分裂
- 遗传规律

### 数学
- 勾股定理
- 三角函数
- 正弦函数图像
- 概率分布
- 三角形的外心与重心
- 抛物线的平移与伸缩
- 相似三角形

### 天文
- 行星运动定律
- 宇宙膨胀
- 黑洞
- 日食月食

### 编程
- 算法复杂度
- 数据结构
- 排序算法
- 设计模式

---

## 🛠 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Three.js | 3D 渲染引擎 | r134 |
| GeoGebra | 动态几何/函数交互图（数学主题） | deployggb.js CDN |
| Tailwind CSS | UI 样式框架 | v3.4+ |
| KaTeX | 数学公式渲染 | 0.16.11 |
| D3.js | 数据可视化（可选） | v7 |
| OrbitControls | 3D 场景控制 | 内联简化版 |

### 渲染模式说明

```
┌─────────────────────────────────────────────────────────────┐
│                    主题输入分析                               │
├─────────────────────────────────────────────────────────────┤
│  关键词检测（GeoGebra 优先级最高）                             │
│  ├── 几何/函数/变换/轨迹/作图 → GeoGebra 动态交互图 🆕         │
│  ├── 运动/粒子/分子/机械/天体 → 纯 Three.js 3D               │
│  ├── 柱状图/饼图/折线图       → SVG 2D 图表                  │
│  └── 牛顿/波动/能量/电磁      → Three.js + SVG 混合模式      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
aetherviz-master/
├── README.md                       # 项目说明文档
├── LICENSE                         # MIT 许可证
├── SKILL.md                        # Claude Skill 定义文件
├── scripts/
│   └── ggb_embed.js                # .ggb → 可嵌入单文件 HTML 的片段生成器
└── references/
    ├── geogebra-embed.md           # GeoGebra 嵌入 API、踩坑记录、参数速查
    └── geogebra-recipes.md         # 6 条中小学动态几何构造配方
```

---

## 💡 使用示例

### 示例 1：匀速运动

输入主题后，系统自动：
1. 识别为「物理」学科 → 蓝色渐变主题
2. 检测「运动」关键词 → Three.js 纯 3D 模式
3. 生成：小球运动模拟 + 速度滑块 + 位移轨迹

### 示例 2：三角函数 🆕

输入主题后，系统自动：
1. 识别为「数学」学科 → 金黄渐变主题
2. 命中 `ggbKeywords`（含「函数」）→ **GeoGebra 模式**（优先级高于 SVG）
3. 生成：单位圆动态图 —— 学生拖动 θ 滑块，直观看到 sin/cos 投影线段的变化

### 示例 3：三角形的外心与重心 🆕

输入主题后，系统自动：
1. 检测「几何/外心」关键词 → **GeoGebra 模式**
2. 生成：可拖动顶点的三角形，外心 O 与重心 G 实时重算
3. 侧边栏给出交互指引：「拖动顶点，观察两个心如何重新定位」

### 示例 4：波动与振动

输入主题后，系统自动：
1. 识别为「物理」学科
2. 检测「波动」关键词 → 混合模式
3. 生成：3D 弹簧振子 + SVG 波形图叠加

---

## 🤝 贡献指南

欢迎贡献代码、提交问题或提供建议！

```bash
# 1. Fork 本仓库
# 2. 创建特性分支
git checkout -b feature/your-feature

# 3. 提交更改
git commit -m 'Add amazing feature'

# 4. 推送分支
git push origin feature/your-feature

# 5. 打开 Pull Request
```

### 贡献者

<a href="https://github.com/luzwales/aetherviz-master/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=luzwales/aetherviz-master" />
</a>

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🔗 相关链接

- [Three.js 官方文档](https://threejs.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/)
- [KaTeX 数学公式](https://katex.org/)
- [D3.js 数据可视化](https://d3js.org/)
- [GeoGebra](https://www.geogebra.org/)

---

## 📝 更新日志

### v5.1 (2026-10-15)
- ✅ 新增 GeoGebra 动态几何图引擎（数学主题最高优先级路由）
- ✅ 新增 `scripts/ggb_embed.js`：`.ggb` → base64 内联的单文件教案片段生成器
- ✅ 新增 `--view x0,x1,y0,y1`（**contain-fit 语义**）：给一个必须可见的世界坐标内容框，
  框内元素保证可见、圆不变椭圆、随容器尺寸自适应 —— 修掉「默认高度下负半轴元素被切掉」的真实缺陷
- ✅ 新增 `references/geogebra-embed.md`：嵌入 API 实测契约与踩坑记录
- ✅ 新增 `references/geogebra-recipes.md`：6 条中小学动态几何构造配方（全部已实测通过）
- ✅ 明确 GeoGebra 模式的网络依赖边界（内网场景改走 geogebra-geometry 出静态 PNG）
- ✅ 修掉 4 个真实缺陷：多图页面自触发重注入循环、看门狗误杀加载中的图、
  缩小后无法恢复、`--view` 负数值被参数解析拒收
- ✅ **文档驱动验收全通过**：用配方文档里写的命令本身生成 6 张图，真实浏览器加载后
  逐条核对 —— `canvas=638x418`、代数面板不出现、无 fallback、内容框 `CONTAINS`、等轴比 `1.0000`；
  640px 与 320px 两档容器共 12 例全部通过

### v5.0 (2026-02-22)
- ✅ 新增 SVG + Three.js 混合渲染
- ✅ 新增渲染方案自动识别
- ✅ 新增 D3.js 支持
- ✅ 优化坐标同步机制

### v4.0 (2026-02-22)
- ✅ 优化面板布局
- ✅ 小测验面板可折叠
- ✅ 新增右下角悬浮按钮

---

<p align="center">
  用 ❤️ 打造 | 每一个知识都值得被可视化<br>
  由 AetherViz Master 为你生成 ❤️
</p>
