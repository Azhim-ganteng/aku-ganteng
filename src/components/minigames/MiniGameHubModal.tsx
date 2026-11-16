import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Hammer,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { MINI_GAMES } from '../../data/miniGamesData';
import { useEduWorld } from '../../context/EduWorldContext';
import { MiniGameCompletionPayload, MiniGameId } from '../../types/eduworld';
import { ParkourMiniGame } from './ParkourMiniGame';
import { TreasureHuntMiniGame } from './TreasureHuntMiniGame';
import { QuizBattleMiniGame } from './QuizBattleMiniGame';
import { ScienceChallengeMiniGame } from './ScienceChallengeMiniGame';
import { NetworkPuzzleMiniGame } from './NetworkPuzzleMiniGame';
import { RacingMiniGame } from './RacingMiniGame';
import { FarmingMiniGame } from './FarmingMiniGame';

interface CompletionSummary {
  won: boolean;
  score: number;
  timeSeconds?: number;
  accuracy?: number;
  xpEarned: number;
  coinsEarned: number;
  newlyUnlockedItem: string | null;
  newlyUnlockedBadge: string | null;
}

export const MiniGameHubModal: React.FC = () => {
  const {
    miniGameHubOpen,
    activeMiniGameId,
    openMiniGameHub,
    closeMiniGameHub,
    miniGameProgress,
    recordMiniGameCompletion,
  } = useEduWorld();

  const [selectedId, setSelectedId] = useState<MiniGameId | null>(activeMiniGameId);
  const [stage, setStage] = useState<'lobby' | 'intro' | 'playing' | 'summary'>('lobby');
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);

  useEffect(() => {
    if (miniGameHubOpen) {
      setSelectedId(activeMiniGameId);
      setSummary(null);
      setStage(activeMiniGameId ? 'intro' : 'lobby');
    }
  }, [miniGameHubOpen, activeMiniGameId]);

  if (!miniGameHubOpen) return null;

  const currentId = selectedId ?? activeMiniGameId;
  const activeDef = MINI_GAMES.find((m) => m.id === currentId) ?? null;

  const enterGame = (id: MiniGameId) => {
    setSelectedId(id);
    setSummary(null);
    setStage('intro');
  };

  const handleGameComplete = async (payload: MiniGameCompletionPayload) => {
    const res = await recordMiniGameCompletion(payload);
    setSummary({
      won: payload.won,
      score: payload.score,
      timeSeconds: payload.timeSeconds,
      accuracy: payload.accuracy,
      ...res,
    });
    setStage('summary');
  };

  const returnToLobby = () => {
    setSelectedId(null);
    setSummary(null);
    setStage('lobby');
    openMiniGameHub(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="EDUWORLD Mini Game Hub"
    >
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            {stage !== 'lobby' && (
              <button
                type="button"
                onClick={returnToLobby}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                aria-label="Back to Mini Game Hub lobby"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeDef && stage !== 'lobby' ? activeDef.title : 'EDUWORLD Mini Game Hub'}
              </h2>
              <p className="text-xs text-slate-500">
                {miniGameProgress.completedIds.length}/7 Challenges Cleared ·{' '}
                {miniGameProgress.unlockedBadges.length}/7 Badges ·{' '}
                {miniGameProgress.unlockedSandboxItems.length}/7 Sandbox Unlocks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setStage('lobby');
              setSelectedId(null);
              closeMiniGameHub();
            }}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            aria-label="Close Mini Game Hub"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {stage === 'lobby' || !activeDef ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MINI_GAMES.map((mg) => {
                const cleared = miniGameProgress.completedIds.includes(mg.id);
                const bestScore = miniGameProgress.bestScores[mg.id];
                const bestTime = miniGameProgress.bestTimes[mg.id];
                return (
                  <div
                    key={mg.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className="inline-flex items-center gap-1.5 font-bold"
                          style={{ color: mg.accentHex }}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: mg.accentHex }} />
                          Challenge
                        </span>
                        {cleared ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">+{mg.baseXp} XP</span>
                        )}
                      </div>

                      <h3 className="mt-2 text-base font-bold text-slate-900">{mg.title}</h3>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{mg.tagline}</p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Badge: {mg.badgeTitle}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Hammer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Unlocks: {mg.unlockItemName}</span>
                        </div>
                        {(bestScore !== undefined || bestTime !== undefined) && (
                          <p className="font-mono-tabular text-slate-700 pt-0.5">
                            {bestScore !== undefined ? `Best Score: ${bestScore}` : ''}{' '}
                            {bestTime !== undefined ? `· Best Time: ${bestTime}s` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => enterGame(mg.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white py-2 text-xs font-bold hover:bg-slate-800 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{cleared ? 'Replay Challenge' : 'Play Challenge'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : stage === 'intro' ? (
            <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: activeDef.accentHex }}>
                <Sparkles className="w-4 h-4" />
                <span>Mini Game Briefing</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{activeDef.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{activeDef.instructions}</p>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-white border border-slate-200 p-3.5 text-xs">
                <div>
                  <p className="text-slate-500">Completion Rewards</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    +{activeDef.baseXp} XP · +{activeDef.baseCoins} EduCoins
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Sandbox Build Unlock</p>
                  <p className="font-bold text-emerald-700 mt-0.5">{activeDef.unlockItemName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setReplayNonce((n) => n + 1);
                  setStage('playing');
                }}
                className="w-full rounded-xl bg-sky-600 text-white py-3 text-sm font-bold hover:bg-sky-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Start {activeDef.title}
              </button>
            </div>
          ) : stage === 'summary' && summary ? (
            <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {summary.won ? `${activeDef.title} Completed!` : `${activeDef.title} Finished`}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Score: <span className="font-mono-tabular font-bold text-slate-900">{summary.score}</span>
                  {summary.timeSeconds !== undefined && ` · Time: ${summary.timeSeconds}s`}
                  {summary.accuracy !== undefined && ` · Accuracy: ${summary.accuracy}%`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
                  <p className="text-sky-700 font-semibold">Experience Earned</p>
                  <p className="text-lg font-bold text-sky-900">+{summary.xpEarned} XP</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-amber-700 font-semibold">EduCoins Earned</p>
                  <p className="text-lg font-bold text-amber-900">+{summary.coinsEarned}</p>
                </div>
              </div>

              {(summary.newlyUnlockedItem || summary.newlyUnlockedBadge) && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
                  {summary.newlyUnlockedBadge && (
                    <p className="font-bold">New Hub Badge Unlocked: {summary.newlyUnlockedBadge}</p>
                  )}
                  {summary.newlyUnlockedItem && (
                    <p className="font-semibold">
                      Unlocked in Creative Build Mode: {summary.newlyUnlockedItem}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSummary(null);
                    setReplayNonce((n) => n + 1);
                    setStage('playing');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-white py-2.5 text-xs font-bold hover:bg-sky-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Play Again
                </button>
                <button
                  type="button"
                  onClick={returnToLobby}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 py-2.5 text-xs font-bold hover:bg-slate-100"
                >
                  All Mini-Games
                </button>
              </div>
            </div>
          ) : (
            <div key={`${activeDef.id}-${replayNonce}`}>
              {activeDef.id === 'parkour' && <ParkourMiniGame onComplete={handleGameComplete} />}
              {activeDef.id === 'treasure-hunt' && <TreasureHuntMiniGame onComplete={handleGameComplete} />}
              {activeDef.id === 'quiz-battle' && <QuizBattleMiniGame onComplete={handleGameComplete} />}
              {activeDef.id === 'science-challenge' && (
                <ScienceChallengeMiniGame onComplete={handleGameComplete} />
              )}
              {activeDef.id === 'network-puzzle' && <NetworkPuzzleMiniGame onComplete={handleGameComplete} />}
              {activeDef.id === 'racing' && (
                <RacingMiniGame
                  bestTimeSeconds={miniGameProgress.bestTimes.racing}
                  onComplete={handleGameComplete}
                />
              )}
              {activeDef.id === 'farming' && <FarmingMiniGame onComplete={handleGameComplete} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
