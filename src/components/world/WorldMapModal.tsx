import React, { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Flag,
  MapPin,
  Navigation,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { DISTRICTS } from '../../data/districts';
import {
  EXPLORATION_OBJECTIVES,
  OPEN_WORLD_DISTRICTS,
  WORLD_BRIDGES,
  WORLD_LANDMARKS,
  WORLD_WATER_BODIES,
} from '../../data/openWorldData';
import { BUILD_ZONES } from '../../data/sandboxCatalog';
import { MINI_GAME_HUB_COORDS } from '../../data/miniGamesData';
import { useEduWorld } from '../../context/EduWorldContext';
import { ExplorationObjective } from '../../types/eduworld';

interface WorldMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerPos: { x: number; z: number };
  playerYaw: number;
  onFastTravel: (x: number, z: number, label: string) => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  isOpen,
  onClose,
  playerPos,
  playerYaw,
  onFastTravel,
}) => {
  const { player, openWorldProgress, claimExplorationObjective } = useEduWorld();
  const [activeSubTab, setActiveSubTab] = useState<'map' | 'objectives'>('map');
  const [selectedLabel, setSelectedLabel] = useState<string>('Central Academy Plaza');
  const [selectedDetail, setSelectedDetail] = useState<string>(
    'Click any Inner District, Outer District, or Landmark beacon on the map to Fast Travel immediately.',
  );

  if (!isOpen) return null;

  const riverPointsAttr = WORLD_WATER_BODIES[0].points.map((p) => `${p.x},${p.z}`).join(' ');
  const outerLoopPointsAttr = OPEN_WORLD_DISTRICTS.map((d) => `${d.plazaCoords.x},${d.plazaCoords.z}`).join(' ');

  const getObjectiveProgress = (obj: ExplorationObjective): number => {
    switch (obj.metric) {
      case 'outerDistrictsVisited':
        return openWorldProgress.visitedOuterDistricts.length;
      case 'landmarksDiscovered':
        return openWorldProgress.discoveredLandmarks.length;
      case 'bridgesCrossed':
        return openWorldProgress.crossedBridges.length;
      case 'totalZonesVisited':
        return player.visitedDistricts.length + openWorldProgress.visitedOuterDistricts.length;
      default:
        return 0;
    }
  };

  // Convert player yaw (Three.js +Z forward at yaw=0) into SVG angle
  const dirX = Math.sin(playerYaw);
  const dirZ = Math.cos(playerYaw);
  const arrowAngleDeg = (Math.atan2(dirX, -dirZ) * 180) / Math.PI;

  const travelAndClose = (x: number, z: number, label: string) => {
    onFastTravel(x, z, label);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="EDUWORLD Open-World Map & Exploration Objectives"
    >
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">EDUWORLD Open-World Atlas</h2>
              <p className="text-xs text-slate-500">
                11 Districts · {openWorldProgress.discoveredLandmarks.length}/{WORLD_LANDMARKS.length} Landmarks ·{' '}
                {openWorldProgress.crossedBridges.length}/{WORLD_BRIDGES.length} River Bridges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1">
              <button
                type="button"
                onClick={() => setActiveSubTab('map')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeSubTab === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Interactive Map
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('objectives')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeSubTab === 'objectives'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Objectives & Landmarks
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
              aria-label="Close World Map"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {activeSubTab === 'map' ? (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* SVG Interactive Map Canvas */}
            <div className="lg:col-span-8 bg-sky-100/70 p-3 sm:p-4 flex items-center justify-center relative border-b lg:border-b-0 lg:border-r border-slate-200">
              <svg
                viewBox="-295 -295 590 590"
                className="w-full max-w-[540px] aspect-square rounded-2xl bg-sky-200/70 border border-sky-300/70 shadow-inner"
              >
                {/* Island Meadow Ground */}
                <circle cx={0} cy={0} r={286} fill="#dcfce7" stroke="#94a3b8" strokeWidth={3} />
                <circle cx={0} cy={0} r={275} fill="#ecfdf5" />

                {/* Outer Hexagonal Loop Road */}
                <polygon
                  points={outerLoopPointsAttr}
                  fill="none"
                  stroke="#475569"
                  strokeWidth={7}
                  strokeLinejoin="round"
                />

                {/* Solarpunk Valley River & Crystal Lake & Lagoon */}
                <polyline
                  points={riverPointsAttr}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={46} cy={168} r={21} fill="#38bdf8" stroke="#0284c7" strokeWidth={1.5} />
                <circle cx={-124} cy={144} r={14} fill="#38bdf8" stroke="#0284c7" strokeWidth={1.5} />

                {/* Central Academy Plaza Base */}
                <circle cx={0} cy={0} r={98} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={2.5} />

                {/* Grand Academy Ringway */}
                <circle cx={0} cy={0} r={106} fill="none" stroke="#334155" strokeWidth={8} />
                <circle cx={0} cy={0} r={106} fill="none" stroke="#bae6fd" strokeWidth={1.2} strokeDasharray="6 6" />

                {/* 6 Outer Arterial Radial Boulevards */}
                {OPEN_WORLD_DISTRICTS.map((d) => {
                  const len = Math.hypot(d.plazaCoords.x, d.plazaCoords.z);
                  const ux = d.plazaCoords.x / len;
                  const uz = d.plazaCoords.z / len;
                  return (
                    <line
                      key={`road-${d.id}`}
                      x1={ux * 106}
                      y1={uz * 106}
                      x2={d.plazaCoords.x}
                      y2={d.plazaCoords.z}
                      stroke="#475569"
                      strokeWidth={7}
                    />
                  );
                })}

                {/* 5 Inner Campus Spokes */}
                {DISTRICTS.map((d) => (
                  <line
                    key={`spoke-${d.id}`}
                    x1={0}
                    y1={0}
                    x2={d.plazaCoords.x}
                    y2={d.plazaCoords.z}
                    stroke="#64748b"
                    strokeWidth={4.5}
                  />
                ))}

                {/* 3 River Bridges */}
                {WORLD_BRIDGES.map((b) => {
                  const deg = (-b.yaw * 180) / Math.PI;
                  const crossed = openWorldProgress.crossedBridges.includes(b.id);
                  return (
                    <g key={b.id} transform={`translate(${b.x}, ${b.z}) rotate(${deg})`}>
                      <rect
                        x={-5.5}
                        y={-12}
                        width={11}
                        height={24}
                        rx={2.5}
                        fill={crossed ? '#fef3c7' : '#e2e8f0'}
                        stroke={b.accentHex}
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}

                {/* Central Plaza Node */}
                <g
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setSelectedLabel('Central Academy Plaza');
                    setSelectedDetail('Starting heart of EDUWORLD with the Central Astrolabe & 5 original districts.');
                  }}
                  onClick={() => travelAndClose(0, 14, 'Central Academy Plaza')}
                >
                  <circle cx={0} cy={0} r={12} fill="#0284c7" stroke="#ffffff" strokeWidth={2.5} />
                  <text x={0} y={24} textAnchor="middle" fontSize={10} fontWeight="700" fill="#0f172a">
                    Central Plaza
                  </text>
                </g>

                {/* 5 Original Inner Districts */}
                {DISTRICTS.map((d) => {
                  const visited = player.visitedDistricts.includes(d.id);
                  return (
                    <g
                      key={d.id}
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setSelectedLabel(d.name);
                        setSelectedDetail(d.tagline);
                      }}
                      onClick={() => travelAndClose(d.plazaCoords.x, d.plazaCoords.z + 8, d.name)}
                    >
                      <circle
                        cx={d.plazaCoords.x}
                        cy={d.plazaCoords.z}
                        r={10.5}
                        fill={d.accentHex}
                        stroke={visited ? '#fef08a' : '#ffffff'}
                        strokeWidth={2.2}
                      />
                      <text
                        x={d.plazaCoords.x}
                        y={d.plazaCoords.z + (d.plazaCoords.z > 0 ? 18 : -14)}
                        textAnchor="middle"
                        fontSize={9.5}
                        fontWeight="600"
                        fill="#1e293b"
                      >
                        {d.name}
                      </text>
                    </g>
                  );
                })}

                {/* 6 Connected Outer World Districts */}
                {OPEN_WORLD_DISTRICTS.map((d) => {
                  const visited = openWorldProgress.visitedOuterDistricts.includes(d.id);
                  const labelOffsetY = d.plazaCoords.z > 120 ? 27 : d.plazaCoords.z < -120 ? -21 : d.plazaCoords.z > 0 ? 25 : -19;
                  return (
                    <g
                      key={d.id}
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setSelectedLabel(d.name);
                        setSelectedDetail(`${d.tagline} · Guide: ${d.guideNpc.name}`);
                      }}
                      onClick={() => travelAndClose(d.plazaCoords.x, d.plazaCoords.z + 8, d.name)}
                    >
                      <circle
                        cx={d.plazaCoords.x}
                        cy={d.plazaCoords.z}
                        r={17}
                        fill={d.accentHex}
                        fillOpacity={visited ? 0.95 : 0.78}
                        stroke={visited ? '#fef08a' : '#ffffff'}
                        strokeWidth={visited ? 3.5 : 2.5}
                      />
                      <text
                        x={d.plazaCoords.x}
                        y={d.plazaCoords.z + 3.5}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="700"
                        fill="#ffffff"
                      >
                        D{d.number}
                      </text>
                      <text
                        x={d.plazaCoords.x}
                        y={d.plazaCoords.z + labelOffsetY}
                        textAnchor="middle"
                        fontSize={11.5}
                        fontWeight="700"
                        fill="#0f172a"
                      >
                        {d.name}
                      </text>
                    </g>
                  );
                })}

                {/* 12 Discoverable Landmarks */}
                {WORLD_LANDMARKS.map((lm) => {
                  const discovered = openWorldProgress.discoveredLandmarks.includes(lm.id);
                  return (
                    <g
                      key={lm.id}
                      transform={`translate(${lm.coords.x}, ${lm.coords.z})`}
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setSelectedLabel(lm.name);
                        setSelectedDetail(`${lm.description} (+${lm.rewardXp} XP, +${lm.rewardCoins} Coins)`);
                      }}
                      onClick={() => travelAndClose(lm.coords.x, lm.coords.z + 7, lm.name)}
                    >
                      <polygon
                        points="0,-6.5 6.5,0 0,6.5 -6.5,0"
                        fill={discovered ? '#10b981' : '#f59e0b'}
                        stroke="#ffffff"
                        strokeWidth={1.6}
                      />
                    </g>
                  );
                })}

                {/* 6 Creative Sandbox Build Zones */}
                {BUILD_ZONES.map((bz) => (
                  <g
                    key={bz.id}
                    className="cursor-pointer"
                    onMouseEnter={() => {
                      setSelectedLabel(`Build Zone: ${bz.name}`);
                      setSelectedDetail(`Creative Sandbox Construction Plot (${bz.theme}). Click to Fast Travel.`);
                    }}
                    onClick={() => travelAndClose(bz.centerX, bz.centerZ, bz.name)}
                  >
                    <rect
                      x={bz.centerX - bz.halfW}
                      y={bz.centerZ - bz.halfD}
                      width={bz.halfW * 2}
                      height={bz.halfD * 2}
                      rx={4}
                      fill={bz.accentHex}
                      fillOpacity={0.14}
                      stroke={bz.accentHex}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                    <text
                      x={bz.centerX}
                      y={bz.centerZ + 3}
                      textAnchor="middle"
                      fontSize={7.5}
                      fontWeight="700"
                      fill="#0f172a"
                    >
                      BUILD
                    </text>
                  </g>
                ))}

                {/* Mini Game Hub Pavilion */}
                <g
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setSelectedLabel('Mini Game Hub Pavilion');
                    setSelectedDetail('7 playable challenges: Parkour, Treasure Hunt, Quiz Battle, Science, Network, Racing & Farming.');
                  }}
                  onClick={() => travelAndClose(MINI_GAME_HUB_COORDS.x - 4, MINI_GAME_HUB_COORDS.z + 11, 'Mini Game Hub Pavilion')}
                >
                  <circle
                    cx={MINI_GAME_HUB_COORDS.x}
                    cy={MINI_GAME_HUB_COORDS.z}
                    r={11}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                  />
                  <text
                    x={MINI_GAME_HUB_COORDS.x}
                    y={MINI_GAME_HUB_COORDS.z + 3}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontWeight="800"
                    fill="#ffffff"
                  >
                    HUB
                  </text>
                </g>

                {/* Live Player Position & Heading Indicator */}
                <g transform={`translate(${playerPos.x}, ${playerPos.z}) rotate(${arrowAngleDeg})`}>
                  <circle cx={0} cy={0} r={11} fill="#ef4444" fillOpacity={0.22} />
                  <polygon points="0,-9 6.5,7 0,3.5 -6.5,7" fill="#ef4444" stroke="#ffffff" strokeWidth={1.8} />
                </g>

                {/* Compass Labels */}
                <text x={0} y={-278} textAnchor="middle" fontSize={12} fontWeight="800" fill="#475569">
                  N
                </text>
                <text x={0} y={288} textAnchor="middle" fontSize={12} fontWeight="800" fill="#475569">
                  S
                </text>
                <text x={-282} y={4} textAnchor="middle" fontSize={12} fontWeight="800" fill="#475569">
                  W
                </text>
                <text x={282} y={4} textAnchor="middle" fontSize={12} fontWeight="800" fill="#475569">
                  E
                </text>
              </svg>
            </div>

            {/* Sidebar: Legend, Selected Details & Quick Fast Travel List */}
            <div className="lg:col-span-4 p-4 flex flex-col gap-3.5 overflow-y-auto max-h-[68vh]">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{selectedLabel}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{selectedDetail}</p>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 px-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> You
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rotate-45 bg-amber-500 inline-block" /> Undiscovered Landmark
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rotate-45 bg-emerald-500 inline-block" /> Discovered
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Outer Open-World Districts
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {OPEN_WORLD_DISTRICTS.map((d) => {
                    const visited = openWorldProgress.visitedOuterDistricts.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => travelAndClose(d.plazaCoords.x, d.plazaCoords.z + 8, d.name)}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-sky-300 hover:bg-sky-50/70 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: d.accentHex }}
                            />
                            <span className="text-xs font-semibold text-slate-900 truncate">{d.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{d.guideNpc.name}</p>
                        </div>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                            visited ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {visited ? 'Visited' : 'Travel'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Mini Game Hub & Build Zones
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      travelAndClose(MINI_GAME_HUB_COORDS.x - 4, MINI_GAME_HUB_COORDS.z + 11, 'Mini Game Hub Pavilion')
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    Mini Game Hub
                  </button>
                  {BUILD_ZONES.map((bz) => (
                    <button
                      key={bz.id}
                      type="button"
                      onClick={() => travelAndClose(bz.centerX, bz.centerZ, bz.name)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-300 transition-colors"
                    >
                      {bz.name.replace(' Plot', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Central Campus & Inner Districts
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => travelAndClose(0, 14, 'Central Academy Plaza')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-300 transition-colors"
                  >
                    Central Plaza
                  </button>
                  {DISTRICTS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => travelAndClose(d.plazaCoords.x, d.plazaCoords.z + 8, d.name)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-300 transition-colors"
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Exploration Objectives & Landmark Checklist */
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Open-World Exploration Objectives</h3>
              </div>
              <div className="space-y-2.5">
                {EXPLORATION_OBJECTIVES.map((obj) => {
                  const current = Math.min(obj.targetCount, getObjectiveProgress(obj));
                  const pct = Math.round((current / obj.targetCount) * 100);
                  const claimed = openWorldProgress.claimedObjectives.includes(obj.id);
                  const ready = current >= obj.targetCount && !claimed;

                  return (
                    <div
                      key={obj.id}
                      className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{obj.title}</p>
                          <p className="text-xs text-slate-600">{obj.description}</p>
                        </div>
                        <span className="font-mono-tabular text-xs font-semibold text-slate-700 shrink-0">
                          {current}/{obj.targetCount}
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-sky-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          Reward: +{obj.rewardXp} XP · +{obj.rewardCoins} EduCoins
                        </span>
                        {claimed ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                          </span>
                        ) : ready ? (
                          <button
                            type="button"
                            onClick={() => claimExplorationObjective(obj.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1 font-semibold hover:bg-emerald-700 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Claim
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium">In Progress</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flag className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Discoverable Landmarks ({openWorldProgress.discoveredLandmarks.length}/{WORLD_LANDMARKS.length})
                </h3>
              </div>
              <div className="space-y-2">
                {WORLD_LANDMARKS.map((lm) => {
                  const discovered = openWorldProgress.discoveredLandmarks.includes(lm.id);
                  const distName = OPEN_WORLD_DISTRICTS.find((d) => d.id === lm.districtId)?.name ?? '';
                  return (
                    <div
                      key={lm.id}
                      className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin
                            className={`w-3.5 h-3.5 shrink-0 ${discovered ? 'text-emerald-600' : 'text-amber-500'}`}
                          />
                          <span className="text-xs font-bold text-slate-900 truncate">{lm.name}</span>
                          {discovered && (
                            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                              Found
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {distName} · +{lm.rewardXp} XP / +{lm.rewardCoins} Coins
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => travelAndClose(lm.coords.x, lm.coords.z + 7, lm.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-xs font-semibold text-slate-700 shrink-0 transition-colors"
                      >
                        Go
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
