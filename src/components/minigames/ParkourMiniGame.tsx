import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Flag, RotateCcw } from 'lucide-react';
import { MiniGameCompletionPayload } from '../../types/eduworld';

interface ParkourMiniGameProps {
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  moveAmp?: number;
  moveSpeed?: number;
  baseX?: number;
  checkpointId?: number;
}

const WORLD_W = 1480;
const VIEW_W = 680;
const VIEW_H = 340;

const PLATFORMS: Platform[] = [
  { x: 20, y: 280, w: 150, h: 24 },
  { x: 210, y: 245, w: 105, h: 18 },
  { x: 360, y: 215, w: 105, h: 18, moveAmp: 36, moveSpeed: 1.7, baseX: 360 },
  { x: 520, y: 185, w: 115, h: 18, checkpointId: 1 },
  { x: 690, y: 215, w: 95, h: 18 },
  { x: 830, y: 175, w: 105, h: 18, moveAmp: 42, moveSpeed: 2.0, baseX: 830 },
  { x: 995, y: 150, w: 115, h: 18, checkpointId: 2 },
  { x: 1165, y: 185, w: 95, h: 18 },
  { x: 1300, y: 145, w: 150, h: 24, checkpointId: 3 },
];

const COINS_INIT = [
  { x: 262, y: 215 },
  { x: 410, y: 175 },
  { x: 575, y: 150 },
  { x: 738, y: 180 },
  { x: 882, y: 135 },
  { x: 1052, y: 115 },
  { x: 1212, y: 150 },
];

export const ParkourMiniGame: React.FC<ParkourMiniGameProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const completedRef = useRef(false);
  const [hudState, setHudState] = useState({ elapsed: 0, checkpoints: 0, coins: 0, falls: 0 });
  const [runSeed, setRunSeed] = useState(0);

  useEffect(() => {
    completedRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = { x: 60, y: 230, vx: 0, vy: 0, w: 22, h: 30, grounded: false };
    let respawn = { x: 60, y: 230 };
    const reachedCheckpoints = new Set<number>();
    const collectedCoins = new Set<number>();
    let falls = 0;
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
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      // Update moving platforms
      for (let i = 0; i < PLATFORMS.length; i++) {
        const p = PLATFORMS[i];
        if (p.moveAmp && p.moveSpeed && p.baseX !== undefined) {
          p.x = p.baseX + Math.sin(elapsed * p.moveSpeed) * p.moveAmp;
        }
      }

      const k = keysRef.current;
      let move = 0;
      if (k['KeyA'] || k['ArrowLeft']) move -= 1;
      if (k['KeyD'] || k['ArrowRight']) move += 1;

      player.vx = move * 235;
      if ((k['Space'] || k['KeyW'] || k['ArrowUp']) && player.grounded) {
        player.vy = -445;
        player.grounded = false;
      }

      player.vy += 1100 * dt;
      const prevBottom = player.y + player.h;
      player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x + player.vx * dt));
      player.y += player.vy * dt;
      player.grounded = false;

      // Platform landing resolution
      for (let i = 0; i < PLATFORMS.length; i++) {
        const p = PLATFORMS[i];
        if (
          player.x + player.w > p.x + 2 &&
          player.x < p.x + p.w - 2 &&
          player.vy >= 0 &&
          prevBottom <= p.y + 8 &&
          player.y + player.h >= p.y
        ) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.grounded = true;

          if (p.checkpointId && !reachedCheckpoints.has(p.checkpointId)) {
            reachedCheckpoints.add(p.checkpointId);
            respawn = { x: p.x + p.w * 0.5 - player.w * 0.5, y: p.y - player.h - 4 };
          }
        }
      }

      // Coin pickups
      COINS_INIT.forEach((c, idx) => {
        if (!collectedCoins.has(idx)) {
          const dx = player.x + player.w * 0.5 - c.x;
          const dy = player.y + player.h * 0.5 - c.y;
          if (Math.hypot(dx, dy) < 22) {
            collectedCoins.add(idx);
          }
        }
      });

      // Fall reset to latest checkpoint
      if (player.y > VIEW_H + 40) {
        falls += 1;
        player.x = respawn.x;
        player.y = respawn.y;
        player.vx = 0;
        player.vy = 0;
      }

      // Finish portal check
      const portalX = 1395;
      const portalY = 112;
      if (!completedRef.current && Math.hypot(player.x + 11 - portalX, player.y + 15 - portalY) < 28) {
        completedRef.current = true;
        const timePenalty = Math.round(elapsed * 4);
        const score = Math.max(250, 900 - timePenalty + collectedCoins.size * 45 - falls * 35);
        const accuracy = Math.max(55, Math.min(100, 100 - falls * 10));
        onComplete({
          miniGameId: 'parkour',
          score,
          timeSeconds: Math.round(elapsed * 10) / 10,
          accuracy,
          won: true,
        });
        return;
      }

      setHudState({
        elapsed: Math.round(elapsed * 10) / 10,
        checkpoints: reachedCheckpoints.size,
        coins: collectedCoins.size,
        falls,
      });

      // Render Canvas
      const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x - VIEW_W * 0.35));
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.save();
      ctx.translate(-camX, 0);

      // Platforms
      PLATFORMS.forEach((p) => {
        ctx.fillStyle = p.moveAmp ? '#f59e0b' : p.checkpointId ? '#10b981' : '#cbd5e1';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(p.x, p.y + p.h - 5, p.w, 5);

        if (p.checkpointId) {
          const hit = reachedCheckpoints.has(p.checkpointId);
          ctx.fillStyle = hit ? '#34d399' : '#94a3b8';
          ctx.fillRect(p.x + p.w * 0.5 - 2, p.y - 26, 4, 26);
          ctx.beginPath();
          ctx.moveTo(p.x + p.w * 0.5 + 2, p.y - 26);
          ctx.lineTo(p.x + p.w * 0.5 + 18, p.y - 19);
          ctx.lineTo(p.x + p.w * 0.5 + 2, p.y - 12);
          ctx.fill();
        }
      });

      // Coins
      COINS_INIT.forEach((c, idx) => {
        if (collectedCoins.has(idx)) return;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(c.x, c.y + Math.sin(elapsed * 4 + idx) * 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Finish Portal
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(portalX, portalY, 22 + Math.sin(elapsed * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.fill();

      // Player Avatar
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(player.x, player.y + 8, player.w, player.h - 8);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(player.x + 3, player.y, player.w - 6, 11);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(player.x + (player.vx >= 0 ? 11 : 4), player.y + 3, 6, 4);

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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl px-4 py-2">
        <span className="font-mono-tabular">Time: {hudState.elapsed.toFixed(1)}s</span>
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <Flag className="w-3.5 h-3.5" /> Checkpoints: {hudState.checkpoints}/3
        </span>
        <span className="text-amber-700">Coins: {hudState.coins}/{COINS_INIT.length}</span>
        <span>Falls: {hudState.falls}</span>
        <button
          type="button"
          onClick={() => setRunSeed((s) => s + 1)}
          className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="w-3 h-3" /> Restart
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="w-full rounded-xl border border-slate-300 bg-slate-900 shadow-inner"
      />

      {/* Touch & Click Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={() => setKey('ArrowLeft', true)}
            onPointerUp={() => setKey('ArrowLeft', false)}
            onPointerLeave={() => setKey('ArrowLeft', false)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-sky-600 active:text-white border border-slate-200 font-semibold text-xs inline-flex items-center gap-1 select-none"
          >
            <ArrowLeft className="w-4 h-4" /> Left
          </button>
          <button
            type="button"
            onPointerDown={() => setKey('ArrowRight', true)}
            onPointerUp={() => setKey('ArrowRight', false)}
            onPointerLeave={() => setKey('ArrowRight', false)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-sky-600 active:text-white border border-slate-200 font-semibold text-xs inline-flex items-center gap-1 select-none"
          >
            Right <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">
          Use A/D or Arrows to run · Space/W to jump
        </span>
        <button
          type="button"
          onPointerDown={() => setKey('Space', true)}
          onPointerUp={() => setKey('Space', false)}
          onPointerLeave={() => setKey('Space', false)}
          className="px-5 py-2.5 rounded-xl bg-sky-600 text-white active:bg-sky-700 font-semibold text-xs inline-flex items-center gap-1 select-none"
        >
          <ArrowUp className="w-4 h-4" /> Jump
        </button>
      </div>
    </div>
  );
};
