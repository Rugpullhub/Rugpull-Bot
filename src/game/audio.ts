// Efek suara 8-bit disintesis via WebAudio (tanpa file audio eksternal)

export class SFX {
  private ctx: AudioContext | null = null;
  muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = localStorage.getItem("gtweb:sfx") === "off";
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem("gtweb:sfx", m ? "off" : "on");
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol = 0.12,
    delay = 0
  ) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 0.1, freq = 1200, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  punch() {
    this.tone("square", 220, 90, 0.06, 0.08);
    this.noise(0.05, 0.05, 900);
  }
  clank() {
    this.tone("square", 700, 500, 0.04, 0.05);
    this.tone("square", 500, 300, 0.05, 0.04, 0.03);
  }
  break_() {
    this.noise(0.16, 0.16, 700);
    this.tone("square", 160, 60, 0.12, 0.07);
  }
  place() {
    this.tone("sine", 300, 180, 0.08, 0.12);
    this.noise(0.05, 0.05, 600);
  }
  pickup() {
    this.tone("square", 620, 620, 0.05, 0.06);
    this.tone("square", 930, 930, 0.07, 0.06, 0.05);
  }
  jump() {
    this.tone("square", 260, 420, 0.09, 0.05);
  }
  splash() {
    this.noise(0.2, 0.1, 500);
  }
  burn() {
    this.noise(0.4, 0.18, 400);
    this.tone("sawtooth", 300, 50, 0.45, 0.12);
  }
  die() {
    this.tone("square", 440, 220, 0.15, 0.08);
    this.tone("square", 220, 110, 0.2, 0.08, 0.12);
    this.tone("square", 110, 55, 0.3, 0.08, 0.28);
  }
  door() {
    this.noise(0.25, 0.08, 300);
    this.tone("sine", 500, 200, 0.25, 0.07);
  }
  fizz() {
    this.noise(0.3, 0.12, 2500);
  }
  click() {
    this.tone("square", 800, 800, 0.03, 0.05);
  }
  deny() {
    this.tone("square", 160, 120, 0.09, 0.06);
  }
}
