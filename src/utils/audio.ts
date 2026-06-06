let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function playAlertTone(level: 'info' | 'warning' | 'critical' = 'warning') {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = level === 'critical'
    ? [880, 0, 880, 0, 880]
    : level === 'warning'
      ? [660, 0, 660]
      : [440];
  const duration = level === 'critical' ? 0.18 : level === 'warning' ? 0.2 : 0.3;

  freqs.forEach((f, i) => {
    if (f <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = level === 'critical' ? 'square' : 'sine';
    osc.frequency.value = f;
    const t = now + i * duration;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + duration - 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  });
}

export function resumeAudioContext() {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}
