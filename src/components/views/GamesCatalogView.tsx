import React, { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, Play, Search, Trophy } from 'lucide-react';
import { DISTRICTS } from '../../data/districts';
import { GAMES_CATALOG } from '../../data/gamesCatalog';
import { useEduWorld } from '../../context/EduWorldContext';
import { GameCategory } from '../../types/eduworld';

const CATEGORIES: ('All' | GameCategory)[] = [
  'All',
  'STEM & Lab',
  'Logic & Code',
  'World & Humanities',
  'Eco & Civic',
];

export const GamesCatalogView: React.FC = () => {
  const { player, openGame, openMiniGameHub, teleportToBuilding, miniGameProgress } = useEduWorld();
  const [selectedCategory, setSelectedCategory] = useState<'All' | GameCategory>('All');
  const [search, setSearch] = useState('');

  const filteredGames = useMemo(() => {
    return GAMES_CATALOG.filter((game) => {
      const catMatch = selectedCategory === 'All' || game.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const textMatch =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.subtitle.toLowerCase().includes(q) ||
        game.buildingName.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [selectedCategory, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">20 Educational Games</h1>
          <p className="mt-1 text-sm text-slate-600">
            Launch any district simulation directly or teleport to its landmark in the 3D city.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => openMiniGameHub()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-white px-4 py-2.5 text-xs font-bold hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            <Trophy className="w-4 h-4" />
            <span>Mini Game Hub ({miniGameProgress.completedIds.length}/7)</span>
          </button>
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games or buildings..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Interactive Category Segmented Filter */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 border border-slate-200 w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 20-Game Modular Grid */}
      {filteredGames.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No educational modules match your search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGames.map((game) => {
            const district = DISTRICTS.find((d) => d.id === game.districtId);
            const prog = player.gameProgress[game.id];
            return (
              <div
                key={game.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular">
                      {String(game.number).padStart(2, '0')} · {game.category}
                    </span>
                    {prog ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Best {prog.bestScore}
                      </span>
                    ) : (
                      <span>{game.estimatedMinutes} min</span>
                    )}
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{game.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {game.buildingName} · {district?.name}
                  </p>
                  <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">{game.subtitle}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openGame(game)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 text-white py-2 px-3 text-sm font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{game.engineType === 'ai-challenge' ? 'Play AI Mode' : 'Play Interactive'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => teleportToBuilding(game)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    title="Teleport to building in 3D city"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
