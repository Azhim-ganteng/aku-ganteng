import React, { useEffect, useState } from 'react';
import { Bot, Clock, Sparkles, User } from 'lucide-react';
import { QUIZ_BATTLE_BANKS } from '../../data/miniGamesData';
import { DifficultyLevel, GameQuestion, MiniGameCompletionPayload } from '../../types/eduworld';

interface QuizBattleMiniGameProps {
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

type Subject = keyof typeof QUIZ_BATTLE_BANKS;
const SUBJECTS: Subject[] = ['STEM', 'Coding', 'History', 'Ecology'];

export const QuizBattleMiniGame: React.FC<QuizBattleMiniGameProps> = ({ onComplete }) => {
  const [subject, setSubject] = useState<Subject>('STEM');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('scholar');
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState(15);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startDuel = async () => {
    setLoading(true);
    let loaded = QUIZ_BATTLE_BANKS[subject];
    try {
      const res = await fetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: `Quiz Battle: ${subject}`,
          category: subject,
          difficulty,
          objectives: [`${subject} fast quiz battle`],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.questions) && data.questions.length >= 4) {
          loaded = data.questions.slice(0, 6);
        }
      }
    } catch {
      // Fallback to built-in question bank
    } finally {
      setQuestions(loaded.slice(0, 6));
      setIndex(0);
      setPlayerScore(0);
      setBotScore(0);
      setCorrectCount(0);
      setTimer(difficulty === 'master' ? 12 : difficulty === 'scholar' ? 15 : 18);
      setFeedback(null);
      setPhase('playing');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase !== 'playing' || feedback !== null) return;
    if (timer <= 0) {
      handleChoice(-1);
      return;
    }
    const id = window.setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
  });

  const handleChoice = (optIdx: number) => {
    if (feedback !== null || !questions[index]) return;
    const q = questions[index];
    const correct = optIdx === q.correctIndex;
    const speedBonus = Math.max(0, timer * 8);
    const earned = correct ? 120 + speedBonus : 0;

    // Bot accuracy scales by difficulty
    const botChance = difficulty === 'master' ? 0.78 : difficulty === 'scholar' ? 0.62 : 0.45;
    const botHits = Math.random() < botChance;
    const botGain = botHits ? 110 + Math.floor(Math.random() * 55) : 0;

    const nextPlayer = playerScore + earned;
    const nextBot = botScore + botGain;
    const nextCorrect = correctCount + (correct ? 1 : 0);

    setPlayerScore(nextPlayer);
    setBotScore(nextBot);
    setCorrectCount(nextCorrect);
    setFeedback(
      correct
        ? `Correct (+${earned} pts)! ${q.explanation}`
        : `Missed! Correct answer: ${q.options[q.correctIndex]}. ${q.explanation}`,
    );

    window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        const accuracy = Math.round((nextCorrect / questions.length) * 100);
        onComplete({
          miniGameId: 'quiz-battle',
          score: nextPlayer,
          accuracy,
          won: nextPlayer >= nextBot && nextCorrect >= 3,
        });
      } else {
        setIndex((i) => i + 1);
        setTimer(difficulty === 'master' ? 12 : difficulty === 'scholar' ? 15 : 18);
        setFeedback(null);
      }
    }, 1150);
  };

  if (phase === 'setup') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Choose Subject</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                  subject === s ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Difficulty Level</p>
          <div className="grid grid-cols-3 gap-2">
            {(['explorer', 'scholar', 'master'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold capitalize transition-colors ${
                  difficulty === d
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={startDuel}
          disabled={loading}
          className="w-full rounded-xl bg-sky-600 text-white py-3 text-sm font-bold hover:bg-sky-700 transition-colors inline-flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>{loading ? 'Preparing AI Questions...' : `Start ${subject} Duel vs Bot Nova`}</span>
        </button>
      </div>
    );
  }

  const current = questions[index];
  if (!current) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-3 text-xs font-bold">
        <div className="flex items-center gap-1.5 text-sky-700">
          <User className="w-4 h-4" /> You: {playerScore}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-slate-800 font-mono-tabular">
          <Clock className="w-4 h-4 text-amber-600" /> {timer}s · Q{index + 1}/{questions.length}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-rose-700">
          <Bot className="w-4 h-4" /> Bot Nova: {botScore}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <p className="text-sm font-bold text-slate-900">{current.question}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {current.options.map((opt, idx) => {
            let btnClass = 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-sky-50 text-slate-800';
            if (feedback !== null) {
              btnClass =
                idx === current.correctIndex
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-400';
            }
            return (
              <button
                key={opt}
                type="button"
                disabled={feedback !== null}
                onClick={() => handleChoice(idx)}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${btnClass}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs leading-relaxed">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
};
