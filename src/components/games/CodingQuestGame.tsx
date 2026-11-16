import React, { useEffect, useState } from 'react';
import { ArrowUp, CheckCircle2, Play, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { DifficultyLevel, GameCompletionPayload } from '../../types/eduworld';
import { playClickTone, playErrorTone, playSuccessTone } from '../../utils/audio';

type Command = 'FWD' | 'LEFT' | 'RIGHT';

interface LevelSpec {
  title: string;
  size: number;
  start: { x: number; y: number; dir: number }; // 0=N, 1=E, 2=S, 3=W
  goal: { x: number; y: number };
  walls: string[];
  cores: string[];
}

const LEVELS: Record<DifficultyLevel, LevelSpec[]> = {
  explorer: [
    {
      title: 'Courtyard Calibration',
      size: 5,
      start: { x: 0, y: 4, dir: 0 },
      goal: { x: 3, y: 1 },
      walls: ['1,3', '1,2', '2,3'],
      cores: ['0,2', '3,2'],
    },
    {
      title: 'Solar Conduit Route',
      size: 5,
      start: { x: 0, y: 4, dir: 1 },
      goal: { x: 4, y: 0 },
      walls: ['2,4', '2,3', '2,1'],
      cores: ['1,2', '4,2'],
    },
  ],
  scholar: [
    {
      title: 'Switchback Protocol',
      size: 5,
      start: { x: 0, y: 4, dir: 0 },
      goal: { x: 4, y: 0 },
      walls: ['1,4', '1,3', '1,1', '3,2', '3,1'],
      cores: ['0,0', '2,2'],
    },
    {
      title: 'Dual Relay Sweep',
      size: 5,
      start: { x: 2, y: 4, dir: 0 },
      goal: { x: 0, y: 0 },
      walls: ['1,3', '3,3', '2,1', '1,1'],
      cores: ['2,2', '4,1'],
    },
  ],
  master: [
    {
      title: 'Nexus Labyrinth',
      size: 6,
      start: { x: 0, y: 5, dir: 1 },
      goal: { x: 5, y: 0 },
      walls: ['2,5', '2,4', '1,2', '2,2', '4,3', '4,2', '4,1'],
      cores: ['3,4', '0,1', '5,2'],
    },
    {
      title: 'Autonomous Perimeter',
      size: 6,
      start: { x: 0, y: 5, dir: 0 },
      goal: { x: 5, y: 5 },
      walls: ['1,5', '1,4', '1,3', '3,2', '3,1', '4,4', '4,3'],
      cores: ['0,1', '3,0', '5,2'],
    },
  ],
};

const DIR_ARROWS = ['↑', '→', '↓', '←'];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

interface Props {
  difficulty: DifficultyLevel;
  soundEnabled: boolean;
  onComplete: (payload: GameCompletionPayload) => void;
}

export const CodingQuestGame: React.FC<Props> = ({ difficulty, soundEnabled, onComplete }) => {
  const levels = LEVELS[difficulty];
  const [levelIdx, setLevelIdx] = useState(0);
  const level = levels[levelIdx];

  const [program, setProgram] = useState<Command[]>([]);
  const [rover, setRover] = useState(level.start);
  const [collected, setCollected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Queue rover commands and press Run Program.');
  const [levelsCleared, setLevelsCleared] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setProgram([]);
    setRover(level.start);
    setCollected([]);
    setRunning(false);
    setStatusMsg('Queue rover commands and press Run Program.');
  }, [level]);

  const addCmd = (cmd: Command) => {
    if (running || program.length >= 24) return;
    playClickTone(soundEnabled);
    setProgram((p) => [...p, cmd]);
  };

  const runProgram = () => {
    if (running || program.length === 0) return;
    setRunning(true);
    let curr = { ...level.start };
    const foundCores = new Set<string>();
    setRover(curr);
    setCollected([]);
    setStatusMsg('Executing autonomous sequence...');

    let step = 0;
    const timer = window.setInterval(() => {
      if (step >= program.length) {
        window.clearInterval(timer);
        setRunning(false);
        const atGoal = curr.x === level.goal.x && curr.y === level.goal.y;
        if (atGoal) {
          playSuccessTone(soundEnabled);
          const nextCleared = levelsCleared + 1;
          setLevelsCleared(nextCleared);
          if (levelIdx + 1 < levels.length) {
            setStatusMsg('Beacon reached! Loading next courtyard...');
            window.setTimeout(() => setLevelIdx((i) => i + 1), 900);
          } else {
            setFinished(true);
            const bonus = foundCores.size * 30;
            onComplete({
              gameId: 'coding-quest',
              score: 220 + bonus,
              accuracy: 100,
              difficulty,
            });
          }
        } else {
          playErrorTone(soundEnabled);
          setStatusMsg('Rover stopped short of the goal beacon. Adjust your sequence and retry.');
        }
        return;
      }

      const cmd = program[step];
      step += 1;

      if (cmd === 'LEFT') {
        curr = { ...curr, dir: (curr.dir + 3) % 4 };
      } else if (cmd === 'RIGHT') {
        curr = { ...curr, dir: (curr.dir + 1) % 4 };
      } else {
        const nx = curr.x + DX[curr.dir];
        const ny = curr.y + DY[curr.dir];
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= level.size || ny >= level.size || level.walls.includes(key)) {
          window.clearInterval(timer);
          setRunning(false);
          playErrorTone(soundEnabled);
          setStatusMsg('Collision detected with courtyard barrier! Resetting rover.');
          return;
        }
        curr = { ...curr, x: nx, y: ny };
        if (level.cores.includes(key)) {
          foundCores.add(key);
          setCollected(Array.from(foundCores));
        }
      }
      setRover(curr);
    }, 260);
  };

  if (finished) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
        <h3 className="mt-3 text-xl font-semibold text-slate-900">All Autonomous Routes Verified</h3>
        <p className="mt-1 text-sm text-slate-600">
          Your rover navigated every courtyard puzzle cleanly on {difficulty} tier.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Grid Courtyard */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Puzzle {levelIdx + 1}/{levels.length}: {level.title}
          </span>
          <span className="font-mono-tabular">Data Cores: {collected.length}/{level.cores.length}</span>
        </div>

        <div
          className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-3 aspect-square max-w-[420px] w-full mx-auto"
          style={{ gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: level.size * level.size }).map((_, idx) => {
            const x = idx % level.size;
            const y = Math.floor(idx / level.size);
            const key = `${x},${y}`;
            const isWall = level.walls.includes(key);
            const isGoal = level.goal.x === x && level.goal.y === y;
            const isCore = level.cores.includes(key) && !collected.includes(key);
            const isRover = rover.x === x && rover.y === y;

            return (
              <div
                key={key}
                className={`rounded-lg flex items-center justify-center text-sm font-semibold border transition-colors ${
                  isWall
                    ? 'bg-slate-700 border-slate-800 text-slate-400'
                    : isGoal
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {isRover ? (
                  <span className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-mono-tabular shadow-sm">
                    {DIR_ARROWS[rover.dir]}
                  </span>
                ) : isGoal ? (
                  <span className="text-xs font-mono-tabular">GOAL</span>
                ) : isCore ? (
                  <span className="w-3.5 h-3.5 rounded-sm bg-amber-500 rotate-45 block" title="Data Core" />
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-600 text-center">{statusMsg}</p>
      </div>

      {/* Command Sequencer */}
      <div className="lg:col-span-5 flex flex-col justify-between gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Instruction Palette</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => addCmd('FWD')}
              disabled={running}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-2 text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-300"
            >
              <ArrowUp className="w-4 h-4 text-sky-600" />
              <span>Forward</span>
            </button>
            <button
              type="button"
              onClick={() => addCmd('LEFT')}
              disabled={running}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-2 text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-300"
            >
              <RotateCcw className="w-4 h-4 text-sky-600" />
              <span>Turn Left</span>
            </button>
            <button
              type="button"
              onClick={() => addCmd('RIGHT')}
              disabled={running}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-2 text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-300"
            >
              <RotateCw className="w-4 h-4 text-sky-600" />
              <span>Turn Right</span>
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Command Queue ({program.length}/24)</span>
              <button
                type="button"
                disabled={running || program.length === 0}
                onClick={() => setProgram([])}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
            <div className="mt-2 min-h-[120px] max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex flex-wrap content-start gap-1.5">
              {program.length === 0 && (
                <span className="text-xs text-slate-400">Click instructions above to build your rover program.</span>
              )}
              {program.map((cmd, idx) => (
                <button
                  key={`${cmd}-${idx}`}
                  type="button"
                  disabled={running}
                  onClick={() => setProgram((p) => p.filter((_, i) => i !== idx))}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-xs font-mono-tabular font-medium text-slate-800 hover:border-red-300"
                  title="Click to remove"
                >
                  {idx + 1}. {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => {
              setRover(level.start);
              setCollected([]);
              setStatusMsg('Rover reset to start pad.');
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Rover
          </button>
          <button
            type="button"
            disabled={running || program.length === 0}
            onClick={runProgram}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 text-white py-2.5 px-4 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>{running ? 'Running...' : 'Run Program'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
