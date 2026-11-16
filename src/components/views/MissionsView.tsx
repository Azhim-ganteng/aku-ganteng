import React from 'react';
import { CheckCircle2, Coins, Target } from 'lucide-react';
import { MISSIONS } from '../../data/missionsAndBadges';
import { getMissionMetricValue, useEduWorld } from '../../context/EduWorldContext';

export const MissionsView: React.FC = () => {
  const { player, claimMission } = useEduWorld();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Educational Missions</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete city exploration and gameplay objectives to claim bonus XP and EduCoins.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MISSIONS.map((mission) => {
          const current = getMissionMetricValue(player, mission.metric);
          const progress = Math.min(current, mission.targetCount);
          const pct = Math.round((progress / mission.targetCount) * 100);
          const isClaimed = player.claimedMissions.includes(mission.id);
          const isReady = progress >= mission.targetCount && !isClaimed;

          return (
            <div
              key={mission.id}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Target className="w-4 h-4 text-sky-600" />
                    <span className="font-mono-tabular">
                      +{mission.rewardXp} XP · +{mission.rewardCoins} Coins
                    </span>
                  </div>
                  {isClaimed && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Claimed
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-base font-semibold text-slate-900">{mission.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{mission.description}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 font-mono-tabular mb-1">
                    <span>Progress</span>
                    <span>
                      {progress} / {mission.targetCount}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${isClaimed ? 'bg-emerald-500' : 'bg-sky-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {isReady && (
                  <button
                    type="button"
                    onClick={() => claimMission(mission.id)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 text-white py-2 px-4 text-sm font-semibold hover:bg-amber-700 transition-colors"
                  >
                    <Coins className="w-4 h-4" />
                    <span>Claim Reward</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
