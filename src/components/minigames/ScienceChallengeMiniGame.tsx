import React, { useState } from 'react';
import { Atom, FlaskConical, Sparkles, Zap } from 'lucide-react';
import { MiniGameCompletionPayload } from '../../types/eduworld';

interface ScienceChallengeMiniGameProps {
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

export const ScienceChallengeMiniGame: React.FC<ScienceChallengeMiniGameProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [mistakes, setMistakes] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Stage 1: Build a safe 12V circuit by closing Main + Lamp breakers (keep Bypass OFF).');
  const [aiHint, setAiHint] = useState<string | null>(null);

  // Stage 1: Electricity Circuit
  const [voltage, setVoltage] = useState<6 | 12 | 24>(6);
  const [mainSwitch, setMainSwitch] = useState(false);
  const [lampSwitch, setLampSwitch] = useState(true);
  const [bypassSwitch, setBypassSwitch] = useState(false);

  // Stage 2: Physics Projectile Lab (target distance ~ 40m at g = 9.8)
  const [angleDeg, setAngleDeg] = useState(45);
  const [speedMs, setSpeedMs] = useState(18);
  const targetDist = 40;

  // Stage 3: Chemistry Identification
  const [chemChoice, setChemChoice] = useState<string | null>(null);

  const testCircuit = () => {
    if (bypassSwitch) {
      setMistakes((m) => m + 1);
      setStatusMsg('Short circuit detected! Turn OFF the Bypass switch before energizing.');
      return;
    }
    if (!mainSwitch || !lampSwitch) {
      setMistakes((m) => m + 1);
      setStatusMsg('Open circuit! Both Main Breaker and Lamp Switch must be closed.');
      return;
    }
    if (voltage !== 12) {
      setMistakes((m) => m + 1);
      setStatusMsg(voltage < 12 ? '6V is too dim for the 12V lab lamp.' : '24V overloaded the 12V filament! Dial to 12V.');
      return;
    }
    setAiHint(null);
    setStatusMsg('Circuit energized cleanly at 12V! Advancing to Stage 2: Physics Trajectory Lab.');
    setStage(2);
  };

  const launchProjectile = () => {
    const rad = (angleDeg * Math.PI) / 180;
    const range = (speedMs * speedMs * Math.sin(2 * rad)) / 9.8;
    const error = Math.abs(range - targetDist);
    if (error <= 3.5) {
      setAiHint(null);
      setStatusMsg(`Direct hit (${range.toFixed(1)}m)! Advancing to Stage 3: Chemistry Identification.`);
      setStage(3);
    } else {
      setMistakes((m) => m + 1);
      setStatusMsg(
        `Landed at ${range.toFixed(1)}m (target is ${targetDist}m ± 3.5m). Adjust angle or launch speed!`,
      );
    }
  };

  const verifyChemistry = (compound: string) => {
    setChemChoice(compound);
    if (compound === 'Sodium Chloride (NaCl)') {
      const accuracy = Math.max(60, 100 - mistakes * 10);
      const score = Math.max(400, 920 - mistakes * 70);
      onComplete({
        miniGameId: 'science-challenge',
        score,
        accuracy,
        won: true,
      });
    } else {
      setMistakes((m) => m + 1);
      setStatusMsg('Not quite! Neutral pH 7.0 + bright yellow-orange flame test points to sodium.');
    }
  };

  const askHint = async () => {
    const topic =
      stage === 1
        ? 'Series DC electrical circuit safety with voltage matching and short-circuit avoidance'
        : stage === 2
        ? 'Projectile motion horizontal range formula R = v^2 * sin(2*theta) / g for 40m target'
        : 'Identifying unknown salt with pH 7.0 and bright yellow sodium flame test';
    const fallback =
      stage === 1
        ? 'Select 12V, close Main & Lamp switches, and keep Bypass OFF.'
        : stage === 2
        ? 'At 45 degrees, v = 20 m/s produces R = 400 / 9.8 ≈ 40.8m.'
        : 'Sodium ions produce a bright yellow flame, and table salt dissolves at neutral pH 7.';
    try {
      const res = await fetch('/api/ai/minigame-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: 'Science Challenge',
          topic: `Science Lab Stage ${stage}`,
          questionOrClue: topic,
        }),
      });
      if (!res.ok) throw new Error('Hint fallback');
      const data = await res.json();
      setAiHint(data.hint || fallback);
    } catch {
      setAiHint(fallback);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5 text-xs">
        <span className="font-semibold text-violet-950">{statusMsg}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono-tabular font-bold text-violet-700">Stage {stage}/3</span>
          <button
            type="button"
            onClick={askHint}
            className="inline-flex items-center gap-1 rounded-lg bg-white border border-violet-200 px-2 py-1 font-semibold text-violet-700 hover:bg-violet-100"
          >
            <Sparkles className="w-3 h-3" /> Hint
          </button>
        </div>
      </div>

      {aiHint && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2 text-xs text-sky-900">
          Lab Assistant: {aiHint}
        </div>
      )}

      {stage === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Zap className="w-4 h-4 text-amber-500" /> Virtual Electricity Circuit Bench
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Power Supply:</span>
            {([6, 12, 24] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVoltage(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  voltage === v ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {v}V
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setMainSwitch((v) => !v)}
              className={`rounded-xl border p-3 text-xs font-bold ${
                mainSwitch ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              Main Breaker: {mainSwitch ? 'CLOSED' : 'OPEN'}
            </button>
            <button
              type="button"
              onClick={() => setLampSwitch((v) => !v)}
              className={`rounded-xl border p-3 text-xs font-bold ${
                lampSwitch ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              Lamp Switch: {lampSwitch ? 'CLOSED' : 'OPEN'}
            </button>
            <button
              type="button"
              onClick={() => setBypassSwitch((v) => !v)}
              className={`rounded-xl border p-3 text-xs font-bold ${
                bypassSwitch ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              Short Bypass: {bypassSwitch ? 'ON (DANGER)' : 'OFF'}
            </button>
          </div>
          <button
            type="button"
            onClick={testCircuit}
            className="w-full rounded-xl bg-violet-600 text-white py-2.5 text-xs font-bold hover:bg-violet-700"
          >
            Energize Circuit
          </button>
        </div>
      )}

      {stage === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Atom className="w-4 h-4 text-sky-600" /> Physics Projectile Launcher (Target: {targetDist}m)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs font-semibold text-slate-700">
              Launch Angle: <span className="font-mono-tabular font-bold">{angleDeg}°</span>
              <input
                type="range"
                min={20}
                max={75}
                value={angleDeg}
                onChange={(e) => setAngleDeg(Number(e.target.value))}
                className="w-full mt-1"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Launch Velocity: <span className="font-mono-tabular font-bold">{speedMs} m/s</span>
              <input
                type="range"
                min={12}
                max={28}
                value={speedMs}
                onChange={(e) => setSpeedMs(Number(e.target.value))}
                className="w-full mt-1"
              />
            </label>
          </div>
          <div className="h-24 rounded-xl bg-slate-900 relative overflow-hidden p-3 flex items-end justify-between text-[11px] text-slate-300">
            <span>Launcher (0m)</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-bold">
              Target Zone ({targetDist}m)
            </span>
          </div>
          <button
            type="button"
            onClick={launchProjectile}
            className="w-full rounded-xl bg-violet-600 text-white py-2.5 text-xs font-bold hover:bg-violet-700"
          >
            Fire Test Probe
          </button>
        </div>
      )}

      {stage === 3 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FlaskConical className="w-4 h-4 text-emerald-600" /> Chemistry Unknown Sample Lab
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
            <div>
              <p className="text-slate-500">pH Reading</p>
              <p className="font-bold text-slate-900">7.0 (Neutral)</p>
            </div>
            <div>
              <p className="text-slate-500">Flame Test</p>
              <p className="font-bold text-amber-600">Bright Yellow</p>
            </div>
            <div>
              <p className="text-slate-500">Crystal Shape</p>
              <p className="font-bold text-slate-900">Cubic Lattice</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              'Sodium Chloride (NaCl)',
              'Hydrochloric Acid (HCl)',
              'Copper(II) Sulfate (CuSO4)',
              'Calcium Carbonate (CaCO3)',
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => verifyChemistry(item)}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                  chemChoice === item
                    ? 'border-violet-500 bg-violet-50 text-violet-950'
                    : 'border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-800'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
