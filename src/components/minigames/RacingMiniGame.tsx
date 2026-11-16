import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Flag, RotateCcw } from 'lucide-react';
import { MiniGameCompletionPayload } from '../../types/eduworld';

interface RacingMiniGameProps {
  bestTimeSeconds?: number;
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

const TRACK_W = 660;
const TRACK_H = 340;
const CX = TRACK_W / 2;
const CY = TRACK_H / 2;
const RX = 240;
const RY = 112;

const CHECKPOINTS = [
  { x: CX + RX, y: CY, label: '1' },
  { x: CX, y: CY + RY, label: '2' },
  { x: CX - RX, y: CY, label: '3' },
  { x: CX, y: CY - RY, label: 'Finish' },
];

export const RacingMiniGame: React.FC<RacingMiniGameProps> = ({ bestTimeSeconds, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const finishedRef = useRef(false);
  const [hud, setHud] = useState({ lap: 1, checkpoint: 0, time: 0, speedKmh: 0 });
  const [runSeed, setRunSeed] = useState(0);

  useEffect(() => {
    finishedRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const kart = { x: CX + 40, y: CY - RY, angle: 0, speed: 0 };
    let nextCp = 0;
    let lap = 1;
    const startTime = performance.now();
    let lastTime = startTime;
    let rafId = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      const k = keysRef.current;
      const accel = k['KeyW'] || k['ArrowUp'] ? 1 : k['KeyS'] || k['ArrowDown'] ? -0.6 : 0;
      const steer = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);

      // Check track ellipse normalized distance
      const normDist = Math.hypot((kart.x - CX) / RX, (kart.y - CY) / RY);
      const onTrack = normDist >= 0.72 && normDist <= 1.28;
      const maxSpd = onTrack ? 235 : 135;

      kart.speed += accel * 290 * dt;
      kart.speed *= Math.pow(0.45, dt);
      kart.speed = Math.max(-90, Math.min(maxSpd, kart.speed));
      kart.angle += steer * 2.85 * dt * (kart.speed >= 0 ? 1 : -1);

      kart.x = Math.max(22, Math.min(TRACK_W - 22, kart.x + Math.cos(kart.angle) * kart.speed * dt));
      kart.y = Math.max(22, Math.min(TRACK_H - 22, kart.y + Math.sin(kart.angle) * kart.speed * dt));

      const targetCp = CHECKPOINTS[nextCp];
      if (Math.hypot(kart.x - targetCp.x, kart.y - targetCp.y) < 42) {
        if (nextCp === CHECKPOINTS.length - 1) {
          if (lap >= 2 && !finishedRef.current) {
            finishedRef.current = true;
            const totalTime = Math.round(elapsed * 10) / 10;
            const score = Math.max(300, Math.round(1150 - totalTime * 18));
            onComplete({
              miniGameId: 'racing',
              score,
              timeSeconds: totalTime,
              accuracy: 100,
              won: true,
            });
            return;
          }
          lap += 1;
          nextCp = 0;
        } else {
          nextCp += 1;
        }
      }

      setHud({
        lap,
        checkpoint: nextCp,
        time: Math.round(elapsed * 10) / 10,
        speedKmh: Math.round(Math.abs(kart.speed) * 0.48),
      });

      // Draw Circuit
      ctx.fillStyle = '#065f46';
      ctx.fillRect(0, 0, TRACK_W, TRACK_H);

      // Asphalt Oval Track
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 72;
      ctx.beginPath();
      ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start/Finish line
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(CX, CY - RY - 34);
      ctx.lineTo(CX, CY - RY + 34);
      ctx.stroke();

      // Checkpoints
      CHECKPOINTS.forEach((cp, idx) => {
        const active = idx === nextCp;
        ctx.fillStyle = active ? '#f43f5e' : 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, active ? 14 : 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cp.label, cp.x, cp.y + 3);
      });

      // Solar Kart
      ctx.save();
      ctx.translate(kart.x, kart.y);
      ctx.rotate(kart.angle);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(-13, -8, 26, 16);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-4, -6, 10, 12);
      ctx.restore();

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onComplete, runSeed]);

  const setKey = (code: string, val: boolean) => {
    keysRef.current[code] = val;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800">
        <span>Lap {hud.lap}/2</span>
        <span className="inline-flex items-center gap-1 text-rose-700">
          <Flag className="w-3.5 h-3.5" /> Next Gate: {CHECKPOINTS[hud.checkpoint]?.label}
        </span>
        <span className="font-mono-tabular">Time: {hud.time.toFixed(1)}s</span>
        <span className="font-mono-tabular text-sky-700">{hud.speedKmh} km/h</span>
        {bestTimeSeconds && <span className="text-emerald-700">Record: {bestTimeSeconds}s</span>}
        <button
          type="button"
          onClick={() => setRunSeed((s) => s + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={TRACK_W}
        height={TRACK_H}
        className="w-full rounded-xl border border-slate-300 shadow-inner"
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={() => setKey('ArrowLeft', true)}
            onPointerUp={() => setKey('ArrowLeft', false)}
            onPointerLeave={() => setKey('ArrowLeft', false)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-rose-600 active:text-white border border-slate-200 font-semibold text-xs inline-flex items-center gap-1 select-none"
          >
            <ArrowLeft className="w-4 h-4" /> Steer L
          </button>
          <button
            type="button"
            onPointerDown={() => setKey('ArrowRight', true)}
            onPointerUp={() => setKey('ArrowRight', false)}
            onPointerLeave={() => setKey('ArrowRight', false)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-rose-600 active:text-white border border-slate-200 font-semibold text-xs inline-flex items-center gap-1 select-none"
          >
            Steer R <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">W / Up Accelerate · A / D Steer</span>
        <button
          type="button"
          onPointerDown={() => setKey('ArrowUp', true)}
          onPointerUp={() => setKey('ArrowUp', false)}
          onPointerLeave={() => setKey('ArrowUp', false)}
          className="px-5 py-2.5 rounded-xl bg-rose-600 text-white active:bg-rose-700 font-semibold text-xs inline-flex items-center gap-1 select-none"
        >
          <ArrowUp className="w-4 h-4" /> Throttle
        </button>
      </div>
    </div>
  );
};
