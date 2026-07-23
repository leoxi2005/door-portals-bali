// Procedural WebAudio soundscape — loops by construction, zero assets needed.
// Drop real files into assets/audio/ (ambient.mp3, open.mp3, close.mp3) and
// they take over automatically; otherwise the synth versions play.

export class AudioEngine {
  constructor(volume = 0.8) {
    this.volume = volume;
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.files = {};
    this._probeFiles();
  }

  _probeFiles() {
    for (const name of ['ambient', 'open', 'close']) {
      const el = document.createElement('audio');
      el.src = `assets/audio/${name}.mp3`;
      el.addEventListener('canplaythrough', () => { this.files[name] = el; }, { once: true });
      el.addEventListener('error', () => {}, { once: true });
    }
  }

  start() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    // dreamy echo bus shared by chimes / door sounds
    this.echo = this.ctx.createDelay(1.0);
    this.echo.delayTime.value = 0.42;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.35;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    this.echo.connect(fb).connect(lp).connect(this.echo);
    this.echo.connect(this.master);

    this._startAmbient();
  }

  toggleMute() {
    if (!this.master) return;
    this.muted = !this.muted;
    this.master.gain.value = this.muted ? 0 : this.volume;
    if (this.files.ambient) this.files.ambient.muted = this.muted;
    return this.muted;
  }

  // ------------------------------------------------------------- ambient

  _noiseBuffer(seconds = 2) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // pinkish noise via one-pole lowpass of white
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = last * 8;
    }
    return buf;
  }

  _startAmbient() {
    if (this.files.ambient) {
      this.files.ambient.loop = true;
      this.files.ambient.volume = Math.min(1, this.volume * 0.8);
      this.files.ambient.play().catch(() => {});
      return;
    }
    const ctx = this.ctx;

    // wind: looping pink noise through a slowly wandering lowpass
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4);
    src.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 320;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    src.connect(windLp).connect(windGain).connect(this.master);
    src.start();
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.06;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 160;
    windLfo.connect(windLfoGain).connect(windLp.frequency);
    windLfo.start();
    const gustLfo = ctx.createOscillator();
    gustLfo.frequency.value = 0.045;
    const gustGain = ctx.createGain();
    gustGain.gain.value = 0.022;
    gustLfo.connect(gustGain).connect(windGain.gain);
    gustLfo.start();

    // crickets: sparse chirp bursts
    const chirp = () => {
      const t0 = ctx.currentTime + 0.05;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      pan.connect(this.master);
      const f = 4100 + Math.random() * 500;
      for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0;
        const t = t0 + i * 0.07;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.012, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.connect(g).connect(pan);
        osc.start(t);
        osc.stop(t + 0.07);
      }
      this._cricketTimer = setTimeout(chirp, 700 + Math.random() * 2600);
    };
    chirp();

    // distant dreamy wind-chimes (pentatonic, echoed)
    const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0];
    const chime = () => {
      const n = NOTES[Math.floor(Math.random() * NOTES.length)] * (Math.random() < 0.4 ? 0.5 : 1);
      this._pluck(n, 0.035, Math.random() * 1.6 - 0.8);
      this._chimeTimer = setTimeout(chime, 7000 + Math.random() * 12000);
    };
    this._chimeTimer = setTimeout(chime, 4000);
  }

  _pluck(freq, gain, pan = 0, when = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2.001;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g);
    osc2.connect(g);
    g.connect(p);
    p.connect(this.master);
    g.connect(this.echo);
    osc.start(t); osc2.start(t);
    osc.stop(t + 3); osc2.stop(t + 3);
  }

  // ------------------------------------------------------------- events

  doorOpen(pan = 0) {
    if (!this.ctx) return;
    if (this.files.open) {
      const el = this.files.open.cloneNode();
      el.volume = Math.min(1, this.volume);
      el.play().catch(() => {});
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // rising airy whoosh
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(1.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(160, t);
    bp.frequency.exponentialRampToValueAtTime(950, t + 0.75);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(bp).connect(g).connect(p).connect(this.master);
    src.start(t);
    src.stop(t + 1.2);
    // magical reveal arpeggio
    const NOTES = [523.25, 659.25, 783.99, 1046.5];
    NOTES.forEach((f, i) => this._pluck(f, 0.05, pan, 0.25 + i * 0.13));
  }

  doorClose(pan = 0) {
    if (!this.ctx) return;
    if (this.files.close) {
      const el = this.files.close.cloneNode();
      el.volume = Math.min(1, this.volume);
      el.play().catch(() => {});
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.55; // land roughly when the panel meets the frame
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g).connect(p).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
    // soft latch tick
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(lp).connect(g2).connect(p);
    src.start(t);
    src.stop(t + 0.12);
  }
}
