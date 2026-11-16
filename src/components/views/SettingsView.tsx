import React, { useState } from 'react';
import { LogIn, LogOut, Save, Volume2, VolumeX } from 'lucide-react';
import { useEduWorld } from '../../context/EduWorldContext';
import { AppSettings, QualityTier } from '../../types/eduworld';

export const SettingsView: React.FC = () => {
  const { player, updateSettings, user, isSigningIn, signInWithGoogle, signOutUser } = useEduWorld();
  const [draft, setDraft] = useState<AppSettings>(player.settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(draft);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Optimize 3D city performance for your device, tune camera controls, and manage cloud account sync.
        </p>
      </div>

      {/* Graphics & Controls */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">3D Graphics & Device Performance</h2>
          <p className="mt-1 text-xs text-slate-500">
            Select Eco mode for low-end laptops/mobile devices or High for full shadow resolution.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                { id: 'auto', label: 'Auto Detect', note: 'Balances GPU & software WebGL' },
                { id: 'low', label: 'Eco (Low-End)', note: '1x pixel ratio, shadows off' },
                { id: 'high', label: 'High Fidelity', note: '2048px shadows & sharp AA' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDraft((s) => ({ ...s, qualityTier: opt.id as QualityTier }))}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  draft.qualityTier === opt.id
                    ? 'border-sky-600 bg-sky-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                <p className="mt-1 text-xs text-slate-600">{opt.note}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              Camera Orbit Sensitivity:{' '}
              <span className="font-mono-tabular text-sky-700">{draft.cameraSensitivity.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={draft.cameraSensitivity}
              onChange={(e) => setDraft((s) => ({ ...s, cameraSensitivity: Number(e.target.value) }))}
              className="w-full accent-sky-600"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {draft.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-sky-600" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">Audio Feedback</p>
                <p className="text-xs text-slate-500">Chimes for XP, coins & answers</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraft((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
                draft.soundEnabled ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {draft.soundEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-800"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Firebase Account Sync */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cloud Account Sync</h2>
          <p className="mt-1 text-sm text-slate-600">
            {user
              ? `Signed in as ${user.displayName || user.email}. Your XP, games, and avatar sync automatically.`
              : 'Exploring in Guest Mode. Sign in with Google to save progress across devices and appear on the leaderboard.'}
          </p>
        </div>
        {user ? (
          <button
            type="button"
            onClick={signOutUser}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSigningIn}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSigningIn ? 'Signing in...' : 'Sign In with Google'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
