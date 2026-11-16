import React, { useMemo, useState } from 'react';
import { Compass, KeyRound, Sparkles } from 'lucide-react';
import { TREASURE_CHEST_BANK } from '../../data/miniGamesData';
import { MiniGameCompletionPayload } from '../../types/eduworld';

interface TreasureHuntMiniGameProps {
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

const GRID_COLS = 5;
const GRID_ROWS = 4;

interface ChestTarget {
  index: number;
  clue: string;
  question: (typeof TREASURE_CHEST_BANK)[number]['question'];
  bonusCoins: number;
  bonusXp: number;
}

export const TreasureHuntMiniGame: React.FC<TreasureHuntMiniGameProps> = ({ onComplete }) => {
  const chests = useMemo<ChestTarget[]>(() => {
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * (GRID_COLS * GRID_ROWS)));
    }
    return Array.from(indices).map((idx, i) => ({
      index: idx,
      ...TREASURE_CHEST_BANK[i % TREASURE_CHEST_BANK.length],
    }));
  }, []);

  const [scanned, setScanned] = useState<Record<number, string>>({});
  const [unlockedChests, setUnlockedChests] = useState<number[]>([]);
  const [activeChest, setActiveChest] = useState<ChestTarget | null>(null);
  const [radarMessage, setRadarMessage] = useState('Click any sector tile to scan for buried treasure chests.');
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);

  const handleScanTile = (tileIdx: number) => {
    if (activeChest) return;
    setAiHint(null);

    const chestHit = chests.find((c) => c.index === tileIdx);
    if (chestHit) {
      if (unlockedChests.includes(tileIdx)) {
        setRadarMessage('This treasure chest has already been unlocked!');
        return;
      }
      setScanned((prev) => ({ ...prev, [tileIdx]: 'CHEST' }));
      setActiveChest(chestHit);
      setRadarMessage('Treasure Chest found! Answer its knowledge lock to claim the loot.');
      return;
    }

    setAttempts((a) => a + 1);
    const tx = tileIdx % GRID_COLS;
    const ty = Math.floor(tileIdx / GRID_COLS);
    let minDist = 99;
    chests.forEach((c) => {
      if (unlockedChests.includes(c.index)) return;
      const cx = c.index % GRID_COLS;
      const cy = Math.floor(c.index / GRID_COLS);
      const d = Math.abs(cx - tx) + Math.abs(cy - ty);
      if (d < minDist) minDist = d;
    });

    const badge = minDist <= 1 ? 'HOT!' : minDist === 2 ? 'WARM' : 'COLD';
    setScanned((prev) => ({ ...prev, [tileIdx]: badge }));
    setRadarMessage(
      minDist <= 1
        ? `Scanner HOT! A hidden chest is directly adjacent (${minDist} step away).`
        : minDist === 2
        ? `Scanner WARM — within 2 tiles of a hidden chest.`
        : `Scanner COLD (${minDist} tiles away). Follow the exploration clues!`,
    );
  };

  const handleAnswer = (optIdx: number) => {
    if (!activeChest) return;
    const isCorrect = optIdx === activeChest.question.correctIndex;
    if (!isCorrect) {
      setWrongAnswers((w) => w + 1);
      setRadarMessage(`Lock held! Hint: ${activeChest.question.hint}`);
      return;
    }

    const nextUnlocked = [...unlockedChests, activeChest.index];
    const nextScore = score + 220 + activeChest.bonusCoins * 2;
    setUnlockedChests(nextUnlocked);
    setScore(nextScore);
    setActiveChest(null);
    setAiHint(null);

    if (nextUnlocked.length >= chests.length) {
      const accuracy = Math.max(60, Math.round((3 / (3 + wrongAnswers)) * 100));
      onComplete({
        miniGameId: 'treasure-hunt',
        score: Math.max(300, nextScore - attempts * 8),
        accuracy,
        won: true,
      });
    } else {
      setRadarMessage(
        `Chest Unlocked (+${activeChest.bonusCoins} bonus score)! ${chests.length - nextUnlocked.length} chest(s) left.`,
      );
    }
  };

  const requestAiHint = async () => {
    if (!activeChest || hintLoading) return;
    setHintLoading(true);
    try {
      const res = await fetch('/api/ai/minigame-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: 'Treasure Hunt',
          topic: 'Campus Treasure Lock',
          questionOrClue: activeChest.question.question,
        }),
      });
      if (!res.ok) throw new Error('Hint fallback');
      const data = await res.json();
      setAiHint(data.hint || activeChest.question.hint);
    } catch {
      setAiHint(activeChest.question.hint);
    } finally {
      setHintLoading(false);
    }
  };

  const remainingClue = chests.find((c) => !unlockedChests.includes(c.index))?.clue ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
          <Compass className="w-4 h-4 text-amber-600" /> {radarMessage}
        </span>
        <span className="font-mono-tabular font-bold text-slate-800">
          Chests: {unlockedChests.length}/{chests.length} · Score: {score}
        </span>
      </div>

      {remainingClue && !activeChest && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-700">
          <span className="font-bold text-slate-900">Active Clue:</span> {remainingClue}
        </div>
      )}

      {activeChest ? (
        <div className="rounded-2xl border border-amber-300 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <KeyRound className="w-4 h-4" /> Chest Lock Puzzle
            </span>
            <button
              type="button"
              onClick={requestAiHint}
              disabled={hintLoading}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            >
              <Sparkles className="w-3.5 h-3.5" /> {hintLoading ? 'Thinking...' : 'AI Hint'}
            </button>
          </div>
          <p className="text-sm font-bold text-slate-900">{activeChest.question.question}</p>
          {aiHint && (
            <p className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-900">
              AI Guide: {aiHint}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeChest.question.options.map((opt, idx) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleAnswer(idx)}
                className="rounded-xl border border-slate-200 bg-slate-50 hover:border-amber-400 hover:bg-amber-50 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
            const state = scanned[idx];
            const isUnlocked = unlockedChests.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleScanTile(idx)}
                className={`h-14 rounded-xl border text-xs font-bold transition-all ${
                  isUnlocked
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : state === 'CHEST'
                    ? 'bg-amber-400 text-slate-900 border-amber-500'
                    : state === 'HOT!'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : state === 'WARM'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : state === 'COLD'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
              >
                {isUnlocked ? 'OPENED' : state ?? `S-${idx + 1}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
