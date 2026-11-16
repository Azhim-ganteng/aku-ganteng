import React, { useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, Loader2, Sparkles, XCircle } from 'lucide-react';
import { DifficultyLevel, GameCompletionPayload, GameDefinition, GameQuestion } from '../../types/eduworld';
import { evaluateOpenAnswer, generateDynamicQuestions } from '../../services/aiClient';
import { playClickTone, playErrorTone, playSuccessTone } from '../../utils/audio';

interface Props {
  game: GameDefinition;
  difficulty: DifficultyLevel;
  soundEnabled: boolean;
  onComplete: (payload: GameCompletionPayload) => void;
}

export const AIChallengeGame: React.FC<Props> = ({ game, difficulty, soundEnabled, onComplete }) => {
  const [questions, setQuestions] = useState<GameQuestion[]>(game.fallbackQuestions);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [sourceLabel, setSourceLabel] = useState<'Gemini AI' | 'Curriculum Bank'>('Curriculum Bank');
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  // Open-ended AI evaluation bonus stage
  const [stage, setStage] = useState<'quiz' | 'reflection' | 'done'>('quiz');
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{
    isCorrect: boolean;
    score: number;
    feedback: string;
    improvementTip: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingQuestions(true);
    generateDynamicQuestions({
      gameTitle: game.title,
      category: game.category,
      difficulty,
      count: 3,
    })
      .then((res) => {
        if (!active) return;
        if (res.questions && res.questions.length > 0) {
          setQuestions(res.questions);
          setSourceLabel('Gemini AI');
        }
      })
      .catch(() => {
        if (!active) return;
        setQuestions(game.fallbackQuestions);
        setSourceLabel('Curriculum Bank');
      })
      .finally(() => {
        if (active) setLoadingQuestions(false);
      });

    return () => {
      active = false;
    };
  }, [game, difficulty]);

  const currentQ = questions[qIdx] ?? game.fallbackQuestions[0];

  const handleSelect = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === currentQ.correctIndex) {
      setCorrectCount((c) => c + 1);
      playSuccessTone(soundEnabled);
    } else {
      playErrorTone(soundEnabled);
    }
  };

  const handleNextQuestion = () => {
    playClickTone(soundEnabled);
    if (qIdx + 1 < questions.length) {
      setQIdx((i) => i + 1);
      setPicked(null);
      setShowHint(false);
    } else {
      setStage('reflection');
    }
  };

  const reflectionPrompt = `In your own words, explain one key principle from "${game.learningObjectives[0]}" and how it applies in real life.`;

  const finishModule = (bonusScore: number) => {
    const accuracy = Math.round(((correctCount + (bonusScore >= 60 ? 1 : 0)) / (questions.length + 1)) * 100);
    const totalScore = correctCount * 100 + bonusScore;
    setStage('done');
    onComplete({
      gameId: game.id,
      score: totalScore,
      accuracy,
      difficulty,
    });
  };

  const handleEvaluateReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionAnswer.trim() || evaluating) return;
    setEvaluating(true);
    try {
      const result = await evaluateOpenAnswer({
        question: reflectionPrompt,
        studentAnswer: reflectionAnswer.trim(),
        expectedTopic: game.title,
        difficulty,
      });
      setEvalResult(result);
      if (result.isCorrect) playSuccessTone(soundEnabled);
    } catch {
      // Local heuristic fallback if AI endpoint unavailable
      const words = reflectionAnswer.trim().split(/\s+/).length;
      const localScore = Math.min(95, 55 + words * 3);
      setEvalResult({
        isCorrect: words >= 5,
        score: localScore,
        feedback: 'Thoughtful explanation recorded in your academy log.',
        improvementTip: 'Include a concrete real-world example to reinforce the concept.',
      });
    } finally {
      setEvaluating(false);
    }
  };

  if (loadingQuestions) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-10 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-7 h-7 text-sky-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-900">Preparing {game.title} ({difficulty})</p>
        <p className="text-xs text-slate-500">Generating adaptive district challenges...</p>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
        <h3 className="mt-3 text-xl font-semibold text-slate-900">{game.title} Completed</h3>
        <p className="mt-1 text-sm text-slate-600">
          Answered {correctCount} of {questions.length} core questions · Difficulty: {difficulty}
        </p>
      </div>
    );
  }

  if (stage === 'reflection') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-sky-700">
          <Sparkles className="w-4 h-4" />
          <span>AI Synthesis Checkpoint</span>
        </div>
        <h4 className="mt-2 text-base font-semibold text-slate-900">{reflectionPrompt}</h4>

        <form onSubmit={handleEvaluateReflection} className="mt-4 flex flex-col gap-3">
          <textarea
            rows={3}
            value={reflectionAnswer}
            onChange={(e) => setReflectionAnswer(e.target.value)}
            placeholder="Write 1–3 sentences explaining the principle..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          {evalResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Evaluation Score: {evalResult.score}/100</span>
                <span className={evalResult.isCorrect ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {evalResult.isCorrect ? 'Concept Mastered' : 'Keep Refining'}
                </span>
              </div>
              <p className="mt-1 text-slate-700">{evalResult.feedback}</p>
              <p className="mt-1 text-xs text-slate-500">Tip: {evalResult.improvementTip}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!evalResult ? (
              <>
                <button
                  type="button"
                  onClick={() => finishModule(50)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Skip & Complete
                </button>
                <button
                  type="submit"
                  disabled={evaluating || !reflectionAnswer.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
                >
                  {evaluating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Evaluate with Gemini AI</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => finishModule(evalResult.score)}
                className="rounded-lg bg-emerald-600 text-white px-5 py-2 text-sm font-semibold hover:bg-emerald-700"
              >
                Claim Rewards & Finish
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Question {qIdx + 1} of {questions.length} · Source: {sourceLabel}
        </span>
        <span className="font-mono-tabular">Correct: {correctCount}</span>
      </div>

      <h4 className="mt-3 text-lg font-semibold text-slate-900">{currentQ.question}</h4>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {currentQ.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const isRight = idx === currentQ.correctIndex;
          let cls = 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-sky-50 hover:border-sky-300';
          if (picked !== null) {
            if (isRight) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
            else if (isPicked) cls = 'border-red-400 bg-red-50 text-red-900';
          }
          return (
            <button
              key={`${opt}-${idx}`}
              type="button"
              disabled={picked !== null}
              onClick={() => handleSelect(idx)}
              className={`rounded-xl border p-3.5 text-left text-sm font-medium transition-colors flex items-center justify-between gap-2 ${cls}`}
            >
              <span>{opt}</span>
              {picked !== null && isRight && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {picked !== null && isPicked && !isRight && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowHint((h) => !h)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:underline"
        >
          <HelpCircle className="w-4 h-4" />
          <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
        </button>

        {picked !== null && (
          <button
            type="button"
            onClick={handleNextQuestion}
            className="rounded-lg bg-sky-600 text-white px-5 py-2 text-sm font-semibold hover:bg-sky-700"
          >
            {qIdx + 1 < questions.length ? 'Next Question' : 'Proceed to AI Synthesis'}
          </button>
        )}
      </div>

      {showHint && picked === null && (
        <p className="mt-3 text-xs text-slate-600 bg-sky-50 border border-sky-200 rounded-lg p-3">
          Hint: {currentQ.hint}
        </p>
      )}

      {picked !== null && (
        <p className="mt-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
          {currentQ.explanation}
        </p>
      )}
    </div>
  );
};
