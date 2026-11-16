import React from 'react';
import { Award, Lock } from 'lucide-react';
import { ACHIEVEMENTS } from '../../data/missionsAndBadges';
import { useEduWorld } from '../../context/EduWorldContext';

export const AchievementsView: React.FC = () => {
  const { player } = useEduWorld();
  const gamesCompleted = Object.keys(player.gameProgress).length;

  const getCurrent = (metric: string) => {
    if (metric === 'gamesCompleted') return gamesCompleted;
    if (metric === 'level') return player.level;
    if (metric === 'districtsVisited') return player.visitedDistricts.length;
    if (metric === 'coins') return player.coins;
    if (metric === 'xp') return player.xp;
    return 0;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Achievement Badges</h1>
          <p className="mt-1 text-sm text-slate-600">
            Unlock academic milestones across city exploration, games, and total XP mastery.
          </p>
        </div>
        <p className="text-sm font-mono-tabular text-slate-700">
          Unlocked: <strong>{player.unlockedAchievements.length}</strong> / {ACHIEVEMENTS.length}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ACHIEVEMENTS.map((ach) => {
          const current = getCurrent(ach.metric);
          const unlocked = player.unlockedAchievements.includes(ach.id) || current >= ach.threshold;

          return (
            <div
              key={ach.id}
              className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                unlocked ? 'border-amber-300 bg-white' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">{ach.tier} Tier</span>
                  {unlocked ? (
                    <Award className="w-5 h-5 text-amber-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <h3 className={`mt-3 text-base font-semibold ${unlocked ? 'text-slate-900' : 'text-slate-600'}`}>
                  {ach.title}
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{ach.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono-tabular">
                <span className={unlocked ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                  {unlocked ? 'Earned' : 'In Progress'}
                </span>
                <span className="text-slate-600">
                  {Math.min(current, ach.threshold)} / {ach.threshold}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
