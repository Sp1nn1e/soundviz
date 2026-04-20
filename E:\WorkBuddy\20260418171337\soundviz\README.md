# SoundViz - 音频可视化引擎

## 项目概述
简易版TouchDesigner，支持实时音频输入和多种可视化渲染模式。

## 技术架构
- **前端**: HTML5 + CSS3 + Vanilla JS
- **音频处理**: Web Audio API (AudioContext, AnalyserNode)
- **渲染引擎**: Canvas 2D / WebGL
- **实时输入**: 麦克风 (getUserMedia) + 音频文件

## 核心模块

### 1. 音频引擎 (AudioEngine)
- AudioContext 初始化
- getUserMedia 麦克风采集
- MediaElementSource 音频文件播放
- AnalyserNode FFT频谱分析
- 低/中/高三频分离

### 2. 频谱数据
- 低频 (Bass): 0-250Hz
- 中频 (Mid): 250Hz-4kHz
- 高频 (Treble): 4kHz-20kHz

### 3. 可视化模式
- `waveform` - 波形模式
- `bars` - 频谱柱状图
- `particles` - 粒子系统
- `circle` - 圆形频谱
- `dots` - 光点模式
- `reactive` - 反应式光效

### 4. 控制参数
- 灵敏度 (Sensitivity)
- 颜色主题
- 粒子数量
- 模糊/光晕强度

## 文件结构
```
soundviz/
├── index.html          # 主入口
├── styles.css          # 样式
├── audio-engine.js     # 音频处理模块
├── visualizer.js       # 可视化渲染器
├── ui-controller.js    # UI控制
└── main.js             # 主程序入口
```
