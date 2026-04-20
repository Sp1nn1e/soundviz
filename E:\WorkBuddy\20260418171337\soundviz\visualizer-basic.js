/**
 * visualizer-basic.js
 * 基础渲染模式：波形 / 频谱柱 / 粒子 / 圆形 / 光点 / 反应式 / 3D波浪 / 图案
 * 
 * 依赖：visualizer-core.js（Visualizer 类定义）
 * 请在 visualizer-core.js 之后加载此文件
 */

Object.assign(Visualizer.prototype, {

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
    },

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
    },

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
    },

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
    },

    renderCircleRing(data, cx, cy, radius, intensity, offset) {
        const segments = 180;
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
        
        const gradient = this.ctx.createRadialGradient(cx, cy, radius - 20, cx, cy, radius + 80);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.5, this.colorScheme.mid);
        gradient.addColorStop(1, this.colorScheme.treble);
        
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = this.colorScheme.mid;
        this.ctx.shadowBlur = this.params.glow * intensity;
        this.ctx.stroke();
        
        this.ctx.fillStyle = `rgba(${this.hexToRgb(this.colorScheme.bass)}, ${0.1 * intensity})`;
        this.ctx.fill();
        
        this.params.rotation += 0.002 * intensity;
    },

    renderDots() {
        const data = this.audioEngine.frequencyData;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        const cols = 32;
        const rows = 16;
        const cellWidth = this.width / cols;
        const cellHeight = this.height / rows;
        const dotSize = this.params.dotSize;
        
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
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = this.params.glow * value;
                this.ctx.fill();
                
                if (value > 0.5) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${(value - 0.5) * 0.3})`;
                    this.ctx.fill();
                }
            }
        }
    },

    renderReactive() {
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        if (bass > 0.4) {
            const gradient = this.ctx.createRadialGradient(
                this.width / 2, this.height / 2, 0,
                this.width / 2, this.height / 2, this.width * bass
            );
            gradient.addColorStop(0, this.colorScheme.bass);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = bass * 0.4;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.globalAlpha = 1;
        }
        
        this.renderEdgeLights(bass, mid, treble);
        this.renderCenterEffect(bass, mid, treble);
        this.renderDistortedGrid(bass, mid);
    },

    renderEdgeLights(bass, mid, treble) {
        const thickness = 20 + bass * 40;
        const glow = this.params.glow * bass;
        
        const gradientTop = this.ctx.createLinearGradient(0, 0, 0, thickness);
        gradientTop.addColorStop(0, this.colorScheme.bass);
        gradientTop.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradientTop;
        this.ctx.shadowColor = this.colorScheme.bass;
        this.ctx.shadowBlur = glow;
        this.ctx.fillRect(0, 0, this.width, thickness);
        
        const gradientBottom = this.ctx.createLinearGradient(0, this.height - thickness, 0, this.height);
        gradientBottom.addColorStop(0, 'transparent');
        gradientBottom.addColorStop(1, this.colorScheme.treble);
        this.ctx.fillStyle = gradientBottom;
        this.ctx.shadowColor = this.colorScheme.treble;
        this.ctx.fillRect(0, this.height - thickness, this.width, thickness);
        
        const gradientLeft = this.ctx.createLinearGradient(0, 0, thickness, 0);
        gradientLeft.addColorStop(0, this.colorScheme.mid);
        gradientLeft.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradientLeft;
        this.ctx.shadowColor = this.colorScheme.mid;
        this.ctx.shadowBlur = glow * mid;
        this.ctx.fillRect(0, 0, thickness, this.height);
        
        const gradientRight = this.ctx.createLinearGradient(this.width - thickness, 0, this.width, 0);
        gradientRight.addColorStop(0, 'transparent');
        gradientRight.addColorStop(1, this.colorScheme.mid);
        this.ctx.fillStyle = gradientRight;
        this.ctx.shadowBlur = glow * mid;
        this.ctx.fillRect(this.width - thickness, 0, thickness, this.height);
    },

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
        this.ctx.shadowColor = this.colorScheme.bass;
        this.ctx.shadowBlur = this.params.glow * bass;
        this.ctx.stroke();
        
        const midRadius = maxRadius * (0.5 + mid * 0.3);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, midRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.colorScheme.mid;
        this.ctx.lineWidth = 2 + mid * 3;
        this.ctx.shadowColor = this.colorScheme.mid;
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
    },

    renderDistortedGrid(bass, mid) {
        const gridSize = 50;
        const offset = bass * 20;
        
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
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
    },

    render3DWave() {
        const data = this.audioEngine.frequencyData;
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        
        const rows = 20;
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
            
            for (let i = 0; i < cols; i++) {
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
    },

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
                
                const animOffset = Math.sin(Date.now() * 0.003 + i * j) * 0.2;
                value = Math.max(0, value + animOffset * bass);
                
                const x = i * cellWidth + cellWidth / 2;
                const y = j * cellHeight + cellHeight / 2;
                const size = 20 + value * 30;
                
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

});
