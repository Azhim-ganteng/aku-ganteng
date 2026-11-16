import React, { useState } from 'react';
import { BookOpen, CheckCircle2, FileText, Loader2, Send, Sparkles, XCircle } from 'lucide-react';
import { GAMES_CATALOG } from '../../data/gamesCatalog';
import { useEduWorld } from '../../context/EduWorldContext';
import {
  askAiTutor,
  generateDynamicQuestions,
  generateProgressReport,
} from '../../services/aiClient';
import { DifficultyLevel, GameQuestion } from '../../types/eduworld';

type AssistantMode = 'tutor' | 'generator' | 'report';

export const AIAssistantView: React.FC = () => {
  const { player, recordAiInteraction } = useEduWorld();
  const [mode, setMode] = useState<AssistantMode>('tutor');

  // Tutor Chat state
  const [subject, setSubject] = useState('Physics & Astronomy');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Welcome to the EDUWORLD AI Learning Assistant. Choose any subject focus and ask a question—I can explain tough concepts step-by-step or quiz your understanding.',
    },
  ]);

  // Question Generator state
  const [genGameId, setGenGameId] = useState(GAMES_CATALOG[0].id);
  const [genDifficulty, setGenDifficulty] = useState<DifficultyLevel>('scholar');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<GameQuestion[]>([]);
  const [pickedAnswers, setPickedAnswers] = useState<Record<number, number>>({});

  // Progress Report state
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    summary: string;
    strengths: string[];
    growthAreas: string[];
    nextMilestone: string;
  } | null>(null);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatError(null);
    const nextHistory = [...messages, { role: 'user' as const, text }];
    setMessages(nextHistory);
    setChatLoading(true);
    recordAiInteraction();

    try {
      const res = await askAiTutor({
        message: text,
        subject,
        level: player.level,
        history: nextHistory,
      });
      setMessages((m) => [...m, { role: 'assistant', text: res.reply }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to connect to Gemini AI Tutor.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    const game = GAMES_CATALOG.find((g) => g.id === genGameId) ?? GAMES_CATALOG[0];
    setGenLoading(true);
    setGenError(null);
    setPickedAnswers({});
    recordAiInteraction();

    try {
      const res = await generateDynamicQuestions({
        gameTitle: game.title,
        category: game.category,
        difficulty: genDifficulty,
        count: 4,
      });
      setGeneratedQuestions(res.questions);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unable to generate questions right now.');
      setGeneratedQuestions(game.fallbackQuestions);
    } finally {
      setGenLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportError(null);
    recordAiInteraction();
    const summaries = Object.values(player.gameProgress).map((gp) => {
      const g = GAMES_CATALOG.find((item) => item.id === gp.gameId);
      return {
        title: g?.title ?? gp.gameId,
        bestScore: gp.bestScore,
        bestAccuracy: gp.bestAccuracy,
        difficulty: gp.highestDifficulty,
      };
    });

    try {
      const res = await generateProgressReport({
        displayName: player.displayName,
        level: player.level,
        xp: player.xp,
        gamesCompletedCount: Object.keys(player.gameProgress).length,
        gameSummaries: summaries,
      });
      setReport(res);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Unable to generate report right now.');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">AI Learning Assistant</h1>
          <p className="mt-1 text-sm text-slate-600">
            Powered by Gemini AI for step-by-step tutoring, custom practice generation, and progress synthesis.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 w-fit">
          {(
            [
              { id: 'tutor', label: 'AI Tutor', icon: Sparkles },
              { id: 'generator', label: 'Practice Generator', icon: BookOpen },
              { id: 'report', label: 'Progress Report', icon: FileText },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode 1: AI Tutor */}
      {mode === 'tutor' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
            <span className="text-sm font-semibold text-slate-900">Subject Focus</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800"
            >
              <option>Physics & Astronomy</option>
              <option>Mathematics & Geometry</option>
              <option>Computer Science & Networking</option>
              <option>Biology & Chemistry</option>
              <option>History, Geography & English</option>
              <option>Personal Finance & Cyber Safety</option>
            </select>
          </div>

          <div className="p-5 h-[380px] overflow-y-auto space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'ml-auto bg-sky-600 text-white'
                    : 'mr-auto bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                {m.text}
              </div>
            ))}
            {chatLoading && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                <span>Composing explanation...</span>
              </div>
            )}
            {chatError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                {chatError}
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="border-t border-slate-200 p-4 flex items-center gap-2 bg-slate-50">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask any question, e.g. How does Kepler's Third Law work?"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* Mode 2: Dynamic Question Generator */}
      {mode === 'generator' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Educational Topic</label>
              <select
                value={genGameId}
                onChange={(e) => setGenGameId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              >
                {GAMES_CATALOG.map((g) => (
                  <option key={g.id} value={g.id}>
                    {String(g.number).padStart(2, '0')}. {g.title} ({g.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Difficulty</label>
              <select
                value={genDifficulty}
                onChange={(e) => setGenDifficulty(e.target.value as DifficultyLevel)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
              >
                <option value="explorer">Explorer</option>
                <option value="scholar">Scholar</option>
                <option value="master">Master</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={genLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
            >
              {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Generate Practice Set</span>
            </button>
          </div>

          {genError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
              {genError} — Showing curated curriculum fallback questions below.
            </div>
          )}

          {generatedQuestions.length > 0 && (
            <div className="space-y-4">
              {generatedQuestions.map((q, qi) => {
                const picked = pickedAnswers[qi];
                return (
                  <div key={qi} className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs text-slate-500 font-mono-tabular">Question {qi + 1}</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">{q.question}</h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oi) => {
                        const isPicked = picked === oi;
                        const isRight = oi === q.correctIndex;
                        let cls = 'border-slate-200 bg-slate-50 hover:bg-sky-50';
                        if (picked !== undefined) {
                          if (isRight) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                          else if (isPicked) cls = 'border-red-400 bg-red-50 text-red-900';
                        }
                        return (
                          <button
                            key={oi}
                            type="button"
                            disabled={picked !== undefined}
                            onClick={() => setPickedAnswers((prev) => ({ ...prev, [qi]: oi }))}
                            className={`rounded-lg border px-3.5 py-2.5 text-left text-sm flex items-center justify-between ${cls}`}
                          >
                            <span>{opt}</span>
                            {picked !== undefined && isRight && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {picked !== undefined && isPicked && !isRight && <XCircle className="w-4 h-4 text-red-600" />}
                          </button>
                        );
                      })}
                    </div>
                    {picked !== undefined && (
                      <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Learning Progress Report */}
      {mode === 'report' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">AI Learning Progress Report</h2>
              <p className="text-xs text-slate-500">
                Synthesizes your level ({player.level}), XP ({player.xp}), and {Object.keys(player.gameProgress).length}/20 completed modules.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>Generate Report</span>
            </button>
          </div>

          {reportError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              {reportError}
            </div>
          )}

          {report && (
            <div className="space-y-4 border-t border-slate-200 pt-5">
              <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-900">Observed Strengths</p>
                  <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                    {report.strengths.map((s) => (
                      <li key={s}>· {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-semibold text-sky-900">Recommended Growth Areas</p>
                  <ul className="mt-2 space-y-1 text-sm text-sky-900">
                    {report.growthAreas.map((g) => (
                      <li key={g}>· {g}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-900">Next Milestone</p>
                <p className="mt-1 text-sm text-slate-700">{report.nextMilestone}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
