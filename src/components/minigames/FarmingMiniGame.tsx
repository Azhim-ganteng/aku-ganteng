import React, { useEffect, useState } from 'react';
import { Droplets, Lock, Plus, Sprout, Sun } from 'lucide-react';
import { MiniGameCompletionPayload } from '../../types/eduworld';

interface FarmingMiniGameProps {
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

type CropType = 'wheat' | 'berry' | 'orchid';

const CROPS: Record<CropType, { name: string; cost: number; value: number; points: number; growthRate: number; color: string }> = {
  wheat: { name: 'Sun Wheat', cost: 5, value: 18, points: 25, growthRate: 24, color: '#F59E0B' },
  berry: { name: 'Solar Berry', cost: 10, value: 32, points: 45, growthRate: 18, color: '#EC4899' },
  orchid: { name: 'Azure Orchid', cost: 16, value: 52, points: 70, growthRate: 14, color: '#0EA5E9' },
};

interface FarmPlot {
  unlocked: boolean;
  crop: CropType | null;
  growth: number; // 0..100
  water: number; // 0..100
}

export const FarmingMiniGame: React.FC<FarmingMiniGameProps> = ({ onComplete }) => {
  const [plots, setPlots] = useState<FarmPlot[]>(() =>
    Array.from({ length: 9 }).map((_, idx) => ({
      unlocked: idx < 4,
      crop: null,
      growth: 0,
      water: 60,
    })),
  );
  const [selectedCrop, setSelectedCrop] = useState<CropType>('wheat');
  const [tool, setTool] = useState<'plant' | 'water' | 'harvest'>('plant');
  const [gardenCoins, setGardenCoins] = useState(30);
  const [harvestPoints, setHarvestPoints] = useState(0);
  const [harvestCount, setHarvestCount] = useState(0);
  const TARGET_POINTS = 180;

  // Real-time plant growth & moisture tick
  useEffect(() => {
    const id = window.setInterval(() => {
      setPlots((prev) =>
        prev.map((p) => {
          if (!p.unlocked || !p.crop) return p;
          const cfg = CROPS[p.crop];
          const nextWater = Math.max(0, p.water - 5);
          const canGrow = p.water > 10;
          const nextGrowth = canGrow ? Math.min(100, p.growth + cfg.growthRate * 0.65) : p.growth;
          return { ...p, water: nextWater, growth: nextGrowth };
        }),
      );
    }, 650);
    return () => window.clearInterval(id);
  }, []);

  const handlePlotClick = (idx: number) => {
    const p = plots[idx];
    if (!p.unlocked) {
      if (gardenCoins >= 25) {
        setGardenCoins((c) => c - 25);
        setPlots((prev) => prev.map((pl, i) => (i === idx ? { ...pl, unlocked: true, water: 70 } : pl)));
      }
      return;
    }

    if (p.crop && p.growth >= 100) {
      const cfg = CROPS[p.crop];
      const nextPoints = harvestPoints + cfg.points;
      const nextCount = harvestCount + 1;
      setGardenCoins((c) => c + cfg.value);
      setHarvestPoints(nextPoints);
      setHarvestCount(nextCount);
      setPlots((prev) => prev.map((pl, i) => (i === idx ? { ...pl, crop: null, growth: 0, water: 50 } : pl)));

      if (nextPoints >= TARGET_POINTS) {
        onComplete({
          miniGameId: 'farming',
          score: nextPoints * 4 + gardenCoins,
          accuracy: 100,
          won: true,
        });
      }
      return;
    }

    if (tool === 'water') {
      setPlots((prev) => prev.map((pl, i) => (i === idx ? { ...pl, water: 100 } : pl)));
      return;
    }

    if (tool === 'plant' && !p.crop) {
      const cfg = CROPS[selectedCrop];
      if (gardenCoins < cfg.cost) return;
      setGardenCoins((c) => c - cfg.cost);
      setPlots((prev) => prev.map((pl, i) => (i === idx ? { ...pl, crop: selectedCrop, growth: 8, water: 85 } : pl)));
    } else if (p.crop) {
      // Convenient auto-water if clicking a growing planted plot
      setPlots((prev) => prev.map((pl, i) => (i === idx ? { ...pl, water: 100 } : pl)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-950">
        <span>Garden Coins: {gardenCoins}</span>
        <span>Harvested: {harvestCount} crops</span>
        <span className="font-mono-tabular">
          Goal: {Math.min(TARGET_POINTS, harvestPoints)}/{TARGET_POINTS} pts
        </span>
      </div>

      {/* Tool & Seed Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('plant')}
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold border ${
              tool === 'plant' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Sprout className="w-3.5 h-3.5" /> Plant
          </button>
          <button
            type="button"
            onClick={() => setTool('water')}
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold border ${
              tool === 'water' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" /> Water
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(CROPS) as CropType[]).map((cid) => {
            const c = CROPS[cid];
            return (
              <button
                key={cid}
                type="button"
                onClick={() => {
                  setSelectedCrop(cid);
                  setTool('plant');
                }}
                className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
                  selectedCrop === cid
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {c.name} ({c.cost}c → +{c.value}c)
              </button>
            );
          })}
        </div>
      </div>

      {/* 3x3 Expandable Garden Plots */}
      <div className="grid grid-cols-3 gap-3">
        {plots.map((p, idx) => {
          if (!p.unlocked) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handlePlotClick(idx)}
                className="h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400 flex flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-500"
              >
                <Lock className="w-4 h-4" />
                <span>Expand Plot (25c)</span>
              </button>
            );
          }

          const cfg = p.crop ? CROPS[p.crop] : null;
          const ripe = p.growth >= 100;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handlePlotClick(idx)}
              className={`h-24 rounded-2xl border p-3 flex flex-col justify-between text-left transition-all ${
                ripe
                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                  : p.crop
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : 'border-amber-900/20 bg-amber-900/10 hover:bg-amber-900/15'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-900">{cfg ? cfg.name : 'Empty Soil'}</span>
                {ripe ? (
                  <span className="text-amber-700 inline-flex items-center gap-0.5">
                    <Sun className="w-3.5 h-3.5" /> Harvest!
                  </span>
                ) : p.crop ? (
                  <span className="font-mono-tabular text-emerald-700">{Math.round(p.growth)}%</span>
                ) : (
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>

              <div className="space-y-1">
                {p.crop && (
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${p.growth}%`, backgroundColor: cfg?.color ?? '#10b981' }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span>Water: {Math.round(p.water)}%</span>
                  {p.crop && p.water <= 15 && <span className="text-rose-600 font-bold">Thirsty!</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
