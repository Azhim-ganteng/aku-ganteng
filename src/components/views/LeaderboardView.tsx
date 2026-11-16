import React from 'react';
import { LogIn, Trophy } from 'lucide-react';
import { useEduWorld } from '../../context/EduWorldContext';

export const LeaderboardView: React.FC = () => {
  const { leaderboard, player, user, isSigningIn, signInWithGoogle } = useEduWorld();
  const gamesCompletedCount = Object.keys(player.gameProgress).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Academy Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live rankings synchronized via Cloud Firestore across EDUWORLD AI scholars.
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSigningIn}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSigningIn ? 'Signing in...' : 'Sign In to Publish Rank'}</span>
          </button>
        )}
      </div>

      {/* Player Personal Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: player.avatar.accentColor }}
          >
            {player.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {player.displayName} · {user ? 'Synced Account' : 'Guest Mode'}
            </p>
            <p className="text-xs text-slate-500">{player.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm font-mono-tabular">
          <div>
            <span className="text-xs text-slate-500 block">Level</span>
            <strong className="text-slate-900">{player.level}</strong>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Total XP</span>
            <strong className="text-slate-900">{player.xp}</strong>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Games</span>
            <strong className="text-slate-900">{gamesCompletedCount}/20</strong>
          </div>
        </div>
      </div>

      {/* Firestore Rankings Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {leaderboard.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Trophy className="w-9 h-9 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">No Public Ranks Published Yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Sign in with Google to publish your scholar XP and claim the #1 spot on the live academy leaderboard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-5">Rank</th>
                  <th className="py-3.5 px-5">Scholar</th>
                  <th className="py-3.5 px-5">Title</th>
                  <th className="py-3.5 px-5 text-right">Level</th>
                  <th className="py-3.5 px-5 text-right">Games</th>
                  <th className="py-3.5 px-5 text-right">XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leaderboard.map((entry, idx) => {
                  const isMe = user && entry.uid === user.uid;
                  return (
                    <tr key={entry.uid} className={isMe ? 'bg-sky-50/70' : 'hover:bg-slate-50'}>
                      <td className="py-3.5 px-5 font-mono-tabular font-semibold text-slate-900">
                        #{idx + 1}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-6 rounded-sm shrink-0"
                            style={{ backgroundColor: entry.avatarAccentColor }}
                          />
                          <span className="font-semibold text-slate-900">{entry.displayName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600">{entry.title}</td>
                      <td className="py-3.5 px-5 text-right font-mono-tabular text-slate-800">{entry.level}</td>
                      <td className="py-3.5 px-5 text-right font-mono-tabular text-slate-600">
                        {entry.gamesCompletedCount}/20
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono-tabular font-semibold text-slate-900">
                        {entry.xp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
