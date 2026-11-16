import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { DifficultyLevel, GameCompletionPayload } from '../../types/eduworld';
import { playErrorTone, playSuccessTone } from '../../utils/audio';

interface MathItem {
  prompt: string;
  formulaHint: string;
  options: number[];
  answer: number;
}

function buildMathDeck(difficulty: DifficultyLevel, seed: number): MathItem[] {
  const items: MathItem[] = [];
  for (let i = 0; i < 6; i++) {
    const n = ((seed + i * 3) % 7) + 2;
    let prompt = '';
    let formulaHint = '';
    let answer = 0;

    if (difficulty === 'explorer') {
      const a = n * 4;
      const b = i * 5 + 7;
      prompt = `${a} + ${b} = ?`;
      formulaHint = 'Add the tens and ones cleanly.';
      answer = a + b;
    } else if (difficulty === 'scholar') {
      const x = n + 2;
      const coeff = (i % 3) + 2;
      const offset = 5 + i;
      const rhs = coeff * x + offset;
      prompt = `Solve for x: ${coeff}x + ${offset} = ${rhs}`;
      formulaHint = `Subtract ${offset} from ${rhs}, then divide by ${coeff}.`;
      answer = x;
    } else {
      const base = n + 3;
      const factor = (i % 4) + 3;
      if (i % 2 === 0) {
        prompt = `What is ${factor * 10}% of ${base * 10}?`;
        formulaHint = `Multiply (${factor * 10} / 100) × ${base * 10}.`;
        answer = (factor * 10 * base * 10) / 100;
      } else {
        prompt = `Ratio 3 : ${factor} = ${3 * n} : x. Find x.`;
        formulaHint = `Scale both sides of the ratio by ${n}.`;
        answer = factor * n;
      }
    }

    const distractors = new Set<number>([answer]);
    while (distractors.size < 4) {
      const delta = (distractors.size % 2 === 0 ? 1 : -1) * (distractors.size * 2 + 1);
      const candidate = Math.max(1, answer + delta);
      distractors.add(candidate);
    }
    const options = Array.from(distractors).sort((a, b) => a - b);
    items.push({ prompt, formulaHint, options, answer });
  }
  return items;
}

interface Props {
  difficulty: DifficultyLevel;
  soundEnabled: boolean;
  onComplete: (payload: GameCompletionPayload) => void;
}

export const MathKingdomGame: React.FC<Props> = ({ difficulty, soundEnabled, onComplete }) => {
  const [seed, setSeed] = useState(1);
  const deck = useMemo(() => buildMathDeck(difficulty, seed), [difficulty, seed]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = deck[index];

  const handlePick = (val: number) => {
    if (selected !== null || done) return;
    setSelected(val);
    const isRight = val === current.answer;
    if (isRight) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setCorrect((c) => c + 1);
      setScore((s) => s + 60 + nextCombo * 15);
      playSuccessTone(soundEnabled);
    } else {
      setCombo(0);
      playErrorTone(soundEnabled);
    }

    window.setTimeout(() => {
      if (index + 1 < deck.length) {
        setIndex((i) => i + 1);
        setSelected(null);
      } else {
        const finalCorrect = isRight ? correct + 1 : correct;
        const finalScore = isRight ? score + 60 + (combo + 1) * 15 : score;
        const accuracy = Math.round((finalCorrect / deck.length) * 100);
        setDone(true);
        onComplete({ gameId: 'math-kingdom', score: finalScore, accuracy, difficulty });
      }
    }, 850);
  };

  const reset = () => {
    setSeed((s) => s + 1);
    setIndex(0);
    setSelected(null);
    setCorrect(0);
    setCombo(0);
    setScore(0);
    setDone(false);
  };

  if (done) {
    const accuracy = Math.round((correct / deck.length) * 100);
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
        <h3 className="mt-3 text-xl font-semibold text-slate-900">Citadel Gates Unlocked</h3>
        <p className="mt-1 text-sm text-slate-600">
          Accuracy: <span className="font-mono-tabular font-semibold">{accuracy}%</span> · Final Score:{' '}
          <span className="font-mono-tabular font-semibold">{score}</span>
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Another Round</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progress & Combo Strip */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <span className="text-slate-600">
          Round <strong className="font-mono-tabular text-slate-900">{index + 1} / {deck.length}</strong>
        </span>
        <div className="flex items-center gap-4 font-mono-tabular">
          <span className="text-amber-700">Combo ×{combo}</span>
          <span className="text-slate-900 font-semibold">Score {score}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-sky-600 transition-all duration-200"
          style={{ width: `${((index + 1) / deck.length) * 100}%` }}
        />
      </div>

      {/* Equation Stage */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-medium text-slate-500">Arithmetic Citadel Challenge</p>
        <h3 className="mt-2 text-3xl font-semibold text-slate-900 font-mono-tabular">{current.prompt}</h3>
        <p className="mt-2 text-sm text-slate-500">{current.formulaHint}</p>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {current.options.map((opt) => {
            const isPicked = selected === opt;
            const isCorrect = opt === current.answer;
            let cls = 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-sky-50 hover:border-sky-300';
            if (selected !== null) {
              if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
              else if (isPicked) cls = 'border-red-400 bg-red-50 text-red-900';
            }
            return (
              <button
                key={opt}
                type="button"
                disabled={selected !== null}
                onClick={() => handlePick(opt)}
                className={`rounded-xl border py-4 px-3 text-xl font-semibold font-mono-tabular transition-colors flex items-center justify-center gap-2 ${cls}`}
              >
                <span>{opt}</span>
                {selected !== null && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {selected !== null && isPicked && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
