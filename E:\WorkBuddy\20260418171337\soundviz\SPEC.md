# SoundViz 模块索引规范

> 本文件是 SoundViz 项目的全局架构索引。
> AI 读取此文件即可掌握全局，**无需读取各模块源文件**。
> 除非需要精确定位代码实现，否则不要将模块文件内容注入对话上下文。

---

## 📁 项目结构

```
soundviz/
├── index.html           # 入口页面，含所有 <script> 引用
├── main.js              # 初始化入口
├── ui-controller.js     # UI 控制面板（27KB/735行）
├── audio-engine.js       # 音频采集与频谱分析（22.8KB/729行）
├── visualizer-core.js    # SoundVisualizer 核心类（15.1KB/433行）
├── visualizer-basic.js   # 基础视觉模式（19KB/456行）
├── visualizer-ancient.js # 古建筑模式（15.2KB/344行）
├── visualizer-extra.js   # 额外模式（7.7KB/198行）
├── visualizer-ball.js    # 发光球模式（12.5KB/289行）
├── styles.css            # 所有样式（19.3KB/938行）
└── visualizer.js         # 【已废弃】原始合并文件（72KB/1769行），勿引用
```

---

## 🎨 视觉模式 ID 清单（13 个）

| ID | 模式名称 | 渲染方法 | 所属模块 |
|----|----------|----------|----------|
| `0` | 波形 | `renderWaveform` | visualizer-basic.js |
| `1` | 频谱 | `renderBars` | visualizer-basic.js |
| `2` | 粒子 | `renderParticles` | visualizer-basic.js |
| `3` | 圆形 | `renderCircle` | visualizer-basic.js |
| `4` | 光点 | `renderDots` | visualizer-basic.js |
| `5` | 响应式 | `renderReactive` | visualizer-basic.js |
| `6` | 3D波 | `render3DWave` | visualizer-basic.js |
| `7` | 形状 | `renderShapes` | visualizer-basic.js |
| `8` | 古建筑 | `renderAncientPavilion` | visualizer-ancient.js |
| `9` | 图片波浪 | `renderImageWave` | visualizer-extra.js |
| `10` | 平铺 | `renderTiledPattern` | visualizer-extra.js |
| `11` | 漩涡 | `renderVortex` | visualizer-extra.js |
| `12` | 发光球 | `renderBouncing` | visualizer-ball.js |

---

## 🧩 模块职责

### visualizer-core.js（核心）
- `class SoundVisualizer` — 主类，构造器、init、drawFrame、animate
- `animate()` — 每帧主循环，switch 分发到各渲染方法
- 颜色方案、主题定义、背景色

### visualizer-basic.js（基础 8 模式）
- `renderWaveform / renderBars / renderParticles / renderCircle`
- `renderDots / renderReactive / render3DWave / renderShapes`

### visualizer-ancient.js（古建筑 1 模式）
- `renderAncientPavilion` — 古建筑夜景绘制

### visualizer-extra.js（额外 3 模式）
- `renderImageWave` / `renderTiledPattern` / `renderVortex`

### visualizer-ball.js（发光球 1 模式）
- `renderBouncing` — 发光球绘制（带 `ballRadius`、`ballRadiusVel` 状态）

### ui-controller.js（UI 面板）
- `class UIController` — 所有按钮事件、DJ 面板、歌曲列表
- `setMode(id)` — 通过 `visualizer.setMode(id)` 切换模式
- 主题切换：`visualizer.setColorScheme(theme)`

### audio-engine.js（音频）
- `class AudioEngine` — 麦克风、文件播放、混音模式
- 频谱数据：`getFrequencyData() / getTimeDomainData() / getBassData() / getMidData() / getTrebleData()`

---

## 🔧 常用调试入口

| 需求 | 文件 | 关键方法/属性 |
|------|------|--------------|
| 修改 mode 切换逻辑 | visualizer-core.js | `setMode(id)` / `animate()` switch |
| 修改颜色/主题 | visualizer-core.js | `colorSchemes` / `setColorScheme()` |
| 添加新视觉模式 | visualizer-basic.js | 新增 `renderXxx()` + 在 core animate() 添加 case |
| 修改古建筑渲染 | visualizer-ancient.js | `renderAncientPavilion()` |
| 修改发光球状态 | visualizer-ball.js | `ballRadius` / `ballRadiusVel` / `initBouncing()` |
| 修改 UI 按钮 | ui-controller.js | `UIController` 构造器事件绑定 |
| 修改样式 | styles.css | 各类 .btn / .panel 样式 |
| 修改音频参数 | audio-engine.js | `getFrequencyData()` / `getBassData()` |

---

## 📌 颜色主题（palettes）

定义在 `visualizer-core.js` 的 `colorSchemes` 对象：

- `spring` — 春意（粉绿）
- `summer` — 夏夜（深蓝）
- `autumn` — 秋意（橙红）
- `day` — 白天（浅色）
- `ancient` — 古建筑（暖黄）

切换：`uiController.setTheme('summer')` → `visualizer.setColorScheme(theme)`

---

## ⚠️ 使用约定

1. **读此文件，不读源文件**：SoundViz 相关任务先读 SPEC.md 掌握全局，除非需要精确定位代码行
2. **修改前先 grep**：确认方法在哪个模块，再用 replace_in_file 编辑
3. **避免全读**：不要用 read_file 读取整个大文件，需要哪段读哪段
4. **index.html 不动**：script 引用顺序已固定（core→basic→ancient→extra→ball→ui→audio→main）

---

*最后更新：2026-04-20*
