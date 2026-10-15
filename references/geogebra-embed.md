# GeoGebra 嵌入参考

面向 AetherViz 教案 HTML 的 GeoGebra 集成细节。SKILL.md 给出决策规则和流程，本文给出**参数表、踩坑记录和可用构造配方**。

---

## 1. 运行时 API 参数（实测有效）

`new GGBApplet(params, true).inject(elementId)` 接受的关键参数：

| 参数 | 建议值 | 说明 |
|------|--------|------|
| `appName` | `"classic"` | **必须 classic**。`geometry`/`graphing` 预设忽略面板隐藏参数 |
| `width` | 宿主 `clientWidth` | **必须是像素数**，传 `"100%"` 会塌缩 |
| `height` | 宿主 `clientHeight` | 同上 |
| `showToolBar` | `false` | 隐藏工具栏 |
| `showMenuBar` | `false` | 隐藏菜单栏 |
| `showAlgebraInput` | `false` | 隐藏输入栏 |
| `enableShiftDragZoom` | `true` | 允许拖拽平移 |
| `enableRightClick` | `true` | 允许右键菜单 |
| `useBrowserForJS` | `true` | 走浏览器 JS 引擎，加载更快 |
| `ggbBase64` | base64 字符串 | 构造数据，替代 `ggbFile` |
| `appletOnLoad` | 回调 | 就绪钩子 |

### `appletOnLoad` 里唯一可靠的视角设置

```javascript
appletOnLoad: function (api) {
    try { api.setPerspective("Geometry"); } catch (e) {}
}
```

这会隐藏代数视图（Algebra View），只留下画布。失败不致命。

**无论有没有 `--view` 都必须调用它** —— `appName:"geometry"` 会强制显示代数面板，而
`setAlgebraViewVisible()` / `setShowAlgebraView()` 都不存在，所以这是唯一手段。
`scripts/ggb_embed.js` 生成的回调里把它放在最前面（有 `--view` 时它还必须更早，理由见下条）。

### 视窗控制：`setCoordSystem`（实测语义，写入 `--view` 的实现）

`api.setCoordSystem(xmin, xmax, ymin, ymax)` **存在且有效**，是网页端唯一能改视窗的手段。
三条实测结论：

1. **`api.setPerspective("Geometry")` 必须早于 `setCoordSystem`**。顺序反了（或漏掉
   perspective），x 会用**陈旧的 divisor**（`canvas 宽度 − 390`，390 是留给侧方面板的宽度，
   **即使面板被隐藏也照扣**），于是 x span 不等于请求值、`invXscale ≠ invYscale`，圆会变成椭圆。
   实测（单位圆，applet 1200×420）：先 perspective 再 setCoordSystem → `invX/invY = 1.0000` ✅；
   反序 → `0.5160` ❌。
2. **y 的 divisor 恒等于 canvas 高度**（精确）；**x 只有在 perspective 之后才等于真实宽度**。
3. **`getViewProperties(1)` 返回的是 JSON 字符串**，必须 `JSON.parse` 才能取 `xMin`/`width`/`invXscale`。
   直接当对象用会抛 `TypeError: Cannot read properties of undefined`。

**不要把 `setCoordSystem` 当成「设定坐标轴上下限」用** —— 它精确遵守传入窗口但**忽略画布长宽比**，
所以 `x[-3,3] y[-4,4]` 在宽画布里会把单位圆压成椭圆。`ggb_embed.js --view` 因此做的是
**contain-fit**：把请求框按画布比例等比**放大**（只增不减）后居中：

```javascript
api.setPerspective("Geometry");                       // 必须最先
var vp = JSON.parse(api.getViewProperties(1));
var s  = Math.max((bx1 - bx0) / vp.width, (by1 - by0) / vp.height);
var vx = s * vp.width, vy = s * vp.height;
var cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
api.setCoordSystem(cx - vx / 2, cx + vx / 2, cy - vy / 2, cy + vy / 2);
```

因为 span 只增不减，请求框内的元素**必定可见**；因为 span 由画布比例缩放，
**`invXscale === invYscale` 恒成立**（圆永远是圆）且**与容器尺寸无关**。
六条配方在 640px / 320px 两档卡片宽度下实测 **12/12 全部 CONTAINS 且 aspect=1.0000**。

**`evalCommand("ZoomIn[...]")` 不能替代** —— 实测 before/after 的 `getViewProperties(1)`
完全相同，完全不生效。

> ⚠️ **滑块必须实测**：多份参数把这条「唯一可靠方法」当成万能解，但
> **没有任何一次验收检查过 Geometry 视角下 GeoGebra 原生滑块面板是否还在**。
> 抛物线 / 三角函数 / 相似三角形这类**靠滑块驱动**的配方全押在它上面。
>
> 验收时注意：GeoGebra 把滑块**画进 Euclidian canvas**，DOM 里**没有** `.sliderPanel`
> / `.slider` 节点（实测 class 只有 `EuclidianPanel` / `DockGlassPane` /
> `dockPanelParent` / `ggbdockpanelhack`）。用 `querySelectorAll('.slider')` 判定
> 会永远得到 0，从而误判「滑块被压掉了」。
>
> 正确做法：跑一条含滑块的配方（配方 3，a/b/c），**截图目视**确认画布上出现
> `a = 1` / `b = -2` / `c_v = -1` 这样的滑块条，或在页面里检索 canvas 像素区域。
> 若 Geometry 视角确实压掉了滑块，改用 `setPerspective("Graphics")`，
> 或在侧边栏自建 `<input type="range">` 并调用 `api.evaluate("SetValue(a, 3)")`
> （`api.evaluate` 已验证存在；`showView(-1)`、`setViewRect` 一律不可用）。

---

## 2. 不存在的 API（实测抛 TypeError / undefined）

**不要**在生成的 HTML 里调用：

```javascript
api.setViewRect(x1, x2, y1, y2)      // ✗ api.setViewRect is not a function
api.setViewProperties(...)           // ✗ undefined
api.setAxesRatio(...)                // ✗ undefined
api.setWindowSize(...)               // ✗ undefined
api.setToolbarVisible(false)         // ✗
api.setAlgebraViewVisible(false)     // ✗
api.setShowAlgebraView(false)        // ✗
api.setPerspectiveGraphics(bool)     // ✗
api.setActiveView(...)               // ✗ undefined
api.zoomIn() / api.zoomOut()         // ✗ undefined
api.getXmin() / getXmax() / getYmin() / getYmax()   // ✗ undefined（改用 getViewProperties）
api.resize(w, h)                     // ✗ undefined
```

**视窗只能在网页端改，而且只有 `setCoordSystem` 一条路**（语义见第 1 节）——
`setViewRect` 之类的「视窗便利方法」一个都不存在，`ZoomIn` 命令也不生效。
生成 `.ggb` 时**不要**传 `generate.js --view`（该参数实测错位，见
`references/geogebra-recipes.md` 通用规则第 5 条），视窗统一交给 `ggb_embed.js --view`。

其他只读方法可用但价值有限：`api.getXML()` 返回字符串；`api.getAllObjectNames(bool)` 在 `useBrowserForJS:true` 下常返回空数组；`api.getValue(name)` / `api.getYcoord(name)` 对本配置返回 `NaN`。**不要依赖它们做验收判断**（`getYcoord` 返回 `NaN` 意味着「元素是否在视窗内」无法用 API 查，只能算术推导 + 截图目视），验收应看 canvas 是否渲染。

---

## 3. 尺寸与 resize 契约

GeoGebra 注入后会把自身包进**固定尺寸的 inline frame**，不会跟随容器 CSS。更麻烦的是
**它会把自己的像素宽度写回宿主的 `style` 上且从不清理**，于是宿主被钉死在旧尺寸：

- 缩小后 `clientWidth` 一直报旧的小值（实测 704px，外层 wrapper 明明有 1300px）；
- 若 ResizeObserver 监听的是**宿主**，它就看不到任何变化 → 永不重注入 → **图再也长不回来**。

因此有两条必须遵守的规则：**注入前清掉宿主的 inline 尺寸**、**观察 outer wrapper 而不是宿主**。
另外重注入代价高且**会自触发**（applet 回写宽度 → 观察器触发 → 重注入 → 再回写），
实测六图页面漂移 `1300 → 1298 → 1292 → 1284`，canvas 忽隐忽现。必须靠「记录构建尺寸」+「settle 窗口」掐断。

`scripts/ggb_embed.js` 已实现全部四条修复，可直接用；自建时照抄这套骨架：

```javascript
var currentApi = null, timer = null, watchdog = null, pending = null;
var loaded = false, rendered = null, settleTimer = null;

var RESIZE_DEBOUNCE_MS = 220, RESIZE_SETTLE_MS = 600;
var LOAD_TIMEOUT_MS = 8000, LOAD_HARD_TIMEOUT_MS = 45000;

function destroy() {
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  if (currentApi) {
    // 关键：不销毁旧实例，每次 resize 都会累积 applet/canvas/定时器
    try { if (typeof currentApi.remove === "function") currentApi.remove(); } catch (e) {}
    currentApi = null;
  }
  pending = null;
}

function boot() {
  host.style.width = "";                // ← 让宿主回到 CSS 宽度，否则永远量到旧尺寸
  host.style.height = "";
  var w = host.clientWidth || 640;
  var h = host.clientHeight || 420;
  if (w < 40) w = 640;                 // 布局未就绪 / 侧栏折叠时的兜底
  if (h < 40) h = 420;
  var size = w + "x" + h;
  if (size === rendered) return;        // ← 掐断 applet 回写宽度造成的自触发循环
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  if (pending === size) return;         // 同尺寸注入已在途，不重复发起
  pending = size;

  destroy();                            // 必须在清 innerHTML 之前
  loaded = false;
  host.innerHTML = "";                  // 清掉旧 frame
  try {
    new GGBApplet({ /* ... width: w, height: h ... */ }, true).inject(hostId);
  } catch (e) { pending = null; rendered = null; showFallback("动态图初始化失败"); return; }
  // inject() 只是"发起"异步加载，try/catch 看不到 base64 损坏或 CDN 被拦
  watchdog = setTimeout(function () {
    if (loaded) return;
    console.warn("[ggb] 仍未加载完成（" + LOAD_TIMEOUT_MS / 1000 + "s）");
    watchdog = setTimeout(function () {          // ← 只警告，不销毁
      if (!loaded) { pending = null; rendered = null; destroy(); showFallback("动态图加载超时，请检查网络连接后刷新页面"); }
    }, LOAD_HARD_TIMEOUT_MS);
  }, LOAD_TIMEOUT_MS);
  rendered = size;                               // 记录"构建时的尺寸"，不是 applet 产出的尺寸
  settleTimer = setTimeout(function () { settleTimer = null; }, RESIZE_SETTLE_MS);
}

function onResize() {
  if (settleTimer) return;                       // 重建期间观察器会看到瞬时空态，忽略它
  if (timer) clearTimeout(timer);
  timer = setTimeout(boot, RESIZE_DEBOUNCE_MS);
}
var roTarget = host.parentNode || host;          // ← 观察 wrapper，不是宿主
if (typeof ResizeObserver === "function") new ResizeObserver(onResize).observe(roTarget);
else window.addEventListener("resize", onResize);

boot();
```

> ⚠️ **看门狗不能销毁仍在加载的 applet**。六图页面实测首个 canvas 要 6–9s（GWT 模块串行加载），
> 早期版本 8s 到点就 `destroy()` + 显示「动态图加载失败」，把**即将渲染成功**的图打成了失败态。
> 正确行为：8s 只 `console.warn`，放弃推迟到 45s，期间 applet 照常加载、绝不动它。

**验收信号**（Playwright 探测）：
- `stage.querySelector('canvas')` 存在（`stage` 是 `.ggb-stage`，即 `#<id>`）
- canvas 像素尺寸接近容器尺寸（实测 898×418 对 900px 容器）
- `stage.querySelector('.algebraPanel')` 为 `null`
- `document.querySelectorAll('.sliderPanel, .slider').length > 0` —— **不要用这条**，
  滑块是画在 canvas 上的，DOM 里查不到；改用截图目视（见第 1 节末的提醒）
- `.ggb-fallback` 未出现
- 缩小再放大一轮后 canvas 仍 ≈ 容器尺寸（`@1360 → 1298x418 / @760 → 705x415 / 回 1360 → 1298x418`）
- 反复改变容器宽度 3 次后，`document.querySelectorAll('canvas').length === 1`（验证旧 applet 确实被销毁）

---

## 4. 单文件约束

`.ggb` 是 ZIP 容器，直接引用会多出一个附件文件。AetherViz 要求单文件教案，所以：

```
.ggb (ZIP) → base64 → 内联进 <script> 的字符串字面量
```

体积代价：base64 约为原文件的 **1.34 倍**。实测：

| 构造 | .ggb | base64 | 教案增重 |
|------|------|--------|----------|
| 三角形 + 外接圆 | 4.7 KB | 6.2 KB | +1.4 KB |
| 中等复杂度几何（10+ 对象） | ~15 KB | ~20 KB | +5 KB |

几何构造通常很轻，单文件完全可行。**不要**把带大量自定义数据的 `.ggb` 内联。

---

## 5. 依赖与降级

```html
<script src="https://www.geogebra.org/apps/deployggb.js"></script>
```

这是唯一必需的外部依赖（Three.js/KaTeX/Tailwind 本来也是 CDN）。若该脚本加载失败，`GGBApplet` 未定义，片段会渲染 `.ggb-fallback` 提示：

> 动态图加载失败，请检查网络连接

**这意味着教案不是真正的"离线零依赖"**。如果某节课必须完全离线（如内网机房），应改用 `geogebra-geometry` 生成静态 PNG 内联，放弃交互性 —— 两者不可兼得。

---

## 6. 参数速查：`scripts/ggb_embed.js`

```bash
node scripts/ggb_embed.js --in fig.ggb --id ggbFig --height 420 --view -1.8,1.8,-1.8,1.8
```

| Flag | 默认 | 说明 |
|------|------|------|
| `--in` / `-i` | *必填* | 输入 `.ggb`（指向目录会报错退出） |
| `--out` / `-o` | 无 | 写入文件；不给则打到 stdout，CSS 始终打到 stderr |
| `--id` | `ggb` | DOM id；非法字符会被剔除，**若发生了剔除则自动追加原值哈希**，保证同页多图不撞 id（`a-b` → `ab_bswm0`） |
| `--height` | `420` | 图框 CSS 高度（px），只接受 `80`–`2000` 的整数；宽度跟随容器 |
| `--view` | 无 | **`x0,x1,y0,y1` 世界坐标内容框，语义是 contain-fit（不是坐标轴上下限）**。框内元素保证可见、圆不变形、与容器尺寸无关。负数值可直接写（`-1.8,1.8,-1.8,1.8` 会被正确接受）。不给时交给 GeoGebra 自动取景 |
| `--app` | `classic` | applet 类型；**不要改** |
| `--caption` | 无 | 图下方说明文字（HTML 转义，不会注入） |
| `--json` | `false` | 输出 JSON：`{ok, input, id, height, view, app, ggbBytes, base64Bytes, deployJs, snippet, css}` |

退出码：`0` 成功；`1` 输入文件问题；`2` 参数用法错误（含 `--view` 格式错误）。

**`--view` 的校验行为**：必须 4 个逗号分隔的数字，且 `x1 > x0`、`y1 > y0`，否则 exit 2 并给出具体原因。

**该给多大的框**：按「图形最外沿」给一个刚好包住教学要点的框。**框给紧了图才大** ——
contain-fit 会把框按画布比例放大，框的 y 跨度越大，放大后 x 也越宽，图形反而缩小。
反面例子：r5 用 `-3.2,3.2,-7.5,7.5` 会撑到 `x[±11.45]`，三次曲线缩成中间一小段；
改成 `-2.4,2.4,-2.4,2.4` 后曲线铺满画面。**另外：曲线上的可拖动点要求视窗包住整条曲线的值域**，
否则学生把点拖到越界处它就消失了（见 `references/geogebra-recipes.md` 配方 5）。

典型用法：

```bash
# 取片段（正文粘贴）；CSS 走 stderr，管道不受污染
node scripts/ggb_embed.js --in fig.ggb --id ggbFig > embed_snippet.html

# 取配套 CSS（head 粘贴）—— 用 2>/dev/null 丢掉提示信息
node scripts/ggb_embed.js --in fig.ggb --json 2>/dev/null \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).css))"

# 写文件并同时拿到 CSS
node scripts/ggb_embed.js --in fig.ggb --out snip.html
```

---

## 7. 常见故障速查

| 现象 | 根因 | 修复 |
|------|------|------|
| canvas 只有几十像素高（如 165×30） | `width`/`height` 传了百分比或 `0` | 传宿主 `clientWidth/clientHeight` 像素值 |
| 左侧出现代数视图列表 | `appName` 用了 `geometry`/`graphing`，或没调 `setPerspective` | 改 `classic` + 在 `appletOnLoad` 里调 `setPerspective("Geometry")` |
| 白屏无内容 | `deployggb.js` 未引入或在业务脚本之后 | 移到 `<head>` 最前 |
| 窗口 resize 后图不变形 | GeoGebra frame 固定尺寸 | 监听 resize，重新 `inject()` |
| **缩下去就再也放不大** | GeoGebra 把像素宽度写回宿主 inline style，观察宿主的 ResizeObserver 看不到变化 | `boot()` 开头清 `host.style.width/height`；观察 `host.parentNode` |
| **多图页面 canvas 逐渐消失 / 宿主宽度缓慢漂移** | applet 回写宽度 → 观察器触发 → 重注入 → 再回写 | 记录 `rendered` 尺寸并 `if (size === rendered) return`；注入后 600ms settle 窗口内忽略观察器 |
| 容器折叠时图消失 | `clientWidth` 为 0 | 加 `if (w < 40) w = 640` 兜底 |
| 反复 resize 后越来越卡 / canvas 越来越多 | 旧 applet 没销毁 | 重新注入前先 `currentApi.remove()` |
| **多图页面部分图显示「加载失败」但其实马上就好了** | 看门狗 8s 到点就 destroy 了仍在加载的 applet（GWT 模块串行加载，首个 canvas 要 6–9s） | 8s 只 `console.warn`，放弃推迟到 45s，期间不销毁 applet |
| 图一直是空白、`.ggb-fallback` 也没出现 | `inject()` 只发起异步加载，错误发生在 try/catch 之外 | 用看门狗等 `appletOnLoad`，超时才降级 |
| **负半轴的点/切线/曲线下半支被下边缘切掉** | 没给 `--view`，默认 420px 高度可见 y 只有约 `[-0.8, 7.4]` | 加 `ggb_embed.js --view` 给内容框（contain-fit，语义见第 1 节） |
| **圆显示成椭圆** | 直接调 `setCoordSystem` 而没先 `setPerspective`（x 用陈旧 divisor `画布宽 − 390`） | `setPerspective("Geometry")` 必须早于 `setCoordSystem`；或直接用 `ggb_embed.js --view` 的 contain-fit |
| **`getViewProperties` 结果取不到字段** | 它返回 JSON **字符串** | `JSON.parse(api.getViewProperties(1))` |
| 同页两张图，第二张不显示 | 两个 `--id` 过滤后变成同一个 | 用不同 id；生成器会自动加哈希后缀规避 |
| 中文 caption 乱码 | 生成 HTML 时编码丢失 | 片段文件按 UTF-8 读写（Node `fs.writeFileSync(p, s, 'utf8')`）；**不要**用 PowerShell `Set-Content` 拼装中文 HTML |

> 最后一条是本项目实测踩到的：用 PowerShell 拼装含中文的 HTML 会把 caption 变成乱码。生成教案请用 Node 或直接编辑文件，不要用 PowerShell 字符串插值。

---

## 8. 验收测试台要点

用 Playwright 做自动验收时，以下契约实测有效（踩过坑，照抄）：

- **片段 DOM 结构**：`div.ggb-embed#<id>-wrap` → `div.ggb-stage#<id>` → `canvas`；
  caption 是 `.ggb-caption`，失败态是 `.ggb-fallback`，代数面板是 `.algebraPanel`。
- **拿 `api` 的方式**：片段在 `appletOnLoad` 里派发
  `host.dispatchEvent(new CustomEvent("ggb:ready", {detail:{id, api}}))`（`bubbles:true`）。
  测试页必须在**捕获阶段**监听，否则可能错过：
  ```javascript
  window.__api = null;
  document.addEventListener('ggb:ready', function (e) { window.__api = e.detail.api; }, true);
  ```
- **必须用 `file://` 加载**（`page.goto`），**不要用 `page.setContent`**：后者在 `about:blank`
  源上会抛 `SecurityError: Failed to read the 'cookie' property from 'Document'`，
  并**打断多 applet 初始化**（此前自建六图测试台只有第一张加载成功就是因此，
  另一原因是脚本在 HTML parse 阶段就调 `inject()`，而真管线等 `DOMContentLoaded`）。
- **等待**：`page.waitForFunction(() => window.__api !== null, null, {timeout: 90000})`。
- **`getViewProperties(1)` 返回 JSON 字符串**，必须 `JSON.parse`。
- **不要用 `getValue` / `getYcoord` 断言元素可见性** —— 都返回 `NaN`。
  「是否在视窗内」只能由 `xMin/yMin/width/invXscale` 反算窗口后**算术推导**，再截图目视确认。