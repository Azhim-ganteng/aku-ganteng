import React, { useState } from 'react';
import { CheckCircle2, Network, RotateCcw, Sparkles } from 'lucide-react';
import { NETWORK_IP_QUESTIONS } from '../../data/miniGamesData';
import { MiniGameCompletionPayload } from '../../types/eduworld';

interface NetworkPuzzleMiniGameProps {
  onComplete: (payload: MiniGameCompletionPayload) => void;
}

interface NetNode {
  id: string;
  label: string;
  x: number;
  y: number;
  role: 'router' | 'switch' | 'pc' | 'server';
}

const NODES: NetNode[] = [
  { id: 'router', label: 'Core Router', x: 50, y: 20, role: 'router' },
  { id: 'sw-a', label: 'Lab Switch', x: 22, y: 52, role: 'switch' },
  { id: 'sw-b', label: 'Campus Switch', x: 78, y: 52, role: 'switch' },
  { id: 'pc-1', label: 'Client PC', x: 18, y: 84, role: 'pc' },
  { id: 'srv', label: 'Backup Server', x: 78, y: 84, role: 'server' },
];

type LinkPair = [string, string];

export const NetworkPuzzleMiniGame: React.FC<NetworkPuzzleMiniGameProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'topology' | 'ip'>('topology');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkPair[]>([['router', 'sw-a']]);
  const [status, setStatus] = useState(
    'Click two nodes to toggle a fiber link. Connect all 5 nodes AND give Backup Server a redundant 2-link path (max 6 links).',
  );
  const [ipIndex, setIpIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const hasLink = (a: string, b: string) =>
    links.some(([u, v]) => (u === a && v === b) || (u === b && v === a));

  const handleNodeClick = (id: string) => {
    if (!selectedNode) {
      setSelectedNode(id);
      return;
    }
    if (selectedNode === id) {
      setSelectedNode(null);
      return;
    }
    if (hasLink(selectedNode, id)) {
      setLinks((prev) => prev.filter(([u, v]) => !((u === selectedNode && v === id) || (u === id && v === selectedNode))));
    } else if (links.length < 6) {
      setLinks((prev) => [...prev, [selectedNode, id]]);
    } else {
      setStatus('Cable budget reached (max 6 links). Click an existing pair to remove a cable.');
    }
    setSelectedNode(null);
  };

  const verifyTopology = () => {
    const adj = new Map<string, string[]>();
    NODES.forEach((n) => adj.set(n.id, []));
    links.forEach(([a, b]) => {
      adj.get(a)?.push(b);
      adj.get(b)?.push(a);
    });

    // BFS reachability from Core Router
    const visited = new Set<string>(['router']);
    const queue = ['router'];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const nxt of adj.get(curr) ?? []) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }

    if (visited.size < NODES.length) {
      setMistakes((m) => m + 1);
      setStatus(`Only ${visited.size}/${NODES.length} nodes are reachable from Core Router.`);
      return;
    }

    const srvDegree = (adj.get('srv') ?? []).length;
    if (srvDegree < 2) {
      setMistakes((m) => m + 1);
      setStatus('Backup Server needs at least 2 fiber links for failover redundancy!');
      return;
    }

    setAiHint(null);
    setStatus('Topology verified! Solve the IPv4 & Subnetting packets below.');
    setStage('ip');
  };

  const handleIpChoice = (optIdx: number) => {
    const q = NETWORK_IP_QUESTIONS[ipIndex];
    if (optIdx === q.correctIndex) {
      if (ipIndex + 1 >= NETWORK_IP_QUESTIONS.length) {
        const accuracy = Math.max(60, 100 - mistakes * 10);
        const score = Math.max(420, 960 - mistakes * 65);
        onComplete({
          miniGameId: 'network-puzzle',
          score,
          accuracy,
          won: true,
        });
      } else {
        setIpIndex((i) => i + 1);
        setAiHint(null);
      }
    } else {
      setMistakes((m) => m + 1);
      setStatus(`Packet dropped! Hint: ${q.hint}`);
    }
  };

  const requestHint = async () => {
    const topic =
      stage === 'topology'
        ? 'Redundant star-mesh network topology connecting router, switches, workstation, and dual-homed backup server'
        : NETWORK_IP_QUESTIONS[ipIndex].prompt;
    const fallback =
      stage === 'topology'
        ? 'Connect Core Router to both switches, switches to Client PC & Backup Server, plus a cross-link into Backup Server.'
        : NETWORK_IP_QUESTIONS[ipIndex].hint;
    try {
      const res = await fetch('/api/ai/minigame-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameTitle: 'Network Puzzle',
          topic: stage === 'topology' ? 'Network Topology' : 'IPv4 Subnetting',
          questionOrClue: topic,
        }),
      });
      if (!res.ok) throw new Error('Hint fallback');
      const data = await res.json();
      setAiHint(data.hint || fallback);
    } catch {
      setAiHint(fallback);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs">
        <span className="font-semibold text-blue-950">{status}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={requestHint}
            className="inline-flex items-center gap-1 rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Sparkles className="w-3 h-3" /> Hint
          </button>
        </div>
      </div>

      {aiHint && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2 text-xs text-sky-900">
          NetOps Hint: {aiHint}
        </div>
      )}

      {stage === 'topology' ? (
        <div className="space-y-3">
          <div className="relative h-64 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {links.map(([aId, bId], i) => {
                const a = NODES.find((n) => n.id === aId);
                const b = NODES.find((n) => n.id === bId);
                if (!a || !b) return null;
                return (
                  <line
                    key={`${aId}-${bId}-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#38bdf8"
                    strokeWidth={1.3}
                  />
                );
              })}
            </svg>
            {NODES.map((n) => {
              const isSelected = selectedNode === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNodeClick(n.id)}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  className={`-translate-x-1/2 -translate-y-1/2 absolute rounded-xl px-2.5 py-1.5 text-[11px] font-bold border shadow-md transition-transform ${
                    isSelected
                      ? 'bg-amber-400 text-slate-900 border-white scale-110'
                      : n.role === 'router'
                      ? 'bg-sky-600 text-white border-sky-300'
                      : n.role === 'server'
                      ? 'bg-emerald-600 text-white border-emerald-300'
                      : 'bg-slate-800 text-slate-100 border-slate-500 hover:border-sky-400'
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setLinks([['router', 'sw-a']]);
                setSelectedNode(null);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Cables ({links.length}/6)
            </button>
            <button
              type="button"
              onClick={verifyTopology}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-5 py-2 text-xs font-bold hover:bg-blue-700"
            >
              <Network className="w-3.5 h-3.5" /> Test Topology
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-blue-700">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Topology Online
            </span>
            <span>IP Challenge {ipIndex + 1}/{NETWORK_IP_QUESTIONS.length}</span>
          </div>
          <p className="text-sm font-bold text-slate-900">{NETWORK_IP_QUESTIONS[ipIndex].prompt}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {NETWORK_IP_QUESTIONS[ipIndex].options.map((opt, idx) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleIpChoice(idx)}
                className="rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
