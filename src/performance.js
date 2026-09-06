export class FrameProfiler {
  constructor(capacity = 240) {
    this.capacity = capacity;
    this.frames = [];
    this.work = [];
    this.cursor = 0;
  }

  record(frameMs, workMs) {
    // Tab suspension is not a representative rendered frame.
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 500) return;
    this.frames[this.cursor] = frameMs;
    this.work[this.cursor] = workMs;
    this.cursor = (this.cursor + 1) % this.capacity;
  }

  snapshot() {
    if (!this.frames.length) return { fps: 0, medianMs: 0, p95Ms: 0, cpuMs: 0 };
    const sorted = [...this.frames].sort((a, b) => a - b);
    const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
    return {
      fps: 1000 / (this.frames.reduce((a, b) => a + b, 0) / this.frames.length),
      medianMs: percentile(0.5), p95Ms: percentile(0.95),
      cpuMs: this.work.reduce((a, b) => a + b, 0) / this.work.length
    };
  }
}
