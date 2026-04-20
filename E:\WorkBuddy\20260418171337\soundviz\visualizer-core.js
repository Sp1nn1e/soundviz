/**
 * visualizer-core.js
 * Visualizer 核心模块：构造器 / 初始化 / 颜色方案 / 图案生成器 / 动画主循环 / 工具方法
 * 
 * 模块拆分说明（解决上下文过大触发 11133 问题）：
 *   visualizer-core.js    ← 本文件，核心框架
 *   visualizer-basic.js   ← 基础渲染模式（波形/频谱/粒子/圆形/光点/反应式/3D波浪/图案）
 *   visualizer-ancient.js ← 古建筑模式
 *   visualizer-extra.js   ← 图片波浪/平铺/漩涡
 *   visualizer-ball.js    ← 发光球模式
 */

class Visualizer {
    constructor(canvas, audioEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioEngine = audioEngine;
        
        // 画布尺寸
        this.width = 0;
        this.height = 0;
        
        // 当前模式
        this.mode = 'waveform';
        
        // 粒子系统
        this.particles = [];
        this.maxParticles = 500;
        
        // 图片资源
        this.customImage = null;
        this.customImageData = null;
        this.texturePatterns = {};
        
        // 预设纹理生成器
        this.patternGenerators = {};
        
        // 颜色配置
        this.colorScheme = {
            bass: '#ff3366',
            mid: '#33ff99',
            treble: '#3399ff',
            bg: '#0a0a0a'
        };
        
        // 渲染参数
        this.params = {
            sensitivity: 1.5,
            blur: 0,
            glow: 20,
            particleSpeed: 2,
            particleLife: 100,
            barCount: 64,
            circleRadius: 150,
            dotSize: 3,
            rotation: 0,
            // 图片相关参数
            imageScale: 1.0,
            imageOpacity: 0.5,
            imageGlow: 10,
            distortion: 0,
            imageFilter: 'none' // none, glow, pulse, ripple
        };
        
        // 历史数据
        this.history = [];
        this.historyLength = 50;
        
        // 动画帧
        this.animationId = null;
        this.isRunning = false;
        
        // 初始化
        this.resize();
        this.initPatternGenerators();
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        if (this.mode === 'particles') {
            this.initParticles();
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.particles = [];
        this.history = [];
        this.ballRadiusVel = 0; // 重置球半径速度

        if (mode === 'particles') {
            this.initParticles();
        } else if (mode === 'bouncingball') {
            this.ball = null; // 强制重新初始化球
        }
    }

    /**
     * 初始化图案生成器
     */
    initPatternGenerators() {
        // 心形
        this.patternGenerators.heart = (ctx, x, y, size, intensity) => {
            ctx.beginPath();
            const s = size * (1 + intensity * 0.5);
            ctx.moveTo(x, y + s * 0.3);
            ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
            ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
            ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
            ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
            ctx.fill();
        };

        // 星星
        this.patternGenerators.star = (ctx, x, y, size, intensity) => {
            const spikes = 5;
            const outerRadius = size * (1 + intensity * 0.5);
            const innerRadius = outerRadius * 0.5;
            ctx.beginPath();
            for (let i = 0; i < spikes * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI / spikes) - Math.PI / 2;
                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        };

        // 六边形
        this.patternGenerators.hexagon = (ctx, x, y, size, intensity) => {
            const s = size * (1 + intensity * 0.3);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI / 3) - Math.PI / 2;
                const px = x + Math.cos(angle) * s;
                const py = y + Math.sin(angle) * s;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        };

        // 三角形
        this.patternGenerators.triangle = (ctx, x, y, size, intensity) => {
            const s = size * (1 + intensity * 0.4);
            ctx.beginPath();
            ctx.moveTo(x, y - s);
            ctx.lineTo(x + s * 0.866, y + s * 0.5);
            ctx.lineTo(x - s * 0.866, y + s * 0.5);
            ctx.closePath();
            ctx.fill();
        };

        // 菱形
        this.patternGenerators.diamond = (ctx, x, y, size, intensity) => {
            const s = size * (1 + intensity * 0.4);
            ctx.beginPath();
            ctx.moveTo(x, y - s);
            ctx.lineTo(x + s * 0.7, y);
            ctx.lineTo(x, y + s);
            ctx.lineTo(x - s * 0.7, y);
            ctx.closePath();
            ctx.fill();
        };

        // 圆环
        this.patternGenerators.ring = (ctx, x, y, size, intensity) => {
            const r = size * (1 + intensity * 0.3);
            const width = 3 + intensity * 5;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = width;
            ctx.stroke();
        };

        // 十字
        this.patternGenerators.cross = (ctx, x, y, size, intensity) => {
            const s = size * (1 + intensity * 0.3);
            const w = 4 + intensity * 4;
            ctx.fillRect(x - w/2, y - s, w, s * 2);
            ctx.fillRect(x - s, y - w/2, s * 2, w);
        };

        // 螺旋
        this.patternGenerators.spiral = (ctx, x, y, size, intensity) => {
            const turns = 3 + intensity * 2;
            ctx.beginPath();
            for (let i = 0; i < 360 * turns; i += 2) {
                const angle = i * Math.PI / 180;
                const r = (i / 360) * size * 0.1 * (1 + intensity);
                const px = x + Math.cos(angle) * r;
                const py = y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 2 + intensity * 3;
            ctx.stroke();
        };
    }

    /**
     * 加载自定义图片
     */
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.customImage = img;
                    this.customImageData = e.target.result;
                    this.createTilePattern(img);
                    resolve(img);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 创建平铺纹理
     */
    createTilePattern(img) {
        const tileSize = 100;
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = tileSize;
        patternCanvas.height = tileSize;
        const pctx = patternCanvas.getContext('2d');
        pctx.drawImage(img, 0, 0, tileSize, tileSize);
        this.texturePatterns.tile = this.ctx.createPattern(patternCanvas, 'repeat');
    }

    /**
     * 清空自定义图片
     */
    clearImage() {
        this.customImage = null;
        this.customImageData = null;
        this.texturePatterns = {};
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle(x = null, y = null, pattern = null) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        
        return {
            x: x !== null ? x : this.width / 2,
            y: y !== null ? y : this.height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: Math.random() * this.params.particleLife + 50,
            maxLife: this.params.particleLife,
            size: Math.random() * 4 + 2,
            hue: Math.random() * 60 + (this.audioEngine.bassData.current > 0.5 ? 330 : 180),
            pattern: pattern || ['heart', 'star', 'hexagon', 'triangle', 'diamond'][Math.floor(Math.random() * 5)]
        };
    }

    setColorScheme(scheme) {
        const schemes = {
            neon: { bass: '#ff3366', mid: '#33ff99', treble: '#3399ff', bg: '#0a0a0a' },
            fire: { bass: '#ff0000', mid: '#ff6600', treble: '#ffff00', bg: '#1a0505' },
            ocean: { bass: '#0066ff', mid: '#00ccff', treble: '#00ffcc', bg: '#050a14' },
            purple: { bass: '#ff00ff', mid: '#cc00ff', treble: '#6600ff', bg: '#0a0514' },
            mono: { bass: '#ffffff', mid: '#aaaaaa', treble: '#666666', bg: '#0a0a0a' },
            sunset: { bass: '#ff6b35', mid: '#f7c59f', treble: '#efaee4', bg: '#1a1423' },
            cyber: { bass: '#00ff88', mid: '#00bfff', treble: '#ff00ff', bg: '#0a0a1a' },
            gold: { bass: '#ffd700', mid: '#ff8c00', treble: '#ff4500', bg: '#1a1a0a' }
        };
        
        if (schemes[scheme]) {
            this.colorScheme = schemes[scheme];
        }
    }

    setParam(name, value) {
        if (this.params.hasOwnProperty(name)) {
            this.params[name] = value;
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate() {
        if (!this.isRunning) return;
        
        this.audioEngine.update();
        this.audioEngine.decayPeaks(0.92);
        
        this.ctx.fillStyle = this.colorScheme.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        if (this.params.blur > 0) {
            this.ctx.fillStyle = `rgba(${this.hexToRgb(this.colorScheme.bg)}, ${this.params.blur / 100})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 渲染图片背景（如果有）
        this.renderImageBackground();
        
        // 根据模式渲染
        switch (this.mode) {
            case 'waveform':    this.renderWaveform(); break;
            case 'bars':        this.renderBars(); break;
            case 'particles':   this.renderParticles(); break;
            case 'circle':      this.renderCircle(); break;
            case 'dots':        this.renderDots(); break;
            case 'reactive':    this.renderReactive(); break;
            case '3dwave':      this.render3DWave(); break;
            case 'shapes':      this.renderShapes(); break;
            case 'ancient':     this.renderAncientPavilion(); break;
            case 'imagewave':   this.renderImageWave(); break;
            case 'tiled':       this.renderTiledPattern(); break;
            case 'vortex':      this.renderVortex(); break;
            case 'bouncingball':this.renderBouncingBall(); break;
        }
        
        this.history.push({
            bass: this.audioEngine.bassData.current,
            mid: this.audioEngine.midData.current,
            treble: this.audioEngine.trebleData.current
        });
        if (this.history.length > this.historyLength) {
            this.history.shift();
        }
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * 渲染图片背景
     */
    renderImageBackground() {
        if (!this.customImage) return;
        
        const bass = this.audioEngine.bassData.current;
        const mid = this.audioEngine.midData.current;
        const treble = this.audioEngine.trebleData.current;
        
        const scale = this.params.imageScale * (1 + bass * this.params.distortion);
        const opacity = this.params.imageOpacity * (1 + mid * 0.5);
        
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(1, opacity);
        
        if (this.params.imageFilter === 'pulse') {
            const hueShift = bass * 60;
            this.ctx.filter = `hue-rotate(${hueShift}deg) saturate(${1 + mid}) brightness(${1 + treble * 0.5})`;
        } else if (this.params.imageFilter === 'glow') {
            this.ctx.filter = `blur(${bass * 5}px) brightness(${1 + treble * 0.5})`;
        } else if (this.params.imageFilter === 'ripple') {
            this.ctx.filter = `saturate(${1 + bass}) contrast(${1 + mid * 0.5})`;
        }
        
        const w = this.customImage.width * scale;
        const h = this.customImage.height * scale;
        const x = (this.width - w) / 2;
        const y = (this.height - h) / 2;
        
        this.ctx.drawImage(this.customImage, x, y, w, h);
        this.ctx.restore();
        
        if (this.params.imageGlow > 0 && bass > 0.3) {
            this.ctx.save();
            this.ctx.globalAlpha = bass * 0.3;
            this.ctx.shadowColor = this.colorScheme.bass;
            this.ctx.shadowBlur = this.params.imageGlow * bass * 2;
            this.ctx.drawImage(this.customImage, x, y, w, h);
            this.ctx.restore();
        }
    }

    // ============ 工具方法 ============

    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result 
            ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
            : '255, 255, 255';
    }
}

window.Visualizer = Visualizer;
