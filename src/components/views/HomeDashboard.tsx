import React, { useEffect, useState } from 'react';
import { ArrowRight, Compass, Gamepad2, Loader2, MapPin, Sparkles } from 'lucide-react';
import { DISTRICTS } from '../../data/districts';
import { GAMES_CATALOG } from '../../data/gamesCatalog';
import { getMissionMetricValue, useEduWorld } from '../../context/EduWorldContext';
import { MISSIONS } from '../../data/missionsAndBadges';
import { fetchLearningRecommendations } from '../../services/aiClient';

export const HomeDashboard: React.FC = () => {
  const {
    player,
    setActiveTab,
    openGame,
    teleportToDistrict,
    user,
    isSigningIn,
    signInWithGoogle,
  } = useEduWorld();

  const [recLoading, setRecLoading] = useState(false);
  const [recData, setRecData] = useState<{
    headline: string;
    recommendations: { gameTitle: string; recommendedDifficulty: string; reason: string }[];
  } | null>(null);

  const completedCount = Object.keys(player.gameProgress).length;
  const featuredGames = GAMES_CATALOG.filter((g) => g.engineType !== 'ai-challenge');
  const nextMission = MISSIONS.find((m) => !player.claimedMissions.includes(m.id)) ?? MISSIONS[0];
  const nextMissionVal = getMissionMetricValue(player, nextMission.metric);

  const loadRecommendations = async () => {
    setRecLoading(true);
    const completedTitles = GAMES_CATALOG.filter((g) => player.gameProgress[g.id]).map((g) => g.title);
    const unplayedTitles = GAMES_CATALOG.filter((g) => !player.gameProgress[g.id]).map((g) => g.title);
    try {
      const res = await fetchLearningRecommendations({
        level: player.level,
        xp: player.xp,
        completedGameTitles: completedTitles,
        unplayedGameTitles: unplayedTitles,
      });
      setRecData(res);
    } catch {
      setRecData({
        headline: 'Recommended Learning Path in EDUWORLD AI',
        recommendations: [
          {
            gameTitle: 'Solar System Adventure',
            recommendedDifficulty: 'explorer',
            reason: 'Explore Keplerian orbital periods inside the 3D Science Spire observatory.',
          },
          {
            gameTitle: 'Coding Quest',
            recommendedDifficulty: 'explorer',
            reason: 'Build algorithmic sequencing skills with the courtyard autonomous rover.',
          },
          {
            gameTitle: 'Math Kingdom',
            recommendedDifficulty: 'scholar',
            reason: 'Sharpen algebraic speed and ratio intuition at the Arithmetic Citadel.',
          },
        ],
      });
    } finally {
      setRecLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Hero Vista Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div>
            <p className="text-xs font-medium text-sky-700">
              EDUWORLD AI · {player.title}
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
              Explore the Futuristic Education City
            </h1>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Walk across five Solarpunk academic districts, converse with AI mentors, and master 20 interactive simulations spanning science, coding, math, and global humanities.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('explore')}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-5 py-3 text-sm font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
            >
              <Compass className="w-4 h-4" />
              <span>Enter 3D City</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('games')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-800 px-5 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Gamepad2 className="w-4 h-4 text-sky-600" />
              <span>Browse 20 Games</span>
            </button>
            {!user && (
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                className="text-sm font-medium text-slate-600 hover:text-sky-700 disabled:opacity-60 disabled:cursor-not-allowed px-2 py-2 whitespace-nowrap"
              >
                {isSigningIn ? 'Signing in...' : 'Sign in with Google to sync'}
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative min-h-[260px]">
          <img
            src="/src/assets/images/hero_eduworld_city_1794751381845.jpg"
            alt="EDUWORLD AI sunlit futuristic campus city"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 via-slate-900/35 to-transparent p-5 text-white">
            <p className="text-xs text-slate-200">5 Academic Districts · 20 Interactive Buildings</p>
            <p className="text-sm font-semibold mt-0.5">Live Third-Person Exploration Ready</p>
          </div>
        </div>
      </section>

      {/* Full-width 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Scholar Level</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono-tabular">Level {player.level}</p>
          <p className="mt-1 text-xs text-slate-500 font-mono-tabular">{player.xp} Total XP</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">EduCoins Balance</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700 font-mono-tabular">{player.coins}</p>
          <p className="mt-1 text-xs text-slate-500">Earned from games & missions</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Games Completed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono-tabular">{completedCount} / 20</p>
          <p className="mt-1 text-xs text-slate-500">{player.visitedDistricts.length} / 5 Districts Visited</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Active Mission</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">{nextMission.title}</p>
          <p className="mt-1 text-xs text-sky-700 font-mono-tabular">
            Progress: {Math.min(nextMissionVal, nextMission.targetCount)} / {nextMission.targetCount}
          </p>
        </div>
      </section>

      {/* Featured Interactive Starter Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Featured Interactive Simulations</h2>
            <p className="text-sm text-slate-600">Launch directly into our core 3D/2D playable districts or inspect all 20 modules.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('games')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline whitespace-nowrap shrink-0"
          >
            <span>All 20 Games</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featuredGames.map((game) => (
            <div key={game.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between">
              <div>
                <div className="h-44 bg-slate-100 overflow-hidden">
                  {game.coverImage && (
                    <img
                      src={game.coverImage}
                      alt={game.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">
                    {game.category} · {game.buildingName}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{game.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{game.subtitle}</p>
                </div>
              </div>
              <div className="px-5 pb-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openGame(game)}
                  className="flex-1 rounded-lg bg-slate-900 text-white py-2 px-3 text-sm font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Play Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = DISTRICTS.find((dist) => dist.id === game.districtId);
                    if (d) teleportToDistrict(d.id, game.buildingCoords, game.buildingName);
                  }}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  title="Locate in 3D City"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Personalized Gemini AI Recommendations + District Teleport */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                {recData?.headline || 'Personalized Learning Recommendations'}
              </h2>
            </div>
            <button
              type="button"
              onClick={loadRecommendations}
              disabled={recLoading}
              className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
            >
              {recLoading ? 'Refreshing...' : 'Refresh Path'}
            </button>
          </div>

          {recLoading && !recData ? (
            <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              <span>Analyzing your progress...</span>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {(recData?.recommendations ?? []).map((rec) => {
                const matched = GAMES_CATALOG.find(
                  (g) => g.title.toLowerCase() === rec.gameTitle.toLowerCase(),
                );
                return (
                  <div key={rec.gameTitle} className="py-3.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {rec.gameTitle}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          · Suggested: {rec.recommendedDifficulty}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">{rec.reason}</p>
                    </div>
                    {matched && (
                      <button
                        type="button"
                        onClick={() => openGame(matched)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-300 whitespace-nowrap shrink-0"
                      >
                        Launch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">City Districts</h2>
          <p className="mt-1 text-xs text-slate-500">Teleport directly to any academic district plaza in 3D.</p>
          <div className="mt-4 space-y-2.5">
            {DISTRICTS.map((dist) => (
              <button
                key={dist.id}
                type="button"
                onClick={() => teleportToDistrict(dist.id, dist.plazaCoords, dist.name)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{dist.name}</p>
                  <p className="text-xs text-slate-500 truncate">{dist.tagline}</p>
                </div>
                <span className="text-xs font-semibold text-sky-700 whitespace-nowrap shrink-0">Visit</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
