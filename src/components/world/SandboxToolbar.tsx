import React, { useState } from 'react';
import {
  Box,
  Copy,
  Edit3,
  FolderOpen,
  Grid,
  Hammer,
  Lock,
  Move,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  BUILD_ZONES,
  MAX_SANDBOX_ITEMS,
  SANDBOX_ITEMS,
  SANDBOX_MATERIAL_VARIANTS,
} from '../../data/sandboxCatalog';
import {
  BuildZoneDefinition,
  SandboxBuildProject,
  SandboxItemCategory,
  SandboxTool,
} from '../../types/eduworld';

interface SandboxToolbarProps {
  activeTool: SandboxTool;
  setActiveTool: (t: SandboxTool) => void;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  selectedVariant: string;
  setSelectedVariant: (variant: string) => void;
  gridSnap: boolean;
  setGridSnap: (v: boolean) => void;
  rotY: number;
  onRotate: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  itemCount: number;
  currentZone: BuildZoneDefinition | null;
  previewStatus: { valid: boolean; reason?: string } | null;
  movingObjectId: string | null;
  unlockedItems: string[];
  savedBuilds: SandboxBuildProject[];
  activeBuildId: string | null;
  onSaveBuild: (name: string, zoneId: string) => void;
  onLoadBuild: (buildId: string) => void;
  onNewBuild: () => void;
  onRenameBuild: (buildId: string, name: string) => void;
  onDeleteBuild: (buildId: string) => void;
  onJumpToZone: (zone: BuildZoneDefinition) => void;
  onMobileAction: (action: 'place' | 'remove') => void;
  onExitBuildMode: () => void;
}

export const SandboxToolbar: React.FC<SandboxToolbarProps> = ({
  activeTool,
  setActiveTool,
  selectedItemId,
  setSelectedItemId,
  selectedVariant,
  setSelectedVariant,
  gridSnap,
  setGridSnap,
  rotY,
  onRotate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  itemCount,
  currentZone,
  previewStatus,
  movingObjectId,
  unlockedItems,
  savedBuilds,
  activeBuildId,
  onSaveBuild,
  onLoadBuild,
  onNewBuild,
  onRenameBuild,
  onDeleteBuild,
  onJumpToZone,
  onMobileAction,
  onExitBuildMode,
}) => {
  const [category, setCategory] = useState<SandboxItemCategory>('blocks');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buildNameInput, setBuildNameInput] = useState(() => {
    const active = savedBuilds.find((b) => b.buildId === activeBuildId);
    return active?.name ?? 'My Solarpunk Build';
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const filteredItems = SANDBOX_ITEMS.filter((it) => it.category === category);
  const rotDeg = Math.round((((rotY * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <>
      {/* Top Build Mode Header Strip */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-2 max-w-[96vw]">
        <div className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-1.5 shadow-md">
          <Hammer className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="text-xs font-bold text-slate-900 whitespace-nowrap">Build Mode</span>
          <span className="text-slate-300">|</span>
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              currentZone ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {currentZone ? currentZone.name : 'Outside Build Zone'}
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="font-mono-tabular text-xs text-slate-600 hidden sm:inline whitespace-nowrap">
            {itemCount}/{MAX_SANDBOX_ITEMS}
          </span>
        </div>

        {/* Zone Quick-Teleport Pills */}
        {!currentZone && (
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white border border-amber-200 px-2.5 py-1 shadow-md">
            <span className="text-[11px] font-semibold text-amber-800 mr-1">Go to Build Zone:</span>
            {BUILD_ZONES.slice(0, 3).map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => onJumpToZone(z)}
                className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-sky-50 text-[11px] font-semibold text-slate-800 border border-amber-200 hover:border-sky-300 transition-colors whitespace-nowrap"
              >
                {z.name.replace(' Plot', '')}
              </button>
            ))}
          </div>
        )}

        {/* Validation Status Chip */}
        {previewStatus && !previewStatus.valid && previewStatus.reason && (
          <div className="rounded-xl bg-red-600 text-white px-3 py-1 text-xs font-semibold shadow-md whitespace-nowrap">
            {previewStatus.reason}
          </div>
        )}
        {movingObjectId && (
          <div className="rounded-xl bg-sky-600 text-white px-3 py-1 text-xs font-semibold shadow-md whitespace-nowrap">
            Click a valid spot to drop moved object
          </div>
        )}

        <div className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-2 py-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              const active = savedBuilds.find((b) => b.buildId === activeBuildId);
              if (active) setBuildNameInput(active.name);
              setDrawerOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Saves ({savedBuilds.length})</span>
          </button>
          <button
            type="button"
            onClick={onExitBuildMode}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-800 px-2.5 py-1 text-xs font-semibold hover:bg-slate-200 transition-colors whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit (ESC)</span>
          </button>
        </div>
      </div>

      {/* Bottom Build Mode Inventory & Tools Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96vw] max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-xl p-2.5 flex flex-col gap-2">
        {/* Row 1: Category Tabs, Tools, Rotate, Grid Snap, Undo/Redo, Variants */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                { id: 'blocks', label: 'Blocks (9)' },
                { id: 'objects', label: 'Objects (10)' },
                { id: 'unlockable', label: `Unlocked (${unlockedItems.length}/7)` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  category === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Building Tools */}
          <div className="inline-flex items-center gap-1">
            {(
              [
                { id: 'place', label: 'Place', icon: Box },
                { id: 'move', label: 'Move', icon: Move },
                { id: 'duplicate', label: 'Clone', icon: Copy },
                { id: 'remove', label: 'Erase', icon: Trash2 },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTool(t.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? t.id === 'remove'
                        ? 'bg-red-600 text-white'
                        : 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Transform, Snap & History Controls */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={onRotate}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 whitespace-nowrap"
              title="Rotate object (R)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{rotDeg}°</span>
            </button>
            <button
              type="button"
              onClick={() => setGridSnap(!gridSnap)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                gridSnap ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}
              title="Toggle 2m grid snap"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{gridSnap ? 'Snap ON' : 'Free'}</span>
            </button>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Scrollable Item Palette + Material Variant Selector + Mobile Touch Actions */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {filteredItems.map((item) => {
              const isLocked = item.category === 'unlockable' && !unlockedItems.includes(item.id);
              const selected = selectedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    if (activeTool === 'remove') setActiveTool('place');
                  }}
                  title={isLocked ? `Locked: ${item.unlockRequirementLabel}` : item.name}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    isLocked
                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : selected
                      ? 'border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <span
                      className="w-3.5 h-3.5 rounded border border-slate-300 shrink-0"
                      style={{ backgroundColor: item.colorHex }}
                    />
                  )}
                  <span className="whitespace-nowrap">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Material Variant Chips */}
          <div className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-2 shrink-0">
            {SANDBOX_MATERIAL_VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariant(v.id)}
                title={`Material finish: ${v.label}`}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  selectedVariant === v.id ? 'border-slate-900 scale-110' : 'border-slate-300'
                }`}
                style={{ backgroundColor: v.tintHex ?? '#FFFFFF' }}
                aria-label={`Material ${v.label}`}
              />
            ))}
          </div>

          {/* Mobile / Quick Action Buttons */}
          <div className="flex sm:hidden items-center gap-1 border-l border-slate-200 pl-2 shrink-0">
            <button
              type="button"
              onClick={() => onMobileAction('place')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
            >
              Place
            </button>
            <button
              type="button"
              onClick={() => onMobileAction('remove')}
              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
            >
              Del
            </button>
          </div>
        </div>
      </div>

      {/* Save / Load / Manage Constructions Modal */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Saved Sandbox Constructions</h3>
                <p className="text-xs text-slate-500">
                  Saves positions, rotations, item types & material finishes to your profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                aria-label="Close saves modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={buildNameInput}
                  onChange={(e) => setBuildNameInput(e.target.value)}
                  placeholder="Construction name..."
                  maxLength={64}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSaveBuild(buildNameInput, currentZone?.id ?? BUILD_ZONES[0].id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 text-white px-4 py-2 text-xs font-semibold hover:bg-sky-700 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{activeBuildId ? 'Update' : 'Save Build'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onNewBuild();
                    setBuildNameInput('New Sandbox Project');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Fresh Construction</span>
                </button>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  Active: {itemCount} objects
                </span>
              </div>
            </div>

            {/* Build Zones Fast Teleport List */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Teleport to Any of the 6 Build Zones
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BUILD_ZONES.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      onJumpToZone(z);
                      setDrawerOpen(false);
                    }}
                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 text-[11px] font-semibold text-slate-700 transition-colors"
                  >
                    {z.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {savedBuilds.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No saved constructions yet. Place objects inside any Build Zone and click Save!
                </p>
              ) : (
                savedBuilds.map((b) => {
                  const isActive = b.buildId === activeBuildId;
                  const zoneDef = BUILD_ZONES.find((z) => z.id === b.zoneId);
                  return (
                    <div
                      key={b.buildId}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                        isActive ? 'border-sky-400 bg-sky-50/50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        {renamingId === b.buildId ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameText}
                              onChange={(e) => setRenameText(e.target.value)}
                              className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onRenameBuild(b.buildId, renameText);
                                setRenamingId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-slate-900 truncate">{b.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {zoneDef?.name ?? b.zoneId} · {b.items.length} objects
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadBuild(b.buildId);
                            setBuildNameInput(b.name);
                            if (zoneDef) onJumpToZone(zoneDef);
                            setDrawerOpen(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(b.buildId);
                            setRenameText(b.name);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                          title="Rename"
                          aria-label="Rename construction"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBuild(b.buildId)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete"
                          aria-label="Delete construction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
