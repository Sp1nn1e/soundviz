/**
 * UIController - UI控制面板 V2
 */

class UIController {
    constructor(audioEngine, visualizer) {
        this.audioEngine = audioEngine;
        this.visualizer = visualizer;
        
        this.elements = {};
        this.isPanelOpen = false;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateFreqDisplay();
        this.updateLoopUI(this.audioEngine.loopMode);
        this.renderPlaylist(this.audioEngine.playlist);
        
        // 检查是否有保存的歌单
        if (this.audioEngine.hasSavedPlaylist()) {
            const savedNames = this.audioEngine.getSavedPlaylistNames();
            console.log('[UI] 歌单已保留:', savedNames);
            this.setStatus('📋 歌单已保留 (' + savedNames.length + '首)，请重新添加文件');
        }
        
        this.freqInterval = setInterval(() => this.updateFreqDisplay(), 50);

        // 初始化手机模式
        this.initPhoneMode();
    }

    cacheElements() {
        this.elements = {
            // 音频源
            micBtn: document.getElementById('micBtn'),
            fileInput: document.getElementById('fileInput'),
            fileBtn: document.getElementById('fileBtn'),
            fileName: document.getElementById('fileName'),
            
            // 图片上传
            imageInput: document.getElementById('imageInput'),
            imageBtn: document.getElementById('imageBtn'),
            imageName: document.getElementById('imageName'),
            clearImageBtn: document.getElementById('clearImageBtn'),
            
            // 播放控制
            playPauseBtn: document.getElementById('playPauseBtn'),
            stopBtn: document.getElementById('stopBtn'),
            progressSlider: document.getElementById('progressSlider'),
            currentTimeEl: document.getElementById('currentTime'),
            totalTimeEl: document.getElementById('totalTime'),
            playerBar: document.getElementById('playerBar'),
            
            // 模式
            modeButtons: document.querySelectorAll('.mode-btn'),
            
            // 颜色主题
            themeButtons: document.querySelectorAll('.theme-btn'),
            
            // 滑块
            sensitivity: document.getElementById('sensitivity'),
            glow: document.getElementById('glow'),
            blur: document.getElementById('blur'),
            speed: document.getElementById('speed'),
            barCount: document.getElementById('barCount'),
            imageScale: document.getElementById('imageScale'),
            imageOpacity: document.getElementById('imageOpacity'),
            distortion: document.getElementById('distortion'),
            imageFilter: document.getElementById('imageFilter'),
            
            // 滑块值显示
            sensitivityValue: document.getElementById('sensitivityValue'),
            glowValue: document.getElementById('glowValue'),
            blurValue: document.getElementById('blurValue'),
            speedValue: document.getElementById('speedValue'),
            barCountValue: document.getElementById('barCountValue'),
            imageScaleValue: document.getElementById('imageScaleValue'),
            imageOpacityValue: document.getElementById('imageOpacityValue'),
            distortionValue: document.getElementById('distortionValue'),
            
            // 频率指示器
            bassBar: document.getElementById('bassBar'),
            midBar: document.getElementById('midBar'),
            trebleBar: document.getElementById('trebleBar'),
            bassValue: document.getElementById('bassValue'),
            midValue: document.getElementById('midValue'),
            trebleValue: document.getElementById('trebleValue'),
            
            // 状态
            status: document.getElementById('status'),
            
            // 面板切换
            togglePanel: document.getElementById('togglePanel'),
            controlPanel: document.getElementById('controlPanel'),

            // 手机模式
            phoneToggleBtn: document.getElementById('phoneToggleBtn'),
            phoneSimulator: document.getElementById('phoneSimulator'),
            phoneControlPanel: document.getElementById('phoneControlPanel'),
            phoneClosePanelBtn: document.getElementById('phoneClosePanelBtn'),
            phoneSettingsBtn: document.getElementById('phoneSettingsBtn'),
            phoneScreen: document.getElementById('phoneScreen'),
            phoneCanvas: document.getElementById('phoneCanvas'),
            phoneModeIndicator: document.getElementById('phoneModeIndicator'),
            // 顶部工具栏
            phoneMicBtn: document.getElementById('phoneMicBtn'),
            phoneFileBtn: document.getElementById('phoneFileBtn'),
            phoneImageBtn: document.getElementById('phoneImageBtn'),
            phonePlaylistBtn: document.getElementById('phonePlaylistBtn'),
            // 隐藏的文件输入
            phoneFileInput: document.getElementById('phoneFileInput'),
            phoneImageInput: document.getElementById('phoneImageInput'),
            // 控制面板内按钮
            phoneMicBtn2: document.getElementById('phoneMicBtn2'),
            phoneFileBtn2: document.getElementById('phoneFileBtn2'),
            phoneImageBtn2: document.getElementById('phoneImageBtn2'),
            // 歌单面板
            phonePlaylistPanel: document.getElementById('phonePlaylistPanel'),
            phoneClosePlaylistBtn: document.getElementById('phoneClosePlaylistBtn'),
            phoneLoopBtn: document.getElementById('phoneLoopBtn'),
            phoneLoopLabel: document.getElementById('phoneLoopLabel'),
            phoneLoopInlineBtn: document.getElementById('phoneLoopInlineBtn'),
            phonePrevBtn: document.getElementById('phonePrevBtn'),
            phoneNextBtn: document.getElementById('phoneNextBtn'),
            phoneAddMusicBtn: document.getElementById('phoneAddMusicBtn'),
            phonePlaylistSongs: document.getElementById('phonePlaylistSongs'),
            // 播放栏
            phonePlayBtn: document.getElementById('phonePlayBtn'),
            phoneProgress: document.getElementById('phoneProgress'),
            phoneSongTitle: document.getElementById('phoneSongTitle'),
            phoneCurrentTime: document.getElementById('phoneCurrentTime'),
            phoneTotalTime: document.getElementById('phoneTotalTime')
        };

        // 手机模式状态
        this.isPhoneMode = false;
        this.phoneCanvasContext = null;
    }

    bindEvents() {
        // 麦克风按钮
        this.elements.micBtn.addEventListener('click', () => this.toggleMicrophone());
        
        // 音频文件
        this.elements.fileInput.addEventListener('change', (e) => this.handleAudioFile(e));
        this.elements.fileBtn.addEventListener('click', () => this.elements.fileInput.click());
        
        // 图片上传
        this.elements.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        this.elements.imageBtn.addEventListener('click', () => this.elements.imageInput.click());
        this.elements.clearImageBtn.addEventListener('click', () => this.clearImage());
        
        // 播放控制
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.elements.stopBtn.addEventListener('click', () => this.stopPlayback());
        this.elements.progressSlider.addEventListener('input', (e) => this.seekTo(e.target.value));
        
        // 前进后退
        const rewindBtn = document.getElementById('rewindBtn');
        if (rewindBtn) {
            rewindBtn.addEventListener('click', () => this.rewind());
        }
        const forwardBtn = document.getElementById('forwardBtn');
        if (forwardBtn) {
            forwardBtn.addEventListener('click', () => this.forward());
        }
        
        // 模式切换 - 改为 toggleMode 支持叠加
        this.elements.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.toggleMode(btn.dataset.mode));
        });
        
        // 颜色主题
        this.elements.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
        });
        
        // 滑块
        this.elements.sensitivity.addEventListener('input', (e) => this.handleSensitivity(e.target.value));
        this.elements.glow.addEventListener('input', (e) => this.handleGlow(e.target.value));
        this.elements.blur.addEventListener('input', (e) => this.handleBlur(e.target.value));
        this.elements.speed.addEventListener('input', (e) => this.handleSpeed(e.target.value));
        this.elements.barCount.addEventListener('input', (e) => this.handleBarCount(e.target.value));
        this.elements.imageScale.addEventListener('input', (e) => this.handleImageScale(e.target.value));
        this.elements.imageOpacity.addEventListener('input', (e) => this.handleImageOpacity(e.target.value));
        this.elements.distortion.addEventListener('input', (e) => this.handleDistortion(e.target.value));
        this.elements.imageFilter.addEventListener('change', (e) => this.handleImageFilter(e.target.value));
        
            // 面板切换按钮
            this.elements.togglePanel.addEventListener('click', () => this.togglePanel());
            
            // 顶部工具栏的设置按钮
            const topBarToggleBtn = document.getElementById('togglePanelBtn');
            if (topBarToggleBtn) {
                topBarToggleBtn.addEventListener('click', () => this.togglePanel());
            }
            
            // 播放条收起按钮
            this.elements.playerCollapseBtn = document.getElementById('playerCollapseBtn');
            if (this.elements.playerCollapseBtn) {
                this.elements.playerCollapseBtn.addEventListener('click', () => this.togglePlayerBar());
            }
            
            // 迷你播放按钮 - 点击展开播放条
            const miniBtn = document.getElementById('playerMiniBtn');
            if (miniBtn) {
                // 单击：展开播放条
                miniBtn.addEventListener('click', () => {
                    this.showPlayerBar();
                });
                // 双击：播放/暂停
                let lastClick = 0;
                miniBtn.addEventListener('dblclick', () => {
                    if (this.audioEngine.audioElement) {
                        this.togglePlay();
                    }
                });
            }
            
            // 频率指示器收起按钮
            const freqCollapseBtn = document.getElementById('freqCollapseBtn');
            if (freqCollapseBtn) {
                freqCollapseBtn.addEventListener('click', () => this.toggleFreqIndicator());
            }

            // 歌单面板
            const playlistBtn = document.getElementById('playlistBtn');
            if (playlistBtn) {
                playlistBtn.addEventListener('click', () => this.togglePlaylist());
            }
            const playlistCloseBtn = document.getElementById('playlistCloseBtn');
            if (playlistCloseBtn) {
                playlistCloseBtn.addEventListener('click', () => this.hidePlaylist());
            }
            const loopModeBtn = document.getElementById('loopModeBtn');
            if (loopModeBtn) {
                loopModeBtn.addEventListener('click', () => this.toggleLoop());
            }
            const prevTrackBtn = document.getElementById('prevTrackBtn');
            if (prevTrackBtn) {
                prevTrackBtn.addEventListener('click', () => this.prevTrack());
            }
            const nextTrackBtn = document.getElementById('nextTrackBtn');
            if (nextTrackBtn) {
                nextTrackBtn.addEventListener('click', () => this.nextTrack());
            }

            // 歌单多文件添加
            const playlistFileInput = document.getElementById('playlistFileInput');
            if (playlistFileInput) {
                playlistFileInput.addEventListener('change', (e) => this.handlePlaylistFiles(e));
            }

            // 注册音频引擎回调
            this.audioEngine.onPlaylistChange = (list) => this.renderPlaylist(list);
            this.audioEngine.onTrackChange = (idx, track) => this.onTrackChanged(idx, track);
            this.audioEngine.onLoopModeChange = (mode) => this.updateLoopUI(mode);

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // 进度更新
        this.progressInterval = setInterval(() => this.updateProgress(), 100);
    }

    /**
     * 初始化手机模式
     */
    initPhoneMode() {
        if (!this.elements.phoneToggleBtn) return;

        // 绑定手机模式按钮事件
        this.elements.phoneToggleBtn.addEventListener('click', () => this.togglePhoneMode());

        // 绑定手机控制面板按钮
        if (this.elements.phoneSettingsBtn) {
            this.elements.phoneSettingsBtn.addEventListener('click', () => this.togglePhoneControlPanel());
        }
        if (this.elements.phoneClosePanelBtn) {
            this.elements.phoneClosePanelBtn.addEventListener('click', () => this.togglePhoneControlPanel());
        }

        // 绑定手机控制面板中的效果按钮
        this.bindPhoneModeButtons();

        // 绑定手机控制面板中的滑块
        this.bindPhoneSliders();

        // 绑定手机内按钮事件
        if (this.elements.phoneMicBtn) {
            this.elements.phoneMicBtn.addEventListener('click', () => this.toggleMicrophone());
        }
        if (this.elements.phoneMicBtn2) {
            this.elements.phoneMicBtn2.addEventListener('click', () => this.toggleMicrophone());
        }
        
        // 文件上传
        if (this.elements.phoneFileBtn) {
            this.elements.phoneFileBtn.addEventListener('click', () => this.elements.phoneFileInput.click());
        }
        if (this.elements.phoneFileBtn2) {
            this.elements.phoneFileBtn2.addEventListener('click', () => this.elements.phoneFileInput.click());
        }
        if (this.elements.phoneFileInput) {
            this.elements.phoneFileInput.addEventListener('change', (e) => this.handleAudioFile(e));
        }
        
        // 图片上传
        if (this.elements.phoneImageBtn) {
            this.elements.phoneImageBtn.addEventListener('click', () => this.elements.phoneImageInput.click());
        }
        if (this.elements.phoneImageBtn2) {
            this.elements.phoneImageBtn2.addEventListener('click', () => this.elements.phoneImageInput.click());
        }
        if (this.elements.phoneImageInput) {
            this.elements.phoneImageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        
        // 歌单
        if (this.elements.phonePlaylistBtn) {
            this.elements.phonePlaylistBtn.addEventListener('click', () => this.togglePhonePlaylist());
        }
        if (this.elements.phoneClosePlaylistBtn) {
            this.elements.phoneClosePlaylistBtn.addEventListener('click', () => this.togglePhonePlaylist());
        }
        if (this.elements.phoneAddMusicBtn) {
            this.elements.phoneAddMusicBtn.addEventListener('click', () => this.elements.phoneFileInput.click());
        }
        
        // 循环模式
        if (this.elements.phoneLoopBtn) {
            this.elements.phoneLoopBtn.addEventListener('click', () => this.toggleLoopMode());
        }
        if (this.elements.phoneLoopInlineBtn) {
            this.elements.phoneLoopInlineBtn.addEventListener('click', () => this.toggleLoopMode());
        }

        // 播放控制
        if (this.elements.phonePlayBtn) {
            this.elements.phonePlayBtn.addEventListener('click', () => this.togglePlay());
        }
        if (this.elements.phonePrevBtn) {
            this.elements.phonePrevBtn.addEventListener('click', () => this.playPrev());
        }
        if (this.elements.phoneNextBtn) {
            this.elements.phoneNextBtn.addEventListener('click', () => this.playNext());
        }
        if (this.elements.phoneProgress) {
            this.elements.phoneProgress.addEventListener('input', (e) => this.seekTo(e.target.value));
        }

        // 初始化手机画布
        this.initPhoneCanvas();
        
        // 初始化手机歌单UI
        this.initPhonePlaylist();
    }
    
    /**
     * 切换手机歌单面板
     */
    togglePhonePlaylist() {
        const panel = this.elements.phonePlaylistPanel;
        if (panel) {
            panel.classList.toggle('open');
            // 关闭控制面板
            if (panel.classList.contains('open')) {
                this.elements.phoneControlPanel?.classList.remove('open');
            }
        }
    }
    
    /**
     * 初始化手机歌单UI
     */
    initPhonePlaylist() {
        this.renderPhonePlaylist();
        // 监听歌单变化
        if (this.audioEngine) {
            this.audioEngine.on('playlistChanged', () => this.renderPhonePlaylist());
        }
    }
    
    /**
     * 渲染手机歌单
     */
    renderPhonePlaylist() {
        const container = this.elements.phonePlaylistSongs;
        if (!container || !this.audioEngine) return;
        
        const playlist = this.audioEngine.playlist;
        if (playlist.length === 0) {
            container.innerHTML = '<div class="phone-playlist-empty">暂无歌曲</div>';
            return;
        }
        
        const currentIndex = this.audioEngine.currentIndex;
        container.innerHTML = playlist.map((song, index) => `
            <div class="phone-song-item ${index === currentIndex ? 'playing' : ''}" data-index="${index}">
                <span>${index === currentIndex ? '▶' : '♪'}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${song.name}</span>
            </div>
        `).join('');
        
        // 绑定点击事件
        container.querySelectorAll('.phone-song-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.playSong(index);
            });
        });
    }
    
    /**
     * 切换循环模式
     */
    toggleLoopMode() {
        if (!this.audioEngine) return;
        // 使用 audio-engine 统一的模式名：off/single/list
        const modes = ['off', 'single', 'list'];
        const labels = { off: '顺序播放', single: '单曲循环', list: '列表循环' };
        const currentIndex = modes.indexOf(this.audioEngine.loopMode);
        const newMode = modes[(currentIndex + 1) % modes.length];
        this.audioEngine.setLoopMode(newMode);

        // 更新手机UI标签
        if (this.elements.phoneLoopLabel) {
            this.elements.phoneLoopLabel.textContent = labels[newMode];
        }
        if (this.elements.phoneLoopBtn) {
            this.elements.phoneLoopBtn.classList.toggle('active', newMode !== 'off');
        }
        if (this.elements.phoneLoopInlineBtn) {
            this.elements.phoneLoopInlineBtn.classList.toggle('active', newMode !== 'off');
        }
        this.updateLoopUI(newMode);
    }
    
    /**
     * 播放指定歌曲
     */
    playSong(index) {
        if (!this.audioEngine || index < 0) return;
        this.audioEngine.playSong(index);
        this.updatePlayButton(true);
    }

    /**
     * 初始化手机画布
     */
    initPhoneCanvas() {
        const phoneCanvas = this.elements.phoneCanvas;
        if (!phoneCanvas) return;

        this.phoneCanvasContext = phoneCanvas.getContext('2d');

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.updatePhoneCanvasSize();
        });
    }

    /**
     * 更新手机画布尺寸
     */
    updatePhoneCanvasSize() {
        const phoneCanvas = this.elements.phoneCanvas;
        const phoneScreen = this.elements.phoneScreen;
        if (!phoneCanvas || !phoneScreen) return;

        // 等待 DOM 渲染完成
        requestAnimationFrame(() => {
            // 使用 CSS 尺寸来设置画布尺寸
            const rect = phoneScreen.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                phoneCanvas.width = Math.floor(rect.width);
                phoneCanvas.height = Math.floor(rect.height);
            } else {
                // 备用方案：使用固定尺寸
                phoneCanvas.width = 375;
                phoneCanvas.height = 742;
            }
        });
    }

    /**
     * 切换手机模式
     */
    togglePhoneMode() {
        this.isPhoneMode = !this.isPhoneMode;

        if (this.isPhoneMode) {
            document.body.classList.add('phone-mode-active');
            this.elements.phoneToggleBtn.classList.add('active');
            this.elements.phoneToggleBtn.innerHTML = '📴';

            // 自动切换到手机渲染模式
            if (this.visualizer) {
                this.visualizer._isPhoneMode = true;
            }

            // 显示指示器
            this.showPhoneModeIndicator();

            // 延迟设置画布尺寸，等待 DOM 渲染完成
            setTimeout(() => {
                // 更新画布尺寸
                this.updatePhoneCanvasSize();
                // 设置给 visualizer
                if (this.visualizer && this.visualizer.setPhoneCanvas) {
                    this.visualizer.setPhoneCanvas(this.elements.phoneCanvas);
                }
            }, 200);

        } else {
            document.body.classList.remove('phone-mode-active');
            this.elements.phoneToggleBtn.classList.remove('active');
            this.elements.phoneToggleBtn.innerHTML = '📱';
            
            // 自动切换回桌面渲染模式
            if (this.visualizer) {
                this.visualizer._isPhoneMode = false;
            }
            
            // 清除 visualizer 的手机画布
            if (this.visualizer && this.visualizer.setPhoneCanvas) {
                this.visualizer.setPhoneCanvas(null);
            }
        }
    }

    /**
     * 显示手机模式指示器
     */
    showPhoneModeIndicator() {
        const indicator = this.elements.phoneModeIndicator;
        if (!indicator) return;

        indicator.classList.add('visible');
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    }

    /**
     * 切换手机控制面板显示
     */
    togglePhoneControlPanel() {
        const panel = this.elements.phoneControlPanel;
        if (panel) {
            panel.classList.toggle('open');
            // 关闭歌单面板
            if (panel.classList.contains('open')) {
                this.elements.phonePlaylistPanel?.classList.remove('open');
            }
        }
    }

    /**
     * 绑定手机控制面板中的效果按钮
     */
    bindPhoneModeButtons() {
        const phonePanel = document.getElementById('phoneControlPanel');
        if (!phonePanel) return;

        // 四季特效按钮
        phonePanel.querySelectorAll('.phone-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (mode) {
                    this.toggleMode(mode);
                    // 同步更新手机面板按钮状态
                    this.syncPhoneModeButtons();
                }
            });
        });

        // 颜色主题按钮
        phonePanel.querySelectorAll('.phone-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                if (theme) {
                    this.setTheme(theme);
                    // 同步更新手机面板按钮状态
                    this.syncPhoneThemeButtons();
                }
            });
        });
    }

    /**
     * 同步手机面板的模式按钮状态
     */
    syncPhoneModeButtons() {
        const phonePanel = document.getElementById('phoneControlPanel');
        if (!phonePanel) return;

        // 同步四季特效按钮
        phonePanel.querySelectorAll('.phone-mode-btn[data-mode]').forEach(btn => {
            const mode = btn.dataset.mode;
            if (this.visualizer.activeModes.includes(mode)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 同步手机面板的主题按钮状态
     */
    syncPhoneThemeButtons() {
        const phonePanel = document.getElementById('phoneControlPanel');
        if (!phonePanel) return;

        phonePanel.querySelectorAll('.phone-theme-btn').forEach(btn => {
            const theme = btn.dataset.theme;
            if (this.visualizer.colorScheme.name === theme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 绑定手机控制面板中的滑块
     */
    bindPhoneSliders() {
        const phonePanel = document.getElementById('phoneControlPanel');
        if (!phonePanel) return;

        // 灵敏度滑块
        const sensitivitySlider = phonePanel.querySelector('#phoneSensitivity');
        if (sensitivitySlider) {
            sensitivitySlider.addEventListener('input', (e) => {
                this.visualizer.setParam('sensitivity', parseFloat(e.target.value));
                this.updateSliderValue('sensitivityValue', e.target.value);
            });
        }

        // 光晕滑块
        const glowSlider = phonePanel.querySelector('#phoneGlow');
        if (glowSlider) {
            glowSlider.addEventListener('input', (e) => {
                this.visualizer.setParam('glow', parseFloat(e.target.value));
                this.updateSliderValue('glowValue', e.target.value);
            });
        }
    }

    /**
     * 更新滑块显示值
     */
    updateSliderValue(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
        }
    }

    /**
     * 更新手机模式歌曲信息
     */
    updatePhoneSongInfo(title) {
        if (this.elements.phoneSongTitle) {
            this.elements.phoneSongTitle.textContent = title || '未播放';
        }
    }

    /**
     * 更新手机模式播放按钮
     */
    updatePhonePlayButton(isPlaying) {
        if (this.elements.phonePlayBtn) {
            this.elements.phonePlayBtn.textContent = isPlaying ? '⏸' : '▶';
        }
    }

    /**
     * 更新手机模式进度条
     */
    updatePhoneProgress(current, total) {
        if (this.elements.phoneProgress && total > 0) {
            this.elements.phoneProgress.value = (current / total) * 100;
        }
    }

    async toggleMicrophone() {
        if (this.audioEngine.isPlaying && this.audioEngine.source?.mediaStream) {
            this.audioEngine.stopMicrophone();
            this.elements.micBtn.classList.remove('active');
            this.elements.micBtn.innerHTML = '🎤 麦克风';
            this.setStatus('等待输入...');
        } else {
            try {
                // 🔧 移动端修复：确保 AudioContext 在用户交互时被激活
                if (this.audioEngine.audioContext && this.audioEngine.audioContext.state === 'suspended') {
                    await this.audioEngine.audioContext.resume();
                }
                
                await this.audioEngine.startMicrophone();
                this.elements.micBtn.classList.add('active');
                this.elements.micBtn.innerHTML = '🔴 录音中';
                this.setStatus('麦克风已连接');
                
                if (!this.visualizer.isRunning) {
                    this.visualizer.start();
                }
            } catch (error) {
                // 🔧 针对不同错误类型提供不同提示
                if (error.message === 'MIC_NOT_SUPPORTED') {
                    this.setStatus('麦克风功能不可用，请使用Chrome或Safari浏览器');
                } else {
                    this.setStatus('麦克风访问失败: ' + error.message);
                }
            }
        }
    }

    async handleAudioFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            this.setStatus('加载音频文件...');
            
            // 🔧 移动端修复：确保 AudioContext 在用户交互时被激活
            if (this.audioEngine.audioContext && this.audioEngine.audioContext.state === 'suspended') {
                await this.audioEngine.audioContext.resume();
            }
            
            // 添加到歌单并播放
            const idx = this.audioEngine.addToPlaylist(file);
            await this.audioEngine.playTrack(idx);
            this.elements.fileName.textContent = file.name;
            this.elements.fileBtn.classList.add('active');
            this.setStatus('🎶 ' + file.name);

            // 显示播放条并更新歌单UI
            this.showPlayerBar();
            this.renderPlaylist(this.audioEngine.playlist);
            this.showPlaylist();

            if (!this.visualizer.isRunning) {
                this.visualizer.start();
            }
        } catch (error) {
            this.setStatus('文件加载失败');
        }
    }

    async handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            this.setStatus('请上传图片文件');
            return;
        }
        
        try {
            this.setStatus('加载图片...');
            await this.visualizer.loadImage(file);
            this.elements.imageName.textContent = file.name;
            this.elements.imageBtn.classList.add('active');
            this.setStatus('图片已加载: ' + file.name);
            
            if (!this.visualizer.isRunning) {
                this.visualizer.start();
            }
        } catch (error) {
            this.setStatus('图片加载失败');
        }
    }

    clearImage() {
        this.visualizer.clearImage();
        this.elements.imageName.textContent = '';
        this.elements.imageBtn.classList.remove('active');
        this.setStatus('图片已清除');
    }

    // 播放控制方法
    togglePlay() {
        if (!this.audioEngine.audioElement) {
            this.setStatus('请先加载音频文件');
            return;
        }
        
        // 🔧 移动端修复：确保 AudioContext 在用户交互时被激活
        if (this.audioEngine.audioContext && this.audioEngine.audioContext.state === 'suspended') {
            this.audioEngine.audioContext.resume();
        }
        
        this.audioEngine.togglePlay();
        this.updatePlayButton();
    }

    stopPlayback() {
        if (this.audioEngine.audioElement) {
            this.audioEngine.audioElement.pause();
            this.audioEngine.audioElement.currentTime = 0;
            this.audioEngine.isPlaying = false;
            this.updatePlayButton();
            this.elements.progressSlider.value = 0;
            this.elements.currentTimeEl.textContent = '0:00';
        }
    }

    rewind() {
        if (this.audioEngine.audioElement) {
            const newTime = Math.max(0, this.audioEngine.currentTime - 5);
            this.audioEngine.seek(newTime);
        }
    }

    forward() {
        if (this.audioEngine.audioElement) {
            const newTime = Math.min(this.audioEngine.duration, this.audioEngine.currentTime + 5);
            this.audioEngine.seek(newTime);
        }
    }

    seekTo(percent) {
        if (this.audioEngine.audioElement && this.audioEngine.duration) {
            const time = (percent / 100) * this.audioEngine.duration;
            this.audioEngine.seek(time);
        }
    }

    updatePlayButton() {
        const isPlaying = this.audioEngine.audioElement && !this.audioEngine.audioElement.paused;
        this.elements.playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
        this.elements.playPauseBtn.classList.toggle('playing', isPlaying);
        
        // 更新迷你按钮
        const miniBtn = document.getElementById('playerMiniBtn');
        if (miniBtn) {
            miniBtn.textContent = isPlaying ? '⏸️' : '▶️';
            miniBtn.classList.toggle('playing', isPlaying);
        }
        
        // 更新手机播放按钮
        if (this.elements.phonePlayBtn) {
            this.elements.phonePlayBtn.textContent = isPlaying ? '⏸' : '▶';
            this.elements.phonePlayBtn.classList.toggle('active', isPlaying);
        }
    }

    updateProgress() {
        if (this.audioEngine.audioElement && this.audioEngine.duration) {
            const percent = (this.audioEngine.currentTime / this.audioEngine.duration) * 100;
            this.elements.progressSlider.value = percent;
            this.elements.currentTimeEl.textContent = this.audioEngine.formatTime(this.audioEngine.currentTime);
            this.elements.totalTimeEl.textContent = this.audioEngine.formatTime(this.audioEngine.duration);
            
            // 更新手机界面进度
            if (this.elements.phoneProgress) {
                this.elements.phoneProgress.value = percent;
            }
            if (this.elements.phoneCurrentTime) {
                this.elements.phoneCurrentTime.textContent = this.audioEngine.formatTime(this.audioEngine.currentTime);
            }
            if (this.elements.phoneTotalTime) {
                this.elements.phoneTotalTime.textContent = this.audioEngine.formatTime(this.audioEngine.duration);
            }
        }
    }

    showPlayerBar() {
        this.elements.playerBar.classList.add('visible');
        const miniBtn = document.getElementById('playerMiniBtn');
        if (miniBtn) miniBtn.classList.remove('faded');
    }

    hidePlayerBar() {
        this.elements.playerBar.classList.remove('visible');
        const miniBtn = document.getElementById('playerMiniBtn');
        if (miniBtn) miniBtn.classList.add('faded');
    }

    togglePlayerBar() {
        this.elements.playerBar.classList.toggle('visible');
        const miniBtn = document.getElementById('playerMiniBtn');
        if (miniBtn) {
            if (this.elements.playerBar.classList.contains('visible')) {
                miniBtn.classList.remove('faded');
            } else {
                miniBtn.classList.add('faded');
            }
        }
    }

    setMode(mode) {
        // 保持兼容性 - 替换模式
        this.visualizer.setMode(mode);
        
        this.elements.modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        this.setStatus('模式: ' + this.getModeName(mode));
    }
    
    /**
     * 切换模式 - 按一次开启，再按关闭
     */
    toggleMode(mode) {
        const isActive = this.visualizer.toggleMode(mode);
        
        // 更新所有按钮状态和层数指示
        this.elements.modeButtons.forEach(btn => {
            const btnMode = btn.dataset.mode;
            const isBtnActive = this.visualizer.isModeActive(btnMode);
            btn.classList.toggle('active', isBtnActive);
            
            if (isBtnActive) {
                const layerIndex = this.visualizer.activeModes.indexOf(btnMode);
                btn.dataset.layer = layerIndex + 1;
            } else {
                delete btn.dataset.layer;
            }
        });
        
        const activeModes = this.visualizer.activeModes;
        const modeNames = activeModes.map(m => this.getModeName(m)).join(' + ');
        
        // 添加性能提示
        let perfTip = '';
        if (activeModes.length >= 3) {
            perfTip = ' | 性能模式已启用';
        }
        
        this.setStatus(`叠加模式: ${modeNames} (${activeModes.length}/${this.visualizer.maxLayers})${perfTip}`);
    }

    getModeName(mode) {
        const names = {
            waveform: '波形',
            bars: '频谱柱',
            particles: '粒子',
            circle: '圆形',
            dots: '光点',
            reactive: '反应式',
            '3dwave': '3D波浪',
            shapes: '图案',
            ancient: '古建筑',
            imagewave: '图片波浪',
            tiled: '平铺图案',
            vortex: '漩涡',
            bouncingball: '发光球',
            spring: '春天',
            summer: '夏天',
            autumn: '秋天',
            winter: '冬天',
            daytime: '白天',
            runningstick: '火柴人跑步'
        };
        return names[mode] || mode;
    }

    setTheme(theme) {
        this.visualizer.setColorScheme(theme);
        
        this.elements.themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        
        this.setStatus('颜色主题: ' + theme);
    }

    handleSensitivity(value) {
        const v = parseFloat(value);
        this.visualizer.params.sensitivity = v;
        this.audioEngine.setSensitivity(v);
        this.elements.sensitivityValue.textContent = v.toFixed(1);
    }

    handleGlow(value) {
        const v = parseInt(value);
        this.visualizer.params.glow = v;
        this.elements.glowValue.textContent = v;
    }

    handleBlur(value) {
        const v = parseInt(value);
        this.visualizer.params.blur = v / 10;
        this.elements.blurValue.textContent = v;
    }

    handleSpeed(value) {
        const v = parseFloat(value);
        this.visualizer.params.particleSpeed = v;
        this.elements.speedValue.textContent = v.toFixed(1);
    }

    handleBarCount(value) {
        const v = parseInt(value);
        this.visualizer.params.barCount = v;
        this.elements.barCountValue.textContent = v;
    }

    handleImageScale(value) {
        const v = parseFloat(value);
        this.visualizer.params.imageScale = v;
        this.elements.imageScaleValue.textContent = v.toFixed(1);
    }

    handleImageOpacity(value) {
        const v = parseFloat(value);
        this.visualizer.params.imageOpacity = v;
        this.elements.imageOpacityValue.textContent = v.toFixed(1);
    }

    handleDistortion(value) {
        const v = parseFloat(value);
        this.visualizer.params.distortion = v;
        this.elements.distortionValue.textContent = v.toFixed(1);
    }

    handleImageFilter(value) {
        this.visualizer.params.imageFilter = value;
        this.setStatus('图片滤镜: ' + value);
    }

    updateFreqDisplay() {
        const bass = this.audioEngine.bassData.current;
        const mid = this.audioEngine.midData.current;
        const treble = this.audioEngine.trebleData.current;
        
        this.elements.bassBar.style.width = `${bass * 100}%`;
        this.elements.midBar.style.width = `${mid * 100}%`;
        this.elements.trebleBar.style.width = `${treble * 100}%`;
        
        this.elements.bassValue.textContent = (bass * 100).toFixed(0);
        this.elements.midValue.textContent = (mid * 100).toFixed(0);
        this.elements.trebleValue.textContent = (treble * 100).toFixed(0);
        
        this.elements.bassBar.style.boxShadow = bass > 0.5 ? `0 0 10px ${this.visualizer.colorScheme.bass}` : 'none';
        this.elements.midBar.style.boxShadow = mid > 0.5 ? `0 0 10px ${this.visualizer.colorScheme.mid}` : 'none';
        this.elements.trebleBar.style.boxShadow = treble > 0.5 ? `0 0 10px ${this.visualizer.colorScheme.treble}` : 'none';
    }

    setStatus(message) {
        this.elements.status.textContent = message;
        
        // 同步到手机歌名
        if (this.elements.phoneSongTitle) {
            // 提取歌曲名称（去掉emoji前缀）
            const songMatch = message.match(/[🎵🎶]\s*(.+)/);
            if (songMatch) {
                this.elements.phoneSongTitle.textContent = songMatch[1];
            } else if (message.includes('播放:')) {
                this.elements.phoneSongTitle.textContent = message.replace('播放:', '').trim();
            } else if (message === '等待输入...' || message === '等待音频输入...') {
                this.elements.phoneSongTitle.textContent = '未播放';
            }
        }
    }

    toggleFreqIndicator() {
        const freqIndicator = document.getElementById('freqIndicator');
        if (freqIndicator) {
            freqIndicator.classList.toggle('collapsed');
        }
    }

    // ============ 歌单系统 ============

    togglePlaylist() {
        const panel = document.getElementById('playlistPanel');
        panel.classList.toggle('open');
    }

    hidePlaylist() {
        const panel = document.getElementById('playlistPanel');
        panel.classList.remove('open');
    }

    showPlaylist() {
        const panel = document.getElementById('playlistPanel');
        panel.classList.add('open');
    }

    async handlePlaylistFiles(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        let firstTrackIndex = -1;
        for (const file of files) {
            const idx = this.audioEngine.addToPlaylist(file);
            if (firstTrackIndex < 0) firstTrackIndex = idx;
        }

        // 自动播放第一首（如果当前没在播放）
        if (!this.audioEngine.isPlaying || this.audioEngine.playlist.length === files.length) {
            try {
                await this.audioEngine.playTrack(firstTrackIndex >= 0 ? firstTrackIndex : 0);
                this.updatePlayButton();
                this.showPlayerBar();
                if (!this.visualizer.isRunning) {
                    this.visualizer.start();
                }
            } catch (err) {
                this.setStatus('播放失败');
            }
        }

        // 清空input以允许再次选择相同文件
        e.target.value = '';
    }

    renderPlaylist(list) {
        const container = document.getElementById('playlistSongs');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = '<div class="playlist-empty">暂无歌曲，请添加</div>';
            return;
        }

        const currentIdx = this.audioEngine.currentIndex;
        container.innerHTML = list.map((track, i) => `
            <div class="playlist-song${i === currentIdx ? ' playing' : ''}" data-index="${i}">
                <span class="song-icon">${i === currentIdx && this.audioEngine.isPlaying ? '🔊' : '🎵'}</span>
                <span class="song-name" title="${track.name}">${track.name}</span>
                <button class="song-del" data-index="${i}" title="删除">✕</button>
            </div>
        `).join('');

        // 点击歌曲播放
        container.querySelectorAll('.playlist-song').forEach(el => {
            el.addEventListener('click', async (e) => {
                if (e.target.classList.contains('song-del')) return;
                const idx = parseInt(el.dataset.index);
                try {
                    await this.audioEngine.playTrack(idx);
                    this.updatePlayButton();
                    this.showPlayerBar();
                    if (!this.visualizer.isRunning) {
                        this.visualizer.start();
                    }
                    this.setStatus('播放: ' + this.audioEngine.getCurrentTrack()?.name);
                } catch (err) {
                    this.setStatus('播放失败');
                }
            });
        });

        // 删除歌曲
        container.querySelectorAll('.song-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                this.audioEngine.removeFromPlaylist(idx);
                // 如果歌单空了，停止播放
                if (this.audioEngine.playlist.length === 0) {
                    this.audioEngine.stopAudioFile();
                    this.hidePlayerBar();
                }
            });
        });
    }

    onTrackChanged(idx, track) {
        this.renderPlaylist(this.audioEngine.playlist);
        this.setStatus('🎶 ' + track.name);
    }

    toggleLoop() {
        const mode = this.audioEngine.toggleLoopMode();
        this.updateLoopUI(mode);
    }

    updateLoopUI(mode) {
        const loopBtn = document.getElementById('loopModeBtn');
        const loopLabel = document.getElementById('loopModeLabel');
        const modeNames = { off: '关闭', single: '单曲循环', list: '歌单循环' };
        const modeIcons = { off: '➡️', single: '🔂', list: '🔁' };

        if (loopBtn) loopBtn.textContent = modeIcons[mode];
        if (loopLabel) loopLabel.textContent = modeNames[mode];

        if (loopBtn) {
            loopBtn.classList.toggle('active', mode !== 'off');
        }
    }

    async prevTrack() {
        if (this.audioEngine.playlist.length === 0) return;
        try {
            await this.audioEngine.playPrev();
            this.updatePlayButton();
        } catch (err) {
            this.setStatus('播放失败');
        }
    }

    async nextTrack() {
        if (this.audioEngine.playlist.length === 0) return;
        try {
            await this.audioEngine.playNext();
            this.updatePlayButton();
        } catch (err) {
            this.setStatus('播放失败');
        }
    }

    togglePanel() {
        this.isPanelOpen = !this.isPanelOpen;
        this.elements.controlPanel.classList.toggle('open', this.isPanelOpen);
        this.elements.togglePanel.textContent = this.isPanelOpen ? '⚙️ 隐藏' : '⚙️ 设置';
    }

    handleKeyboard(e) {
        switch(e.key) {
            case 'm':
            case 'M':
                this.toggleMicrophone();
                break;
            case ' ':
                e.preventDefault();
                if (this.audioEngine.isPlaying) {
                    this.audioEngine.stop();
                } else {
                    this.toggleMicrophone();
                }
                break;
            // 数字键切换模式（叠加）
            case '1': this.toggleMode('waveform'); break;
            case '2': this.toggleMode('bars'); break;
            case '3': this.toggleMode('particles'); break;
            case '4': this.toggleMode('circle'); break;
            case '5': this.toggleMode('dots'); break;
            case '6': this.toggleMode('shapes'); break;
            case '7': this.toggleMode('vortex'); break;
            case '8': this.toggleMode('bouncingball'); break;
            case '9': this.toggleMode('reactive'); break;
            case '0': this.toggleMode('ancient'); break;
            // 四季模式快捷键
            case 'q':
            case 'Q':
                this.toggleMode('spring');
                break;
            case 'w':
            case 'W':
                this.toggleMode('summer');
                break;
            case 'e':
            case 'E':
                this.toggleMode('autumn');
                break;
            case 'r':
            case 'R':
                // R已用于古建筑旋转效果，需要区分处理
                if (this.visualizer.isModeActive('ancient')) {
                    this.toggleAncientEffect('rotation');
                } else {
                    this.toggleMode('winter');
                }
                break;
            case 't':
            case 'T':
                this.toggleMode('daytime');
                break;
            case 'u':
            case 'U':
                this.toggleMode('runningstick');
                break;
            case 'x':
            case 'X':
                this.togglePhoneMode();
                break;
            case 'p':
            case 'P':
                this.togglePanel();
                break;
            case 'f':
            case 'F':
                this.toggleFreqIndicator();
                break;
            case 'n':
            case 'N':
                this.togglePlaylist();
                break;
            // 按住 Shift + 数字键 = 单独切换到该模式（替换所有）
            case '!': this.setMode('waveform'); break;
            case '@': this.setMode('bars'); break;
            case '#': this.setMode('particles'); break;
            case '$': this.setMode('circle'); break;
            case '%': this.setMode('dots'); break;
        }
    }
    
    toggleAncientEffect(effect) {
        if (this.visualizer.mode === 'ancient' && this.visualizer.ancientEffects) {
            this.visualizer.ancientEffects[effect] = !this.visualizer.ancientEffects[effect];
        }
    }

    destroy() {
        if (this.freqInterval) {
            clearInterval(this.freqInterval);
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
    }
}

window.UIController = UIController;
