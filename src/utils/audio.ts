let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, startOffset = 0, type: OscillatorType = 'sine', volume = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playSuccessTone(enabled: boolean) {
  if (!enabled) return;
  playTone(523.25, 0.14, 0, 'triangle', 0.07);
  playTone(659.25, 0.16, 0.09, 'triangle', 0.07);
  playTone(783.99, 0.24, 0.18, 'triangle', 0.08);
}

export function playCoinTone(enabled: boolean) {
  if (!enabled) return;
  playTone(880, 0.11, 0, 'sine', 0.06);
  playTone(1174.66, 0.18, 0.08, 'sine', 0.07);
}

export function playErrorTone(enabled: boolean) {
  if (!enabled) return;
  playTone(260, 0.15, 0, 'sine', 0.06);
  playTone(210, 0.2, 0.11, 'sine', 0.06);
}

export function playClickTone(enabled: boolean) {
  if (!enabled) return;
  playTone(620, 0.05, 0, 'sine', 0.035);
}

export function playJumpTone(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.11);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

export function playLandTone(enabled: boolean) {
  if (!enabled) return;
  playTone(135, 0.075, 0, 'triangle', 0.04);
}
