# AetherViz GeoGebra 构造配方

面向中小学教案的**动态交互图**构造配方。每条配方给出：构造命令、推荐视窗、教学交互点。

命令语法参考 `geogebra-file-generator` 技能的 `references/commands.md`；本文只给经过教学场景挑选的成品配方。

---

## 通用规则

1. **变量名避开 `a` `b` `c`** —— `Polygon(A,B,C)` 会自动占用这三个名字（三个边）。
2. **自由点用大写单字母**（`A` `B` `C` `P`），从属对象用带下标的语义名（`c1` `t1` `s1`）。
3. **构造辅助线要 `setVisible(x,false)`** —— 作图辅助线不该出现在最终图里。
4. **⚠️ 两个 `--view` 不是一回事，别混。**
   - **`generate.js --view`（技能自带，生成 .ggb 时用）—— 不可用，不要传**，见下条；
   - **`ggb_embed.js --view`（本技能，嵌入时用）—— 可用，是解决视窗问题的正解**，见第 6 条。

5. **⚠️ `generate.js --view` 不可用（实测结论，别踩）** —— `generate.js` 会按 `payload.width`（默认 1200）
   算 `scale/xZero/yZero` 覆盖进 `geogebra.xml` 的 `<coordSystem>`，**但文件里记录的 `size`
   却是 applet 自己的尺寸**（实测 `810x526`，预留在 745 高）。两个数不一致，结果与请求值完全对不上。
   用最简图形 `A=(0,0) B=(1,1) f(x)=x^2` 单独实测：

   | 请求 `--view` | 文件 `size` | 实际可见世界坐标 |
   |---------------|-------------|------------------|
   | `-3,3,-3,3` | `810x526` | `x[-3.00, 1.05] y[4.37, 7.00]` |
   | `-1,14,-1,7` | `810x526` | `x[-1.00, 9.13] y[4.42, 11.00]` |
   | 不传 `--view` | `810x526` | `x[-8.10, 8.10] y[-5.26, 5.26]` ✅ |

   注意第二行：`ymin=-1` 但可见 y 从 `4.42` 起 —— **原点整个落在画布外**，也不是简单的比例问题。
   **生成 `.ggb` 时唯一可靠的做法是不传 `--view`**，用 GeoGebra 默认视窗，
   或者把图形本身平移到默认视窗正中间（`fitView` 类命令不可用）。
   **视窗控制在嵌入阶段做**（第 6 条），那才是它该在的地方。

   > 根因是 `generate.js` 用 `payload.width/height`（1200×800）算缩放，却在 `size` 里写了
   > applet 实测尺寸，且 `euclidianView` 的 `size` 与 `coordSystem` 必须同源才成立。
   > 这属于 `geogebra-file-generator` 技能自身的缺陷，不修改其它技能的源码，仅在此记录。

6. **✅ 用 `ggb_embed.js --view x0,x1,y0,y1` 控制视窗（推荐做法）。**
   不带 `--view` 时，GeoGebra 按内容自动取景，**纵向范围完全由 applet 高度决定**
   （`yMin = (yZero - height) / scale`，默认 420px 时可见 y 只有 `[-0.81, 7.45]`），
   于是放在 `y < -0.81` 的元素（负半轴的点、水平切线、下半支曲线）**会被切掉** ——
   而 `--preview` 的 PNG 和对象清单**都发现不了**，它们只看文件层面。

   **`--view` 的语义是「这个区域必须看得见」，不是「坐标轴上下限」**：
   它做的是 **contain-fit** —— 把请求的矩形按画布长宽比等比**放大**（只增不减）后居中，
   于是

   - 请求框内的所有元素**必定可见**；
   - `invXscale === invYscale` 恒成立，**圆永远是圆**（不会变成椭圆）；
   - 结果与容器宽高无关，**图会自适应任何嵌入尺寸**。

   六条配方在 640px 与 320px 两种卡片宽度下实测，**12/12 全部 `CONTAINS` 且 `aspect=1.0000`**。

   **写法**：按「图形最外沿」给一个刚好包住内容的框，四个数依次是 `x0,x1,y0,y1`
   （注意 y0 是小的那个；负数可以直接写）：

   ```
   node scripts/ggb_embed.js --in tri.ggb --view -0.8,5.8,-0.8,3.8 --height 420
   ```

   **框给紧了图才大** —— 框的 y 跨度越大，被放大到画布比例后 x 也越宽，图形反而缩小。
   例：r5 用 `-3.2,3.2,-7.5,7.5` 会撑到 `x[±11.45]`，三次曲线缩成中间一小段；
   改成 `-4,4,-2.8,2.8` 后曲线铺满画面，P 与 Q 都清晰可读。

   **自检：把框画在图上，它包住所有要讲的东西了吗？** 框外的元素会被放大后仍留在画面边缘之外。

---

## 1. 勾股定理（拖动直角边看斜边）

**教学点**：拖动 A 或 B，直角边 a、b 变化，斜边 c 实时跟随；面板显示 `a²+b²=c²` 恒成立。

```
A=(0,0)
B=(5,0)
C=(0,3)
t1=Polygon(A,B,C)
right=Angle(A, C, B)
c1=Circle(A, 0.6)
c2=Circle(B, 0.6)
c3=Circle(C, 0.6)

setColor(t1,"#1c7ed6")
setLineThickness(t1,3)
setFilling(t1,0.12)
setColor(right,"#c92a2a")
setLineThickness(right,3)
setLabelVisible(right,false)
setVisible(c1,false)
setVisible(c2,false)
setVisible(c3,false)
```

```bash
node generate.js --out pyth.ggb --preview pyth.png --no-algebra --cmd-file r1.txt
```

> 嵌入时用 `--view -0.8,5.8,-0.8,3.8`（包住三角形与三个直角标记圆，半径 0.6）。
> 生成 `.ggb` 时不传 `--view`。

**侧边栏交互指引**：「拖动点 A 或 B，观察三边长度如何联动变化，验证 a² + b² = c²」

---

## 2. 三角形外心与重心（拖顶点看派生的心）

**教学点**：任意拖动一个顶点，外心 O、重心 G、垂足 D 全部实时重算，直观理解"心的位置由什么决定"。

```
A=(1,1)
B=(7,1)
C=(3,5)
t1=Polygon(A,B,C)

# 外心：两边的中垂线交点
m_ab=Midpoint(A,B)
m_bc=Midpoint(B,C)
perp_ab=PerpendicularLine(m_ab, Line(A,B))
perp_bc=PerpendicularLine(m_bc, Line(B,C))
O=Intersect(perp_ab, perp_bc)
c_out=Circle(A,B,C)

# 重心：两条中线交点
M_ca=Midpoint(C,A)
m1=Line(C, Midpoint(A,B))
m2=Line(A, Midpoint(A,C))
G=Intersect(m1, m2)

setColor(t1,"#1c7ed6")
setLineThickness(t1,3)
setFilling(t1,0.1)
setColor(c_out,"#e8590c")
setLineThickness(c_out,2)
setColor(O,"#c92a2a")
setPointSize(O,8)
setCaption(O,"外心 O")
setColor(G,"#2b8a3e")
setPointSize(G,8)
setCaption(G,"重心 G")
setLineStyle(m1,1)
setLineStyle(m2,1)
setColor(m1,"#adb5bd")
setColor(m2,"#adb5bd")
setVisible(perp_ab,false)
setVisible(perp_bc,false)
setVisible(m_ab,false)
setVisible(m_bc,false)
```

```bash
node generate.js --out centers.ggb --preview centers.png --no-algebra --cmd-file r2.txt
```

> 嵌入时用 `--view -1.2,8.2,-1.8,5.8`（包住三角形与外接圆：外接圆心 `(4,2)`、半径 `√10≈3.16`，
> 所以 x 到 `0.84~7.16`、y 到 `-1.16~5.16`）。生成 `.ggb` 时不传 `--view`。

> ⚠️ **中线不要复用已隐藏的 `m_ab`**。`setVisible(m_ab,false)` 只是隐藏，对象还在，
> 但实测 `m1=Line(C, m_ab)` 在这条命令链里会被拒绝（`G=Intersect(m1,m2)` 随之一起消失，
> 而 `generate.js` 仍以退出码 0 结束）。**直接把 `Midpoint(...)` 内联进 `Line()` 最稳**，
> 并删掉不再需要的 `M_ca`，实测两条中线与 G 全部正常建立。

**侧边栏交互指引**：「拖动顶点 A/B/C，观察外心 O 与重心 G 如何重新定位；试着让三角形接近等边，看两个心是否重合」

---

## 3. 抛物线的三个系数（滑块驱动）

**教学点**：三条 GeoGebra 原生滑块控制 a/b/c，实时看到开口方向、对称轴、顶点位置的变化。

```
a=Slider(-4, 4, 0.5)
b=Slider(-8, 8, 0.5)
c_v=Slider(-6, 6, 0.5)
SetValue(a, 1)
SetValue(b, -2)
SetValue(c_v, -1)

f(x)=a*x^2 + b*x + c_v
V=(-b/(2*a), c_v - b*b/(4*a))
axis=Line(V, Vector((0,1)))

setColor(f,"#1c7ed6")
setLineThickness(f,3)
setColor(V,"#c92a2a")
setPointSize(V,8)
setCaption(V,"顶点 V")
setColor(axis,"#adb5bd")
setLineStyle(axis,1)
```

```bash
node generate.js --out parabola.ggb --preview parabola.png --no-algebra --cmd-file r3.txt
```

> 抛物线本身必然冲出视窗（这是它向上开口的必然结果，不是 bug）。要看见的是顶点 V、对称轴、滑块。
> 嵌入时用 `--view -1.6,3.6,-2.8,4.2`：V(1,-2) 在框内且有余量，抛物线在 `x≈-1.2` 与 `x≈3.2`
> 处穿出顶边，画面利用率比默认取景高得多。生成 `.ggb` 时不传 `--view`。

> 顶点纵坐标直接写成 `-b²/(4a)` 的等价形式 `c - b*b/(4*a)`，避免 GeoGebra 里嵌套 `f(-b/(2*a))` 的求值顺序问题。

**侧边栏交互指引**：「拖动滑块 a（控制开口）、b（控制左右平移）、c（控制上下平移），观察顶点 V 与对称轴的变化」

---

## 4. 单位圆与三角函数（角度滑块）

**教学点**：拖 θ 滑块，射线与两个投影线段同步变化，直接建立 sin/cos 的几何意义。

```
theta=Slider(0, 360, 1)
SetValue(theta, 45)
O=(0,0)
unit_c=Circle(O, 1)
P=(cos(theta*°), sin(theta*°))
ray_op=Segment(O, P)
foot=Intersect(Line(O,P), Line((0,-2),(0,2)))
seg_cos=Segment(O, foot)
seg_sin=Segment(foot, P)

setColor(unit_c,"#adb5bd")
setLineThickness(unit_c,2)
setColor(ray_op,"#1c7ed6")
setLineThickness(ray_op,3)
setColor(P,"#c92a2a")
setPointSize(P,7)
setColor(seg_cos,"#2b8a3e")
setLineThickness(seg_cos,4)
setColor(seg_sin,"#e8590c")
setLineThickness(seg_sin,4)
setVisible(foot,false)
```

> ⚠️ **投影脚点必须用求交构造，不能写 `foot=(cos(theta*°), 0)`**。
> GeoGebra 把「一对坐标值」一律建成 **vector**，实测 `foot=(cos(theta*°), 0)` 得到的类型是
> `vector`，于是 `Segment(O, foot)`（点 + 向量）直接被拒绝 —— 命令返回 `false`，
> 而 `generate.js` 仍然以退出码 0 结束，`seg_cos` `seg_sin` 静默消失，图上只剩单位圆和射线。
> `Point(fx, 0)`、`Point((fx,0))`、`Point(fx)`、`X(P)` 全部同样被拒（已逐条实测）。
> 可用的写法是**造一条竖直辅助直线再求交**：
> `foot=Intersect(Line(O,P), Line((0,-2),(0,2)))` —— 这样 `foot` 的类型是 `point`，
> 两段投影线段都能正常建立（实测通过）。辅助线用 `Line((0,-2),(0,2))` 而不是 `xAxis`，
> 是为了不让 x 轴在图上被重复绘制。

```bash
node generate.js --out trig.ggb --preview trig.png --no-algebra --cmd-file r4.txt
```

> 嵌入时用 `--view -1.8,1.8,-1.8,1.8`：单位圆半径 1，两条投影线段最远到 `(±1, 0)`，
> 正方形框留出约 0.8 的余量，圆不会被压小也不会贴边。生成 `.ggb` 时不传 `--view`。

**侧边栏交互指引**：「拖动角度滑块 θ，观察绿色线段（cos θ）与橙色线段（sin θ）如何随角度变化——这就是三角函数的几何意义」

---

## 5. 切线与导数（沿曲线拖动点）

**教学点**：点 P 被约束在曲线上，可沿曲线拖动；切线与斜率实时跟随，割线趋近切线的极限过程可视化。

```
f(x)=If(-2 < x < 2, x^3 - 3*x)
P=Point(f)
SetValue(P, (1, -2))
tan_l=Tangent(P, f)
Q=(0, 0)
sec_l=Line(P, Q)

setColor(f,"#1c7ed6")
setLineThickness(f,3)
setColor(P,"#c92a2a")
setPointSize(P,9)
setCaption(P,"拖我")
setColor(Q,"#7048e8")
setPointSize(Q,7)
setCaption(Q,"Q")
setColor(tan_l,"#e8590c")
setLineThickness(tan_l,2)
setColor(sec_l,"#7048e8")
setLineThickness(sec_l,1)
```

```bash
node generate.js --out tangent.ggb --preview tangent.png --no-algebra --cmd-file r5.txt
```

> 嵌入时用 `--view -2.4,2.4,-2.4,2.4`，与上面函数值域 `y[-2,2]` 对齐。生成 `.ggb` 时不传 `--view`。

> ⚠️ **三次函数要收窄自变量范围，让整条曲线能被一个紧凑的框包住**。
> `f(x)=x^3-3x` 在 `x=±8` 处达到 `f=±488`，若画满全定义域就只能配一个很高的框，
> 于是曲线被压成中间一小段。**收窄到 `If(-2 < x < 2, x^3 - 3*x)`，值域恰好是 `y[-2, 2]`**
> （极值 `f(1)=-2`、`f(-1)=2`，端点 `f(±2)=±2`），配 `--view -2.4,2.4,-2.4,2.4` 就能整条容纳。
> 对比：旧的 `If(-2.4 < x < 2.4, ...)` 值域是 `y[±6.62]`，必须配宽框，S 形明显更小（已用截对比确认）。
>
> ⚠️ **这里要区分两个 `If(...)` 的作用**。收窄定义域解决的是「曲线在紧凑视窗里显得小」，
> **不是**「切线与 P 跑到视窗外」—— 实测那纯粹是**嵌入高度不足**（默认 420px 只显示到 `y≈-0.8`），
> 解药是用 `ggb_embed.js --view` 给视窗（见「通用规则」第 6 条），与 `If` 无关。
>
> ⚠️ **点 P 是可拖动的，视窗必须包住整条曲线的值域**。这一点比「看得清」更重要：若曲线值域
> 超出视窗，学生一旦把 P 拖到越界处，P 就消失在画面外。`If(-2 < x < 2, ...)` 的值域与视窗
> 恰好对齐，全程拖动都不会越界。
>
> ⚠️ **割线远端点不能取在临界点上**。默认 `P=(1,-2)` 正好是极小值点，此处切线是水平线；
> 若远端点也写成 `(-2, f(-2)) = (-2,-2)`，两点同在 `y=-2`，**割线与切线会完全重合**，
> 紫色割线被橙色切线盖住，「割线→切线」的极限过程根本看不见（实测截图：modlens 只读到一条
> `sec_1 = y=-2`，与切线无法区分）。改取曲线上的普通点 `Q=(0,0)`，割线斜率 -2 与切线斜率 0
> 明显不同，两条线才分得开。**若要换 P 的位置，记得同时确认割线不与切线重合。**

**侧边栏交互指引**：「沿蓝色曲线拖动点 P，观察橙色切线如何跟随；思考当 P 逼近某点时，割线与切线的关系」

---

## 6. 相似三角形（滑块控制缩放比）

**教学点**：滑块 k 控制以 A 为中心的位似倍数，对应边 AB∥A2B2、AC∥A2C2 始终成立，直观呈现 AA 相似与 k→1 时两三角形重合。

```
k=Slider(0.2, 3, 0.1)
SetValue(k, 1.8)
A=(0,0)
B=(4,0)
C=(0,3)
t1=Polygon(A,B,C)
A2=A + k*(B-A)
B2=A + k*(B-A) + (B-A)
C2=A + k*(C-A)
t2=Polygon(A2,B2,C2)
l_link=Segment(B, A2)

setColor(t1,"#1c7ed6")
setLineThickness(t1,3)
setFilling(t1,0.12)
setColor(t2,"#e8590c")
setLineThickness(t2,3)
setFilling(t2,0.12)
setColor(l_link,"#c92a2a")
setLineThickness(l_link,2)
setLineStyle(l_link,1)
```

```bash
node generate.js --out similar.ggb --preview similar.png --no-algebra --cmd-file r6.txt
```

> ⚠️ 缩放中心在 A，`A2` 是 B 方向上的位似点，所以 `B2` 必须再走**一段** `B-A`
> （`A + k*(B-A) + (B-A)`），写成 `B2=A2` 会让两个顶点重合、三角形塌成一条线段。
>
> 嵌入时用 `--view -1.0,12.2,-1.2,6.5`：默认 `k=1.8` 时 `B2.x=11.2`、`C2=(0,5.4)`，
> 框包住两个三角形与连接线段（已用嵌入页截图确认两者同时可见）。
> **注意 `k` 是滑块**：拉到 3 时 `B2.x` 会到 16，会超出这个框 —— 这是有意的教学设计
> （学生看到橙色三角形被推出画面，顺势讲「位似把图形放大到画面之外」）。
> 若希望 `k=3` 也在画面内，把框放大到 `--view -1.0,17.5,-1.2,10.5`。生成 `.ggb` 时不传 `--view`。

**侧边栏交互指引**：「拖动滑块 k，观察蓝色与橙色三角形始终保持形状相同、只是大小不同；把 k 调到 1，两者完全重合」

---

## 配方挑选速查

| 教学主题 | 用配方 | 核心交互 |
|----------|--------|----------|
| 勾股定理 | 1 | 拖边长 |
| 三角形四心 | 2 | 拖顶点 |
| 二次函数 | 3 | 拖 a/b/c 滑块 |
| 三角函数 | 4 | 拖 θ 滑块 |
| 导数几何意义 | 5 | 沿曲线拖点 |
| 相似三角形 | 6 | 拖 k 滑块 |

---

## 已实测备注

⚠️ **最重要的一条实测结论：`generate.js` 退出码 0 不代表命令被接受了。**
它把每条命令交给 `api.evalCommand()`，被拒绝时只是把 `results[].ok` 记成 `false`，
**从不据此让进程失败**（`generate.js` 只有参数错误才 `process.exit(1)`）。
所以「跑通了」只能证明 `.ggb` 文件被写出来，不能证明图里的对象都在。
校验配方必须**核对对象清单**，不能看退出码：

```bash
# 对象清单要跟配方承诺的一致
node scripts/assert_objects.js          # 或解包 .ggb 读 geogebra.xml 的 label 属性
```

已用「解包 `.ggb` → 读 `geogebra.xml` 的 `<element label=...>`」逐条核对六条配方：

| 配方 | 承诺对象 | 实测 | 结论 |
|------|----------|------|------|
| 1 勾股 | 8 | 11（含自动生成的边 `a b c`） | OK |
| 2 四心 | 14 | 17 | 修 `m1` 后通过 |
| 3 抛物线 | 5 | 6 | OK |
| 4 单位圆 | 8 | 8 | 修 `foot` 后通过 |
| 5 导数 | 4 | 5 | OK |
| 6 相似 | 10 | 16 | OK |

> 「实测」比「承诺」多，是因为 `Polygon`/`Circle` 会自动派生边与半径等从属对象
> （如 `t1=Polygon(A,B,C)` 额外产生 `a b c`）。**判据是「承诺的对象一个都不少」**，
> 多出来的从属对象属正常。

其他实测记录：

- **配方 2**：垂线与中点已隐藏，但中线 `m1` `m2` 保留为浅灰虚线 —— 这是刻意的：让学生看见重心由中线交点决定。若不想露出，把两条 `setVisible(m1,false)` 加上即可。
- **配方 3**：顶点坐标公式用 `c_v - b*b/(4*a)` 而非 `f(-b/(2*a))`，实测顶点稳定落在 `(1, -2)`，与 `a=1, b=-2, c=-1` 一致。
- **配方 4**：`foot` 必须用求交构造（见上文警告），这是六条配方里唯一踩过「命令被静默拒绝」的坑。
- **配方 5**：`Tangent` 在点 `(1,-2)` 处给出水平切线（`x³-3x` 在 x=1 的导数为 0），符合预期；割线远端点必须避开临界点，否则与切线重合；函数用 `If(-2 < x < 2, ...)` 收窄到值域 `y[-2,2]`，这样整条曲线连同可拖动点 P 都能落进紧凑视窗（`--view -2.4,2.4,-2.4,2.4`）。
- **配方 6**：默认 `k=1.8` 下橙色三角形顶点为 `A2(7.2,0)` `B2(11.2,0)` `C2(0, 5.4)`，与蓝色三角形形状相同。

### 视窗：用 `ggb_embed.js --view`（contain-fit）

**生成 `.ggb` 时不传 `--view`**（`generate.js` 的 `--view` 实测错位，见「通用规则」第 5 条）。
视窗控制放在**嵌入阶段**，用本 Skill 的 `scripts/ggb_embed.js --view x0,x1,y0,y1`：

```bash
node scripts/ggb_embed.js --in tangent.ggb --id r5 --height 420 --view -2.4,2.4,-2.4,2.4
```

六条配方各带自己的内容框（完整数据见每条配方末尾的注解）：

| 配方 | 嵌入用 `--view` | 框住的教学要点 |
|------|-----------------|----------------|
| 1 勾股 | `-0.8,5.8,-0.8,3.8` | 三角形三个顶点 + 三个直角标记圆 |
| 2 四心 | `-1.2,8.2,-1.8,5.8` | 三角形 + 外接圆（圆心 `(4,2)` 半径 `√10`） |
| 3 抛物线 | `-1.6,3.6,-2.8,4.2` | 顶点 `V(1,-2)` + 对称轴 + 三滑块 |
| 4 单位圆 | `-1.8,1.8,-1.8,1.8` | 单位圆 + 两条投影线段 |
| 5 导数 | `-2.4,2.4,-2.4,2.4` | 与函数值域 `y[-2,2]` 对齐 |
| 6 相似 | `-1.0,12.2,-1.2,6.5` | 两个三角形 + 连接线段（`k=1.8`） |

**没给 `--view` 时**，`ggb_embed.js` 只调 `setPerspective("Geometry")` 隐藏代数面板，
视窗交给 GeoGebra 自己的内容自适应 —— 对「图形小且居中」的图（如上面的单位圆）够用，
但默认 420px 高度下可见 y 只有约 `[-0.8, 7.4]`，**纵向负半轴的要点会被下边缘切掉**。

**验证方法**：真实嵌入页逐张截图 + 目视确认（`--preview` 的 PNG 会按 `boundingClientRect`
裁切，与 canvas 尺寸不同源，不能作为判据）。六条配方已在 640px 与 320px 两种卡片宽度下
各跑一遍，12/12 全部 `CONTAINS` 且 `invXscale === invYscale`（圆不变形）。

---

## 验收清单

每张图生成后必须检查：

- [ ] **对象清单与配方承诺一致**（解包 `.ggb` 数 `<element label=...>`，不要看退出码）← 必做
- [ ] **生成 `.ggb` 时没有传 `--view`**（该参数在 `generate.js` 里实测错位到看不见原点）← 必做
- [ ] **嵌入时用 `ggb_embed.js --view` 给出内容框，并确认框包住所有教学要点**（顶点、切点、滑块、极端值…）← 必做
- [ ] 曲线类图形的视窗能包住**整条**曲线值域，拖动点全程不越界 ← 必看
- [ ] 真实嵌入页里逐张截图确认关键元素可见（`--preview` 的 PNG 会按 `boundingClientRect` 裁切，不能作为判据）← 必看
- [ ] 构造辅助线（垂线、中线、中点、投影脚点）按设计 `setVisible(false)` 或保留为浅灰虚线
- [ ] 自由点数量 ≥ 1，或至少有一个 `Slider`（否则不是"动态"图）
- [ ] 嵌入网页后**滑块面板可见**（`setPerspective("Geometry")` 不应压掉它）← 必看，且只能靠截图判断（DOM 里查不到滑块节点）
- [ ] 嵌入网页后**代数面板不出现**（判据：`.ggb-stage` 内没有 `.algebraPanel`）← 必看
- [ ] `ggb_embed.js` 生成的片段在浏览器里 canvas 尺寸 ≈ 容器尺寸
- [ ] 拖动浏览器窗口后 canvas 跟随重排（不残留旧尺寸、不塌缩）
- [ ] 侧边栏写了明确的「交互指引」文案