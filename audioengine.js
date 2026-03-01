/**
 * audioEngine.js — Web Audio API frequency extraction
 */
export class AudioEngine {
  constructor() {
    this._ctx = null; 
    this._analyser = null; 
    this._source = null;
    this._stream = null; 
    this._freqData = null;
    this._smoothed = { bass: 0, mid: 0, treble: 0 };
    this._running = false;
  }

  async init(useMic = true) {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 1024;
    this._analyser.smoothingTimeConstant = 0.85;
    this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
    if (useMic) {
      try {
        this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this._source = this._ctx.createMediaStreamSource(this._stream);
        this._source.connect(this._analyser);
      } catch(e) {
        console.warn('[AudioEngine] Mic denied, using test tone');
        this._startTestTone();
      }
    }
    this._running = true;
  }

  async startMic() {
    try {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._analyser = this._ctx.createAnalyser();
        this._analyser.fftSize = 1024;
        this._analyser.smoothingTimeConstant = 0.85;
        this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
      }
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this._source = this._ctx.createMediaStreamSource(this._stream);
      this._source.connect(this._analyser);
      this._running = true;
      return true;
    } catch(e) {
      console.error('[AudioEngine] Mic start failed:', e);
      return false;
    }
  }

  async startFile(file) {
    try {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._analyser = this._ctx.createAnalyser();
        this._analyser.fftSize = 1024;
        this._analyser.smoothingTimeConstant = 0.85;
        this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
      }
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
      this._source = this._ctx.createBufferSource();
      this._source.buffer = audioBuffer;
      this._source.connect(this._analyser);
      this._analyser.connect(this._ctx.destination);
      this._source.start(0);
      this._running = true;
    } catch(e) {
      console.error('[AudioEngine] File start failed:', e);
      throw e;
    }
  }

  _startTestTone() {
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(110, this._ctx.currentTime);
    gain.gain.setValueAtTime(0.05, this._ctx.currentTime);
    osc.connect(gain); gain.connect(this._analyser); osc.start();
    this._source = osc;
  }

  update() {
    if (!this._running) return { bass: 0, mid: 0, treble: 0 };
    return this.getData();
  }

  getData() {
    if (!this._running || !this._analyser) return { bass: 0, mid: 0, treble: 0 };
    this._analyser.getByteFrequencyData(this._freqData);
    const binCount = this._freqData.length;
    const binHz = (this._ctx.sampleRate / 2) / binCount;
    const bassEnd = Math.floor(250 / binHz), midEnd = Math.floor(4000 / binHz), trebleEnd = Math.floor(16000 / binHz);
    const avg = (s, e) => { let sum = 0; const len = Math.max(1, e - s); for (let i = s; i < e && i < binCount; i++) sum += this._freqData[i]; return sum / len / 255; };
    const raw = { bass: avg(0, bassEnd), mid: avg(bassEnd, midEnd), treble: avg(midEnd, trebleEnd) };
    const a = 0.15;
    this._smoothed.bass   += (raw.bass   - this._smoothed.bass)   * a;
    this._smoothed.mid    += (raw.mid    - this._smoothed.mid)    * a;
    this._smoothed.treble += (raw.treble - this._smoothed.treble) * a;
    return { ...this._smoothed };
  }

  stop() {
    this._running = false;
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    if (this._ctx) this._ctx.close();
    this._ctx = null; 
    this._analyser = null;
  }
}