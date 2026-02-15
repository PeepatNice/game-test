// audio.js — Sound System using Web Audio API
class AudioManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.muted = false;
        this.engineOsc = null;
        this.engineGain = null;
        this.engineLFO = null;
        this.engineLFOGain = null;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.setupEngine();
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    }

    setupEngine() {
        // Main engine oscillator
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 80;

        // Engine volume
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;

        // Distortion for engine rumble
        const distortion = this.ctx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(50);

        // Low pass filter for engine sound
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;

        // LFO for engine vibration
        this.engineLFO = this.ctx.createOscillator();
        this.engineLFO.frequency.value = 8;
        this.engineLFOGain = this.ctx.createGain();
        this.engineLFOGain.gain.value = 15;

        this.engineLFO.connect(this.engineLFOGain);
        this.engineLFOGain.connect(this.engineOsc.frequency);

        this.engineOsc.connect(distortion);
        distortion.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc.start();
        this.engineLFO.start();
    }

    makeDistortionCurve(amount) {
        const samples = 256;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    updateEngine(rpm, throttle) {
        if (!this.initialized || this.muted) return;
        const freq = 60 + rpm * 120;
        const vol = 0.02 + throttle * 0.08;
        this.engineOsc.frequency.linearRampToValueAtTime(freq, this.ctx.currentTime + 0.1);
        this.engineGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.1);
        this.engineLFO.frequency.linearRampToValueAtTime(6 + rpm * 15, this.ctx.currentTime + 0.1);
    }

    playCoinSound() {
        if (!this.initialized || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.frequency.linearRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playFuelSound() {
        if (!this.initialized || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 440;
        osc.frequency.linearRampToValueAtTime(660, this.ctx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.3);
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playCrashSound() {
        if (!this.initialized || this.muted) return;
        // Noise burst for crash
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.3;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start();
    }

    stopEngine() {
        if (!this.initialized) return;
        this.engineGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.initialized) {
            this.masterGain.gain.value = this.muted ? 0 : 0.3;
        }
        return this.muted;
    }

    playVoice(text) {
        if (this.muted) return;
        if ('speechSynthesis' in window) {
            // Cancel any current speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'th-TH';
            utterance.rate = 1.1; // Slightly faster
            utterance.pitch = 0.8; // Deeper voice
            utterance.volume = 1.0;

            window.speechSynthesis.speak(utterance);
        }
    }
}
