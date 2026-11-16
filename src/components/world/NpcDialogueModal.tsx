import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, Loader2, MessageSquare, Send, Sparkles, Target, X } from 'lucide-react';
import { DISTRICTS } from '../../data/districts';
import { GAMES_CATALOG } from '../../data/gamesCatalog';
import { MISSIONS } from '../../data/missionsAndBadges';
import { getMissionMetricValue, useEduWorld } from '../../context/EduWorldContext';
import { talkToDistrictNpc } from '../../services/aiClient';

type DialogueEntry = {
  role: 'npc' | 'user';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const NpcDialogueModal: React.FC = () => {
  const {
    activeNpc,
    closeNpc,
    recordAiInteraction,
    player,
    openGame,
    teleportToBuilding,
    setActiveTab,
    notify,
  } = useEduWorld();
  const [messages, setMessages] = useState<DialogueEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const district = activeNpc ? DISTRICTS.find((d) => d.id === activeNpc.districtId) : null;

  const featuredGame = useMemo(() => {
    if (!activeNpc) return null;
    if (activeNpc.featuredGameId) {
      return GAMES_CATALOG.find((g) => g.id === activeNpc.featuredGameId) ?? null;
    }
    return GAMES_CATALOG.find((g) => g.districtId === activeNpc.districtId) ?? null;
  }, [activeNpc]);

  const suggestedMission = useMemo(() => {
    if (!activeNpc) return null;
    if (activeNpc.recommendedMissionId) {
      const explicit = MISSIONS.find((m) => m.id === activeNpc.recommendedMissionId);
      if (explicit) return explicit;
    }
    return MISSIONS.find((m) => !player.claimedMissions.includes(m.id)) ?? MISSIONS[0];
  }, [activeNpc, player.claimedMissions]);

  useEffect(() => {
    if (!activeNpc || !district) return;
    setMessages([{ role: 'npc', text: activeNpc.greeting }]);
    setInput('');
  }, [activeNpc, district]);

  if (!activeNpc || !district) return null;

  const sendPromptText = async (userText: string, localFallback?: DialogueEntry) => {
    if (loading) return;
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    if (localFallback) {
      recordAiInteraction();
      setMessages((m) => [...m, localFallback]);
      return;
    }

    setLoading(true);
    recordAiInteraction();
    try {
      const res = await talkToDistrictNpc({
        npcName: activeNpc.name,
        npcRole: activeNpc.role,
        districtName: district.name,
        playerMessage: userText,
      });
      setMessages((m) => [...m, { role: 'npc', text: res.dialogue }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach mentor right now.';
      setMessages((m) => [
        ...m,
        {
          role: 'npc',
          text: `${activeNpc.suggestedTopic}: ${errMsg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (kind: 'talk' | 'directions' | 'learn' | 'mission') => {
    if (loading) return;
    if (kind === 'talk') {
      void sendPromptText(`Hi ${activeNpc.name}! Tell me about what's happening in ${district.name}.`);
      return;
    }

    if (kind === 'directions') {
      const hint =
        activeNpc.directionsHint ||
        (featuredGame
          ? `Head toward ${featuredGame.buildingName} in ${district.name} (coordinates ${featuredGame.buildingCoords.x}, ${featuredGame.buildingCoords.z}) to try ${featuredGame.title}.`
          : `Follow the boulevard to ${district.name} Plaza (${district.plazaCoords.x}, ${district.plazaCoords.z}).`);
      void sendPromptText('Can you give me directions around here?', {
        role: 'npc',
        text: hint,
        actionLabel: featuredGame ? `Go to ${featuredGame.buildingName}` : undefined,
        onAction: featuredGame
          ? () => {
              closeNpc();
              teleportToBuilding(featuredGame);
            }
          : undefined,
      });
      return;
    }

    if (kind === 'learn') {
      if (activeNpc.educationalFact) {
        void sendPromptText(`Teach me something interesting about ${activeNpc.suggestedTopic}.`, {
          role: 'npc',
          text: activeNpc.educationalFact,
          actionLabel: featuredGame ? `Play ${featuredGame.title}` : undefined,
          onAction: featuredGame
            ? () => {
                closeNpc();
                openGame(featuredGame);
              }
            : undefined,
        });
      } else {
        void sendPromptText(`Teach me a fascinating, concise fact about ${activeNpc.suggestedTopic}.`);
      }
      return;
    }

    if (kind === 'mission' && suggestedMission) {
      const progress = Math.min(
        suggestedMission.targetCount,
        getMissionMetricValue(player, suggestedMission.metric),
      );
      const claimed = player.claimedMissions.includes(suggestedMission.id);
      const ready = progress >= suggestedMission.targetCount && !claimed;
      const missionMsg = claimed
        ? `Great work! You've already completed "${suggestedMission.title}". Check the Missions board for new challenges.`
        : ready
          ? `Mission Ready to Claim: "${suggestedMission.title}" (${progress}/${suggestedMission.targetCount}) — Reward: +${suggestedMission.rewardXp} XP & +${suggestedMission.rewardCoins} Coins!`
          : `Active Mission: "${suggestedMission.title}" — ${suggestedMission.description} (Progress: ${progress}/${suggestedMission.targetCount}, Reward: +${suggestedMission.rewardXp} XP, +${suggestedMission.rewardCoins} Coins).`;

      notify('Mission Tip', `${suggestedMission.title} (${progress}/${suggestedMission.targetCount})`);
      void sendPromptText('Do you have a mission for me?', {
        role: 'npc',
        text: missionMsg,
        actionLabel: ready ? 'Open Missions to Claim' : featuredGame ? `Start ${featuredGame.title}` : 'View Missions',
        onAction: () => {
          closeNpc();
          if (ready || !featuredGame) {
            setActiveTab('missions');
          } else {
            openGame(featuredGame);
          }
        },
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    await sendPromptText(text);
  };

  const roleBadge = activeNpc.category && activeNpc.category !== 'mentor' ? activeNpc.role : `${district.name} Mentor`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">{roleBadge}</p>
            <h3 className="text-lg font-semibold text-slate-900">{activeNpc.name}</h3>
          </div>
          <button
            type="button"
            onClick={closeNpc}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close NPC dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-72 overflow-y-auto space-y-3 bg-slate-50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`rounded-xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'ml-8 bg-sky-600 text-white'
                  : 'mr-8 bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <p>{m.text}</p>
              {m.actionLabel && m.onAction && (
                <button
                  type="button"
                  onClick={m.onAction}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
                >
                  {m.actionLabel}
                </button>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-8 inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
              <span>{activeNpc.name} is thinking...</span>
            </div>
          )}
        </div>

        {/* Quick NPC Interaction Prompts */}
        <div className="border-t border-slate-200 bg-white px-3 pt-2.5 pb-1 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickAction('talk')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 disabled:opacity-50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Talk</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickAction('directions')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 disabled:opacity-50 transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Ask for Directions</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickAction('learn')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 disabled:opacity-50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Learn Something</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickAction('mission')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 disabled:opacity-50 transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Get Mission</span>
          </button>
        </div>

        <form onSubmit={handleSend} className="p-3 flex items-center gap-2 bg-white">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${activeNpc.suggestedTopic}...`}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Ask</span>
          </button>
        </form>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          <span>Powered by Gemini AI Mentor Dialogue</span>
        </div>
      </div>
    </div>
  );
};
