/**
 * visualizer-extra.js
 * 扩展渲染模式：图片波浪 / 平铺图案 / 漩涡
 * 
 * 依赖：visualizer-core.js（Visualizer 类定义）
 * 请在 visualizer-core.js 之后加载此文件
 */

Object.assign(Visualizer.prototype, {

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
        
        this.renderWaveScanLines(bass, mid);
    },

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
    },

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
        
        const scale = 1 + bass * 0.5;
        const offsetX = Math.sin(Date.now() * 0.001) * 50 * bass;
        const offsetY = Math.cos(Date.now() * 0.001) * 50 * bass;
        
        const drawX = (this.width - w * scale) / 2 + offsetX;
        const drawY = (this.height - h * scale) / 2 + offsetY;
        
        this.ctx.save();
        this.ctx.filter = `hue-rotate(${bass * 120}deg) saturate(${1 + mid}) brightness(${1 + treble * 0.5})`;
        this.ctx.globalAlpha = 0.7 + bass * 0.3;
        
        const tileSize = Math.min(w, h) * scale;
        for (let tx = -tileSize; tx < this.width + tileSize; tx += tileSize) {
            for (let ty = -tileSize; ty < this.height + tileSize; ty += tileSize) {
                this.ctx.drawImage(this.customImage, drawX + tx, drawY + ty, tileSize, tileSize);
            }
        }
        
        this.ctx.restore();
        this.renderTileGrid(bass);
    },

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
    },

    renderVortex() {
        const bass = this.audioEngine.bassData.current * this.params.sensitivity;
        const mid = this.audioEngine.midData.current * this.params.sensitivity;
        const treble = this.audioEngine.trebleData.current * this.params.sensitivity;
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        
        const arms = 5;
        const points = 200;
        
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
            this.ctx.shadowColor = `hsla(${hue}, 100%, 60%, 1)`;
            this.ctx.shadowBlur = this.params.glow;
            this.ctx.stroke();
        }
        
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
        
        this.renderVortexParticles(bass, mid);
    },

    renderVortexParticles(bass, mid) {
        const count = Math.floor(mid * 50);
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
            this.ctx.shadowColor = this.ctx.fillStyle;
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
        }
    }

});
