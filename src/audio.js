export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humOscillator = null;
    this.humGain = null;
    this.volumes = { masterVolume: 1, effectsVolume: 1, rotorVolume: 1 };
  }

  async start() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.52;
      this.master.connect(this.ctx.destination);
      this.effectsBus = this.ctx.createGain();
      this.effectsBus.connect(this.master);
      this.rotorBus = this.ctx.createGain();
      this.rotorBus.connect(this.master);
      this.createDroneHum();
      this.setVolumes(this.volumes);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  createDroneHum() {
    this.humOscillator = this.ctx.createOscillator();
    this.humOscillator.type = 'sawtooth';
    this.humOscillator.frequency.value = 88;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 330;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0;
    this.humOscillator.connect(filter).connect(this.humGain).connect(this.rotorBus);
    this.humOscillator.start();
  }

  tone(frequency, duration, type = 'sine', volume = 0.12, slide = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.effectsBus);
    osc.start(now);
    osc.stop(now + duration);
  }

  noise(duration, volume, cutoff = 1400) {
    if (!this.ctx) return;
    const length = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.effectsBus);
    source.start();
  }

  gunshot(weapon) {
    if (weapon.id === 'shotgun') {
      this.noise(0.28, 0.7, 1050);
      this.tone(88, 0.2, 'triangle', 0.32, -48);
      window.setTimeout(() => this.tone(420, 0.045, 'square', 0.08, -120), 180);
    } else {
      this.noise(0.1, 0.48, 1900);
      this.tone(weapon.id === 'ak5' ? 120 : 145, 0.09, 'square', 0.22, -70);
    }
  }

  hit(critical = false) {
    this.tone(critical ? 920 : 650, 0.045, 'square', 0.08, -120);
  }

  explosion() {
    this.noise(0.55, 0.78, 720);
    this.tone(64, 0.48, 'sine', 0.4, -30);
  }

  reload() {
    this.tone(520, 0.045, 'square', 0.07, -100);
    window.setTimeout(() => this.tone(740, 0.06, 'square', 0.06, -80), 460);
  }

  dryFire() {
    this.tone(260, 0.035, 'square', 0.08, -60);
  }

  updateHum(threats, proximity) {
    if (!this.ctx || !this.humGain) return;
    const now = this.ctx.currentTime;
    this.humGain.gain.cancelScheduledValues(now);
    this.humGain.gain.linearRampToValueAtTime(threats ? 0.018 + proximity * 0.08 : 0, now + 0.15);
    this.humOscillator.frequency.linearRampToValueAtTime(82 + proximity * 70, now + 0.15);
  }

  setVolumes(settings) {
    this.volumes = { ...settings };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.masterVolume * 0.52, now, 0.03);
    this.effectsBus.gain.setTargetAtTime(settings.effectsVolume, now, 0.03);
    this.rotorBus.gain.setTargetAtTime(settings.rotorVolume, now, 0.03);
  }
}
