import React, { useMemo, useState } from 'react';
import { SKILLS } from '../game/data';
import { downloadGodotStarterZip } from '../game/godotExport';
import {
  BENCHMARK_PROFILES,
  GODOT_MIGRATION_BLUEPRINT,
  ROADMAP_PHASES,
  RoadmapPhaseId,
  computeRoadmapProgress,
  evaluateCurrentBuildBenchmark,
} from '../game/roadmapData';
import { AspectId, EquipSlot, GearItem, SkillId, SkillProgress } from '../game/types';
import { EclipseCrestSvg } from './Icons';

interface RoadmapWorkspaceProps {
  completedIds: Record<string, boolean>;
  onToggleDeliverable: (id: string) => void;
  onResetChecklist: () => void;
  onMarkAllChecklist: () => void;
  onBackToTitle: () => void;
  onEnterVerticalSlice: () => void;
  hasActiveRun: boolean;
  // Live build state for the Balance Gate Comparator
  primarySkillId: SkillId;
  activeAspects: AspectId[];
  equipment: Partial<Record<EquipSlot, GearItem>>;
  skillProgress: Record<SkillId, SkillProgress>;
  playerLevel: number;
}

export function RoadmapWorkspace({
  completedIds,
  onToggleDeliverable,
  onResetChecklist,
  onMarkAllChecklist,
  onBackToTitle,
  onEnterVerticalSlice,
  hasActiveRun,
  primarySkillId,
  activeAspects,
  equipment,
  skillProgress,
  playerLevel,
}: RoadmapWorkspaceProps) {
  const [phaseFilter, setPhaseFilter] = useState<'all' | RoadmapPhaseId | 'godot_migration'>('all');
  const [search, setSearch] = useState('');
  const [simLevelMode, setSimLevelMode] = useState<'live' | 10 | 25 | 50>('live');

  const effectiveSimLevel = simLevelMode === 'live' ? playerLevel : simLevelMode;
  const progress = useMemo(() => computeRoadmapProgress(completedIds), [completedIds]);
  const buildEval = useMemo(
    () =>
      evaluateCurrentBuildBenchmark(
        primarySkillId,
        activeAspects,
        equipment,
        skillProgress,
        effectiveSimLevel
      ),
    [primarySkillId, activeAspects, equipment, skillProgress, effectiveSimLevel]
  );

  const visiblePhases = useMemo(() => {
    if (phaseFilter === 'godot_migration') return [];
    const q = search.trim().toLowerCase();
    return ROADMAP_PHASES.filter((p) => phaseFilter === 'all' || p.id === phaseFilter)
      .map((phase) => ({
        ...phase,
        deliverables: phase.deliverables.filter(
          (d) =>
            !q ||
            d.title.toLowerCase().includes(q) ||
            d.detail.toLowerCase().includes(q) ||
            d.milestoneCode.toLowerCase().includes(q)
        ),
      }))
      .filter((p) => p.deliverables.length > 0 || !q);
  }, [phaseFilter, search]);

  const showGodotMigration = useMemo(() => {
    if (phaseFilter !== 'all' && phaseFilter !== 'godot_migration') return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const inCore = GODOT_MIGRATION_BLUEPRINT.coreLoopSteps.some(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.canvasSource.toLowerCase().includes(q) ||
        s.godotTarget.toLowerCase().includes(q) ||
        s.instructions.toLowerCase().includes(q)
    );
    const inState = GODOT_MIGRATION_BLUEPRINT.stateMappings.some(
      (m) =>
        m.reactOrigin.toLowerCase().includes(q) ||
        m.godotNodeOrAutoload.toLowerCase().includes(q) ||
        m.signalOrResource.toLowerCase().includes(q) ||
        m.migrationNotes.toLowerCase().includes(q)
    );
    return (
      inCore ||
      inState ||
      'godot migration'.includes(q) ||
      'ashenengine'.includes(q) ||
      'gdscript'.includes(q)
    );
  }, [phaseFilter, search]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0B0F] text-[#E6E4DD] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-6 px-6 md:px-10 py-4 border-b border-[#272733] bg-[#121218] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <EclipseCrestSvg className="w-8 h-8 shrink-0" />
          <span className="font-display text-lg font-bold text-[#F8FAFC] whitespace-nowrap">
            Ashen Eclipse
          </span>
          <span className="text-[#3F3F52] hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-sm text-[#94A3B8] hidden sm:inline whitespace-nowrap">
            Godot 4 Production Roadmap
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={downloadGodotStarterZip}
            className="px-4 py-2 rounded-lg bg-[#17171F] hover:bg-[#232330] border border-[#D99B38]/60 text-xs font-medium text-[#FDE68A] whitespace-nowrap cursor-pointer"
          >
            Export Godot 4 Starter (.zip)
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="px-4 py-2 rounded-lg bg-[#17171F] hover:bg-[#232330] border border-[#272733] text-xs font-medium text-[#E6E4DD] whitespace-nowrap cursor-pointer"
          >
            Title Screen
          </button>
          <button
            type="button"
            onClick={onEnterVerticalSlice}
            className="px-4 py-2 rounded-lg bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            {hasActiveRun ? 'Resume Vertical Slice' : 'Launch Vertical Slice'}
          </button>
        </div>
      </header>

      {/* Main Scrollable Workspace */}
      <div className="flex-1 overflow-y-auto ae-scroll">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
          {/* Summary + Progress + Search Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-3">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC] text-balance">
                Development Roadmap: Prototype to Release
              </h1>
              <p className="text-sm text-[#A1A1B5] max-w-2xl leading-relaxed">
                Five sequential production phases moving from deterministic web combat math validation into Godot 4 vertical slice, 5-layer VFX, endgame Domain scaling, and release QA.
              </p>
            </div>

            <div className="lg:col-span-4 bg-[#17171F] border border-[#272733] rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">Overall Milestone Completion</span>
                <span className="font-mono-tabular font-semibold text-[#D99B38]">
                  {progress.done} / {progress.total} · {progress.pct}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#0B0B0F] rounded-full overflow-hidden border border-[#272733]">
                <div
                  className="h-full bg-[#D99B38] transition-[width] duration-200"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1 gap-2">
                <span className="text-[11px] text-[#94A3B8]">
                  Saved locally in browser
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onMarkAllChecklist}
                    className="text-[11px] text-[#D99B38] hover:text-[#FDE68A] underline cursor-pointer"
                  >
                    Mark All Verified
                  </button>
                  <button
                    type="button"
                    onClick={onResetChecklist}
                    className="text-[11px] text-[#94A3B8] hover:text-[#F8FAFC] underline cursor-pointer"
                  >
                    Reset Checklist
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#272733]">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#17171F] rounded-lg border border-[#272733]">
              <button
                type="button"
                onClick={() => setPhaseFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  phaseFilter === 'all'
                    ? 'bg-[#232330] text-[#D99B38]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                All Phases
              </button>
              {ROADMAP_PHASES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhaseFilter(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                    phaseFilter === p.id
                      ? 'bg-[#232330] text-[#D99B38]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {p.number}. {p.shortLabel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPhaseFilter('godot_migration')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  phaseFilter === 'godot_migration'
                    ? 'bg-[#232330] text-[#D99B38]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                Godot Migration
              </button>
            </div>

            <div className="w-full sm:w-64">
              <label htmlFor="roadmap-search" className="sr-only">
                Filter roadmap deliverables
              </label>
              <input
                id="roadmap-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter milestones or gates..."
                className="w-full px-3.5 py-2 rounded-lg bg-[#17171F] border border-[#272733] focus:border-[#D99B38] focus:outline-none text-xs text-[#F8FAFC] placeholder:text-[#64748B]"
              />
            </div>
          </div>

          {/* Main 2-Column Layout: Phases (Left 8) + Live Balance Gate Comparator (Right 4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Phase List & Godot Migration */}
            <div className="lg:col-span-8 space-y-6">
              {visiblePhases.length === 0 && !showGodotMigration ? (
                <div className="p-8 rounded-xl bg-[#17171F] border border-[#272733] text-center space-y-2">
                  <p className="text-sm text-[#E6E4DD]">No deliverables match "{search}".</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setPhaseFilter('all');
                    }}
                    className="text-xs text-[#D99B38] underline cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  {visiblePhases.map((phase) => {
                  const phaseDone = phase.deliverables.filter((d) => completedIds[d.id]).length;
                  return (
                    <section
                      key={phase.id}
                      className="bg-[#17171F] border border-[#272733] rounded-xl p-6 space-y-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#272733] pb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono-tabular">
                            <span className="text-[#D99B38] font-semibold">Phase {phase.number}</span>
                            <span aria-hidden="true">·</span>
                            <span>{phase.durationEstimate}</span>
                            <span aria-hidden="true">·</span>
                            <span>{phase.targetEngine}</span>
                          </div>
                          <h2 className="font-display text-xl font-bold text-[#F8FAFC]">
                            {phase.title}
                          </h2>
                          <p className="text-xs text-[#A1A1B5]">{phase.goal}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {phase.id === 'phase2' && (
                            <button
                              type="button"
                              onClick={downloadGodotStarterZip}
                              className="px-3 py-1 rounded bg-[#0B0B0F] hover:bg-[#232330] border border-[#D99B38]/60 text-[11px] font-medium text-[#FDE68A] whitespace-nowrap cursor-pointer"
                            >
                              Download Godot 4 (.zip)
                            </button>
                          )}
                          <div className="font-mono-tabular text-xs text-[#94A3B8]">
                            {phaseDone}/{phase.deliverables.length} Complete
                          </div>
                        </div>
                      </div>

                      {/* Deliverables Checklist */}
                      <div className="space-y-2.5">
                        {phase.deliverables.map((d) => {
                          const checked = Boolean(completedIds[d.id]);
                          return (
                            <label
                              key={d.id}
                              className={`flex items-start gap-3.5 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                                checked
                                  ? 'bg-[#121218] border-[#272733] opacity-75'
                                  : 'bg-[#0B0B0F] border-[#272733] hover:border-[#3F3F52]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleDeliverable(d.id)}
                                className="mt-0.5 h-4 w-4 accent-[#D99B38] rounded cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      checked ? 'text-[#A1A1B5]' : 'text-[#F8FAFC]'
                                    }`}
                                  >
                                    {d.milestoneCode}. {d.title}
                                  </span>
                                  <span
                                    className={`text-[11px] font-mono-tabular ${
                                      checked ? 'text-[#10B981]' : 'text-[#94A3B8]'
                                    }`}
                                  >
                                    {checked ? `Verified · ${d.gateTag}` : `Gate: ${d.gateTag}`}
                                  </span>
                                </div>
                                <p className="text-xs text-[#94A3B8] leading-relaxed">{d.detail}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Phase Exit / Balance Gates */}
                      <div className="pt-2 border-t border-[#272733] space-y-2">
                        <div className="text-xs font-semibold text-[#D99B38]">
                          Phase Exit &amp; Balance Gates
                        </div>
                        <ul className="space-y-1.5">
                          {phase.balanceGates.map((gate, gIdx) => (
                            <li
                              key={gIdx}
                              className="text-xs text-[#CBD5E1] flex items-start gap-2 leading-relaxed"
                            >
                              <span className="text-[#D99B38] font-mono-tabular shrink-0">—</span>
                              <span>{gate}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  );
                })}

                  {showGodotMigration && (
                    <section
                      id="godot-migration"
                      aria-labelledby="godot-migration-heading"
                      className="bg-[#17171F] border border-[#D99B38]/40 rounded-xl p-6 space-y-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#272733] pb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono-tabular">
                            <span className="text-[#D99B38] font-semibold">Architecture Guide</span>
                            <span aria-hidden="true">·</span>
                            <span>Canvas2D &amp; React → GDScript &amp; Godot 4 Nodes</span>
                          </div>
                          <h2
                            id="godot-migration-heading"
                            className="font-display text-xl font-bold text-[#F8FAFC]"
                          >
                            Godot Migration
                          </h2>
                          <p className="text-xs text-[#A1A1B5]">
                            Step-by-step translation blueprint for moving the AshenEngine simulation loop and React state tree into Godot 4 Nodes, Autoloads, and Signals.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={downloadGodotStarterZip}
                          className="px-3 py-1.5 rounded bg-[#0B0B0F] hover:bg-[#232330] border border-[#D99B38]/60 text-[11px] font-medium text-[#FDE68A] whitespace-nowrap cursor-pointer shrink-0"
                        >
                          Export GDScript Starter (.zip)
                        </button>
                      </div>

                      {/* 1. AshenEngine Core Loop Translation */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D99B38]">
                          1. AshenEngine Core Loop → GDScript
                        </h3>
                        <div className="space-y-2.5">
                          {GODOT_MIGRATION_BLUEPRINT.coreLoopSteps.map((step) => (
                            <div
                              key={step.step}
                              className="p-4 rounded-lg bg-[#0B0B0F] border border-[#272733] space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[#F8FAFC]">
                                  Step {step.step}. {step.title}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono-tabular">
                                <div className="px-2.5 py-1.5 rounded bg-[#121218] border border-[#272733] text-[#94A3B8]">
                                  <span className="text-[#64748B]">Canvas2D: </span>
                                  {step.canvasSource}
                                </div>
                                <div className="px-2.5 py-1.5 rounded bg-[#121218] border border-[#D99B38]/30 text-[#FDE68A]">
                                  <span className="text-[#D99B38]">Godot 4: </span>
                                  {step.godotTarget}
                                </div>
                              </div>
                              <p className="text-xs text-[#CBD5E1] leading-relaxed">
                                {step.instructions}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. React State → Godot Node Structure & Signals */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D99B38]">
                          2. React State Management → Godot Node Structure &amp; Signals
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {GODOT_MIGRATION_BLUEPRINT.stateMappings.map((item) => (
                            <div
                              key={item.godotNodeOrAutoload}
                              className="p-4 rounded-lg bg-[#0B0B0F] border border-[#272733] space-y-2"
                            >
                              <div className="text-xs font-semibold text-[#F8FAFC]">
                                {item.godotNodeOrAutoload}
                              </div>
                              <div className="text-[11px] font-mono-tabular text-[#94A3B8]">
                                From: <span className="text-[#CBD5E1]">{item.reactOrigin}</span>
                              </div>
                              <div className="text-[11px] font-mono-tabular text-[#10B981]">
                                Via: {item.signalOrResource}
                              </div>
                              <p className="text-xs text-[#A1A1B5] leading-relaxed">
                                {item.migrationNotes}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 3. Target Scene Tree & GDScript Loop Pattern */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-[#CBD5E1]">
                            Target Godot 4 Node &amp; Autoload Tree
                          </div>
                          <pre className="p-3.5 rounded-lg bg-[#0B0B0F] border border-[#272733] text-[11px] font-mono-tabular text-[#E2E8F0] overflow-x-auto leading-relaxed">
                            {GODOT_MIGRATION_BLUEPRINT.sceneTree}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-[#CBD5E1]">
                            AshenEngine.update(dt) → _physics_process(dt)
                          </div>
                          <pre className="p-3.5 rounded-lg bg-[#0B0B0F] border border-[#272733] text-[11px] font-mono-tabular text-[#FDE68A] overflow-x-auto leading-relaxed">
                            {GODOT_MIGRATION_BLUEPRINT.gdscriptLoopSnippet}
                          </pre>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>

            {/* Right Sidebar: Live Balance Gate Simulator */}
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">
              <div className="bg-[#17171F] border border-[#272733] rounded-xl p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                    Live Balance Gate Simulator
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Evaluates your active vertical-slice build against Phase 1 &amp; Phase 4 target curves.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#0B0B0F] rounded-lg border border-[#272733]">
                  {(
                    [
                      ['live', 'Live'],
                      [10, 'Lv 10'],
                      [25, 'Lv 25'],
                      [50, 'Lv 50'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setSimLevelMode(val)}
                      className={`flex-1 py-1 px-2 rounded text-[11px] font-mono-tabular whitespace-nowrap cursor-pointer transition-colors ${
                        simLevelMode === val
                          ? 'bg-[#232330] text-[#D99B38] font-semibold'
                          : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="p-3.5 rounded-lg bg-[#0B0B0F] border border-[#272733] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">Primary Skill</span>
                    <span className="font-semibold text-[#F8FAFC]">
                      {SKILLS[primarySkillId].name} (Lv {skillProgress[primarySkillId].level})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">Normal Hit / Crit Hit</span>
                    <span className="font-mono-tabular font-bold text-[#D99B38]">
                      {buildEval.currentHit} / {buildEval.critHit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">Pool (Life + ES)</span>
                    <span className="font-mono-tabular text-[#E6E4DD]">
                      {buildEval.effectiveLife} + {buildEval.effectiveEs}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">Power Scale vs Lv 1</span>
                    <span className="font-mono-tabular text-[#10B981]">
                      {buildEval.scaleFactorFromLv1}× ({buildEval.gateStatus})
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="text-xs font-semibold text-[#94A3B8]">
                    Target Benchmarks (Lv 10 → Lv 25 → Lv 50)
                  </div>
                  {BENCHMARK_PROFILES.map((bp) => (
                    <div
                      key={bp.name}
                      className="p-3 rounded-lg bg-[#0B0B0F] border border-[#272733] space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#F8FAFC]">{bp.name}</span>
                        <span className="font-mono-tabular text-[#D99B38]">
                          {bp.lv10Target} → {bp.lv25Target} → {bp.lv50Target}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">{bp.survivabilityNote}</div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
