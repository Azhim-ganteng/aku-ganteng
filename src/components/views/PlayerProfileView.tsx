import React, { useState } from 'react';
import { Check, Compass } from 'lucide-react';
import { GAMES_CATALOG } from '../../data/gamesCatalog';
import { useEduWorld } from '../../context/EduWorldContext';
import { AvatarConfig, PackStyle, VisorStyle } from '../../types/eduworld';

const SUIT_COLORS = [
  { label: 'Alabaster', hex: '#F8FAFC' },
  { label: 'Slate', hex: '#334155' },
  { label: 'Sandstone', hex: '#E7E5E4' },
  { label: 'Obsidian', hex: '#0F172A' },
];

const ACCENT_COLORS = [
  { label: 'Cerulean', hex: '#0284C7' },
  { label: 'Emerald', hex: '#059669' },
  { label: 'Amber', hex: '#D97706' },
  { label: 'Indigo', hex: '#4F46E5' },
];

export const PlayerProfileView: React.FC = () => {
  const { player, updateProfileAppearance, setActiveTab } = useEduWorld();
  const [name, setName] = useState(player.displayName);
  const [avatar, setAvatar] = useState<AvatarConfig>(player.avatar);

  const completedGames = Object.values(player.gameProgress);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileAppearance(name, avatar);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Player Profile & Avatar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Customize your 3D city scholar suit, visor, and gear—updates reflect immediately in Explore World.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Avatar Preview Card */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 flex flex-col items-center justify-between gap-5">
          <div className="text-center">
            <p className="text-xs font-medium text-sky-700">{player.title}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{name || 'Sky Scholar'}</h2>
          </div>

          {/* Crisp Geometric Avatar Preview */}
          <div className="w-48 h-56 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center relative">
            <svg viewBox="0 0 120 150" className="w-36 h-44" aria-label="Avatar preview">
              {/* Pack */}
              {avatar.packStyle === 'wings' && (
                <>
                  <polygon points="34,64 8,52 14,76 34,78" fill={avatar.accentColor} />
                  <polygon points="86,64 112,52 106,76 86,78" fill={avatar.accentColor} />
                </>
              )}
              {avatar.packStyle === 'thruster' && (
                <>
                  <rect x="26" y="60" width="12" height="32" rx="4" fill={avatar.accentColor} />
                  <rect x="82" y="60" width="12" height="32" rx="4" fill={avatar.accentColor} />
                </>
              )}
              {avatar.packStyle === 'satchel' && (
                <rect x="28" y="62" width="64" height="30" rx="6" fill={avatar.accentColor} />
              )}

              {/* Legs */}
              <rect x="42" y="96" width="13" height="36" rx="5" fill="#1E293B" />
              <rect x="65" y="96" width="13" height="36" rx="5" fill="#1E293B" />
              <rect x="40" y="124" width="17" height="10" rx="3" fill={avatar.accentColor} />
              <rect x="63" y="124" width="17" height="10" rx="3" fill={avatar.accentColor} />

              {/* Torso & Chest */}
              <rect x="36" y="54" width="48" height="44" rx="8" fill={avatar.suitColor} stroke="#CBD5E1" strokeWidth="2" />
              <rect x="44" y="62" width="32" height="16" rx="4" fill={avatar.accentColor} />

              {/* Arms */}
              <rect x="22" y="58" width="11" height="32" rx="5" fill={avatar.suitColor} stroke="#CBD5E1" strokeWidth="1.5" />
              <rect x="87" y="58" width="11" height="32" rx="5" fill={avatar.suitColor} stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Head & Visor */}
              <circle cx="60" cy="34" r="19" fill={avatar.suitColor} stroke="#CBD5E1" strokeWidth="2" />
              <rect
                x="44"
                y="27"
                width="32"
                height="12"
                rx="5"
                fill={
                  avatar.visorStyle === 'amber'
                    ? '#F59E0B'
                    : avatar.visorStyle === 'emerald'
                      ? '#10B981'
                      : avatar.visorStyle === 'obsidian'
                        ? '#1E293B'
                        : '#38BDF8'
                }
              />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Compass className="w-4 h-4 text-sky-600" />
            <span>Preview in 3D City</span>
          </button>
        </div>

        {/* Customization Controls */}
        <form onSubmit={handleSave} className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Scholar Display Name</label>
            <input
              type="text"
              maxLength={48}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Primary Suit Finish</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SUIT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setAvatar((a) => ({ ...a, suitColor: c.hex }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                    avatar.suitColor === c.hex ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: c.hex }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Trim & Emblem Accent</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setAvatar((a) => ({ ...a, accentColor: c.hex }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                    avatar.accentColor === c.hex ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Visor Tint</label>
              <select
                value={avatar.visorStyle}
                onChange={(e) => setAvatar((a) => ({ ...a, visorStyle: e.target.value as VisorStyle }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="sky">Sky Cyan</option>
                <option value="amber">Solar Amber</option>
                <option value="emerald">Botanical Emerald</option>
                <option value="obsidian">Obsidian</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Utility Pack</label>
              <select
                value={avatar.packStyle}
                onChange={(e) => setAvatar((a) => ({ ...a, packStyle: e.target.value as PackStyle }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="wings">Aero Wings</option>
                <option value="thruster">Twin Thrusters</option>
                <option value="satchel">Scholar Pack</option>
                <option value="none">Minimalist (None)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-sky-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Save Customization</span>
          </button>
        </form>
      </div>

      {/* Completed Games Mastery Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Game Progress Breakdown</h2>
        {completedGames.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No games completed yet. Visit 20 Educational Games or walk into any building in the 3D city to record your first score.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {completedGames.map((gp) => {
              const g = GAMES_CATALOG.find((item) => item.id === gp.gameId);
              return (
                <div key={gp.gameId} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{g?.title ?? gp.gameId}</p>
                    <p className="text-xs text-slate-500 capitalize">Highest Tier: {gp.highestDifficulty}</p>
                  </div>
                  <div className="flex items-center gap-5 font-mono-tabular text-xs text-slate-700">
                    <span>Best Score: <strong>{gp.bestScore}</strong></span>
                    <span>Accuracy: <strong>{gp.bestAccuracy}%</strong></span>
                    <span>Plays: <strong>{gp.playCount}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
