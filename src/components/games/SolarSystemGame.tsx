import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, XCircle } from 'lucide-react';
import { DifficultyLevel, GameCompletionPayload } from '../../types/eduworld';
import { playClickTone, playErrorTone, playSuccessTone } from '../../utils/audio';

interface PlanetSpec {
  name: string;
  au: number;
  periodDays: number;
  radiusPx: number;
  orbitPx: number;
  color: string;
  fact: string;
}

const PLANETS: PlanetSpec[] = [
  { name: 'Mercury', au: 0.39, periodDays: 88, radiusPx: 5, orbitPx: 44, color: '#94A3B8', fact: 'Fastest orbit in the Solar System at ~47.4 km/s.' },
  { name: 'Venus', au: 0.72, periodDays: 225, radiusPx: 8, orbitPx: 68, color: '#F59E0B', fact: 'Thick CO2 atmosphere traps heat above 460°C.' },
  { name: 'Earth', au: 1.0, periodDays: 365, radiusPx: 9, orbitPx: 95, color: '#0284C7', fact: 'Baseline 1.00 AU orbital distance supporting liquid water.' },
  { name: 'Mars', au: 1.52, periodDays: 687, radiusPx: 7, orbitPx: 122, color: '#EF4444', fact: 'Home to Olympus Mons, the tallest volcano in the Solar System.' },
  { name: 'Jupiter', au: 5.2, periodDays: 4333, radiusPx: 15, orbitPx: 158, color: '#D97706', fact: 'Gas giant with more than twice the mass of all other planets combined.' },
  { name: 'Saturn', au: 9.54, periodDays: 10759, radiusPx: 13, orbitPx: 194, color: '#EAB308', fact: 'Signature icy ring system spanning over 280,000 km across.' },
];

interface ChallengePrompt {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const CHALLENGES: Record<DifficultyLevel, ChallengePrompt[]> = {
  explorer: [
    {
      question: 'Inspect the observatory: which planet orbits closest to the Sun with an 88-day year?',
      options: ['Mercury', 'Mars', 'Venus', 'Earth'],
      correctIndex: 0,
      explanation: 'Mercury orbits at 0.39 AU and completes a full revolution every 88 Earth days.',
    },
    {
      question: 'Which planet sits at 1.00 AU and takes 365 days per orbit?',
      options: ['Earth', 'Venus', 'Saturn', 'Jupiter'],
      correctIndex: 0,
      explanation: 'One Astronomical Unit (AU) is defined by Earth’s average distance from the Sun.',
    },
    {
      question: 'How does orbital period change as you move outward from Mercury to Saturn?',
      options: ['It becomes much longer', 'It becomes shorter', 'It stays 365 days', 'It reverses'],
      correctIndex: 0,
      explanation: 'Outer planets travel larger paths at slower orbital velocities.',
    },
  ],
  scholar: [
    {
      question: 'Jupiter orbits at 5.20 AU. Roughly how many Earth years does one Jovian year take?',
      options: ['~11.9 years', '~2.5 years', '~29.5 years', '~5.2 years'],
      correctIndex: 0,
      explanation: '4,333 days ÷ 365 days ≈ 11.87 Earth years, matching Kepler’s Third Law (P² ≈ a³).',
    },
    {
      question: 'Mars orbits at 1.52 AU while Venus orbits at 0.72 AU. Which planet moves faster along its orbit?',
      options: ['Venus', 'Mars', 'Both move identically', 'Depends on axial tilt'],
      correctIndex: 0,
      explanation: 'Closer planets experience stronger solar gravity and travel faster.',
    },
    {
      question: 'If a spacecraft travels from Earth (1.0 AU) to Saturn (9.54 AU), how many AU does its orbital radius expand?',
      options: ['8.54 AU', '10.54 AU', '4.20 AU', '6.15 AU'],
      correctIndex: 0,
      explanation: '9.54 AU − 1.00 AU = 8.54 AU radial increase.',
    },
  ],
  master: [
    {
      question: 'By Kepler’s Third Law (P² = a³ in years and AU), what is the orbital period of an asteroid at a = 4.0 AU?',
      options: ['8.0 Earth years', '16.0 Earth years', '4.0 Earth years', '64.0 Earth years'],
      correctIndex: 0,
      explanation: 'a³ = 4³ = 64, and √64 = 8.0 Earth years.',
    },
    {
      question: 'Why does solar irradiance drop by 1/27th at 5.2 AU (Jupiter) compared to Earth (1.0 AU)?',
      options: ['Inverse-square law (1 / 5.2² ≈ 1 / 27)', 'Jupiter absorbs all sunlight', 'Solar wind blocks photons', 'Kepler’s Second Law'],
      correctIndex: 0,
      explanation: 'Sunlight spreads over a sphere of area 4πr², decreasing intensity by 1/r².',
    },
    {
      question: 'Which law explains why a planet sweeps out equal orbital areas in equal intervals of time?',
      options: ['Kepler’s Second Law', 'Kepler’s First Law', 'Ohm’s Law', 'Boyle’s Law'],
      correctIndex: 0,
      explanation: 'Conservation of angular momentum drives Kepler’s Second Law of equal areas.',
    },
  ],
};

interface Props {
  difficulty: DifficultyLevel;
  soundEnabled: boolean;
  onComplete: (payload: GameCompletionPayload) => void;
}

export const SolarSystemGame: React.FC<Props> = ({ difficulty, soundEnabled, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [paused, setPaused] = useState(false);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetSpec>(PLANETS[2]);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const speedRef = useRef(speedMultiplier);
  const pausedRef = useRef(paused);
  const selectedRef = useRef(selectedPlanet.name);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    selectedRef.current = selectedPlanet.name;
  }, [selectedPlanet]);

  const questions = CHALLENGES[difficulty];
  const currentQ = questions[qIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let simDays = 0;
    let lastTime = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (!pausedRef.current) {
        simDays += dt * 45 * speedRef.current;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, w, h);

      // Subtle coordinate grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let r = 44; r <= 200; r += 44) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sun
      const sunGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 24);
      sunGrad.addColorStop(0, '#FEF08A');
      sunGrad.addColorStop(0.6, '#F59E0B');
      sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();

      // Planets
      PLANETS.forEach((p) => {
        const isSelected = p.name === selectedRef.current;
        ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.7)' : 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = isSelected ? 1.8 : 1;
        ctx.beginPath();
        ctx.arc(cx, cy, p.orbitPx, 0, Math.PI * 2);
        ctx.stroke();

        const angle = (simDays / p.periodDays) * Math.PI * 2;
        const px = cx + Math.cos(angle) * p.orbitPx;
        const py = cy + Math.sin(angle) * p.orbitPx;

        if (p.name === 'Saturn') {
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(px, py, p.radiusPx + 7, p.radiusPx * 0.45, 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.radiusPx, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, p.radiusPx + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isSelected ? '#F8FAFC' : '#94A3B8';
        ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(p.name, px + p.radiusPx + 6, py + 4);
      });

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSelectAnswer = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === currentQ.correctIndex) {
      setCorrectCount((c) => c + 1);
      playSuccessTone(soundEnabled);
    } else {
      playErrorTone(soundEnabled);
    }
  };

  const handleNext = () => {
    playClickTone(soundEnabled);
    if (qIndex + 1 < questions.length) {
      setQIndex((i) => i + 1);
      setPicked(null);
    } else {
      const accuracy = Math.round((correctCount / questions.length) * 100);
      const score = correctCount * 100;
      setFinished(true);
      onComplete({ gameId: 'solar-system-adventure', score, accuracy, difficulty });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Interactive Orbital Stage (60%+) */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
          <canvas ref={canvasRef} width={520} height={420} className="w-full h-auto block" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{paused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSpeedMultiplier(1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>1.0x</span>
            </button>
          </div>

          <label className="flex items-center gap-3 text-xs font-medium text-slate-700">
            <span className="whitespace-nowrap">Orbital Speed: <strong className="font-mono-tabular">{speedMultiplier.toFixed(1)}x</strong></span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.2"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="w-28 accent-sky-600"
            />
          </label>
        </div>

        {/* Planet Inspector Strip */}
        <div className="flex flex-wrap gap-1.5">
          {PLANETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setSelectedPlanet(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedPlanet.name === p.name
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Right Control & Challenge Deck */}
      <div className="lg:col-span-5 flex flex-col justify-between gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">Selected Planet Telemetry</p>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{selectedPlanet.name}</h4>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-700 font-mono-tabular">
            <span>Distance: {selectedPlanet.au.toFixed(2)} AU</span>
            <span aria-hidden="true">·</span>
            <span>Period: {selectedPlanet.periodDays} days</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{selectedPlanet.fact}</p>
        </div>

        {!finished ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Observatory Challenge {qIndex + 1} of {questions.length}</span>
                <span className="font-mono-tabular">Score: {correctCount * 100}</span>
              </div>
              <h4 className="mt-2 text-base font-semibold text-slate-900">{currentQ.question}</h4>

              <div className="mt-4 flex flex-col gap-2">
                {currentQ.options.map((opt, idx) => {
                  const isPicked = picked === idx;
                  const isRight = idx === currentQ.correctIndex;
                  let style = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
                  if (picked !== null) {
                    if (isRight) style = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                    else if (isPicked) style = 'border-red-400 bg-red-50 text-red-900';
                  }
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={picked !== null}
                      onClick={() => handleSelectAnswer(idx)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center justify-between ${style}`}
                    >
                      <span>{opt}</span>
                      {picked !== null && isRight && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {picked !== null && isPicked && !isRight && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {picked !== null && (
                <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  {currentQ.explanation}
                </p>
              )}
            </div>

            {picked !== null && (
              <button
                type="button"
                onClick={handleNext}
                className="mt-4 w-full rounded-lg bg-sky-600 text-white py-2.5 text-sm font-semibold hover:bg-sky-700 transition-colors"
              >
                {qIndex + 1 < questions.length ? 'Next Observation' : 'Finish Mission'}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="mt-3 text-lg font-semibold text-slate-900">Observatory Calibration Complete</h4>
            <p className="mt-1 text-sm text-slate-600">
              You solved {correctCount} of {questions.length} orbital challenges on {difficulty} mode.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
