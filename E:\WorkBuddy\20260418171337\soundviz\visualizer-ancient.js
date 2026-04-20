/**
 * visualizer-ancient.js
 * 古建筑模式：中国传统楼阁式建筑可视化
 * 音频驱动：bass=缩放，mid=层间震动，treble=亮度
 * 效果叠加：旋转/外延光/雪花（快捷键 R/O/T 切换）
 * 
 * 依赖：visualizer-core.js（Visualizer 类定义）
 * 请在 visualizer-core.js 之后加载此文件
 */

Object.assign(Visualizer.prototype, {

    renderAncientPavilion() {
        // 初始化效果状态
        if (!this.ancientEffects) {
            this.ancientEffects = { rotation: false, outline: true, particles: true };
        }
        
        // 初始化雪花系统
        if (!this.snowflakes) {
            this.snowflakes = [];
            for (let i = 0; i < 300; i++) {
                this.snowflakes.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    size: Math.random() * 4 + 2,
                    speedY: Math.random() * 0.6 + 0.4,
                    speedX: Math.random() * 0.3 + 0.1,
                    wobble: Math.random() * Math.PI * 2,
                    wobbleSpeed: Math.random() * 0.002 + 0.001,
                    opacity: Math.random() * 0.6 + 0.4
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
        
        const beatPulse = beat.isBeat ? beat.beatIntensity : 0;
        const onsetPulse = note.isOnset ? note.onsetIntensity : 0;
        const brightness = 0.5 + treble * 0.3 + beatPulse * 0.2 + onsetPulse * 0.1;
        const hue = 35 + treble * 15;
        
        const baseWidth = Math.min(this.width * 0.35, 280);
        const floorCount = 6;
        const floorHeight = baseWidth * 0.26;
        const roofHeight = floorHeight * 0.55;
        const totalHeight = floorCount * floorHeight + roofHeight;
        const groundY = this.height * 0.92;
        
        // 音符驱动的光效切换
        if (this.ancientLayerIndex === undefined) this.ancientLayerIndex = 0;
        if (this.lastNoteCount === undefined) this.lastNoteCount = 0;
        if (this.noteTimer === undefined) this.noteTimer = 0;
        
        const noteCountNow = note.noteCount || 0;
        if (noteCountNow > this.lastNoteCount) {
            this.ancientLayerIndex = (this.ancientLayerIndex + 1) % floorCount;
            this.noteTimer = 10;
        }
        this.lastNoteCount = noteCountNow;
        if (this.noteTimer > 0) this.noteTimer--;
        
        const currentLayer = this.ancientLayerIndex;
        
        const floorBrightness = [];
        for (let f = 0; f < floorCount; f++) {
            if (f === currentLayer) {
                const notePulse = this.noteTimer > 0 ? 0.5 : 0;
                floorBrightness[f] = 1 + notePulse;
            } else {
                const dist = Math.abs(f - currentLayer);
                floorBrightness[f] = Math.max(0.08, 0.25 - dist * 0.06);
            }
        }
        
        const roofBrightness = floorBrightness[floorCount - 1];
        const stepBrightness = floorBrightness[0] * 0.8;
        
        // 旋转效果
        let rotation = 0;
        if (this.ancientEffects.rotation) {
            const rotSpeed = 0.0008 + beatPulse * 0.003 + mid * 0.001;
            const rotAngle = 20 * Math.PI / 180;
            rotation = Math.sin(Date.now() * rotSpeed) * rotAngle * (0.5 + beatPulse * 0.5);
        }
        
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(rotation);
        this.ctx.translate(-cx, -cy);
        
        // 绘制台阶
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
        
        const buildingBottom = groundY - stepHeight * stepCount;
        
        // 逐层绘制
        for (let f = 0; f < floorCount; f++) {
            const y1 = buildingBottom - floorHeight * f;
            const y2 = y1 - floorHeight;
            const widthRatio = 1 - f * 0.07;
            const fw = baseWidth * widthRatio;
            
            const fBass = bass * (1 - f * 0.08);
            const fMid = mid * (1 - f * 0.06);
            const fb = floorBrightness[f];
            
            const colCount = 8;
            const colSpacing = fw / (colCount - 1);
            
            // 立柱
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
            
            // 横梁
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
                
                const eaveExtend = 18 + fMid * 10;
                this.ctx.beginPath();
                this.ctx.moveTo(cx - fw/2, y2 + bracketH);
                this.ctx.lineTo(cx - fw/2 - eaveExtend, y2 + bracketH + 6);
                this.ctx.moveTo(cx + fw/2, y2 + bracketH);
                this.ctx.lineTo(cx + fw/2 + eaveExtend, y2 + bracketH + 6);
                this.ctx.stroke();
            }
            
            // 节拍脉冲
            if (beatPulse > 0.2 && fb > 0.6) {
                this.ctx.strokeStyle = `hsla(${hue + 25}, 100%, 75%, ${beatPulse * 0.8})`;
                this.ctx.lineWidth = 2 + beatPulse * 3;
                this.ctx.shadowBlur = 15 + beatPulse * 20;
                this.ctx.shadowColor = `hsl(${hue + 40}, 100%, 80%)`;
                this.ctx.strokeRect(cx - fw/2 - 8, y2 - 8, fw + 16, floorHeight + 16);
            }
        }
        
        // 屋顶
        const roofY = buildingBottom - floorCount * floorHeight;
        const roofWidth = baseWidth * (1 - (floorCount - 1) * 0.07) * 1.35;
        const roofPeak = roofY - roofHeight;
        
        this.ctx.strokeStyle = `hsla(${hue + roofBrightness * 15}, 80%, ${50 + roofBrightness * 40}%, ${0.6 + roofBrightness * 0.4})`;
        this.ctx.lineWidth = 2.5 + bass * 2.5 + roofBrightness * 2;
        this.ctx.shadowBlur = roofBrightness * 15 + beatPulse * 10;
        this.ctx.shadowColor = `hsl(${hue + 25}, 100%, 65%)`;
        
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
        
        // 宝顶
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
        
        // 雪花飘落效果
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
                
                this.ctx.save();
                this.ctx.translate(snow.x, snow.y);
                
                this.ctx.shadowBlur = snow.size * 5;
                this.ctx.shadowColor = `hsla(200, 100%, 95%, ${alpha * 0.7})`;
                this.ctx.fillStyle = `hsla(210, 30%, 98%, ${alpha})`;
                this.ctx.strokeStyle = `hsla(220, 50%, 92%, ${alpha * 0.9})`;
                this.ctx.lineWidth = 0.5;
                
                const size = snow.size * (1 + treble * 0.3);
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
        
        // 地面反光
        this.ctx.shadowBlur = 0;
        const glow = this.ctx.createRadialGradient(cx, groundY + 30, 0, cx, groundY + 30, baseWidth * 1.8);
        glow.addColorStop(0, `hsla(${hue}, 80%, 60%, ${brightness * 0.15 + stepBrightness * 0.1})`);
        glow.addColorStop(0.5, `hsla(${hue}, 65%, 45%, ${brightness * 0.06})`);
        glow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = glow;
        this.ctx.fillRect(cx - baseWidth * 1.8, groundY, baseWidth * 3.6, 80);
        
        // 效果指示器
        const indicatorY = groundY + 55;
        let indicatorText = '古建筑';
        if (this.ancientEffects.rotation) indicatorText += ' | 摇摆';
        if (this.ancientEffects.outline) indicatorText += ' | 音符光';
        if (this.ancientEffects.particles) indicatorText += ' | 飘雪';
        indicatorText += ' (R/O/T切换)';
        
        this.ctx.shadowBlur = 5 + brightness * 6;
        this.ctx.shadowColor = `hsl(${hue}, 80%, 65%)`;
        this.ctx.font = '12px "Microsoft YaHei", sans-serif';
        this.ctx.fillStyle = `hsla(${hue}, 70%, ${65 + brightness * 15}%, ${brightness * 0.7})`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(indicatorText, cx, indicatorY);
        
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.textAlign = 'left';
    }

});
