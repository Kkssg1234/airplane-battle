/**
 * 音频管理：使用 Web Audio API 程序化合成音效
 * 无需外部音频文件，加载即用
 */
import type { UserConfig } from '../types';

type SfxName =
  | 'shoot'
  | 'hit'
  | 'explosion'
  | 'powerup'
  | 'damage'
  | 'bomb'
  | 'bossWarn'
  | 'click'
  | 'hover'
  | 'gameOver'
  | 'levelUp';

export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _config: UserConfig;
  private _bgmGain: GainNode | null = null;
  private _bgmOsc: OscillatorNode | null = null;
  private _bgmInterval: number | null = null;
  private _bgmStep = 0;
  private _unlocked = false;

  constructor(config: UserConfig) {
    this._config = config;
  }

  /** 解锁音频（需用户交互后调用，Safari 等要求） */
  unlock(): void {
    if (this._unlocked) return;
    try {
      this._ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this._ctx.state === 'suspended') this._ctx.resume();
      this._unlocked = true;
    } catch {
      this._ctx = null;
    }
  }

  setConfig(config: UserConfig): void {
    this._config = config;
  }

  get ctx(): AudioContext | null {
    return this._ctx;
  }

  /** 播放程序化合成音效 */
  playSfx(name: SfxName): void {
    if (!this._config.soundEnabled || !this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const vol = this._config.sfxVolume;

    switch (name) {
      case 'shoot':
        this._beep(880, 0.05, 'square', 0.08 * vol, now, 1200);
        break;
      case 'hit':
        this._beep(400, 0.04, 'square', 0.1 * vol, now, 200);
        break;
      case 'explosion':
        this._noise(0.3, 0.25 * vol, now);
        break;
      case 'powerup':
        this._beep(523, 0.08, 'triangle', 0.12 * vol, now, 1046);
        break;
      case 'damage':
        this._beep(150, 0.2, 'sawtooth', 0.2 * vol, now, 60);
        break;
      case 'bomb':
        this._noise(0.6, 0.4 * vol, now);
        this._beep(80, 0.5, 'sawtooth', 0.2 * vol, now, 30);
        break;
      case 'bossWarn':
        this._beep(220, 0.15, 'square', 0.15 * vol, now, 220);
        break;
      case 'click':
        this._beep(660, 0.05, 'square', 0.1 * vol, now, 880);
        break;
      case 'hover':
        this._beep(440, 0.03, 'sine', 0.05 * vol, now, 660);
        break;
      case 'gameOver':
        this._beep(440, 0.5, 'sawtooth', 0.15 * vol, now, 110);
        break;
      case 'levelUp':
        this._beep(523, 0.1, 'triangle', 0.12 * vol, now, 784);
        this._beep(784, 0.15, 'triangle', 0.12 * vol, now + 0.1, 1046);
        break;
    }
  }

  /** 单音 beep，freqEnd 为目标频率（滑音） */
  private _beep(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    start: number,
    freqEnd?: number,
  ): void {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + duration);
    }
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  /** 白噪声（爆炸） */
  private _noise(duration: number, gain: number, start: number): void {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, start);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(start);
    src.stop(start + duration);
  }

  /** 启动 BGM（简单电子循环旋律） */
  startBgm(): void {
    if (!this._config.musicEnabled || !this._ctx || this._bgmInterval !== null) return;
    const ctx = this._ctx;
    this._bgmGain = ctx.createGain();
    this._bgmGain.gain.value = this._config.musicVolume * 0.15;
    this._bgmGain.connect(ctx.destination);

    // 简单的科技风 bass line
    const bass = [55, 55, 73, 65, 55, 55, 82, 73];
    const lead = [220, 0, 277, 0, 330, 0, 277, 0];
    this._bgmStep = 0;
    const stepMs = 250;
    this._bgmInterval = window.setInterval(() => {
      if (!this._ctx || !this._bgmGain) return;
      const now = this._ctx.currentTime;
      const i = this._bgmStep % bass.length;
      this._beep(bass[i], 0.2, 'sawtooth', 0.5, now);
      if (lead[i] > 0) this._beep(lead[i], 0.15, 'square', 0.3, now);
      this._bgmStep++;
    }, stepMs);
  }

  stopBgm(): void {
    if (this._bgmInterval !== null) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
    if (this._bgmGain) {
      try {
        this._bgmGain.disconnect();
      } catch {
        /* ignore */
      }
      this._bgmGain = null;
    }
  }
}
