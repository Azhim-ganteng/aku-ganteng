import React, { useState } from 'react';
import { Award, MapPin, Play, X } from 'lucide-react';
import { DISTRICTS } from '../../data/districts';
import { useEduWorld } from '../../context/EduWorldContext';
import { DifficultyLevel } from '../../types/eduworld';
import { SolarSystemGame } from './SolarSystemGame';
import { MathKingdomGame } from './MathKingdomGame';
import { CodingQuestGame } from './CodingQuestGame';
import { AIChallengeGame } from './AIChallengeGame';

export const GameLauncherModal: React.FC = () => {
  const { activeGame, closeGame, player, recordGameCompletion, teleportToBuilding } = useEduWorld();
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('explorer');
  const [playing, setPlaying] = useState(false);

  if (!activeGame) return null;

  const district = DISTRICTS.find((d) => d.id === activeGame.districtId);
  const progress = player.gameProgress[activeGame.id];

  const handleClose = () => {
    setPlaying(false);
    closeGame();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Module {String(activeGame.number).padStart(2, '0')}</span>
              <span aria-hidden="true">·</span>
              <span>{activeGame.buildingName}</span>
              <span aria-hidden="true">·</span>
              <span>{district?.name}</span>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{activeGame.title}</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close game"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!playing ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  {activeGame.coverImage ? (
                    <img
                      src={activeGame.coverImage}
                      alt={activeGame.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-cover rounded-lg mb-4 border border-slate-200"
                    />
                  ) : (
                    <div
                      className="w-full h-36 rounded-lg mb-4 flex flex-col items-center justify-center text-white p-4"
                      style={{ backgroundColor: activeGame.accentHex }}
                    >
                      <span className="font-mono-tabular text-xs opacity-85">
                        DISTRICT BUILDING {String(activeGame.number).padStart(2, '0')}
                      </span>
                      <span className="mt-1 text-lg font-semibold text-center">{activeGame.buildingName}</span>
                    </div>
                  )}

                  <p className="text-sm text-slate-700 leading-relaxed">{activeGame.subtitle}</p>

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-900">Learning Objectives</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                      {activeGame.learningObjectives.map((obj) => (
                        <li key={obj}>· {obj}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {progress && (
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs text-slate-600 font-mono-tabular">
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      Best: {progress.bestScore} pts ({progress.bestAccuracy}%)
                    </span>
                    <span>Plays: {progress.playCount}</span>
                  </div>
                )}
              </div>

              <div className="md:col-span-7 flex flex-col justify-between gap-5">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Select Difficulty Tier</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Higher tiers scale question complexity and award bonus XP and EduCoins.
                  </p>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        { id: 'explorer', label: 'Explorer', note: '1.0x Rewards · Foundational' },
                        { id: 'scholar', label: 'Scholar', note: '1.25x Rewards · Applied' },
                        { id: 'master', label: 'Master', note: '1.6x Rewards · Synthesis' },
                      ] as const
                    ).map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setDifficulty(tier.id)}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          difficulty === tier.id
                            ? 'border-sky-600 bg-sky-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{tier.label}</p>
                        <p className="mt-1 text-xs text-slate-600">{tier.note}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeGame;
                      handleClose();
                      teleportToBuilding(target);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <MapPin className="w-4 h-4 text-sky-600" />
                    <span>Locate Building in 3D City</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-sky-700 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start {activeGame.title}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Active Mode: <strong className="text-slate-800 capitalize">{difficulty}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setPlaying(false)}
                  className="text-sky-700 font-medium hover:underline"
                >
                  Change Difficulty
                </button>
              </div>

              {activeGame.engineType === 'solar-system' && (
                <SolarSystemGame
                  difficulty={difficulty}
                  soundEnabled={player.settings.soundEnabled}
                  onComplete={recordGameCompletion}
                />
              )}
              {activeGame.engineType === 'math-kingdom' && (
                <MathKingdomGame
                  difficulty={difficulty}
                  soundEnabled={player.settings.soundEnabled}
                  onComplete={recordGameCompletion}
                />
              )}
              {activeGame.engineType === 'coding-quest' && (
                <CodingQuestGame
                  difficulty={difficulty}
                  soundEnabled={player.settings.soundEnabled}
                  onComplete={recordGameCompletion}
                />
              )}
              {activeGame.engineType === 'ai-challenge' && (
                <AIChallengeGame
                  game={activeGame}
                  difficulty={difficulty}
                  soundEnabled={player.settings.soundEnabled}
                  onComplete={recordGameCompletion}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
