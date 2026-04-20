/**
 * SoundViz - 音频可视化主程序 V2
 */

class SoundViz {
    constructor() {
        this.audioEngine = null;
        this.visualizer = null;
        this.uiController = null;
        
        this.init();
    }

    async init() {
        console.log('[SoundViz] 启动中...');
        
        // 初始化音频引擎
        this.audioEngine = new AudioEngine();
        await this.audioEngine.init();
        
        // 初始化可视化引擎
        const canvas = document.getElementById('visualizerCanvas');
        this.visualizer = new Visualizer(canvas, this.audioEngine);
        
        // 初始化UI控制器
        this.uiController = new UIController(this.audioEngine, this.visualizer);
        
        // 启动渲染循环
        this.visualizer.start();
        
        // 显示启动提示
        this.showWelcome();
        
        console.log('[SoundViz] 初始化完成');
        console.log('[SoundViz] 可用模式:', ['waveform', 'bars', 'particles', 'circle', 'dots', 'reactive', '3dwave', 'shapes', 'ancient', 'imagewave', 'tiled', 'vortex']);
    }

    showWelcome() {
        const welcome = document.getElementById('welcome');
        if (welcome) {
            setTimeout(() => {
                welcome.style.opacity = '0';
                setTimeout(() => {
                    welcome.style.display = 'none';
                }, 1000);
            }, 3000);
        }
    }

    getAudioEngine() {
        return this.audioEngine;
    }

    getVisualizer() {
        return this.visualizer;
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('全屏模式不可用');
            });
        } else {
            document.exitFullscreen();
        }
    }

    exportSettings() {
        return {
            mode: this.visualizer.mode,
            params: this.visualizer.params,
            colorScheme: this.visualizer.colorScheme
        };
    }

    importSettings(settings) {
        if (settings.mode) {
            this.visualizer.setMode(settings.mode);
        }
        if (settings.params) {
            Object.assign(this.visualizer.params, settings.params);
        }
        if (settings.colorScheme) {
            this.visualizer.colorScheme = settings.colorScheme;
        }
    }

    destroy() {
        if (this.visualizer) {
            this.visualizer.stop();
        }
        if (this.audioEngine) {
            this.audioEngine.destroy();
        }
        if (this.uiController) {
            this.uiController.destroy();
        }
    }
}

let app = null;

document.addEventListener('DOMContentLoaded', async () => {
    app = new SoundViz();
    
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            app.toggleFullscreen();
        });
    }
});

window.SoundViz = SoundViz;
window.getApp = () => app;
