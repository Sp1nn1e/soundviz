/**
 * visualizer-ball.js
 * 发光球模式：弹跳发光球 + 节拍驱动物理 + 拖尾特效 + 粒子背景
 * 
 * 依赖：visualizer-core.js（Visualizer 类定义）
 * 请在 visualizer-core.js 之后加载此文件
 */

Object.assign(Visualizer.prototype, {

    initBouncingBall() {
        this.ball = {
            x: this.width / 2,
            y: this.height / 2,
            vx: 5,
            vy: 3,
            radius: 8,
            radiusVel: 0,
            hue: 0
        };
        this.ballRadiusVel = 0;
    },

    renderBouncingBall() {
        if (!this.ball) {
            this.initBouncingBall();
        }

        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        const beat = this.audioEngine.beatDetector;
        const note = this.audioEngine.noteDetector;

        // 节拍驱动：大幅跳跃
        if (beat.isBeat) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 14 + beat.beatIntensity * 22;
            this.ball.vx = this.ball.vx * 0.3 + Math.cos(angle) * speed;
            this.ball.vy = this.ball.vy * 0.3 + Math.sin(angle) * speed - 6;
        }

        // 音符驱动：高频微弹
        if (note.isOnset) {
            const aImpulse = note.onsetIntensity * 5;
            this.ball.vx += (Math.random() - 0.5) * aImpulse;
            this.ball.vy += (Math.random() - 0.5) * aImpulse;

            const bImpulse = note.onsetIntensity * 2;
            this.ball.radius += bImpulse;
            this.ballRadiusVel += bImpulse * 2;
        }

        // 频率驱动：速度场
        const freqBoost = bass * 3 + treble * 2.5 + mid * 1;
        const speedMult = 1 + freqBoost;
        const wobble = treble * 1.5;
        const wobbleX = (Math.random() - 0.5) * wobble;
        const wobbleY = (Math.random() - 0.5) * wobble * 0.5;
        this.ball.x += (this.ball.vx + wobbleX) * speedMult * 0.5;
        this.ball.y += (this.ball.vy + wobbleY) * speedMult * 0.5;

        // 边界碰撞反弹
        const elasticity = 0.75 + beat.beatIntensity * 0.2;
        const margin = this.ball.radius;
        if (this.ball.x < margin) { this.ball.x = margin; this.ball.vx = Math.abs(this.ball.vx) * elasticity; }
        if (this.ball.x > this.width - margin) { this.ball.x = this.width - margin; this.ball.vx = -Math.abs(this.ball.vx) * elasticity; }
        if (this.ball.y < margin) { this.ball.y = margin; this.ball.vy = Math.abs(this.ball.vy) * elasticity; }
        if (this.ball.y > this.height - margin) { this.ball.y = this.height - margin; this.ball.vy = -Math.abs(this.ball.vy) * elasticity; }

        // 重力
        this.ball.vy += 0.25 + bass * 0.3;

        // 随机抖动
        if (Math.random() < 0.15) {
            this.ball.vx += (Math.random() - 0.5) * (1 + treble * 3);
            this.ball.vy += (Math.random() - 0.5) * (1 + bass * 2);
        }

        // 摩擦力
        this.ball.vx *= 0.992;
        this.ball.vy *= 0.992;

        // 球体大小：节拍+音符双驱动 + 平滑插值
        const baseRadius = 8;
        const energy = (bass + mid + treble) / 3;

        const beatScale = beat.isBeat
            ? (beat.beatIntensity * 3 + bass * 4)
            : 0;
        const noteScale = note.onsetIntensity * 2 + mid * 1.5;
        const targetRadius = baseRadius * (1 + energy * 1.5 + beatScale + noteScale);
        const smoothing = 0.2 + treble * 0.1;
        this.ballRadiusVel += (targetRadius - this.ball.radius) * smoothing;
        this.ballRadiusVel *= 0.75;
        this.ball.radius += this.ballRadiusVel;
        this.ball.radius = Math.max(4, this.ball.radius);

        // 色调变化
        this.ball.hue = (this.ball.hue + 0.3 + treble * 2) % 360;

        // 发光强度
        const noteFlicker = Math.abs(Math.sin(Date.now() * 0.015)) * 0.4 + 0.6;
        const beatFlash = beat.isBeat ? (0.3 + beat.beatIntensity * 0.4) : 0;
        const onsetFlash = note.isOnset ? (note.onsetIntensity * 0.5) : 0;
        const glowIntensity = (0.25 + bass * 0.5 + mid * 0.3 + treble * 0.2 + beatFlash + onsetFlash) * noteFlicker;
        const glowSize = this.ball.radius * (2.5 + bass * 4 + beat.beatIntensity * 2);

        // 拖尾
        this.renderBallTrail(glowIntensity);

        // 外层大光晕
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

        // 中层光晕
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

        // 球体核心
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

        // 高光
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

        // 节拍冲击波
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

        // 音符冲击波
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

        // 背景粒子
        this.renderBallParticles(bass, mid, treble, glowIntensity);
    },

    renderBallTrail(glowIntensity) {
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
    },

    renderBallParticles(bass, mid, treble, glowIntensity) {
        // 低频粒子
        const bassCount = Math.floor(15 + bass * 25);
        for (let i = 0; i < bassCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.ball.radius + Math.random() * 80 + bass * 60;
            const x = this.ball.x + Math.cos(angle) * distance;
            const y = this.ball.y + Math.sin(angle) * distance;
            const size = 3 + Math.random() * 5 + bass * 4;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${this.ball.hue}, 100%, 70%, ${glowIntensity * 0.5})`;
            this.ctx.shadowColor = `hsla(${this.ball.hue}, 100%, 70%, 1)`;
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

});
