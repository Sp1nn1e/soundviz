/**
 * Visualizer - 可视化渲染引擎 V2
 * 支持: 多种渲染模式 + 图片上传 + 纹理处理
 */

class Visualizer {
    constructor(canvas, audioEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioEngine = audioEngine;

        // 手机画布（可选）
        this.phoneCanvas = null;
        this.phoneCtx = null;
        this._isPhoneMode = false;  // 手机模式标记

        // 画布尺寸
        this.width = 0;
        this.height = 0;

        // 当前模式 - 改为数组支持多模式叠加
        this.activeModes = ['waveform']; // 默认波形模式
        
        // 所有可用模式列表
        this.allModes = ['waveform', 'bars', 'particles', 'circle', 'dots', 'reactive', '3dwave', 'shapes', 'ancient', 'imagewave', 'tiled', 'vortex', 'bouncingball', 'spring', 'summer', 'autumn', 'winter', 'daytime', 'runningstick'];
        
        // 最大叠加数量
        this.maxLayers = 3;
        
        // 性能优化参数
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 60; // 默认60fps
        this.skipShadow = false;
        
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

        // resize 后重置季节粒子系统，防止粒子位置跑出边界导致白屏
        if (this.activeModes.includes('particles')) {
            this.initParticles();
        }
        // 季节模式粒子重置（防止窗口缩小时坐标越界）
        const seasonModes = ['spring', 'summer', 'autumn', 'winter', 'daytime'];
        const hasSeason = seasonModes.some(m => this.activeModes.includes(m));
        if (hasSeason) {
            this.springFlowers = null;
            this.summerClouds = null;
            this.autumnRain = null;
            this.autumnRipples = null;
            this.autumnRipplesMid = null;
            this.autumnRipplesHigh = null;
            this.winterSnowflakes = null;
            this.daytimeClouds = null;
            this.runningStickmen = null;
        }
    }

    setMode(mode) {
        // 替换为单模式（用于兼容性）
        this.activeModes = [mode];
        this.particles = [];
        this.history = [];
        this.ballRadiusVel = 0;

        if (mode === 'particles') {
            this.initParticles();
        } else if (mode === 'bouncingball') {
            this.ball = null;
        }
    }
    
    /**
     * 切换模式 - 按一次开启，再按关闭
     * @param {string} mode - 要切换的模式
     * @returns {boolean} - 模式是否被激活
     */
    toggleMode(mode) {
        const index = this.activeModes.indexOf(mode);
        
        if (index >= 0) {
            // 模式已激活，关闭它
            this.activeModes.splice(index, 1);
            
            // 如果没有激活的模式，自动激活波形模式
            if (this.activeModes.length === 0) {
                this.activeModes.push('waveform');
            }
            return false; // 返回 false 表示已关闭
        } else {
            // 模式未激活，开启它
            if (this.activeModes.length >= this.maxLayers) {
                // 已达最大层数，替换最早的模式
                this.activeModes.shift();
            }
            this.activeModes.push(mode);
            
            // 初始化相关状态
            if (mode === 'particles') {
                this.initParticles();
            } else if (mode === 'bouncingball') {
                this.ball = null;
            }
            return true; // 返回 true 表示已激活
        }
    }
    
    /**
     * 检查模式是否激活
     */
    isModeActive(mode) {
        return this.activeModes.indexOf(mode) >= 0;
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
                    
                    // 创建平铺纹理
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

    /**
     * 设置手机画布
     */
    setPhoneCanvas(canvas) {
        if (canvas) {
            this.phoneCanvas = canvas;
            this.phoneCtx = canvas.getContext('2d');
            this._isPhoneMode = true;  // 标记手机模式
        } else {
            this.phoneCanvas = null;
            this.phoneCtx = null;
            this._isPhoneMode = false;
        }
    }

    /**
     * 绘制到指定画布
     * @param {CanvasRenderingContext2D} targetCtx - 目标画布上下文
     * @param {number} targetWidth - 目标画布宽度
     * @param {number} targetHeight - 目标画布高度
     * @param {boolean} isPhoneMode - 是否为手机模式
     */
    drawToCanvas(targetCtx, targetWidth, targetHeight, isPhoneMode = false) {
        // 保存当前画布状态
        const originalCtx = this.ctx;
        const originalWidth = this.width;
        const originalHeight = this.height;

        // 临时切换到目标画布
        this.ctx = targetCtx;
        this.width = targetWidth;
        this.height = targetHeight;

        // 保存目标画布的 shadow 状态
        const originalShadowBlur = targetCtx.shadowBlur;
        const originalShadowColor = targetCtx.shadowColor;

        // 手机模式下缩小效果强度，避免叠加过曝
        const scaleFactor = isPhoneMode ? 0.5 : 1.0;
        // 保存当前缩放因子供子方法使用
        this._phoneScaleFactor = scaleFactor;

        // 绘制背景
        this.ctx.fillStyle = this.colorScheme.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 手机模式下强制跳过阴影效果以避免过曝
        const wasSkipShadow = this.skipShadow;
        if (isPhoneMode) {
            this.skipShadow = true;
        }

        // 手机模式下：分离背景效果和前景效果
        if (isPhoneMode) {
            // 分离渲染：先渲染非火柴人效果，再渲染火柴人
            
            // 背景季节效果（需要叠加显示太阳/云朵/雪花等）
            const bgSeasonModes = ['summer', 'winter', 'autumn', 'daytime'];
            const otherModes = this.activeModes.filter(m => 
                m !== 'runningstick' && !bgSeasonModes.includes(m)
            );
            const seasonModes = this.activeModes.filter(m => 
                bgSeasonModes.includes(m)
            );
            const stickMode = this.activeModes.find(m => m === 'runningstick');
            
            // 计算总效果数量，用于动态调整强度
            const totalModes = this.activeModes.length;
            // 效果越多，基础强度折扣越大（避免叠加过曝）
            const intensityFactor = Math.max(0.3, 1 - (totalModes - 1) * 0.2);
            const phoneScale = scaleFactor * intensityFactor;

            // 先渲染其他效果（使用 source-over）
            for (const mode of otherModes) {
                this.ctx.globalCompositeOperation = 'source-over';
                // 手机模式下跳过阴影效果以避免过曝
                if (this.skipShadow) {
                    this.ctx.shadowBlur = 0;
                }
                switch (mode) {
                    case 'waveform': this.renderWaveform(); break;
                    case 'bars': this.renderBars(); break;
                    case 'particles': this.renderParticles(); break;
                    case 'circle': this.renderCircle(); break;
                    case 'dots': this.renderDots(); break;
                    case 'reactive': this.renderReactive(); break;
                    case '3dwave': this.render3DWave(); break;
                    case 'shapes': this.renderShapes(); break;
                    case 'ancient': this.renderAncientPavilion(); break;
                    case 'imagewave': this.renderImageWave(); break;
                    case 'tiled': this.renderTiledPattern(); break;
                    case 'vortex': this.renderVortex(); break;
                    case 'bouncingball': this.renderBouncingBall(); break;
                    case 'spring': this.renderSpring(); break;
                }
            }

            // 再渲染背景季节效果（使用 screen 叠加，保持可见性）
            // 季节效果使用独立的强度调整，避免被 otherModes 的折扣影响
            const seasonCount = seasonModes.length;
            const seasonFactor = Math.max(0.4, 0.8 - (seasonCount - 1) * 0.15);
            const seasonScale = scaleFactor * seasonFactor;
            
            for (const mode of seasonModes) {
                // 手机模式下使用 source-over 代替 screen，避免多层半透明效果叠加过曝
                this.ctx.globalCompositeOperation = isPhoneMode ? 'source-over' : 'screen';
                // 手机模式下跳过阴影效果以避免过曝
                if (this.skipShadow) {
                    this.ctx.shadowBlur = 0;
                }
                switch (mode) {
                    case 'summer': this.renderSummer(seasonScale); break;
                    case 'winter': this.renderWinter(); break;
                    case 'autumn': this.renderAutumn(); break;
                    case 'daytime': this.renderDaytime(); break;
                }
            }

            // 最后渲染火柴人（在最上层，使用 source-over 避免覆盖其他效果）
            if (stickMode) {
                this.ctx.globalCompositeOperation = 'source-over';
                this.renderRunningStickmen();
            }
        } else {
            // 正常模式：按顺序渲染，使用 screen 叠加
            for (let i = 0; i < this.activeModes.length; i++) {
                const mode = this.activeModes[i];
                const isFirst = i === 0;
                this.ctx.globalCompositeOperation = isFirst ? 'source-over' : 'screen';

                switch (mode) {
                    case 'waveform': this.renderWaveform(); break;
                    case 'bars': this.renderBars(); break;
                    case 'particles': this.renderParticles(); break;
                    case 'circle': this.renderCircle(); break;
                    case 'dots': this.renderDots(); break;
                    case 'reactive': this.renderReactive(); break;
                    case '3dwave': this.render3DWave(); break;
                    case 'shapes': this.renderShapes(); break;
                    case 'ancient': this.renderAncientPavilion(); break;
                    case 'imagewave': this.renderImageWave(); break;
                    case 'tiled': this.renderTiledPattern(); break;
                    case 'vortex': this.renderVortex(); break;
                    case 'bouncingball': this.renderBouncingBall(); break;
                    case 'spring': this.renderSpring(); break;
                    case 'summer': this.renderSummer(scaleFactor); break;
                    case 'autumn': this.renderAutumn(); break;
                    case 'winter': this.renderWinter(); break;
                    case 'daytime': this.renderDaytime(); break;
                    case 'runningstick': this.renderRunningStickmen(); break;
                }
            }
        }

        // 恢复skipShadow状态
        this.skipShadow = wasSkipShadow;

        // 恢复shadow设置
        this.ctx.shadowBlur = originalShadowBlur;
        this.ctx.shadowColor = originalShadowColor;

        // 恢复原始画布状态
        this.ctx = originalCtx;
        this.width = originalWidth;
        this.height = originalHeight;
        this._phoneScaleFactor = 1.0;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        // 立即隐藏欢迎界面
        const welcome = document.getElementById('welcome');
        if (welcome && welcome.style.display !== 'none') {
            welcome.style.opacity = '0';
            setTimeout(() => {
                welcome.style.display = 'none';
            }, 300);
        }
        
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
        
        const now = performance.now();
        const layerCount = this.activeModes.length;
        
        // 初始化性能监控
        if (!this.perfFrames) this.initPerformanceMonitor();
        
        // 更新性能监控
        this.updatePerformanceMonitor();
        
        // 调试日志（仅首次渲染）
        if (!this._debugLogged) {
            console.log('[Visualizer] 动画循环运行中, activeModes:', this.activeModes);
            console.log('[Visualizer] 音频数据:', {
                bass: this.audioEngine.bassData.current,
                mid: this.audioEngine.midData.current,
                treble: this.audioEngine.trebleData.current
            });
            this._debugLogged = true;
        }
        
        // 性能优化：根据叠加层数动态调整帧率
        // 手机模式下不节流，因为只渲染小画布
        if (!this._isPhoneMode) {
            if (layerCount >= 3) {
                this.frameInterval = 1000 / 30; // 三层：30fps
                this.skipShadow = true;
                this.maxParticles = 150; // 减少粒子数量
            } else if (layerCount >= 2) {
                this.frameInterval = 1000 / 45; // 两层：45fps
                this.skipShadow = false;
                this.maxParticles = 250;
            } else {
                this.frameInterval = 1000 / 60; // 单层：60fps
                this.skipShadow = false;
                this.maxParticles = 500;
            }
        } else {
            // 手机模式下保持60fps以确保音画同步
            this.frameInterval = 1000 / 60;
            this.skipShadow = true;
            this.maxParticles = 100;
        }
        
        // 帧率控制：跳过过多帧
        // 如果 lastFrameTime 是 0（初始值），立即渲染
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = now - this.frameInterval;
        }
        if (now - this.lastFrameTime < this.frameInterval) {
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }
        this.lastFrameTime = now;
        
        // 音频数据由 AudioEngine 的独立循环更新，这里只处理峰值衰减
        this.audioEngine.decayPeaks(0.92);
        
        // 手机模式下只渲染手机画布，跳过主画布渲染以保持音画同步
        if (this._isPhoneMode && this.phoneCanvas && this.phoneCtx) {
            this.drawToCanvas(
                this.phoneCtx,
                this.phoneCanvas.width,
                this.phoneCanvas.height,
                true
            );
            this.animationId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        // 清空画布
        this.ctx.fillStyle = this.colorScheme.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        if (this.params.blur > 0 && layerCount < 2) {
            this.ctx.fillStyle = `rgba(${this.hexToRgb(this.colorScheme.bg)}, ${this.params.blur / 100})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 渲染图片背景（如果有）- 只在第一个模式渲染
        if (this.activeModes.indexOf(this.activeModes[0]) === 0) {
            this.renderImageBackground();
        }
        
        // 保存原始shadow设置
        const originalShadowBlur = this.ctx.shadowBlur;
        const originalShadowColor = this.ctx.shadowColor;
        
        // 根据激活的模式渲染（支持叠加）
        for (let i = 0; i < this.activeModes.length; i++) {
            const mode = this.activeModes[i];
            const isFirst = i === 0;
            
            // 设置混合模式用于叠加效果
            this.ctx.globalCompositeOperation = isFirst ? 'source-over' : 'screen';
            
            // 多层时简化渲染：跳过shadow
            if (this.skipShadow) {
                this.ctx.shadowBlur = 0;
            }
            
            switch (mode) {
                case 'waveform': this.renderWaveform(); break;
                case 'bars': this.renderBars(); break;
                case 'particles': this.renderParticles(); break;
                case 'circle': this.renderCircle(); break;
                case 'dots': this.renderDots(); break;
                case 'reactive': this.renderReactive(); break;
                case '3dwave': this.render3DWave(); break;
                case 'shapes': this.renderShapes(); break;
                case 'ancient': this.renderAncientPavilion(); break;
                case 'imagewave': this.renderImageWave(); break;
                case 'tiled': this.renderTiledPattern(); break;
                case 'vortex': this.renderVortex(); break;
                case 'bouncingball': this.renderBouncingBall(); break;
                case 'spring': this.renderSpring(); break;
                case 'summer': this.renderSummer(); break;
                case 'autumn': this.renderAutumn(); break;
                case 'winter': this.renderWinter(); break;
                case 'daytime': this.renderDaytime(); break;
                case 'runningstick': this.renderRunningStickmen(); break;
            }
        }
        
        // 恢复shadow设置
        this.ctx.shadowBlur = originalShadowBlur;
        this.ctx.shadowColor = originalShadowColor;
        
        // 重置混合模式
        this.ctx.globalCompositeOperation = 'source-over';
        
        this.history.push({
            bass: this.audioEngine.bassData.current,
            mid: this.audioEngine.midData.current,
            treble: this.audioEngine.trebleData.current
        });
        if (this.history.length > this.historyLength) {
            this.history.shift();
        }

        // 绘制手机画布（如果有）
        if (this.phoneCanvas && this.phoneCtx) {
            this.drawToCanvas(
                this.phoneCtx,
                this.phoneCanvas.width,
                this.phoneCanvas.height,
                this._isPhoneMode  // 传入手机模式标记
            );
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    // ============ 性能监控 ============
    initPerformanceMonitor() {
        this.perfFrames = 0;
        this.perfLastTime = performance.now();
        this.fps = 60;
    }

    updatePerformanceMonitor() {
        this.perfFrames++;
        const now = performance.now();
        const elapsed = now - this.perfLastTime;
        
        if (elapsed >= 1000) {
            this.fps = Math.round((this.perfFrames * 1000) / elapsed);
            this.perfFrames = 0;
            this.perfLastTime = now;
            
            // 在画布上显示 FPS（使用 strokeText 增加可见度）
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(15, 15, 120, 40);
            this.ctx.strokeStyle = this.fps < 30 ? '#ff4444' : this.fps < 50 ? '#ffaa00' : '#44ff44';
            this.ctx.lineWidth = 2;
            this.ctx.font = 'bold 20px monospace';
            this.ctx.strokeText(`FPS: ${this.fps}`, 20, 42);
            this.ctx.fillStyle = this.fps < 30 ? '#ff4444' : this.fps < 50 ? '#ffaa00' : '#44ff44';
            this.ctx.fillText(`FPS: ${this.fps}`, 20, 42);
            this.ctx.restore();
        }
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
        
        // 根据频率调整颜色
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
        
        // 图片光晕
        if (this.params.imageGlow > 0 && bass > 0.3) {
            this.ctx.save();
            this.ctx.globalAlpha = bass * 0.3;
            this.ctx.shadowColor = this.colorScheme.bass;
            this.ctx.shadowBlur = this.params.imageGlow * bass * 2;
            this.ctx.drawImage(this.customImage, x, y, w, h);
            this.ctx.restore();
        }
    }

    // ============ 渲染模式实现 ============

    renderWaveform() {
        const data = this.audioEngine.timeDomainData;
        const centerY = this.height / 2;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colorScheme.mid;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = this.colorScheme.mid;
        this.ctx.shadowBlur = this.params.glow;
        
        const sliceWidth = this.width / data.length;
        let x = 0;
        
        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = centerY + (v - 1) * this.height * 0.4 * this.params.sensitivity;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
            x += sliceWidth;
        }
        this.ctx.stroke();
        
        // 低频镜像
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colorScheme.bass;
        this.ctx.shadowColor = this.colorScheme.bass;
        x = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = centerY + (v - 1) * this.height * 0.2 * this.audioEngine.bassData.current * this.params.sensitivity;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
            x += sliceWidth;
        }
        this.ctx.stroke();
    }

    renderBars() {
        const data = this.audioEngine.frequencyData;
        const barCount = this.params.barCount;
        const barWidth = this.width / barCount - 2;
        
        const step = Math.floor(data.length / barCount);
        
        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
                sum += data[i * step + j];
            }
            const value = (sum / step / 255) * this.params.sensitivity;
            
            const gradient = this.ctx.createLinearGradient(0, this.height, 0, this.height - value * this.height);
            gradient.addColorStop(0, this.colorScheme.bass);
            gradient.addColorStop(0.5, this.colorScheme.mid);
            gradient.addColorStop(1, this.colorScheme.treble);
            
            const x = i * (barWidth + 2);
            const barHeight = Math.max(2, value * this.height * 0.8);
            
            this.ctx.fillStyle = gradient;
            this.ctx.shadowColor = this.colorScheme.mid;
            this.ctx.shadowBlur = this.params.glow * value;
            
            this.roundRect(x, this.height - barHeight, barWidth, barHeight, 4);
            
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.roundRect(x, this.height - barHeight, barWidth, 3, 2);
        }
    }

    renderParticles() {
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        
        const emitCount = Math.floor(mid * 20);
        for (let i = 0; i < emitCount && this.particles.length < this.maxParticles; i++) {
            const p = this.createParticle();
            p.vx = (Math.random() - 0.5) * 10 * bass;
            p.vy = (Math.random() - 0.5) * 10 * bass;
            p.life = this.params.particleLife * bass + 50;
            this.particles.push(p);
        }
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.x += p.vx * this.params.particleSpeed;
            p.y += p.vy * this.params.particleSpeed;
            p.vy += 0.05;
            
            p.life--;
            p.size *= 0.99;
            
            if (p.life <= 0 || p.size < 0.5 || p.x < 0 || p.x > this.width || p.y > this.height) {
                this.particles.splice(i, 1);
                continue;
            }
            
            const alpha = p.life / p.maxLife;
            const hue = (p.hue + this.audioEngine.trebleData.current * 60) % 360;
            
            this.ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
            this.ctx.shadowColor = `hsla(${hue}, 100%, 60%, 1)`;
            this.ctx.shadowBlur = this.params.glow * alpha;
            
            this.patternGenerators[p.pattern](this.ctx, p.x, p.y, p.size * 5, alpha * 0.5);
        }
        
        if (bass > 0.3) {
            const gradient = this.ctx.createRadialGradient(
                this.width / 2, this.height / 2, 0,
                this.width / 2, this.height / 2, bass * 200
            );
            gradient.addColorStop(0, this.colorScheme.bass);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = bass * 0.5;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.globalAlpha = 1;
        }
    }

    renderCircle() {
        const data = this.audioEngine.frequencyData;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const baseRadius = this.params.circleRadius;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        
        this.renderCircleRing(data, centerX, centerY, baseRadius, bass, 0);
        this.renderCircleRing(data, centerX, centerY, baseRadius * 0.65, mid, Math.PI / 6);
        this.renderCircleRing(data, centerX, centerY, baseRadius * 0.35, bass, Math.PI / 3);
        
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.5);
        gradient.addColorStop(0, this.colorScheme.bass);
        gradient.addColorStop(0.5, this.colorScheme.mid);
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 0.3 + bass * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, baseRadius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
    }

    renderCircleRing(data, cx, cy, radius, intensity, offset) {
        // 性能优化：减少分割段数，多层时进一步减少
        const segments = this.skipShadow ? 60 : 90;
        const step = Math.floor(data.length / segments);
        
        this.ctx.beginPath();
        
        for (let i = 0; i < segments; i++) {
            const dataIndex = Math.floor(i * step * 0.5);
            const value = data[dataIndex] / 255 * intensity;
            
            const angle = (i / segments) * Math.PI * 2 + this.params.rotation + offset;
            const r = radius + value * 80;
            
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        
        this.ctx.closePath();
        
        // 多层时不创建gradient，直接使用颜色
        if (this.skipShadow) {
            this.ctx.strokeStyle = this.colorScheme.mid;
            this.ctx.lineWidth = 1;
        } else {
            const gradient = this.ctx.createRadialGradient(cx, cy, radius - 20, cx, cy, radius + 80);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.5, this.colorScheme.mid);
            gradient.addColorStop(1, this.colorScheme.treble);
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = this.colorScheme.mid;
            this.ctx.shadowBlur = this.params.glow * intensity;
        }
        this.ctx.stroke();
        
        if (!this.skipShadow) {
            this.ctx.fillStyle = `rgba(${this.hexToRgb(this.colorScheme.bass)}, ${0.1 * intensity})`;
            this.ctx.fill();
        }
        
        this.params.rotation += 0.002 * intensity;
    }

    renderDots() {
        const data = this.audioEngine.frequencyData;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        // 性能优化：减少点阵数量，多层时进一步减少
        const cols = this.skipShadow ? 16 : 24;
        const rows = this.skipShadow ? 8 : 12;
        const cellWidth = this.width / cols;
        const cellHeight = this.height / rows;
        const dotSize = this.params.dotSize;
        
        const segmentSize = Math.floor(data.length / (cols * 2));
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const index = (i * rows + j * 4) % data.length;
                let value = data[index] / 255;
                
                const distFromCenter = Math.sqrt(
                    Math.pow((i - cols / 2) / (cols / 2), 2) + 
                    Math.pow((j - rows / 2) / (rows / 2), 2)
                );
                
                if (distFromCenter < 0.5) value += bass * (1 - distFromCenter * 2);
                if (distFromCenter >= 0.3 && distFromCenter < 0.7) value += mid * (1 - Math.abs(distFromCenter - 0.5) * 5);
                if (distFromCenter >= 0.6) value += treble * distFromCenter;
                
                value = Math.min(1, value * this.params.sensitivity);
                
                const x = i * cellWidth + cellWidth / 2;
                const y = j * cellHeight + cellHeight / 2;
                const size = dotSize + value * 8;
                
                const hue = 200 + value * 60;
                const color = `hsl(${hue}, 100%, ${50 + value * 30}%)`;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fillStyle = color;
                // shadow已在animate中统一处理
                this.ctx.fill();
                
                // 多层时跳过额外光晕
                if (!this.skipShadow && value > 0.5) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${(value - 0.5) * 0.3})`;
                    this.ctx.fill();
                }
            }
        }
    }

    renderReactive() {
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        // 全局填充效果（手机模式下降低透明度避免过曝）
        const fillAlpha = this.skipShadow ? bass * 0.2 : bass * 0.4;
        if (bass > 0.4) {
            const gradient = this.ctx.createRadialGradient(
                this.width / 2, this.height / 2, 0,
                this.width / 2, this.height / 2, this.width * bass
            );
            gradient.addColorStop(0, this.colorScheme.bass);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = fillAlpha;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.globalAlpha = 1;
        }
        
        this.renderEdgeLights(bass, mid, treble);
        this.renderCenterEffect(bass, mid, treble);
        this.renderDistortedGrid(bass, mid);
    }

    renderEdgeLights(bass, mid, treble) {
        const thickness = 20 + bass * 40;
        const glow = this.params.glow * bass;
        
        const gradientTop = this.ctx.createLinearGradient(0, 0, 0, thickness);
        gradientTop.addColorStop(0, this.colorScheme.bass);
        gradientTop.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradientTop;
        if (!this.skipShadow) {
            this.ctx.shadowColor = this.colorScheme.bass;
            this.ctx.shadowBlur = glow;
        }
        this.ctx.fillRect(0, 0, this.width, thickness);
        
        const gradientBottom = this.ctx.createLinearGradient(0, this.height - thickness, 0, this.height);
        gradientBottom.addColorStop(0, 'transparent');
        gradientBottom.addColorStop(1, this.colorScheme.treble);
        this.ctx.fillStyle = gradientBottom;
        if (!this.skipShadow) {
            this.ctx.shadowColor = this.colorScheme.treble;
        }
        this.ctx.fillRect(0, this.height - thickness, this.width, thickness);
        
        const gradientLeft = this.ctx.createLinearGradient(0, 0, thickness, 0);
        gradientLeft.addColorStop(0, this.colorScheme.mid);
        gradientLeft.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradientLeft;
        if (!this.skipShadow) {
            this.ctx.shadowColor = this.colorScheme.mid;
            this.ctx.shadowBlur = glow * mid;
        }
        this.ctx.fillRect(0, 0, thickness, this.height);
        
        const gradientRight = this.ctx.createLinearGradient(this.width - thickness, 0, this.width, 0);
        gradientRight.addColorStop(0, 'transparent');
        gradientRight.addColorStop(1, this.colorScheme.mid);
        this.ctx.fillStyle = gradientRight;
        if (!this.skipShadow) {
            this.ctx.shadowBlur = glow * mid;
        }
        this.ctx.fillRect(this.width - thickness, 0, thickness, this.height);
    }

    renderCenterEffect(bass, mid, treble) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        
        const outerRadius = maxRadius * (0.8 + bass * 0.4);
        const gradient1 = this.ctx.createRadialGradient(centerX, centerY, outerRadius - 30, centerX, centerY, outerRadius);
        gradient1.addColorStop(0, 'transparent');
        gradient1.addColorStop(0.5, this.colorScheme.bass);
        gradient1.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = gradient1;
        this.ctx.lineWidth = 3 + bass * 5;
        if (!this.skipShadow) {
            this.ctx.shadowColor = this.colorScheme.bass;
            this.ctx.shadowBlur = this.params.glow * bass;
        }
        this.ctx.stroke();
        
        const midRadius = maxRadius * (0.5 + mid * 0.3);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, midRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.colorScheme.mid;
        this.ctx.lineWidth = 2 + mid * 3;
        if (!this.skipShadow) {
            this.ctx.shadowColor = this.colorScheme.mid;
        }
        this.ctx.stroke();
        
        const coreRadius = 20 + treble * 30;
        const coreGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.3, this.colorScheme.treble);
        coreGradient.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = coreGradient;
        this.ctx.fill();
    }

    renderDistortedGrid(bass, mid) {
        const gridSize = 50;
        const offset = bass * 20;
        
        this.ctx.strokeStyle = `rgba(255,255,255,0.05)`;
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 0;
        
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            for (let x = 0; x < this.width; x += 10) {
                const wave = Math.sin((x + y) * 0.02 + Date.now() * 0.002) * offset;
                if (x === 0) this.ctx.moveTo(x, y + wave);
                else this.ctx.lineTo(x, y + wave);
            }
            this.ctx.stroke();
        }
        
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            for (let y = 0; y < this.height; y += 10) {
                const wave = Math.sin((x + y) * 0.02 + Date.now() * 0.002) * offset;
                if (y === 0) this.ctx.moveTo(x + wave, y);
                else this.ctx.lineTo(x + wave, y);
            }
            this.ctx.stroke();
        }
    }

    render3DWave() {
        const data = this.audioEngine.frequencyData;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        
        // 性能优化：减少行数，多层时进一步减少
        const rows = this.skipShadow ? 8 : 12;
        const cols = Math.floor(data.length / 4);
        const cellWidth = this.width / cols;
        const cellHeight = this.height / rows;
        
        this.ctx.save();
        
        for (let row = rows - 1; row >= 0; row--) {
            const z = row / rows;
            const alpha = 0.1 + z * 0.4;
            const scale = 0.5 + z * 0.5;
            
            const offsetY = this.height * 0.6 - row * cellHeight * scale;
            
            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(${this.hexToRgb(this.colorScheme.mid)}, ${alpha})`;
            this.ctx.lineWidth = 1 + z * 2;
            
            // 性能优化：跳帧采样
            const step = this.skipShadow ? 4 : 2;
            for (let i = 0; i < cols; i += step) {
                const dataIndex = Math.floor(i * 0.5) % data.length;
                const value = data[dataIndex] / 255;
                
                const x = i * cellWidth;
                const wave = Math.sin(i * 0.1 + Date.now() * 0.003) * 20 * bass;
                const y = offsetY - value * this.height * 0.3 * scale - wave;
                
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    // ============ 新增图案模式 ============

    /**
     * 图案模式 - 在屏幕上绘制各种形状
     */
    renderShapes() {
        const data = this.audioEngine.frequencyData;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        const shapes = ['heart', 'star', 'hexagon', 'triangle', 'diamond', 'ring', 'cross', 'spiral'];
        const cols = 8;
        const rows = 5;
        const cellWidth = this.width / cols;
        const cellHeight = this.height / rows;
        
        const step = Math.floor(data.length / (cols * rows));
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const index = (i * rows + j) * step;
                let value = data[index] / 255;
                value = Math.min(1, value * this.params.sensitivity);
                
                // 随时间动画
                const animOffset = Math.sin(Date.now() * 0.003 + i * j) * 0.2;
                value = Math.max(0, value + animOffset * bass);
                
                const x = i * cellWidth + cellWidth / 2;
                const y = j * cellHeight + cellHeight / 2;
                const size = 20 + value * 30;
                
                // 根据频率选择颜色
                if (value > 0.7) {
                    this.ctx.fillStyle = this.colorScheme.bass;
                    this.ctx.shadowColor = this.colorScheme.bass;
                } else if (value > 0.4) {
                    this.ctx.fillStyle = this.colorScheme.mid;
                    this.ctx.shadowColor = this.colorScheme.mid;
                } else {
                    this.ctx.fillStyle = this.colorScheme.treble;
                    this.ctx.shadowColor = this.colorScheme.treble;
                }
                
                this.ctx.shadowBlur = this.params.glow * value;
                
                const shapeIndex = (i + j) % shapes.length;
                this.patternGenerators[shapes[shapeIndex]](this.ctx, x, y, size, value);
            }
        }
    }

    /**
     * 古建筑模式 - 中国传统楼阁式建筑
     * 音频驱动：bass=缩放，mid=层间震动，treble=亮度
     * 效果叠加：旋转/外延光/雪花（快捷键 R/O/T 切换）
     */
    renderAncientPavilion() {
        // 手机模式下跳过背景绘制，避免覆盖其他效果
        const isPhoneMode = this._phoneScaleFactor < 1;
        
        // 性能优化：多层时简化渲染
        const isSimplified = this.skipShadow;
        
        // 初始化效果状态
        if (!this.ancientEffects) {
            this.ancientEffects = { rotation: false, outline: true, particles: true };
        }
        
        // 初始化雪花系统 - 性能优化：减少雪花数量
        if (!this.snowflakes) {
            this.snowflakes = [];
            const snowCount = isSimplified ? 60 : 120;
            for (let i = 0; i < snowCount; i++) {
                this.snowflakes.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 3 + 1.5,
                    speedY: Math.random() * 0.6 + 0.4,
                    speedX: Math.random() * 0.3 + 0.1,
                    wobble: Math.random() * Math.PI * 2,
                    wobbleSpeed: Math.random() * 0.002 + 0.001,
                    opacity: Math.random() * 0.5 + 0.3
                });
            }
        }
        
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;
        
        const cx = this.width / 2;
        const cy = this.height / 2;
        
        // 音频参数
        const beatPulse = beat.isBeat ? beat.beatIntensity : 0;
        const onsetPulse = note.isOnset ? note.onsetIntensity : 0;
        const brightness = 0.5 + treble * 0.3 + beatPulse * 0.2 + onsetPulse * 0.1;
        const hue = 35 + treble * 15;
        
        // 建筑参数
        const baseWidth = Math.min(this.width * 0.35, 280);
        const floorCount = 6;
        const floorHeight = baseWidth * 0.26;
        const roofHeight = floorHeight * 0.55;
        const totalHeight = floorCount * floorHeight + roofHeight;
        const groundY = this.height * 0.82; // 统一地平线高度
        
        // ============ 音符驱动的光效切换 ============
        if (this.ancientLayerIndex === undefined) this.ancientLayerIndex = 0;
        if (this.lastNoteCount === undefined) this.lastNoteCount = 0;
        if (this.noteTimer === undefined) this.noteTimer = 0;
        
        const noteCountNow = note.noteCount || 0;
        if (noteCountNow > this.lastNoteCount) {
            this.ancientLayerIndex = (this.ancientLayerIndex + 1) % floorCount;
            this.noteTimer = 10;
            console.log('[Visualizer] 楼层切换! now:', noteCountNow, 'last:', this.lastNoteCount, 'layer:', this.ancientLayerIndex);
        }
        this.lastNoteCount = noteCountNow;
        
        if (this.noteTimer > 0) this.noteTimer--;
        
        // currentLayer作为当前层索引，供后续计算使用
        const currentLayer = this.ancientLayerIndex;
        
        // 性能优化：多层渲染时保留所有楼层，只简化雪花和阴影
        const actualFloorCount = floorCount;
        
        // 计算每层的亮度（当前层=1，其他层=暗淡值）
        const floorBrightness = [];
        for (let f = 0; f < floorCount; f++) {
            if (f === currentLayer) {
                // 当前层：基础亮度 + 音符脉冲
                const notePulse = this.noteTimer > 0 ? 0.5 : 0;
                floorBrightness[f] = 1 + notePulse; // 1.0 ~ 1.5
            } else {
                // 其他层根据与当前层的距离暗淡
                const dist = Math.abs(f - currentLayer);
                floorBrightness[f] = Math.max(0.08, 0.25 - dist * 0.06);
            }
        }
        
        // 屋顶和宝顶取塔尖层的亮度
        const roofBrightness = floorBrightness[floorCount - 1];
        
        // 台阶亮度（跟随塔底）
        const stepBrightness = floorBrightness[0] * 0.8;
        
        // ============ 旋转效果：左20° → 0° → 右20° → 0° ============
        let rotation = 0;
        if (this.ancientEffects.rotation) {
            // 节拍驱动旋转速度，节奏越强转得越快
            const rotSpeed = 0.0008 + beatPulse * 0.003 + mid * 0.001;
            const rotAngle = 20 * Math.PI / 180; // 20度
            // 完整的左右摇摆周期
            rotation = Math.sin(Date.now() * rotSpeed) * rotAngle * (0.5 + beatPulse * 0.5);
        }
        
        // 保存状态并应用旋转变换
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(rotation);
        this.ctx.translate(-cx, -cy);
        
        // ============ 绘制台阶 ============
        const stepWidth = baseWidth * 1.5;
        const stepCount = 4;
        const stepHeight = 14;
        for (let s = 0; s < stepCount; s++) {
            const sy = groundY - stepHeight * s;
            const sw = stepWidth * (1 - s * 0.12);
            const stepB = stepBrightness * (1 - s * 0.1);
            
            this.ctx.strokeStyle = `hsla(${hue}, 60%, ${40 + stepB * 40}%, ${0.4 + stepB * 0.4})`;
            this.ctx.lineWidth = 1.5 + bass * 1.5 + stepB * 2;
            this.ctx.shadowBlur = stepB * 12;
            this.ctx.shadowColor = `hsl(${hue + 15}, 100%, 60%)`;
            
            this.ctx.strokeRect(cx - sw/2, sy, sw, stepHeight);
        }
        
        // 绘制主体建筑
        const buildingBottom = groundY - stepHeight * stepCount;
        const buildingTop = buildingBottom - totalHeight;
        
        // ============ 逐层绘制 ============
        for (let f = 0; f < actualFloorCount; f++) {
            const y1 = buildingBottom - floorHeight * f;
            const y2 = y1 - floorHeight;
            const widthRatio = 1 - f * 0.07;
            const fw = baseWidth * widthRatio;
            
            const fBass = bass * (1 - f * 0.08);
            const fMid = mid * (1 - f * 0.06);
            const fb = floorBrightness[f]; // 该层亮度
            
            // 柱子和横梁
            const colCount = 8;
            const colSpacing = fw / (colCount - 1);
            
            // 绘制立柱
            for (let c = 0; c < colCount; c++) {
                const colX = cx - fw/2 + c * colSpacing;
                
                this.ctx.strokeStyle = `hsla(${hue + fb * 20}, 70%, ${40 + fb * 45}%, ${0.5 + fb * 0.4})`;
                this.ctx.shadowBlur = fb * 18 + beatPulse * 8;
                this.ctx.shadowColor = `hsl(${hue + 30}, 100%, ${50 + fb * 35}%)`;
                this.ctx.lineWidth = 1.8 + fBass * 2 + fb * 2;
                
                this.ctx.beginPath();
                this.ctx.moveTo(colX, y1);
                this.ctx.lineTo(colX, y2);
                this.ctx.stroke();
            }
            
            // 上下横梁
            this.ctx.strokeStyle = `hsla(${hue}, 65%, ${40 + fb * 40}%, ${0.5 + fb * 0.4})`;
            this.ctx.lineWidth = 1.5 + fBass * 2 + fb * 1.5;
            this.ctx.shadowBlur = fb * 10 + beatPulse * 5;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - fw/2, y1);
            this.ctx.lineTo(cx + fw/2, y1);
            this.ctx.moveTo(cx - fw/2, y2);
            this.ctx.lineTo(cx + fw/2, y2);
            this.ctx.stroke();
            
            // 门窗
            if (f === 0) {
                const doorWidth = fw * 0.3;
                const doorHeight = floorHeight * 0.75;
                this.ctx.strokeStyle = `hsla(${hue + 10}, 60%, ${35 + fb * 40}%, ${0.4 + fb * 0.4})`;
                this.ctx.lineWidth = 1.5 + fb;
                this.ctx.shadowBlur = fb * 8;
                this.ctx.strokeRect(cx - doorWidth/2, y1 - doorHeight, doorWidth, doorHeight);
            } else {
                const winWidth = fw * 0.18;
                const winHeight = floorHeight * 0.45;
                this.ctx.strokeStyle = `hsla(${hue + 10}, 60%, ${35 + fb * 40}%, ${0.3 + fb * 0.4})`;
                this.ctx.lineWidth = 1 + fb;
                this.ctx.shadowBlur = fb * 6;
                for (let w = 0; w < 2; w++) {
                    const winX = cx - fw/4 + w * fw/2 - winWidth/2;
                    this.ctx.strokeRect(winX, y1 - winHeight, winWidth, winHeight);
                }
            }
            
            // 斗拱层
            if (f < floorCount - 1) {
                const bracketH = 10 + fMid * 5;
                
                for (let b = 0; b < 3; b++) {
                    const by = y2 + b * 4;
                    this.ctx.strokeStyle = `hsla(${hue + 10}, 70%, ${45 + fb * 35}%, ${0.4 + fb * 0.4})`;
                    this.ctx.lineWidth = 1.2 + fBass * 1.5 + fb;
                    this.ctx.shadowBlur = fb * 8;
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx - fw/2 - 6, by);
                    this.ctx.lineTo(cx + fw/2 + 6, by);
                    this.ctx.stroke();
                }
                
                // 檐口飞出
                const eaveExtend = 18 + fMid * 10;
                this.ctx.beginPath();
                this.ctx.moveTo(cx - fw/2, y2 + bracketH);
                this.ctx.lineTo(cx - fw/2 - eaveExtend, y2 + bracketH + 6);
                this.ctx.moveTo(cx + fw/2, y2 + bracketH);
                this.ctx.lineTo(cx + fw/2 + eaveExtend, y2 + bracketH + 6);
                this.ctx.stroke();
            }
            
            // 节拍脉冲（亮起层专属）
            if (beatPulse > 0.2 && fb > 0.6) {
                this.ctx.strokeStyle = `hsla(${hue + 25}, 100%, 75%, ${beatPulse * 0.8})`;
                this.ctx.lineWidth = 2 + beatPulse * 3;
                this.ctx.shadowBlur = 15 + beatPulse * 20;
                this.ctx.shadowColor = `hsl(${hue + 40}, 100%, 80%)`;
                this.ctx.strokeRect(cx - fw/2 - 8, y2 - 8, fw + 16, floorHeight + 16);
            }
        }
        
        // ============ 屋顶 ============
        const roofY = buildingBottom - floorCount * floorHeight;
        const roofWidth = baseWidth * (1 - (floorCount - 1) * 0.07) * 1.35;
        const roofPeak = roofY - roofHeight;
        
        this.ctx.strokeStyle = `hsla(${hue + roofBrightness * 15}, 80%, ${50 + roofBrightness * 40}%, ${0.6 + roofBrightness * 0.4})`;
        this.ctx.lineWidth = 2.5 + bass * 2.5 + roofBrightness * 2;
        this.ctx.shadowBlur = roofBrightness * 15 + beatPulse * 10;
        this.ctx.shadowColor = `hsl(${hue + 25}, 100%, 65%)`;
        
        // 屋顶轮廓
        this.ctx.beginPath();
        this.ctx.moveTo(cx - roofWidth/2, roofY);
        this.ctx.lineTo(cx - roofWidth/4, roofY - roofHeight * 0.35);
        this.ctx.lineTo(cx, roofPeak);
        this.ctx.lineTo(cx + roofWidth/4, roofY - roofHeight * 0.35);
        this.ctx.lineTo(cx + roofWidth/2, roofY);
        this.ctx.stroke();
        
        // 屋顶瓦垄
        const tileLines = 10;
        for (let t = 0; t < tileLines; t++) {
            this.ctx.strokeStyle = `hsla(${hue}, 55%, ${40 + roofBrightness * 30}%, ${0.3 + roofBrightness * 0.4})`;
            this.ctx.lineWidth = 1 + roofBrightness * 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - roofWidth/2 + t * (roofWidth / (tileLines - 1)), roofY);
            this.ctx.lineTo(cx, roofPeak);
            this.ctx.stroke();
        }
        
        // 脊兽和宝顶
        const ridgeY = roofPeak - 6;
        const ridgeHeight = 15 + treble * 8 + beatPulse * 6;
        
        this.ctx.strokeStyle = `hsla(${hue + 15}, 90%, ${55 + roofBrightness * 35}%, ${0.6 + roofBrightness * 0.4})`;
        this.ctx.lineWidth = 2 + bass * 2 + roofBrightness * 2;
        this.ctx.shadowBlur = roofBrightness * 20 + beatPulse * 10;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, ridgeY);
        this.ctx.lineTo(cx, ridgeY - ridgeHeight);
        this.ctx.stroke();
        
        const topRadius = 6 + treble * 3 + beatPulse * 2 + roofBrightness * 4;
        this.ctx.fillStyle = `hsla(${hue + 25}, 100%, ${55 + roofBrightness * 35}%, ${0.7 + roofBrightness * 0.3})`;
        this.ctx.shadowBlur = 15 + roofBrightness * 25 + beatPulse * 15;
        this.ctx.beginPath();
        this.ctx.arc(cx, ridgeY - ridgeHeight, topRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore(); // 结束旋转
        
        // ============ 雪花飘落效果（斜角度缓慢飘雪） ============
        if (this.ancientEffects.particles) {
            const snowSpeedMult = 1 + beatPulse * 0.1 + onsetPulse * 0.05;
            
            for (let i = 0; i < this.snowflakes.length; i++) {
                const snow = this.snowflakes[i];
                
                snow.wobble += snow.wobbleSpeed;
                snow.y += snow.speedY * snowSpeedMult;
                snow.x += snow.speedX * snowSpeedMult;
                snow.x += Math.sin(snow.wobble) * 0.3;
                
                const flicker = note.isOnset ? onsetPulse * 0.3 : 0;
                const alpha = snow.opacity * brightness * (0.8 + flicker);
                
                // 性能优化：简化雪花为简单圆点，多层时跳过
                const size = snow.size * (1 + treble * 0.3);
                
                if (isSimplified) {
                    // 多层时：简单圆点
                    this.ctx.fillStyle = `hsla(210, 30%, 98%, ${alpha})`;
                    this.ctx.beginPath();
                    this.ctx.arc(snow.x, snow.y, size, 0, Math.PI * 2);
                    this.ctx.fill();
                } else {
                    // 单层时：绘制六角雪花
                    this.ctx.save();
                    this.ctx.translate(snow.x, snow.y);
                    this.ctx.shadowBlur = snow.size * 5;
                    this.ctx.shadowColor = `hsla(200, 100%, 95%, ${alpha * 0.7})`;
                    this.ctx.fillStyle = `hsla(210, 30%, 98%, ${alpha})`;
                    this.ctx.strokeStyle = `hsla(220, 50%, 92%, ${alpha * 0.9})`;
                    this.ctx.lineWidth = 0.5;
                    
                    this.ctx.beginPath();
                    for (let arm = 0; arm < 6; arm++) {
                        const angle = (arm / 6) * Math.PI * 2;
                        this.ctx.moveTo(0, 0);
                        this.ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
                        const branchX = Math.cos(angle) * size * 0.6;
                        const branchY = Math.sin(angle) * size * 0.6;
                        this.ctx.moveTo(branchX, branchY);
                        this.ctx.lineTo(branchX + Math.cos(angle + 0.5) * size * 0.3, branchY + Math.sin(angle + 0.5) * size * 0.3);
                        this.ctx.moveTo(branchX, branchY);
                        this.ctx.lineTo(branchX + Math.cos(angle - 0.5) * size * 0.3, branchY + Math.sin(angle - 0.5) * size * 0.3);
                    }
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.restore();
                }
                
                if (snow.y > this.height + 20) {
                    snow.y = -20;
                    snow.x = Math.random() * this.width;
                }
                if (snow.x > this.width + 20) {
                    snow.x = -20;
                    snow.y = Math.random() * this.height;
                }
            }
        }
        
        // ============ 地面反光（手机模式下不绘制） ============
        if (!isPhoneMode) {
            this.ctx.shadowBlur = 0;
            const glow = this.ctx.createRadialGradient(cx, groundY + 30, 0, cx, groundY + 30, baseWidth * 1.8);
            glow.addColorStop(0, `hsla(${hue}, 80%, 60%, ${brightness * 0.15 + stepBrightness * 0.1})`);
            glow.addColorStop(0.5, `hsla(${hue}, 65%, 45%, ${brightness * 0.06})`);
            glow.addColorStop(1, 'transparent');
            this.ctx.fillStyle = glow;
            this.ctx.fillRect(cx - baseWidth * 1.8, groundY, baseWidth * 3.6, 80);
        }
        
        // ============ 效果指示器 ============
        const indicatorY = groundY + 55;
        let indicatorText = '古建筑';
        if (this.ancientEffects.rotation) indicatorText += ' | 摇摆';
        if (this.ancientEffects.outline) indicatorText += ' | 音符光';
        if (this.ancientEffects.particles) indicatorText += ' | 飘雪';
        indicatorText += ' (R/O/T切换)';
        
        this.ctx.shadowBlur = 5 + brightness * 6;
        this.ctx.shadowColor = `hsl(${hue}, 80%, 65%)`;
        this.ctx.font = `12px "Microsoft YaHei", sans-serif`;
        this.ctx.fillStyle = `hsla(${hue}, 70%, ${65 + brightness * 15}%, ${brightness * 0.7})`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(indicatorText, cx, indicatorY);
        
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.textAlign = 'left';
    }

    /**
     * 图片波浪模式 - 图片随音频扭曲
     */
    renderImageWave() {
        if (!this.customImage) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('请上传图片以使用此模式', this.width / 2, this.height / 2);
            return;
        }
        
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        
        const w = this.customImage.width;
        const h = this.customImage.height;
        const x = (this.width - w) / 2;
        const y = (this.height - h) / 2;
        
        // 切片波浪效果
        const slices = 20;
        const sliceHeight = h / slices;
        
        for (let i = 0; i < slices; i++) {
            const sliceY = y + i * sliceHeight;
            const wave = Math.sin(i * 0.3 + Date.now() * 0.005) * bass * 30;
            const scale = 1 + Math.sin(i * 0.5 + Date.now() * 0.003) * mid * 0.1;
            
            this.ctx.save();
            this.ctx.translate(x + wave, sliceY);
            this.ctx.scale(scale, 1);
            this.ctx.drawImage(this.customImage, 0, i * sliceHeight, w, sliceHeight, 0, 0, w, sliceHeight);
            this.ctx.restore();
        }
        
        // 垂直扫描线
        this.renderWaveScanLines(bass, mid);
    }

    renderWaveScanLines(bass, mid) {
        const lines = 10;
        const spacing = this.width / lines;
        
        for (let i = 0; i < lines; i++) {
            const lineX = (i * spacing + Date.now() * bass * 2) % (this.width + 100) - 50;
            const alpha = 0.3 + bass * 0.3;
            
            const gradient = this.ctx.createLinearGradient(lineX - 20, 0, lineX + 20, 0);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(lineX - 20, 0, 40, this.height);
        }
    }

    /**
     * 平铺图案模式 - 使用上传的图片作为平铺纹理
     */
    renderTiledPattern() {
        if (!this.customImage) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('请上传图片以使用此模式', this.width / 2, this.height / 2);
            return;
        }
        
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        const w = this.customImage.width;
        const h = this.customImage.height;
        
        // 缩放和位置动画
        const scale = 1 + bass * 0.5;
        const offsetX = Math.sin(Date.now() * 0.001) * 50 * bass;
        const offsetY = Math.cos(Date.now() * 0.001) * 50 * bass;
        
        const drawX = (this.width - w * scale) / 2 + offsetX;
        const drawY = (this.height - h * scale) / 2 + offsetY;
        
        // 颜色滤镜
        this.ctx.save();
        this.ctx.filter = `hue-rotate(${bass * 120}deg) saturate(${1 + mid}) brightness(${1 + treble * 0.5})`;
        this.ctx.globalAlpha = 0.7 + bass * 0.3;
        
        // 平铺绘制
        const tileSize = Math.min(w, h) * scale;
        for (let tx = -tileSize; tx < this.width + tileSize; tx += tileSize) {
            for (let ty = -tileSize; ty < this.height + tileSize; ty += tileSize) {
                this.ctx.drawImage(this.customImage, drawX + tx, drawY + ty, tileSize, tileSize);
            }
        }
        
        this.ctx.restore();
        
        // 网格叠加
        this.renderTileGrid(bass);
    }

    renderTileGrid(bass) {
        const gridSize = 80 + bass * 40;
        
        this.ctx.strokeStyle = `rgba(255,255,255,${0.1 + bass * 0.2})`;
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * 漩涡模式 - 螺旋图案
     */
    renderVortex() {
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        
        // 性能优化：减少点数
        const arms = this.skipShadow ? 2 : 4;
        const points = this.skipShadow ? 80 : 150;
        
        for (let arm = 0; arm < arms; arm++) {
            const armOffset = (arm / arms) * Math.PI * 2;
            
            this.ctx.beginPath();
            
            for (let i = 0; i < points; i++) {
                const t = i / points;
                const angle = t * Math.PI * 6 + armOffset + Date.now() * 0.002 * (1 + bass);
                const radius = t * maxRadius * (1 + mid * 0.3);
                
                const wave = Math.sin(t * 20 + Date.now() * 0.01) * bass * 30;
                
                const x = centerX + Math.cos(angle) * (radius + wave);
                const y = centerY + Math.sin(angle) * (radius + wave);
                
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            
            const hue = (arm / arms * 120 + bass * 60) % 360;
            this.ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${0.8 - bass * 0.3})`;
            this.ctx.lineWidth = 2 + treble * 3;
            // shadow已在animate中统一处理
            this.ctx.stroke();
        }
        
        // 中心光球
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50 + bass * 50);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, this.colorScheme.mid);
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 0.5 + bass * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 50 + bass * 50, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        
        // 漩涡粒子 - 性能优化
        this.renderVortexParticles(bass, mid);
    }

    renderVortexParticles(bass, mid) {
        const count = this.skipShadow ? Math.floor(mid * 25) : Math.floor(mid * 50);
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = t * Math.PI * 8 + Date.now() * 0.003;
            const radius = t * Math.min(this.width, this.height) * 0.4;
            const wobble = Math.sin(Date.now() * 0.01 + i) * 20 * bass;

            const x = this.width / 2 + Math.cos(angle) * (radius + wobble);
            const y = this.height / 2 + Math.sin(angle) * (radius + wobble);

            const size = 2 + mid * 5;

            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${(t * 360 + Date.now() * 0.1) % 360}, 100%, 70%, ${0.5 + bass * 0.5})`;
            this.ctx.fill();
        }
    }


    initBouncingBall() {
        this.ball = {
            x: this.width / 2,
            y: this.height / 2,
            vx: 5,
            vy: 3,
            radius: 8,      // 基础大小
            radiusVel: 0,   // 半径变化速度（用于平滑插值）
            hue: 0
        };
        this.ballRadiusVel = 0; // 同步到顶层属性
    }

    renderBouncingBall() {
        // 初始化球
        if (!this.ball) {
            this.initBouncingBall();
        }

        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // === 节拍驱动：大幅跳跃（低频冲击感）===
        if (beat.isBeat) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 14 + beat.beatIntensity * 22;
            this.ball.vx = this.ball.vx * 0.3 + Math.cos(angle) * speed;
            this.ball.vy = this.ball.vy * 0.3 + Math.sin(angle) * speed - 6;
        }

        // === 音符驱动：高频微弹（每个音符快速响应）===
        if (note.isOnset) {
            // A频带（低中频/鼓）：向心力场，压缩后弹开
            const aImpulse = note.onsetIntensity * 5;
            this.ball.vx += (Math.random() - 0.5) * aImpulse;
            this.ball.vy += (Math.random() - 0.5) * aImpulse;

            // B频带（中高频/人声）：小幅度半径冲击
            const bImpulse = note.onsetIntensity * 2;
            this.ball.radius += bImpulse;          // 立即膨胀
            this.ballRadiusVel += bImpulse * 2;    // 叠加速度
        }

        // === 频率驱动：速度场 ===
        const freqBoost = bass * 3 + treble * 2.5 + mid * 1;
        const speedMult = 1 + freqBoost;
        const wobble = treble * 1.5;
        const wobbleX = (Math.random() - 0.5) * wobble;
        const wobbleY = (Math.random() - 0.5) * wobble * 0.5;
        this.ball.x += (this.ball.vx + wobbleX) * speedMult * 0.5;
        this.ball.y += (this.ball.vy + wobbleY) * speedMult * 0.5;

        // === 边界碰撞反弹 ===
        const elasticity = 0.75 + beat.beatIntensity * 0.2;
        const margin = this.ball.radius;
        if (this.ball.x < margin) { this.ball.x = margin; this.ball.vx = Math.abs(this.ball.vx) * elasticity; }
        if (this.ball.x > this.width - margin) { this.ball.x = this.width - margin; this.ball.vx = -Math.abs(this.ball.vx) * elasticity; }
        if (this.ball.y < margin) { this.ball.y = margin; this.ball.vy = Math.abs(this.ball.vy) * elasticity; }
        if (this.ball.y > this.height - margin) { this.ball.y = this.height - margin; this.ball.vy = -Math.abs(this.ball.vy) * elasticity; }

        // === 重力下坠 ===
        this.ball.vy += 0.25 + bass * 0.3;

        // === 持续随机抖动 ===
        if (Math.random() < 0.15) {
            this.ball.vx += (Math.random() - 0.5) * (1 + treble * 3);
            this.ball.vy += (Math.random() - 0.5) * (1 + bass * 2);
        }

        // === 摩擦力 ===
        this.ball.vx *= 0.992;
        this.ball.vy *= 0.992;

        // === 球体大小：节拍+音符双驱动 + 平滑插值 ===
        const baseRadius = 8;
        const energy = (bass + mid + treble) / 3;

        // 节拍驱动：大幅扩张（低频爆发感）
        const beatScale = beat.isBeat
            ? (beat.beatIntensity * 3 + bass * 4)
            : 0;

        // 音符驱动：中高频持续脉冲
        const noteScale = note.onsetIntensity * 2 + mid * 1.5;

        const targetRadius = baseRadius * (1 + energy * 1.5 + beatScale + noteScale);
        const smoothing = 0.2 + treble * 0.1;
        this.ballRadiusVel += (targetRadius - this.ball.radius) * smoothing;
        this.ballRadiusVel *= 0.75;
        this.ball.radius += this.ballRadiusVel;
        this.ball.radius = Math.max(4, this.ball.radius);

        // === 色调变化 ===
        this.ball.hue = (this.ball.hue + 0.3 + treble * 2) % 360;

        // === 发光强度：音符快闪 + 节拍强闪 ===
        const noteFlicker = Math.abs(Math.sin(Date.now() * 0.015)) * 0.4 + 0.6;
        const beatFlash = beat.isBeat ? (0.3 + beat.beatIntensity * 0.4) : 0;
        const onsetFlash = note.isOnset ? (note.onsetIntensity * 0.5) : 0;
        const glowIntensity = (0.25 + bass * 0.5 + mid * 0.3 + treble * 0.2 + beatFlash + onsetFlash) * noteFlicker;
        const glowSize = this.ball.radius * (2.5 + bass * 4 + beat.beatIntensity * 2);

        // === 绘制轨迹拖尾 ===
        this.renderBallTrail(glowIntensity);

        // === 绘制外层大光晕 ===
        const pulseScale = 1 + beat.beatIntensity * 0.3 + bass * 0.2 + note.onsetIntensity * 0.15;
        const outerGlow = this.ctx.createRadialGradient(
            this.ball.x, this.ball.y, this.ball.radius,
            this.ball.x, this.ball.y, glowSize * pulseScale
        );
        outerGlow.addColorStop(0, `hsla(${this.ball.hue}, 100%, 60%, ${glowIntensity * 0.6})`);
        outerGlow.addColorStop(0.4, `hsla(${this.ball.hue + 40}, 100%, 50%, ${glowIntensity * 0.3})`);
        outerGlow.addColorStop(0.7, `hsla(${this.ball.hue + 80}, 100%, 40%, ${glowIntensity * 0.15})`);
        outerGlow.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, glowSize * pulseScale, 0, Math.PI * 2);
        this.ctx.fillStyle = outerGlow;
        this.ctx.fill();

        // === 绘制中层光晕 ===
        const midGlow = this.ctx.createRadialGradient(
            this.ball.x, this.ball.y, 0,
            this.ball.x, this.ball.y, this.ball.radius * 2
        );
        midGlow.addColorStop(0, `hsla(${this.ball.hue}, 100%, 85%, ${glowIntensity})`);
        midGlow.addColorStop(0.5, `hsla(${this.ball.hue + 20}, 100%, 65%, ${glowIntensity * 0.5})`);
        midGlow.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 2, 0, Math.PI * 2);
        this.ctx.fillStyle = midGlow;
        this.ctx.fill();

        // === 绘制球体核心 ===
        const brightness = 60 + energy * 40 + beat.beatIntensity * 20 + note.onsetIntensity * 30;
        const coreGradient = this.ctx.createRadialGradient(
            this.ball.x - this.ball.radius * 0.3,
            this.ball.y - this.ball.radius * 0.3,
            0,
            this.ball.x, this.ball.y, this.ball.radius
        );
        coreGradient.addColorStop(0, `hsl(${this.ball.hue}, 100%, ${Math.min(98, 85 + energy * 15)}%)`);
        coreGradient.addColorStop(0.3, `hsl(${this.ball.hue}, 100%, ${brightness}%)`);
        coreGradient.addColorStop(0.7, `hsl(${this.ball.hue}, 100%, ${brightness - 20}%)`);
        coreGradient.addColorStop(1, `hsl(${this.ball.hue}, 100%, ${brightness - 35}%)`);

        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = coreGradient;
        this.ctx.shadowColor = `hsl(${this.ball.hue}, 100%, ${brightness}%)`;
        this.ctx.shadowBlur = 25 + bass * 60 + beat.beatIntensity * 40 + note.onsetIntensity * 30;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // === 高光 ===
        const highlightSize = this.ball.radius * (0.15 + beat.beatIntensity * 0.1 + note.onsetIntensity * 0.05);
        this.ctx.beginPath();
        this.ctx.arc(
            this.ball.x - this.ball.radius * 0.35,
            this.ball.y - this.ball.radius * 0.35,
            highlightSize,
            0, Math.PI * 2
        );
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + beat.beatIntensity * 0.4 + note.onsetIntensity * 0.3})`;
        this.ctx.fill();

        // === 节拍冲击波 ===
        if (beat.isBeat) {
            const pulseSize = this.ball.radius * (2 + beat.beatIntensity);
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, pulseSize, 0, Math.PI * 2);
            this.ctx.strokeStyle = `hsla(${this.ball.hue}, 100%, 75%, ${beat.beatIntensity})`;
            this.ctx.lineWidth = 2 + beat.beatIntensity * 2;
            this.ctx.stroke();

            const pulse2Size = this.ball.radius * (3 + beat.beatIntensity * 2);
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, pulse2Size, 0, Math.PI * 2);
            this.ctx.strokeStyle = `hsla(${this.ball.hue + 30}, 100%, 65%, ${beat.beatIntensity * 0.5})`;
            this.ctx.lineWidth = 1 + beat.beatIntensity;
            this.ctx.stroke();
        }

        // === 音符冲击波（A/B频带分离颜色）===
        if (note.isOnset) {
            const aSize = this.ball.radius * (1.5 + note.onsetIntensity * 1.5);
            const bSize = this.ball.radius * (2.5 + note.onsetIntensity * 2);
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, aSize, 0, Math.PI * 2);
            this.ctx.strokeStyle = `hsla(${this.ball.hue}, 100%, 70%, ${note.onsetIntensity * 0.6})`;
            this.ctx.lineWidth = 1 + note.onsetIntensity;
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, bSize, 0, Math.PI * 2);
            this.ctx.strokeStyle = `hsla(${this.ball.hue + 60}, 100%, 75%, ${note.onsetIntensity * 0.4})`;
            this.ctx.lineWidth = 0.5 + note.onsetIntensity * 0.5;
            this.ctx.stroke();
        }

        // === 背景粒子 ===
        this.renderBallParticles(bass, mid, treble, glowIntensity);
    }

    renderBallTrail(glowIntensity) {
        // 拖尾效果 - 增强
        const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        const trailCount = Math.floor(6 + speed * 0.5);
        
        for (let i = 0; i < trailCount; i++) {
            const alpha = glowIntensity * (1 - i / trailCount) * 0.4;
            const offset = i * 4;
            
            this.ctx.beginPath();
            this.ctx.arc(
                this.ball.x - this.ball.vx * offset * 0.5,
                this.ball.y - this.ball.vy * offset * 0.5,
                this.ball.radius * (1 - i / trailCount * 0.6),
                0, Math.PI * 2
            );
            this.ctx.fillStyle = `hsla(${this.ball.hue - i * 5}, 100%, ${65 - i * 5}%, ${alpha})`;
            this.ctx.fill();
        }
    }

    renderBallParticles(bass, mid, treble, glowIntensity) {
        // 低频粒子
        const bassCount = Math.floor(15 + bass * 25);
        for (let i = 0; i < bassCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.ball.radius + Math.random() * 80 + bass * 60;
            
            const x = this.ball.x + Math.cos(angle) * distance;
            const y = this.ball.y + Math.sin(angle) * distance;
            
            const size = 3 + Math.random() * 5 + bass * 4;
            const particleHue = this.ball.hue;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${particleHue}, 100%, 70%, ${glowIntensity * 0.5})`;
            this.ctx.shadowColor = `hsla(${particleHue}, 100%, 70%, 1)`;
            this.ctx.shadowBlur = 15 + bass * 20;
            this.ctx.fill();
        }
        
        // 中频粒子
        const midCount = Math.floor(10 + mid * 20);
        for (let i = 0; i < midCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.ball.radius * 2 + Math.random() * 100 + mid * 70;
            
            const x = this.ball.x + Math.cos(angle) * distance;
            const y = this.ball.y + Math.sin(angle) * distance;
            
            const size = 2 + Math.random() * 3 + mid * 3;
            const particleHue = (this.ball.hue + 30) % 360;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${particleHue}, 100%, 75%, ${glowIntensity * 0.4})`;
            this.ctx.shadowBlur = 8 + mid * 12;
            this.ctx.fill();
        }
        
        // 高频粒子（闪烁星点）
        const trebleCount = Math.floor(treble * 30);
        for (let i = 0; i < trebleCount; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            
            const flicker = Math.sin(Date.now() * 0.01 + i) * 0.5 + 0.5;
            const size = 1 + Math.random() * 2;
            const particleHue = (this.ball.hue + 60) % 360;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${particleHue}, 100%, 90%, ${flicker * treble * 0.6})`;
            this.ctx.shadowColor = '#fff';
            this.ctx.shadowBlur = 5;
            this.ctx.fill();
        }
        
        this.ctx.shadowBlur = 0;
    }

    // ============ 四季模式 ============

    /**
     * 春天模式 - 花朵盛开背景
     */
    renderSpring() {
        if (!this.ctx || this.width === 0 || this.height === 0) return;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // 初始化花朵系统
        if (!this.springFlowers) {
            this.springFlowers = [];
            const flowerCount = 40;
            for (let i = 0; i < flowerCount; i++) {
                this.springFlowers.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 15 + 10,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.08, // 加快旋转速度（原0.02）
                    petalCount: Math.floor(Math.random() * 3) + 5,
                    color: this.getSpringFlowerColor(Math.random()),
                    phase: Math.random() * Math.PI * 2,
                    bloom: Math.random() // 0=花苞, 1=盛开
                });
            }
        }

        // 更新花朵绽放状态
        const bloomSpeed = note.onsetIntensity * 0.3 + bass * 0.2;
        for (const flower of this.springFlowers) {
            flower.bloom = Math.min(1, flower.bloom + bloomSpeed * 0.05);
            flower.rotation += flower.rotationSpeed * (1 + treble * 1.5); // 增加音频响应速度
            flower.phase += 0.05; // 加快相位变化
        }

        // 绘制花朵（背景由全局colorScheme.bg统一处理）
        const pulse = beat.isBeat ? beat.beatIntensity * 0.2 : 0;
        for (const flower of this.springFlowers) {
            this.drawFlower(flower, pulse, bass, treble);
        }

        // 撒花粉效果
        this.renderSpringPollen(treble, note);

        // 显示模式指示
        this.drawSeasonIndicator('🌸 春天 - 花朵绽放');
    }

    getSpringFlowerColor(t) {
        // 真正的樱花配色 - 浅粉到白色，带有淡淡的紫色/蓝色调
        const colors = [
            { h: 350, s: 50, l: 82 },  // 浅粉色
            { h: 355, s: 40, l: 88 },  // 极浅粉
            { h: 0, s: 20, l: 95 },    // 白色带暖色调
            { h: 340, s: 45, l: 85 },  // 粉色
            { h: 280, s: 25, l: 90 },  // 淡紫（山樱色调）
            { h: 360, s: 35, l: 90 },  // 极浅玫红
            { h: 15, s: 30, l: 92 },   // 奶白色
            { h: 330, s: 55, l: 80 }   // 深樱粉
        ];
        return colors[Math.floor(t * colors.length) % colors.length];
    }

    drawFlower(flower, pulse, bass, treble) {
        const ctx = this.ctx;
        const { x, y, size, rotation, petalCount, color, bloom, phase } = flower;
        
        // 樱花固定为5瓣
        const sakuraPetals = 5;
        const actualSize = size * (1 + bloom * 0.5 + pulse + bass * 0.3);
        const opacity = 0.65 + bloom * 0.35;
        const glowIntensity = 3 + treble * 8;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        // 樱花花瓣 - 椭圆形，带轻微缺口（单瓣樱特征）
        const petalLength = actualSize * bloom * 0.7;
        const petalWidth = petalLength * 0.5;
        
        // 花瓣光晕效果
        ctx.shadowColor = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${opacity * 0.6})`;
        ctx.shadowBlur = glowIntensity;
        
        // 绘制5片椭圆花瓣（樱花特征）
        for (let p = 0; p < sakuraPetals; p++) {
            const angle = (p / sakuraPetals) * Math.PI * 2 - Math.PI / 2; // 从顶部开始
            const petalAngle = angle + Math.PI / 2; // 调整到正北方向
            
            ctx.save();
            ctx.rotate(petalAngle);
            
            // 花瓣主体 - 椭圆形
            ctx.beginPath();
            ctx.ellipse(0, -petalLength * 0.45, petalWidth * 0.45, petalLength * 0.5, 0, 0, Math.PI * 2);
            
            // 渐变填充 - 从中心到边缘变淡
            const petalGradient = ctx.createRadialGradient(0, -petalLength * 0.45, 0, 0, -petalLength * 0.45, petalLength * 0.5);
            petalGradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${opacity})`);
            petalGradient.addColorStop(0.6, `hsla(${color.h}, ${color.s - 10}%, ${color.l}%, ${opacity * 0.9})`);
            petalGradient.addColorStop(1, `hsla(${color.h}, ${color.s - 20}%, ${color.l + 5}%, ${opacity * 0.6})`);
            
            ctx.fillStyle = petalGradient;
            ctx.fill();
            
            // 花瓣边缘线 - 淡淡的花瓣轮廓
            ctx.strokeStyle = `hsla(${color.h}, ${color.s - 15}%, ${color.l - 5}%, ${opacity * 0.3})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            
            // 花瓣顶端的小缺口（樱花特征）
            ctx.beginPath();
            ctx.arc(0, -petalLength * 0.85, petalWidth * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l + 10}%, ${opacity * 0.4})`;
            ctx.fill();
            
            ctx.restore();
        }
        
        // 黄色花心
        const centerX = 0;
        const centerY = 0;
        const centerSize = actualSize * bloom * 0.18;
        
        // 花心光晕
        ctx.shadowColor = 'rgba(255, 220, 100, 0.8)';
        ctx.shadowBlur = 4 + treble * 4;
        
        // 花心主体
        const centerGradient = ctx.createRadialGradient(centerX - centerSize * 0.3, centerY - centerSize * 0.3, 0, centerX, centerY, centerSize);
        centerGradient.addColorStop(0, '#FFE066');
        centerGradient.addColorStop(0.5, '#FFD700');
        centerGradient.addColorStop(1, '#FFB300');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, centerSize, 0, Math.PI * 2);
        ctx.fillStyle = centerGradient;
        ctx.fill();
        
        // 花蕊 - 从花心伸出的小点
        ctx.shadowBlur = 2;
        ctx.shadowColor = 'rgba(255, 200, 50, 0.6)';
        for (let st = 0; st < 8; st++) {
            const stAngle = (st / 8) * Math.PI * 2;
            const stLen = centerSize * (0.7 + Math.random() * 0.3);
            const stX = Math.cos(stAngle) * stLen;
            const stY = Math.sin(stAngle) * stLen;
            
            ctx.beginPath();
            ctx.arc(stX, stY, 1 + treble, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(45, 100%, 70%, ${0.7 + treble * 0.3})`;
            ctx.fill();
        }
        
        ctx.restore();
    }

    renderSpringPollen(treble, note) {
        const ctx = this.ctx;
        if (!this.springPollen) {
            this.springPollen = [];
            for (let i = 0; i < 60; i++) {
                this.springPollen.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 2 + 1,
                    speedX: (Math.random() - 0.5) * 0.5,
                    speedY: -Math.random() * 0.3 - 0.1,
                    wobble: Math.random() * Math.PI * 2,
                    opacity: Math.random() * 0.5 + 0.3
                });
            }
        }

        for (const p of this.springPollen) {
            p.wobble += 0.02;
            p.x += p.speedX + Math.sin(p.wobble) * 0.3;
            p.y += p.speedY;
            
            if (p.y < -10) {
                p.y = this.height + 10;
                p.x = Math.random() * this.width;
            }
            
            const alpha = p.opacity * (0.5 + treble * 0.5);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
            ctx.shadowColor = 'rgba(255, 255, 150, 1)';
            ctx.shadowBlur = 3;
            ctx.fill();
        }
    }

    /**
     * 夏天模式 - 太阳闪烁 + 漂浮云朵
     * @param {number} scaleFactor - 缩放因子，用于小画布时缩小效果
     */
    renderSummer(scaleFactor = 1.0) {
        if (!this.ctx || this.width === 0 || this.height === 0) return;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // 手机模式下使用更小的云朵数量
        const cloudCount = scaleFactor < 1 ? 4 : 8;
        // 初始化云朵系统
        if (!this.summerClouds || this.summerClouds.length !== cloudCount) {
            this.summerClouds = [];
            for (let i = 0; i < cloudCount; i++) {
                this.summerClouds.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height * 0.35 + 40,
                    width: Math.random() * 144 + 86,  // 基准86-230，再增大15%（累计×1.4375）
                    height: Math.random() * 44 + 29,  // 基准29-73，再增大15%
                    speed: Math.random() * 0.3 + 0.2,
                    opacity: Math.random() * 0.3 + 0.3
                });
            }
        }

        // 绘制太阳（背景由全局colorScheme.bg统一处理）
        const sunX = this.width * 0.8;
        const sunY = this.height * 0.15;
        // 手机模式下太阳更小
        const baseRadius = scaleFactor < 1 
            ? Math.min(40 + bass * 10, this.width * 0.15)  // 手机：限制最大为画布15%
            : 60 + bass * 20;
        
        // 节拍驱动的闪烁（手机模式下减小）
        const beatFlash = beat.isBeat ? beat.beatIntensity * 0.05 : 0;
        const noteFlicker = note.isOnset ? note.onsetIntensity * 0.03 : 0;
        const flickerIntensity = 1 + beatFlash + noteFlicker;
        
        // 太阳光晕 - 手机模式下限制最大范围和强度
        const maxGlowRadius = scaleFactor < 1 ? this.width * 0.2 : Infinity;
        const rawGlowRadius = baseRadius * 2.0 * flickerIntensity;
        const glowRadius = Math.min(rawGlowRadius, maxGlowRadius);
        
        // 手机模式下透明度更低，减少screen叠加时的过曝
        const glowOpacity = scaleFactor < 1 ? 0.25 : 0.8;
        const outerGlow = this.ctx.createRadialGradient(sunX, sunY, baseRadius * 0.3, sunX, sunY, glowRadius);
        outerGlow.addColorStop(0, `rgba(255, 200, 50, ${glowOpacity})`);
        outerGlow.addColorStop(0.4, `rgba(255, 180, 30, ${glowOpacity * 0.5})`);
        outerGlow.addColorStop(0.7, `rgba(255, 150, 20, ${glowOpacity * 0.2})`);
        outerGlow.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = outerGlow;
        this.ctx.fill();

        // 太阳主体
        const sunGradient = this.ctx.createRadialGradient(sunX - baseRadius * 0.2, sunY - baseRadius * 0.2, 0, sunX, sunY, baseRadius);
        sunGradient.addColorStop(0, '#FFFFA0');
        sunGradient.addColorStop(0.5, '#FFD700');
        sunGradient.addColorStop(1, '#FFA500');
        
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, baseRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = sunGradient;
        // 手机模式下不启用 shadowBlur
        if (scaleFactor >= 1) {
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 40 + beatFlash * 40 + treble * 20;
        }
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // 太阳光芒 - 手机模式下禁用
        if (scaleFactor >= 1) {
            this.drawSunRays(sunX, sunY, baseRadius, treble * 0.5, beat, scaleFactor);
        }

        // 绘制云朵（手机模式下缩小）
        for (const cloud of this.summerClouds) {
            this.drawCloud(cloud, treble, bass, scaleFactor);
        }

        // 显示模式指示
        this.drawSeasonIndicator('☀️ 夏天 - 阳光闪烁');
    }

    drawSunRays(x, y, radius, treble, beat, scaleFactor = 1.0) {
        const ctx = this.ctx;
        const rayCount = 12;
        // 手机模式下缩短光芒
        const rayLength = (radius * 1.5 + treble * 30) * scaleFactor;
        
        ctx.save();
        ctx.translate(x, y);
        
        const rotation = Date.now() * 0.0003;
        ctx.rotate(rotation);
        
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;
            const rayWidth = (3 + treble * 5) * scaleFactor;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const endX = Math.cos(angle) * rayLength;
            const endY = Math.sin(angle) * rayLength;
            
            const gradient = ctx.createLinearGradient(0, 0, endX, endY);
            gradient.addColorStop(0, 'rgba(255, 220, 50, 0.9)');
            gradient.addColorStop(1, 'transparent');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = rayWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        
        ctx.restore();
    }

    drawCloud(cloud, treble, bass, scaleFactor = 1.0) {
        const ctx = this.ctx;
        const { x, y, width, height, speed, opacity } = cloud;
        
        // 更新云朵位置
        cloud.x += speed * (1 + treble * 0.5);
        if (cloud.x > this.width + width) {
            cloud.x = -width;
        }
        
        // 云朵膨胀效果（手机模式下缩小）
        const cloudScale = (1 + bass * 0.2 + treble * 0.1) * scaleFactor;
        const actualWidth = width * cloudScale;
        const actualHeight = height * cloudScale;
        
        ctx.save();
        ctx.globalAlpha = opacity * (0.6 + treble * 0.4);
        
        // 绘制多个圆形组成云朵（手机模式下减小阴影）
        ctx.fillStyle = '#FFFFFF';
        // 手机模式下跳过阴影效果以避免过曝
        ctx.shadowBlur = this.skipShadow ? 0 : (10 + treble * 20) * scaleFactor;
        
        // 主体圆
        ctx.beginPath();
        ctx.arc(x, y, actualHeight * 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // 左边的圆
        ctx.beginPath();
        ctx.arc(x - actualWidth * 0.3, y + actualHeight * 0.1, actualHeight * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // 右边的圆
        ctx.beginPath();
        ctx.arc(x + actualWidth * 0.3, y + actualHeight * 0.1, actualHeight * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 顶部的小圆
        ctx.beginPath();
        ctx.arc(x - actualWidth * 0.1, y - actualHeight * 0.2, actualHeight * 0.35, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    /**
     * 秋天模式 - 飘雨 + 涟漪效果
     */
    renderAutumn() {
        if (!this.ctx || this.width === 0 || this.height === 0) return;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // 初始化雨滴系统（加 prevY 用于追踪跨高度线）
        const rainLine60 = Math.min(this.height * 0.9, this.height - 10);  // 第一层涟漪高度线（+50%，上限 height-10）
        const rainLine80 = Math.min(this.height * 1.2, this.height - 10);  // 第二层涟漪高度线（+50%，上限 height-10）
        const rainLineBase = this.height - 10;  // 第三层（原有底层）

        if (!this.autumnRain) {
            this.autumnRain = [];
            const rainCount = 150;
            for (let i = 0; i < rainCount; i++) {
                this.autumnRain.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    prevY: 0,
                    length: Math.random() * 20 + 15,
                    speed: Math.random() * 8 + 6,
                    opacity: Math.random() * 0.3 + 0.3
                });
            }
        }

        // 初始化三层涟漪系统（每次进入秋天模式时重置，避免跨季节残留导致白屏）
        this.autumnRipples = [];
        this.autumnRipplesMid = [];
        this.autumnRipplesHigh = [];

        // 微风效果
        const windForce = mid * 0.5 + treble * 0.3 + Math.sin(Date.now() * 0.001) * 0.2;

        // 绘制雨滴（斜线条式）
        const rainSpeed = 1 + bass * 0.5 + beat.beatIntensity * 0.3;
        for (const drop of this.autumnRain) {
            drop.prevY = drop.y;  // 移动前记录上一帧位置
            drop.y += drop.speed * rainSpeed;
            drop.x += windForce * drop.speed * 0.3;

            // 跨过60%高度线 → 中层涟漪
            if (drop.prevY < rainLine60 && drop.y >= rainLine60 && Math.random() < 0.15) {
                this.autumnRipplesMid.push({
                    x: drop.x,
                    y: rainLine60,
                    radius: 2,
                    maxRadius: 20 + Math.random() * 15,
                    opacity: 0.5 + treble * 0.3
                });
            }
            // 跨过80%高度线 → 高层涟漪
            if (drop.prevY < rainLine80 && drop.y >= rainLine80 && Math.random() < 0.15) {
                this.autumnRipplesHigh.push({
                    x: drop.x,
                    y: rainLine80,
                    radius: 2,
                    maxRadius: 15 + Math.random() * 10,
                    opacity: 0.4 + treble * 0.2
                });
            }
            // 重置落到底部的雨滴
            if (drop.y > this.height) {
                drop.y = -drop.length;
                drop.x = Math.random() * this.width;

                // 落到地面时产生底层涟漪
                if (Math.random() < 0.3) {
                    this.autumnRipples.push({
                        x: drop.x,
                        y: rainLineBase,
                        radius: 2,
                        maxRadius: 30 + Math.random() * 20,
                        opacity: 0.6 + treble * 0.4
                    });
                }
            }
            
            if (drop.x > this.width + 50) {
                drop.x = -50;
            }
            
            // 绘制雨滴
            const dropGradient = this.ctx.createLinearGradient(
                drop.x, drop.y,
                drop.x + windForce * 10, drop.y + drop.length
            );
            dropGradient.addColorStop(0, 'rgba(180, 180, 180, 0)');
            dropGradient.addColorStop(0.5, `rgba(200, 200, 200, ${drop.opacity})`);
            dropGradient.addColorStop(1, 'rgba(220, 220, 220, 0)');
            
            this.ctx.beginPath();
            this.ctx.moveTo(drop.x, drop.y);
            this.ctx.lineTo(drop.x + windForce * 10, drop.y + drop.length);
            this.ctx.strokeStyle = dropGradient;
            this.ctx.lineWidth = 1.5;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        // 绘制涟漪（底层：height-10）
        for (let i = this.autumnRipples.length - 1; i >= 0; i--) {
            const ripple = this.autumnRipples[i];
            ripple.radius += 1.5;
            ripple.opacity *= 0.96;
            
            if (ripple.opacity < 0.01 || ripple.radius > ripple.maxRadius) {
                this.autumnRipples.splice(i, 1);
                continue;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(200, 200, 200, ${ripple.opacity})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            // 内圈涟漪
            if (ripple.radius > 5) {
                this.ctx.beginPath();
                this.ctx.arc(ripple.x, ripple.y, ripple.radius * 0.6, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(180, 180, 180, ${ripple.opacity * 0.5})`;
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        }

        // 绘制涟漪（中层：height*0.6，浅色，较小）
        for (let i = this.autumnRipplesMid.length - 1; i >= 0; i--) {
            const ripple = this.autumnRipplesMid[i];
            ripple.radius += 1.0;
            ripple.opacity *= 0.96;
            
            if (ripple.opacity < 0.01 || ripple.radius > ripple.maxRadius) {
                this.autumnRipplesMid.splice(i, 1);
                continue;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(180, 160, 140, ${ripple.opacity * 0.7})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            if (ripple.radius > 5) {
                this.ctx.beginPath();
                this.ctx.arc(ripple.x, ripple.y, ripple.radius * 0.5, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(160, 140, 120, ${ripple.opacity * 0.4})`;
                this.ctx.lineWidth = 0.5;
                this.ctx.stroke();
            }
        }

        // 绘制涟漪（高层：height*0.8，最小最淡）
        for (let i = this.autumnRipplesHigh.length - 1; i >= 0; i--) {
            const ripple = this.autumnRipplesHigh[i];
            ripple.radius += 0.8;
            ripple.opacity *= 0.96;
            
            if (ripple.opacity < 0.01 || ripple.radius > ripple.maxRadius) {
                this.autumnRipplesHigh.splice(i, 1);
                continue;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(160, 140, 120, ${ripple.opacity * 0.5})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
        }

        // 显示模式指示
        this.drawSeasonIndicator('🌧️ 秋天 - 细雨飘落');
    }

    /**
     * 冬天模式 - 密集雪花飘落（基于古建筑模式优化）
     */
    renderWinter() {
        if (!this.ctx || this.width === 0 || this.height === 0) return;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        const brightness = 0.6 + treble * 0.3 + beat.beatIntensity * 0.1;
        const hue = 210; // 冷色调蓝

        // 初始化密集雪花系统（比古建筑模式更多）
        if (!this.winterSnowflakes) {
            this.winterSnowflakes = [];
            // 雪花数量增加50%
            const snowCount = this.skipShadow ? 120 : 250;
            for (let i = 0; i < snowCount; i++) {
                this.winterSnowflakes.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 4 + 2,
                    speedY: Math.random() * 1 + 0.5, // 稍快的下落速度
                    speedX: Math.random() * 0.5 + 0.2,
                    wobble: Math.random() * Math.PI * 2,
                    wobbleSpeed: Math.random() * 0.003 + 0.001,
                    opacity: Math.random() * 0.6 + 0.4,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.02
                });
            }
        }

        // 绘制雪地上的反光（可选的微弱效果）
        const groundY = this.height * 0.9;
        const groundGlow = this.ctx.createLinearGradient(0, groundY - 50, 0, groundY + 30);
        groundGlow.addColorStop(0, 'transparent');
        groundGlow.addColorStop(0.5, `rgba(180, 200, 220, ${brightness * 0.08})`);
        groundGlow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = groundGlow;
        this.ctx.fillRect(0, groundY - 50, this.width, 80);

        // 更新和绘制雪花
        const snowSpeedMult = 1 + beat.beatIntensity * 0.15 + note.onsetIntensity * 0.1;
        const isSimplified = this.skipShadow;

        for (const snow of this.winterSnowflakes) {
            snow.wobble += snow.wobbleSpeed;
            snow.rotation += snow.rotationSpeed * (1 + treble * 0.5);
            snow.y += snow.speedY * snowSpeedMult;
            snow.x += snow.speedX * snowSpeedMult;
            snow.x += Math.sin(snow.wobble) * 0.5;

            const flicker = note.isOnset ? note.onsetIntensity * 0.3 : 0;
            const alpha = snow.opacity * brightness * (0.8 + flicker);
            const size = snow.size * (1 + treble * 0.4);

            if (isSimplified) {
                // 简化模式：简单圆点
                this.ctx.fillStyle = `hsla(210, 20%, 98%, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.arc(snow.x, snow.y, size, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // 完整模式：绘制六角雪花
                this.ctx.save();
                this.ctx.translate(snow.x, snow.y);
                this.ctx.rotate(snow.rotation);
                
                this.ctx.shadowBlur = size * 6;
                this.ctx.shadowColor = `hsla(200, 100%, 95%, ${alpha * 0.7})`;
                this.ctx.fillStyle = `hsla(210, 20%, 98%, ${alpha})`;
                this.ctx.strokeStyle = `hsla(220, 50%, 92%, ${alpha * 0.9})`;
                this.ctx.lineWidth = 0.6;
                
                // 六角雪花主体
                this.ctx.beginPath();
                for (let arm = 0; arm < 6; arm++) {
                    const angle = (arm / 6) * Math.PI * 2;
                    this.ctx.moveTo(0, 0);
                    this.ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
                    
                    // 分支
                    const branchX = Math.cos(angle) * size * 0.6;
                    const branchY = Math.sin(angle) * size * 0.6;
                    this.ctx.moveTo(branchX, branchY);
                    this.ctx.lineTo(branchX + Math.cos(angle + 0.5) * size * 0.35, branchY + Math.sin(angle + 0.5) * size * 0.35);
                    this.ctx.moveTo(branchX, branchY);
                    this.ctx.lineTo(branchX + Math.cos(angle - 0.5) * size * 0.35, branchY + Math.sin(angle - 0.5) * size * 0.35);
                }
                this.ctx.stroke();
                
                // 中心
                this.ctx.beginPath();
                this.ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.restore();
            }

            // 重置落到底部的雪花
            if (snow.y > this.height + 20) {
                snow.y = -20;
                snow.x = Math.random() * this.width;
            }
            if (snow.x > this.width + 20) {
                snow.x = -20;
            }
        }

        // 显示模式指示
        this.drawSeasonIndicator('❄️ 冬天 - 大雪纷飞');
    }


    /**
     * 白天模式 - 黄昏深米黄色温暖背景
     * 背景色专为搭配其他效果设计，确保线条清晰可见
     */
    renderDaytime() {
        if (!this.ctx || this.width === 0 || this.height === 0) return;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // 手机模式下跳过背景绘制，避免覆盖其他效果
        const isPhoneMode = this._phoneScaleFactor < 1;
        
        if (!isPhoneMode) {
            // 黄昏深米黄色背景（确保线条清晰可见）
            const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
            bgGradient.addColorStop(0, '#1F1410');   // 顶部深棕
            bgGradient.addColorStop(0.3, '#2C1F18');  // 中上深米黄
            bgGradient.addColorStop(0.6, '#3D2B1F'); // 中间暖棕
            bgGradient.addColorStop(1, '#1A1410');   // 底部深色
            this.ctx.fillStyle = bgGradient;
            this.ctx.fillRect(0, 0, this.width, this.height);

            // 添加微妙的黄昏天空渐变（橙黄到深棕）
            const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height * 0.5);
            skyGradient.addColorStop(0, 'rgba(80, 50, 30, 0.3)');  // 顶部深橙
            skyGradient.addColorStop(0.5, 'rgba(60, 40, 25, 0.2)'); // 中部棕
            skyGradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = skyGradient;
            this.ctx.fillRect(0, 0, this.width, this.height * 0.5);
        }

        // 初始化浮云系统
        if (!this.daytimeClouds) {
            this.daytimeClouds = [];
            const cloudCount = isPhoneMode ? 4 : 6;
            for (let i = 0; i < cloudCount; i++) {
                this.daytimeClouds.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height * 0.35 + 40,
                    width: Math.random() * 100 + 80,
                    height: Math.random() * 25 + 15,
                    speed: Math.random() * 0.12 + 0.08,
                    opacity: Math.random() * 0.2 + 0.3
                });
            }
        }

        // 绘制黄昏暖色浮云
        for (const cloud of this.daytimeClouds) {
            cloud.x += cloud.speed * (1 + treble * 0.3);
            if (cloud.x > this.width + cloud.width) {
                cloud.x = -cloud.width;
            }

            const cloudScale = 1 + bass * 0.1 + treble * 0.05;
            const actualWidth = cloud.width * cloudScale;
            const actualHeight = cloud.height * cloudScale;

            this.ctx.save();
            this.ctx.globalAlpha = cloud.opacity * 0.4;

            // 暖橙色云朵（黄昏色调）
            this.ctx.fillStyle = 'rgba(180, 100, 60, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, actualHeight * 0.5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = 'rgba(160, 90, 50, 0.4)';
            this.ctx.beginPath();
            this.ctx.arc(cloud.x - actualWidth * 0.25, cloud.y + actualHeight * 0.05, actualHeight * 0.35, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.arc(cloud.x + actualWidth * 0.25, cloud.y + actualHeight * 0.05, actualHeight * 0.4, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }

        // 底部深色地平线（手机模式下不绘制，避免覆盖）
        if (!isPhoneMode) {
            const groundGradient = this.ctx.createLinearGradient(0, this.height * 0.88, 0, this.height);
            groundGradient.addColorStop(0, 'transparent');
            groundGradient.addColorStop(0.4, 'rgba(30, 20, 15, 0.3)');
            groundGradient.addColorStop(1, 'rgba(20, 15, 10, 0.5)');
            this.ctx.fillStyle = groundGradient;
            this.ctx.fillRect(0, this.height * 0.88, this.width, this.height * 0.12);
        }

        // 显示模式指示
        this.drawSeasonIndicator('🌅 白天 - 黄昏暖色');
    }

    /**
     * 火柴人跑步特效
     * 7-8个火柴人在地平线上跑步，跑步节奏根据音频节拍调整
     */
    renderRunningStickmen() {
        if (!this.ctx || this.width === 0 || this.height === 0) return;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // 地平线位置（屏幕底部20%处）
        const groundY = this.height * 0.82;

        // 只绘制地面效果线，不覆盖整个背景（保留其他效果的背景）
        const groundGradient = this.ctx.createLinearGradient(0, groundY, 0, this.height);
        groundGradient.addColorStop(0, 'rgba(60, 40, 30, 0.3)');
        groundGradient.addColorStop(0.3, 'rgba(40, 25, 20, 0.4)');
        groundGradient.addColorStop(1, 'rgba(20, 15, 10, 0.5)');
        this.ctx.fillStyle = groundGradient;
        this.ctx.fillRect(0, groundY, this.width, this.height - groundY);

        // 地平线（半透明，不完全覆盖）
        this.ctx.strokeStyle = 'rgba(80, 60, 40, 0.25)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(this.width, groundY);
        this.ctx.stroke();

        // 初始化跑步者
        if (!this.runningStickmen) {
            this.runningStickmen = [];
            const stickmanCount = 8;
            for (let i = 0; i < stickmanCount; i++) {
                this.runningStickmen.push({
                    x: (this.width / stickmanCount) * i - 50, // 初始分布在整个屏幕
                    y: groundY,
                    scale: 0.8 + Math.random() * 0.4,  // 大小差异
                    color: this.getRandomStickmanColor(i),
                    phase: Math.random() * Math.PI * 2, // 跑步动画相位
                    speed: 1 + Math.random() * 0.5,    // 基础速度
                    depth: 0.5 + Math.random() * 0.5    // 远近（影响大小）
                });
            }
        }

        // 根据节拍调整基础跑步频率
        const beatMultiplier = beat.isBeat ? 1 + beat.beatIntensity * 0.5 : 1;
        const baseSpeed = 2 * (1 + bass * 0.5 + mid * 0.3); // 音频强度影响速度
        const runFrequency = 8 * beatMultiplier * (1 + treble * 0.2); // 跑步动作频率

        // 更新和绘制每个火柴人
        for (const stickman of this.runningStickmen) {
            // 更新位置（根据深度调整速度）
            stickman.x += baseSpeed * stickman.speed * stickman.depth * 0.8;

            // 循环：从右边跑到左边后重置到右边
            if (stickman.x > this.width + 100) {
                stickman.x = -80;
                stickman.color = this.getRandomStickmanColor(Math.random() * 8);
            }

            // 更新跑步动画相位
            stickman.phase += runFrequency * 0.1 * stickman.depth;

            // 绘制火柴人
            this.drawStickman(
                stickman.x,
                stickman.y,
                stickman.scale * stickman.depth,
                stickman.color,
                stickman.phase,
                bass,
                beat.isBeat
            );
        }

        // 添加一些跑步时的尘土效果
        if (beat.isBeat) {
            this.drawDustEffect(groundY, bass);
        }

        // 显示模式指示
        this.drawSeasonIndicator('🏃 火柴人跑步');
    }

    /**
     * 绘制单个火柴人
     */
    drawStickman(x, y, scale, color, phase, bass, isBeat) {
        const ctx = this.ctx;
        ctx.save();

        // 基础尺寸
        const headRadius = 12 * scale;
        const bodyLength = 40 * scale;
        const limbLength = 25 * scale;
        const lineWidth = 3 * scale;

        // 跑步时的上下起伏
        const bounce = Math.abs(Math.sin(phase)) * 5 * scale * (isBeat ? 1.3 : 1);
        const actualY = y - bounce;

        // 跑步时的身体前倾角度
        const bodyLean = 0.15 + bass * 0.1;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 发光效果
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 + bass * 10;

        ctx.translate(x, actualY);
        ctx.rotate(bodyLean);

        // 头部
        ctx.beginPath();
        ctx.arc(0, -bodyLength - headRadius, headRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 身体
        ctx.beginPath();
        ctx.moveTo(0, -bodyLength);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // 手臂（随跑步摆动）
        const armSwing = Math.sin(phase) * 0.8;
        const armSwing2 = Math.sin(phase + Math.PI) * 0.8;

        // 左臂
        ctx.beginPath();
        ctx.moveTo(0, -bodyLength * 0.8);
        ctx.lineTo(
            Math.sin(armSwing) * limbLength * 0.8,
            -bodyLength * 0.8 + Math.cos(armSwing) * limbLength
        );
        ctx.stroke();

        // 右臂
        ctx.beginPath();
        ctx.moveTo(0, -bodyLength * 0.8);
        ctx.lineTo(
            Math.sin(armSwing2) * limbLength * 0.8,
            -bodyLength * 0.8 + Math.cos(armSwing2) * limbLength
        );
        ctx.stroke();

        // 腿部（随跑步交替前后）
        const legSwing = Math.sin(phase) * 0.7;
        const legSwing2 = Math.sin(phase + Math.PI) * 0.7;

        // 左腿
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
            Math.sin(legSwing) * limbLength,
            Math.cos(legSwing) * limbLength
        );
        ctx.stroke();

        // 右腿
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
            Math.sin(legSwing2) * limbLength,
            Math.cos(legSwing2) * limbLength
        );
        ctx.stroke();

        ctx.restore();
    }

    /**
     * 获取火柴人闪烁白色颜色
     */
    getRandomStickmanColor(index) {
        // 闪烁白色：基于时间的闪烁效果
        const time = Date.now() * 0.003 + index * 0.5;
        const flicker = 0.7 + Math.sin(time) * 0.3; // 0.4 ~ 1.0 闪烁
        const brightness = Math.floor(255 * flicker);
        return `rgb(${brightness}, ${brightness}, ${brightness})`;
    }

    /**
     * 绘制尘土效果（白色）
     */
    drawDustEffect(groundY, bass) {
        const ctx = this.ctx;

        // 白色尘土效果
        for (let i = 0; i < 3; i++) {
            const dustX = Math.random() * this.width;
            const dustY = groundY - Math.random() * 10;
            const dustSize = (3 + bass * 8) * (Math.random() * 0.5 + 0.5);

            ctx.save();
            ctx.globalAlpha = 0.2 + bass * 0.2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(dustX, dustY, dustSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * 绘制季节模式指示器
     */
    drawSeasonIndicator(text) {
        const ctx = this.ctx;
        const x = this.width / 2;
        const y = this.height - 30;
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '16px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y);
        
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
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
