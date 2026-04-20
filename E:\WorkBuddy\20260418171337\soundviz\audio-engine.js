/**
 * AudioEngine - 音频采集与频谱分析模块
 * 支持: 麦克风输入 / 音频文件 / DJ混音输入
 */

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.gainNode = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.audioElement = null;
        
        // 频谱配置
        this.fftSize = 2048;
        this.smoothingTimeConstant = 0.8;
        
        // 独立音频更新循环（不受渲染帧率影响）
        this.audioLoopId = null;
        this.audioUpdateRate = 1000 / 60; // 60fps 更新频率
        
        // 频率数据
        this.frequencyData = null;
        this.timeDomainData = null;
        
        // 三频带数据
        this.bassData = { current: 0, avg: 0, peak: 0 };
        this.midData = { current: 0, avg: 0, peak: 0 };
        this.trebleData = { current: 0, avg: 0, peak: 0 };
        
        // 频率范围索引
        this.bassRange = { start: 0, end: 0 };
        this.midRange = { start: 0, end: 0 };
        this.trebleRange = { start: 0, end: 0 };
        
        // 节拍检测
        this.beatDetector = {
            energyHistory: [],
            historyLength: 50,
            threshold: 1.3,
            decay: 0.98,
            minInterval: 150, // 毫秒
            lastBeat: 0,
            isBeat: false,
            beatIntensity: 0
        };

        // 音符检测（能量突变检测）
        this.noteDetector = {
            prevEnergy: 0,
            prevMidEnergy: 0,
            onsetHistory: [],
            historyLength: 10,
            threshold: 1.2,
            minInterval: 50,   // 50ms 间隔
            lastOnset: 0,
            isOnset: false,
            onsetIntensity: 0,
            // 音符计数器
            noteCount: 0,
            onsetWindow: 0,
            onsetWindowDuration: 6,
            // 能量历史（用于检测突变）
            energyHistory: new Array(10).fill(0.1),
            energyHistoryIndex: 0,
            // A/B频带分析
            aBand: { current: 0, delta: 0 },
            bBand: { current: 0, delta: 0 },
        };
        
        // 音频播放进度
        this.duration = 0;
        this.currentTime = 0;
        
        // 歌单系统
        this.playlist = []; // [{name, url, file}]
        this.currentIndex = -1;
        this.loopMode = 'single'; // 'off' | 'single' | 'list'  单曲播放/单曲循环/歌单循环
        
        // 加载保存的歌单
        this.loadPlaylist();
        
        // 回调
        this.onReady = null;
        this.onError = null;
        this.onTimeUpdate = null;
        this.onPlaylistChange = null;  // 歌单变化回调
        this.onTrackChange = null;    // 曲目变化回调
        this.onLoopModeChange = null; // 循环模式变化回调
    }

    /**
     * 初始化音频上下文
     */
    async init() {
        if (this.isInitialized) return true;
        
        try {
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 44100
            });
            
            // 创建分析器节点
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            // 创建增益节点
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
            
            // 初始化数据数组
            const bufferLength = this.analyser.frequencyBinCount;
            this.frequencyData = new Uint8Array(bufferLength);
            this.timeDomainData = new Uint8Array(bufferLength);
            
            // 计算频率范围
            this.calculateFrequencyRanges();
            
            this.isInitialized = true;
            console.log('[AudioEngine] 初始化成功, 采样率:', this.audioContext.sampleRate);
            console.log('[AudioEngine] FFT大小:', this.fftSize, '频率bins:', bufferLength);
            
            if (this.onReady) this.onReady();
            return true;
        } catch (error) {
            console.error('[AudioEngine] 初始化失败:', error);
            if (this.onError) this.onError(error);
            return false;
        }
    }

    /**
     * 计算低/中/高频范围索引
     */
    calculateFrequencyRanges() {
        const bufferLength = this.analyser.frequencyBinCount;
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        
        // 根据 FFT 大小计算每个 bin 的频率分辨率
        const binFreq = nyquist / bufferLength;
        
        // 低频: 0 - 250Hz
        this.bassRange.end = Math.floor(250 / binFreq);
        
        // 中频: 250Hz - 4kHz
        this.midRange.start = this.bassRange.end;
        this.midRange.end = Math.floor(4000 / binFreq);
        
        // 高频: 4kHz - 20kHz
        this.trebleRange.start = this.midRange.end;
        this.trebleRange.end = Math.min(Math.floor(20000 / binFreq), bufferLength);
        
        console.log(`[AudioEngine] 频率范围:`, {
            bass: `0-${this.bassRange.end * binFreq}Hz (bins 0-${this.bassRange.end})`,
            mid: `${this.midRange.start * binFreq}-${this.midRange.end * binFreq}Hz`,
            treble: `${this.trebleRange.start * binFreq}-${this.trebleRange.end * binFreq}Hz`
        });
    }

    /**
     * 启动独立音频更新循环（不受渲染帧率影响）
     * 确保节拍检测以固定频率运行
     */
    startAudioLoop() {
        if (this.audioLoopId) return; // 已运行
        
        let lastTime = performance.now();
        
        const loop = (currentTime) => {
            // 固定间隔更新音频数据
            if (currentTime - lastTime >= this.audioUpdateRate) {
                lastTime = currentTime;
                this.update(); // 更新频谱和节拍
            }
            this.audioLoopId = requestAnimationFrame(loop);
        };
        
        this.audioLoopId = requestAnimationFrame(loop);
        console.log('[AudioEngine] 音频更新循环已启动');
    }

    /**
     * 停止音频更新循环
     */
    stopAudioLoop() {
        if (this.audioLoopId) {
            cancelAnimationFrame(this.audioLoopId);
            this.audioLoopId = null;
            console.log('[AudioEngine] 音频更新循环已停止');
        }
    }

    /**
     * 从麦克风输入
     */
    async startMicrophone() {
        if (!this.isInitialized) await this.init();
        
        try {
            console.log('[AudioEngine] 正在请求麦克风...');
            
            // 🔧 移动端麦克风 API 检测
            const hasMediaDevices = !!navigator.mediaDevices;
            const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
            console.log('[AudioEngine] navigator.mediaDevices:', hasMediaDevices);
            console.log('[AudioEngine] navigator.mediaDevices.getUserMedia:', hasGetUserMedia);
            
            if (!hasMediaDevices || !hasGetUserMedia) {
                throw new Error('MIC_NOT_SUPPORTED');
            }
            
            // 🔧 移动端修复：确保 AudioContext 处于运行状态
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log('[AudioEngine] AudioContext 已恢复');
            }
            
            console.log('[AudioEngine] 准备请求麦克风权限...');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    latency: 0
                }
            });
            
            // 关闭之前的源
            if (this.source) {
                this.source.disconnect();
            }
            
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            
            // 不连接到 destination (避免回声)
            
            this.isPlaying = true;
            this.startAudioLoop(); // 启动独立音频更新循环
            console.log('[AudioEngine] 麦克风已连接');
            return true;
        } catch (error) {
            console.error('[AudioEngine] 麦克风访问失败:', error);
            // 🔧 区分不同错误类型
            if (error.message === 'MIC_NOT_SUPPORTED') {
                throw new Error('MIC_NOT_SUPPORTED');
            } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('麦克风权限被拒绝，请在浏览器中允许麦克风访问');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                throw new Error('未找到麦克风设备，请检查手机设置');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                throw new Error('麦克风被其他应用占用');
            } else {
                throw new Error('麦克风启动失败: ' + error.message);
            }
        }
    }

    /**
     * 从音频文件输入
     */
    async loadAudioFile(file) {
        if (!this.isInitialized) await this.init();
        
        return new Promise((resolve, reject) => {
            // 停止之前的播放
            this.stopAudioFile();
            
            // 创建音频元素
            this.audioElement = new Audio();
            this.audioElement.crossOrigin = 'anonymous';
            this.audioElement.loop = false; // 循环由 playTrack 和 loopMode 控制
            
            const url = URL.createObjectURL(file);
            this.audioElement.src = url;
            
            this.audioElement.oncanplaythrough = async () => {
                try {
                    // 获取时长
                    this.duration = this.audioElement.duration;
                    
                    // 🔧 移动端修复：确保 AudioContext 处于运行状态
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        await this.audioContext.resume();
                        console.log('[AudioEngine] AudioContext 已恢复');
                    }
                    
                    // 关闭之前的源
                    if (this.source) {
                        this.source.disconnect();
                        this.gainNode.disconnect();
                    }
                    
                    // 创建媒体源
                    this.source = this.audioContext.createMediaElementSource(this.audioElement);
                    this.source.connect(this.gainNode);
                    this.gainNode.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                    
                    await this.audioElement.play();
                    this.isPlaying = true;
                    this.startAudioLoop(); // 启动独立音频更新循环
                    
                    console.log('[AudioEngine] 音频文件加载成功:', file.name);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            
            this.audioElement.onerror = () => {
                reject(new Error('音频文件加载失败'));
            };
            
            this.audioElement.load();
        });
    }

    /**
     * 停止音频文件播放
     */
    stopAudioFile() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement = null;
        }
        this.isPlaying = false;
        this.duration = 0;
        this.currentTime = 0;
        this.stopAudioLoop(); // 停止音频更新循环
    }
    
    /**
     * 暂停/播放切换
     */
    async togglePlay() {
        if (!this.audioElement) return;
        
        if (this.audioElement.paused) {
            try {
                // 🔧 移动端修复：确保 AudioContext 处于运行状态
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                    console.log('[AudioEngine] AudioContext 已恢复');
                }
                
                await this.audioElement.play();
                this.isPlaying = true;
                this.startAudioLoop(); // 启动独立音频更新循环
            } catch (e) {
                console.log('[AudioEngine] 播放失败:', e);
            }
        } else {
            this.audioElement.pause();
            this.isPlaying = false;
        }
    }
    
    /**
     * 跳转到指定时间
     */
    seek(time) {
        if (this.audioElement) {
            this.audioElement.currentTime = time;
        }
    }
    
    /**
     * 获取格式化时间
     */
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 保存歌单到 localStorage
     */
    savePlaylist() {
        try {
            // 保存歌单信息（不含 blob URL，因为这些不能序列化）
            const playlistInfo = this.playlist.map(item => ({
                name: item.name,
                // 不保存 url，因为它是 blob URL，重启后会失效
                // 用户需要重新添加文件
            }));
            localStorage.setItem('soundviz_playlist', JSON.stringify(playlistInfo));
            console.log('[AudioEngine] 歌单已保存');
        } catch (e) {
            console.error('[AudioEngine] 保存歌单失败:', e);
        }
    }

    /**
     * 加载歌单（但由于 blob URL 无法恢复，提示用户重新添加）
     */
    loadPlaylist() {
        try {
            const saved = localStorage.getItem('soundviz_playlist');
            if (saved) {
                const playlistInfo = JSON.parse(saved);
                console.log('[AudioEngine] 发现保存的歌单信息，但需要重新添加文件');
                // 注意：无法恢复 blob URL，歌单信息只是记录文件名
                this.savedPlaylistInfo = playlistInfo; // 保存以供后续提示
            }
        } catch (e) {
            console.error('[AudioEngine] 加载歌单失败:', e);
        }
    }

    /**
     * 检查是否有保存的歌单信息（用户可选择重新添加）
     */
    hasSavedPlaylist() {
        return this.savedPlaylistInfo && this.savedPlaylistInfo.length > 0;
    }

    /**
     * 获取保存的歌单文件名列表
     */
    getSavedPlaylistNames() {
        return this.savedPlaylistInfo ? this.savedPlaylistInfo.map(item => item.name) : [];
    }

    /**
     * 清除保存的歌单信息
     */
    clearSavedPlaylist() {
        this.savedPlaylistInfo = null;
        localStorage.removeItem('soundviz_playlist');
    }

    // ============ 歌单系统 ============

    /**
     * 添加歌曲到歌单
     */
    addToPlaylist(file) {
        const url = URL.createObjectURL(file);
        this.playlist.push({ name: file.name, url, file });
        this.savePlaylist(); // 保存歌单
        if (this.onPlaylistChange) this.onPlaylistChange(this.playlist);
        return this.playlist.length - 1;
    }

    /**
     * 从歌单移除歌曲
     */
    removeFromPlaylist(index) {
        if (index < 0 || index >= this.playlist.length) return;
        const removed = this.playlist.splice(index, 1)[0];
        URL.revokeObjectURL(removed.url);
        if (this.currentIndex === index) {
            this.currentIndex = -1;
        } else if (this.currentIndex > index) {
            this.currentIndex--;
        }
        this.savePlaylist(); // 保存歌单
        if (this.onPlaylistChange) this.onPlaylistChange(this.playlist);
    }

    /**
     * 播放歌单中指定曲目
     */
    async playTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        // 停止当前播放
        this.stopAudioFile();
        
        const track = this.playlist[index];
        this.currentIndex = index;
        
        return new Promise((resolve, reject) => {
            this.audioElement = new Audio();
            this.audioElement.crossOrigin = 'anonymous';
            this.audioElement.src = track.url;
            
            // 设置循环模式
            this.audioElement.loop = this.loopMode === 'single';
            
            // 曲目结束时处理
            this.audioElement.onended = () => {
                if (this.loopMode === 'list') {
                    this.playNext();
                } else if (this.loopMode === 'single') {
                    this.audioElement.currentTime = 0;
                    this.audioElement.play();
                }
                // loopMode === 'off' 时自然结束
            };
            
            this.audioElement.oncanplaythrough = async () => {
                try {
                    // 🔧 移动端修复：确保 AudioContext 处于运行状态
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        await this.audioContext.resume();
                        console.log('[AudioEngine] AudioContext 已恢复 (playTrack)');
                    }
                    
                    this.duration = this.audioElement.duration;
                    
                    if (this.source) {
                        this.source.disconnect();
                        this.gainNode.disconnect();
                    }
                    
                    this.source = this.audioContext.createMediaElementSource(this.audioElement);
                    this.source.connect(this.gainNode);
                    this.gainNode.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                    
                    await this.audioElement.play();
                    this.isPlaying = true;
                    this.startAudioLoop(); // 启动音频更新循环
                    
                    if (this.onTrackChange) this.onTrackChange(index, track);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            
            this.audioElement.onerror = () => {
                reject(new Error('音频加载失败'));
            };
            
            this.audioElement.load();
        });
    }

    /**
     * 播放下一首
     */
    async playNext() {
        if (this.playlist.length === 0) return;
        let next = this.currentIndex + 1;
        if (next >= this.playlist.length) next = 0;
        await this.playTrack(next);
    }

    /**
     * 播放上一首
     */
    async playPrev() {
        if (this.playlist.length === 0) return;
        let prev = this.currentIndex - 1;
        if (prev < 0) prev = this.playlist.length - 1;
        await this.playTrack(prev);
    }

    /**
     * 设置循环模式
     */
    setLoopMode(mode) {
        this.loopMode = mode;
        if (this.audioElement) {
            this.audioElement.loop = (mode === 'single');
        }
        if (this.onLoopModeChange) this.onLoopModeChange(mode);
    }

    /**
     * 切换循环模式: off -> single -> list -> off
     */
    toggleLoopMode() {
        const modes = ['off', 'single', 'list'];
        const currentIdx = modes.indexOf(this.loopMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        this.setLoopMode(modes[nextIdx]);
        return modes[nextIdx];
    }

    /**
     * 获取当前播放曲目信息
     */
    getCurrentTrack() {
        if (this.currentIndex < 0 || this.currentIndex >= this.playlist.length) return null;
        return { ...this.playlist[this.currentIndex], index: this.currentIndex };
    }

    /**
     * 停止麦克风
     */
    stopMicrophone() {
        if (this.source) {
            this.source.disconnect();
            if (this.source.mediaStream) {
                this.source.mediaStream.getTracks().forEach(track => track.stop());
            }
            this.source = null;
        }
        this.isPlaying = false;
        this.stopAudioLoop(); // 停止音频更新循环
    }

    /**
     * 停止所有输入
     */
    stop() {
        this.stopMicrophone();
        this.stopAudioFile();
        this.resetPeakData();
        this.stopAudioLoop(); // 停止音频更新循环
    }

    /**
     * 更新频谱数据
     */
    update() {
        if (!this.isInitialized || !this.analyser) return;
        
        // 获取频域数据
        this.analyser.getByteFrequencyData(this.frequencyData);
        
        // 获取时域数据
        this.analyser.getByteTimeDomainData(this.timeDomainData);
        
        // 计算三频带数据
        this.bassData.current = this.calculateBandAverage(this.bassRange.start, this.bassRange.end);
        this.midData.current = this.calculateBandAverage(this.midRange.start, this.midRange.end);
        this.trebleData.current = this.calculateBandAverage(this.trebleRange.start, this.trebleRange.end);
        
        // 更新平均值
        this.bassData.avg = this.bassData.avg * 0.9 + this.bassData.current * 0.1;
        this.midData.avg = this.midData.avg * 0.9 + this.midData.current * 0.1;
        this.trebleData.avg = this.trebleData.avg * 0.9 + this.trebleData.current * 0.1;
        
        // 更新峰值
        if (this.bassData.current > this.bassData.peak) this.bassData.peak = this.bassData.current;
        if (this.midData.current > this.midData.peak) this.midData.peak = this.midData.current;
        if (this.trebleData.current > this.trebleData.peak) this.trebleData.peak = this.trebleData.current;
        
        // 更新播放时间
        if (this.audioElement) {
            this.currentTime = this.audioElement.currentTime;
        }
        
        // 节拍检测
        this.detectBeat();
    }
    
    /**
     * 节拍检测
     */
    detectBeat() {
        const bd = this.beatDetector;
        
        // 计算当前能量（主要使用低频）
        let energy = 0;
        const bassBins = this.bassRange.end - this.bassRange.start;
        for (let i = this.bassRange.start; i < this.bassRange.end; i++) {
            // 限制每个频率数据的最大值
            energy += Math.min(255, Math.max(0, this.frequencyData[i]));
        }
        energy = Math.min(1, Math.max(0, energy / bassBins / 255));
        
        // 添加到历史
        bd.energyHistory.push(energy);
        if (bd.energyHistory.length > bd.historyLength) {
            bd.energyHistory.shift();
        }
        
        // 计算平均能量
        const avgEnergy = bd.energyHistory.reduce((a, b) => a + b, 0) / bd.energyHistory.length;
        
        // 当前时间
        const now = Date.now();
        
        // 检测节拍
        if (energy > avgEnergy * bd.threshold && 
            energy > 0.3 && // 能量阈值
            now - bd.lastBeat > bd.minInterval) {
            
            bd.isBeat = true;
            bd.lastBeat = now;
            bd.beatIntensity = Math.min(1, energy); // 0-1 强度
        } else {
            bd.isBeat = false;
        }
        
        // 衰减节拍强度
        bd.beatIntensity *= bd.decay;

        // 音符检测（能量突变 + A/B频带分离）
        this.detectNote();
    }

    /**
     * 音符检测（onset detection）
     * 检测每个音符的起音瞬间
     */
    detectNote() {
        const nd = this.noteDetector;

        // 计算全频段能量（带保护）
        let totalEnergy = 0;
        for (let i = 0; i < this.frequencyData.length; i++) {
            totalEnergy += Math.min(255, Math.max(0, this.frequencyData[i]));
        }
        totalEnergy = Math.min(1, Math.max(0, totalEnergy / this.frequencyData.length / 255));

        const now = Date.now();

        // 能量变化检测（基于连续两帧的差值）
        const prevEnergy = nd.prevTotalEnergy || 0;
        const energyDelta = totalEnergy - prevEnergy;
        
        // 极灵敏检测：每个能量上升沿都触发
        const shouldTrigger = energyDelta > 0.002 && totalEnergy > 0.01 && now - nd.lastOnset > 15;

        if (shouldTrigger) {
            nd.isOnset = true;
            nd.lastOnset = now;
            nd.onsetIntensity = Math.min(1, Math.abs(energyDelta) * 50);
            nd.noteCount++;
            nd.onsetWindow = 4;
        } else {
            nd.isOnset = false;
        }

        // 保存当前能量
        nd.prevTotalEnergy = totalEnergy;

        // onset窗口递减
        if (nd.onsetWindow > 0) nd.onsetWindow--;

        // 衰减强度
        nd.onsetIntensity *= 0.8;
    }

    /**
     * 计算频带平均值
     */
    calculateBandAverage(start, end) {
        let sum = 0;
        const length = end - start;
        
        for (let i = start; i < end; i++) {
            // 限制每个频率数据的最大值，防止异常值
            sum += Math.min(255, Math.max(0, this.frequencyData[i]));
        }
        
        // 归一化到 0-1，并限制范围
        const rawValue = length > 0 ? sum / length / 255 : 0;
        return Math.min(1, Math.max(0, rawValue));
    }

    /**
     * 重置峰值数据
     */
    resetPeakData() {
        this.bassData.peak = 0;
        this.midData.peak = 0;
        this.trebleData.peak = 0;
    }

    /**
     * 衰减峰值数据
     */
    decayPeaks(factor = 0.95) {
        this.bassData.peak *= factor;
        this.midData.peak *= factor;
        this.trebleData.peak *= factor;
    }

    /**
     * 设置灵敏度
     */
    setSensitivity(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = value;
        }
    }

    /**
     * 设置平滑度
     */
    setSmoothing(value) {
        if (this.analyser) {
            this.analyser.smoothingTimeConstant = Math.max(0, Math.min(1, value));
        }
    }

    /**
     * 获取完整频谱数据 (用于高级可视化)
     */
    getFrequencySpectrum() {
        return {
            full: this.frequencyData,
            bass: this.bassData,
            mid: this.midData,
            treble: this.trebleData,
            timeDomain: this.timeDomainData
        };
    }

    /**
     * 销毁引擎
     */
    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }
}

// 导出
window.AudioEngine = AudioEngine;
