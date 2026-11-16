import React, { useState } from 'react';
import {
  Award,
  Compass,
  Gamepad2,
  Home,
  LogIn,
  Menu,
  Settings,
  Sparkles,
  Target,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react';
import { EduWorldProvider, useEduWorld } from './context/EduWorldContext';
import { NavTab } from './types/eduworld';
import { HomeDashboard } from './components/views/HomeDashboard';
import { ExploreWorldView } from './components/world/ExploreWorldView';
import { GamesCatalogView } from './components/views/GamesCatalogView';
import { AIAssistantView } from './components/views/AIAssistantView';
import { MissionsView } from './components/views/MissionsView';
import { AchievementsView } from './components/views/AchievementsView';
import { LeaderboardView } from './components/views/LeaderboardView';
import { PlayerProfileView } from './components/views/PlayerProfileView';
import { SettingsView } from './components/views/SettingsView';
import { GameLauncherModal } from './components/games/GameLauncherModal';
import { NpcDialogueModal } from './components/world/NpcDialogueModal';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore World', icon: Compass },
  { id: 'games', label: '20 Educational Games', icon: Gamepad2 },
  { id: 'ai-assistant', label: 'AI Learning Assistant', icon: Sparkles },
  { id: 'missions', label: 'Missions', icon: Target },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'profile', label: 'Player Profile', icon: UserIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const AppShell: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    player,
    user,
    isSigningIn,
    signInWithGoogle,
    toast,
    dismissToast,
  } = useEduWorld();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (id: NavTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Clean Top Bar (3-zone layout) */}
      <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-4 lg:px-6 flex items-center justify-between gap-6 z-30">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            EDUWORLD AI
          </button>
        </div>

        {/* Center Inline Status Summary */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
          <span>Lvl {player.level}</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>{player.xp} XP</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-amber-700 font-semibold">{player.coins} Coins</span>
        </div>

        {/* Primary Right Action */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => handleNav('profile')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: player.avatar.accentColor }}
              />
              <span className="max-w-[130px] truncate">{player.displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={isSigningIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Sidebar Navigation (All 9 Required Routes) */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-3">
          <nav className="space-y-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-sky-50 text-sky-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <p className="font-semibold text-slate-900">{player.title}</p>
            <p className="mt-0.5 text-slate-500 font-mono-tabular">
              {Object.keys(player.gameProgress).length}/20 Games Cleared
            </p>
          </div>
        </aside>

        {/* Mobile / Tablet Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-14 z-40 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)}>
            <nav
              className="w-64 h-full bg-white border-r border-slate-200 p-3 space-y-1 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                      active ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Main Workspace Stage */}
        <main className={`flex-1 min-w-0 ${activeTab === 'explore' ? 'h-full overflow-hidden' : 'overflow-y-auto'}`}>
          {activeTab === 'home' && <HomeDashboard />}
          {activeTab === 'explore' && <ExploreWorldView />}
          {activeTab === 'games' && <GamesCatalogView />}
          {activeTab === 'ai-assistant' && <AIAssistantView />}
          {activeTab === 'missions' && <MissionsView />}
          {activeTab === 'achievements' && <AchievementsView />}
          {activeTab === 'leaderboard' && <LeaderboardView />}
          {activeTab === 'profile' && <PlayerProfileView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Interactive Modals & Toast */}
      <GameLauncherModal />
      <NpcDialogueModal />

      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            <p className="text-xs text-slate-600 mt-0.5">{toast.detail}</p>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <EduWorldProvider>
      <AppShell />
    </EduWorldProvider>
  );
}
