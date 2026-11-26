import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BuildDrawer } from './components/BuildDrawer';
import { GameHud } from './components/GameHud';
import { Modals } from './components/Modals';
import { RoadmapWorkspace } from './components/RoadmapWorkspace';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import { aggregateGearStats, applyCraftingBench, BenchCraftAction } from './game/combatMath';
import {
  ALL_ASPECT_IDS,
  DOMAIN_MODIFIERS,
  STARTER_PRESETS,
  StarterPreset,
  createInitialSkillProgress,
  createStarterEquipment,
  getUnlockedAspectSlots,
} from './game/data';
import { AshenThreeEngine } from './game/threeEngine';
import { CustomModelStatus, ModelSlotId } from './game/threeModelLoader';
import { computeRoadmapProgress } from './game/roadmapData';
import { exportSaveJson, importSaveJson } from './game/saveSystem';
import {
  AspectId,
  EquipSlot,
  GearItem,
  HudScaleOption,
  HudSnapshot,
  SanctuaryConfig,
  SkillId,
  SkillProgress,
  UpgradeBranch,
  UpgradeTier,
} from './game/types';

const ROADMAP_STORAGE_KEY = 'ashen_eclipse_roadmap_v2';
const HUD_SCALE_STORAGE_KEY = 'ashen_eclipse_hud_scale_v1';
const HC_TELEGRAPHS_STORAGE_KEY = 'ashen_eclipse_hc_telegraphs_v1';
const HITSTOP_STORAGE_KEY = 'ashen_eclipse_hitstop_v1';
const SCREEN_SHAKE_STORAGE_KEY = 'ashen_eclipse_screenshake_v1';

const ALL_ROADMAP_DONE: Record<string, boolean> = {
  p1_d1: true,
  p1_d2: true,
  p1_d3: true,
  p1_d4: true,
  p2_d1: true,
  p2_d2: true,
  p2_d3: true,
  p2_d4: true,
  p3_d1: true,
  p3_d2: true,
  p3_d3: true,
  p3_d4: true,
  p4_d1: true,
  p4_d2: true,
  p4_d3: true,
  p4_d4: true,
  p5_d1: true,
  p5_d2: true,
  p5_d3: true,
  p5_d4: true,
};

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  outcome: null,
  hp: 190,
  maxHp: 190,
  ghostHp: 190,
  es: 20,
  maxEs: 20,
  veilShield: 0,
  mp: 90,
  maxMp: 90,
  playerLevel: 1,
  xp: 0,
  xpToNext: 120,
  flaskCharges: 3,
  maxFlaskCharges: 3,
  shards: 20,
  kills: 0,
  totalRoomEnemies: 0,
  roomCleared: false,
  domainTier: 1,
  corrupted: false,
  currentRoomIndex: 0,
  totalRooms: 4,
  roomNames: ['Shattered Threshold', 'Cinder Nave', 'Obsidian Cloister', 'Eclipse Sanctum'],
  clearedRooms: [false, false, false, false],
  roomConnections: [
    [0, 1],
    [1, 2],
    [2, 3],
  ],
  bossActive: false,
  bossName: '',
  bossHp: 0,
  bossMaxHp: 1,
  bossPhase: 1,
  eclipseReady: false,
  eclipseTimer: 8,
  shadeReady: false,
  critMomentumTimer: 0,
  barrierTimer: 0,
  cooldowns: [0, 0, 0, 0, 0],
  maxCooldowns: [0.45, 1.5, 1.4, 5.5, 1.6],
  skillCosts: [8, 16, 18, 15, 6],
  skillUsesLife: [false, false, false, false, false],
  bufferedSlot: null,
  inSanctuary: false,
  sanctuaryConfig: {
    dummyArmour: 120,
    dummyResistPct: 25,
    sparringPulse: false,
  },
  sanctuaryTelemetry: {
    peakHit: 0,
    hitCount: 0,
    critCount: 0,
    lastHitSkill: '',
    lastHitIsCrit: false,
    lastHitBreakdown: null,
  },
  dpsEstimate: 0,
  elapsedSeconds: 0,
  damageTakenTotal: 0,
  pendingSkillUpgrade: null,
  recentLootToast: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AshenThreeEngine | null>(null);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(STARTER_PRESETS[0].id);
  const [hotbar, setHotbar] = useState<[SkillId, SkillId, SkillId, SkillId, SkillId]>(
    STARTER_PRESETS[0].hotbar
  );
  const [activeAspects, setActiveAspects] = useState<AspectId[]>(STARTER_PRESETS[0].aspects);
  const [unlockedAspects, setUnlockedAspects] = useState<AspectId[]>([
    'blood',
    'iron',
    'storm',
    'shade',
    'frigid',
    'aether',
    'cinder',
    'siphon',
    'veil',
    'hunter',
    'berserk',
    'arcane_surge',
    'chronomancer',
    'harvester',
  ]);
  const [skillProgress, setSkillProgress] = useState<Record<SkillId, SkillProgress>>(
    createInitialSkillProgress
  );
  const [equipment, setEquipment] = useState<Partial<Record<EquipSlot, GearItem>>>(() =>
    createStarterEquipment(STARTER_PRESETS[0].starterWeaponName)
  );
  const [bag, setBag] = useState<GearItem[]>([]);
  const [shards, setShards] = useState(20);
  const [pinnacleKills, setPinnacleKills] = useState(0);
  const [maxDomainTier, setMaxDomainTier] = useState(1);
  const [selectedDomainTier, setSelectedDomainTier] = useState(1);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [corrupted, setCorrupted] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [buildOpen, setBuildOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [minimalHud, setMinimalHud] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [customModels, setCustomModels] = useState<CustomModelStatus[]>([]);

  const [hudScale, setHudScale] = useState<HudScaleOption>(() => {
    try {
      const raw = localStorage.getItem(HUD_SCALE_STORAGE_KEY);
      if (raw === '0.85') return 0.85;
      if (raw === '1.15') return 1.15;
    } catch {
      // ignore
    }
    return 1;
  });

  const [highContrastTelegraphs, setHighContrastTelegraphs] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HC_TELEGRAPHS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [hitstopEnabled, setHitstopEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HITSTOP_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const [screenShakeEnabled, setScreenShakeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SCREEN_SHAKE_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const [completedRoadmapIds, setCompletedRoadmapIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(ROADMAP_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore storage errors
    }
    return { ...ALL_ROADMAP_DONE };
  });

  useEffect(() => {
    try {
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(completedRoadmapIds));
    } catch {
      // ignore storage errors
    }
  }, [completedRoadmapIds]);

  useEffect(() => {
    try {
      localStorage.setItem(HUD_SCALE_STORAGE_KEY, String(hudScale));
    } catch {
      // ignore
    }
  }, [hudScale]);

  useEffect(() => {
    try {
      localStorage.setItem(HC_TELEGRAPHS_STORAGE_KEY, String(highContrastTelegraphs));
      localStorage.setItem(HITSTOP_STORAGE_KEY, String(hitstopEnabled));
      localStorage.setItem(SCREEN_SHAKE_STORAGE_KEY, String(screenShakeEnabled));
    } catch {
      // ignore
    }
    engineRef.current?.setAccessibility({
      highContrastTelegraphs,
      hitstopEnabled,
      screenShakeEnabled,
    });
  }, [highContrastTelegraphs, hitstopEnabled, screenShakeEnabled]);

  const roadmapProgress = useMemo(
    () => computeRoadmapProgress(completedRoadmapIds),
    [completedRoadmapIds]
  );

  // Sync body[data-state]
  useEffect(() => {
    document.body.dataset.state = hud.phase;
  }, [hud.phase]);

  const stats = useMemo(
    () => aggregateGearStats(equipment, activeAspects, hud.playerLevel),
    [equipment, activeAspects, hud.playerLevel]
  );

  const aspectSlotCap = useMemo(
    () => getUnlockedAspectSlots(hud.playerLevel, pinnacleKills),
    [hud.playerLevel, pinnacleKills]
  );

  const launchDomainRun = useCallback(
    (tier: number, isCorrupted: boolean, modIds: string[], resetProgression: boolean) => {
      const eng = engineRef.current;
      if (!eng) return;
      const mods = DOMAIN_MODIFIERS.filter((m) => modIds.includes(m.id));
      setBuildOpen(false);
      setRoadmapOpen(false);
      setHasActiveRun(true);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      eng.startNewRun(tier, isCorrupted, mods, resetProgression);
    },
    []
  );

  const launchSanctuary = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    setBuildOpen(false);
    setRoadmapOpen(false);
    setHasActiveRun(true);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    eng.startSanctuary();
  }, []);

  // Initialize Three.js WebGL Engine once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const eng = new AshenThreeEngine(mount, createInitialSkillProgress(), {
      onHudUpdate: (snap) => setHud(snap),
      onLootCollected: (item) => {
        setBag((prev) => [item, ...prev].slice(0, 24));
      },
      onShardsChanged: (delta) => setShards((prev) => prev + delta),
      onSkillProgressChanged: (prog) => setSkillProgress(prog),
      onPlayerLevelChanged: () => {},
      onAspectUnlockCheck: () => {
        setUnlockedAspects((prev) => {
          const next = ALL_ASPECT_IDS.find((id) => !prev.includes(id));
          return next ? [...prev, next] : prev;
        });
      },
      onPinnacleBossKilled: () => {
        setPinnacleKills((p) => p + 1);
        setMaxDomainTier((t) => t + 1);
        setUnlockedAspects((prev) => {
          const next = ALL_ASPECT_IDS.find((id) => !prev.includes(id));
          return next ? [...prev, next] : prev;
        });
      },
    });

    engineRef.current = eng;
    eng.setAccessibility({
      highContrastTelegraphs,
      hitstopEnabled,
      screenShakeEnabled,
    });
    eng.syncBuild(
      STARTER_PRESETS[0].hotbar,
      STARTER_PRESETS[0].aspects,
      createStarterEquipment(STARTER_PRESETS[0].starterWeaponName),
      createInitialSkillProgress(),
      20
    );
    setCustomModels(eng.getCustomModelStatuses());
    const unsubModels = eng.subscribeCustomModels(() => {
      setCustomModels(eng.getCustomModelStatuses());
    });
    eng.startLoop();

    // Support ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setHasActiveRun(true);
      eng.startNewRun(1, false, [], true);
    }

    return () => {
      unsubModels();
      eng.destroy();
      engineRef.current = null;
    };
  }, []);

  // Push build state changes into running engine
  useEffect(() => {
    engineRef.current?.syncBuild(hotbar, activeAspects, equipment, skillProgress, shards);
  }, [hotbar, activeAspects, equipment, skillProgress, shards]);

  const handleSelectPreset = useCallback((preset: StarterPreset) => {
    setSelectedPresetId(preset.id);
    setHotbar(preset.hotbar);
    setActiveAspects(preset.aspects);
    setEquipment(createStarterEquipment(preset.starterWeaponName));
  }, []);

  const handleStartFromTitle = useCallback(() => {
    launchDomainRun(1, false, [], true);
  }, [launchDomainRun]);

  // Global keyboard shortcuts (Title Enter/Space, Pause Esc/P, Build I/Tab, Minimal H, Mute M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (roadmapOpen) {
        if (e.code === 'Escape') setRoadmapOpen(false);
        return;
      }

      if (hud.phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartFromTitle();
        }
        return;
      }

      if (e.code === 'KeyI' || e.code === 'Tab') {
        if (hud.phase === 'playing' || buildOpen) {
          e.preventDefault();
          setBuildOpen((prev) => {
            const next = !prev;
            engineRef.current?.setPhase(next ? 'paused' : 'playing');
            return next;
          });
        }
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (buildOpen) {
          setBuildOpen(false);
          engineRef.current?.setPhase('playing');
        } else if (hud.phase === 'playing') {
          engineRef.current?.setPhase('paused');
        } else if (hud.phase === 'paused' && !hud.pendingSkillUpgrade) {
          engineRef.current?.setPhase('playing');
        }
      } else if (e.code === 'KeyH' && hud.phase === 'playing') {
        setMinimalHud((prev) => !prev);
      } else if (e.code === 'KeyM') {
        soundEngine.muted = !soundEngine.muted;
        setMuted(soundEngine.muted);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.phase, hud.pendingSkillUpgrade, buildOpen, roadmapOpen, handleStartFromTitle]);

  const handleToggleBuild = () => {
    if (buildOpen) {
      setBuildOpen(false);
      engineRef.current?.setPhase('playing');
    } else {
      setBuildOpen(true);
      engineRef.current?.setPhase('paused');
    }
  };

  const handleOpenRoadmap = () => {
    if (hud.phase === 'playing') {
      engineRef.current?.setPhase('paused');
    }
    setRoadmapOpen(true);
  };

  const handleAssignHotbarSlot = (slotIdx: number, skillId: SkillId) => {
    setHotbar((prev) => {
      const next = [...prev] as [SkillId, SkillId, SkillId, SkillId, SkillId];
      const existing = next.indexOf(skillId);
      if (existing >= 0) {
        next[existing] = next[slotIdx];
      }
      next[slotIdx] = skillId;
      return next;
    });
  };

  const handleToggleAspect = (aspectId: AspectId) => {
    setActiveAspects((prev) => {
      if (prev.includes(aspectId)) {
        return prev.filter((a) => a !== aspectId);
      }
      if (prev.length >= aspectSlotCap) {
        return [...prev.slice(1), aspectId];
      }
      return [...prev, aspectId];
    });
  };

  const handleEquipFromBag = (itemId: string) => {
    const item = bag.find((b) => b.id === itemId);
    if (!item) return;
    const prevEquipped = equipment[item.slot];
    setEquipment((prev) => ({ ...prev, [item.slot]: item }));
    setBag((prev) => {
      const filtered = prev.filter((b) => b.id !== itemId);
      return prevEquipped ? [prevEquipped, ...filtered] : filtered;
    });
  };

  const handleSalvageFromBag = (itemId: string) => {
    setBag((prev) => prev.filter((b) => b.id !== itemId));
    setShards((s) => s + 5);
  };

  const handleCraftEquipped = (slot: EquipSlot, action: BenchCraftAction) => {
    const cost = action === 'add_life' ? 6 : action === 'fix_resist' ? 8 : 12;
    const target = equipment[slot];
    if (!target || shards < cost) return;
    setShards((s) => s - cost);
    setEquipment((prev) => ({ ...prev, [slot]: applyCraftingBench(target, action) }));
  };

  const handleExportSave = () => {
    const json = exportSaveJson({
      hotbar,
      activeAspects,
      unlockedAspects,
      skillProgress,
      equipment,
      bag,
      shards,
      pinnacleKills,
      maxDomainTier,
      selectedDomainTier,
      selectedModifierIds,
      corrupted,
      completedRoadmapIds,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ashen-eclipse-save.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportSave = (rawJson: string): { ok: boolean; error?: string } => {
    try {
      const data = importSaveJson(rawJson);
      setHotbar(data.hotbar);
      setActiveAspects(data.activeAspects);
      setUnlockedAspects(data.unlockedAspects);
      setSkillProgress(data.skillProgress);
      setEquipment(data.equipment);
      setBag(data.bag);
      setShards(data.shards);
      setPinnacleKills(data.pinnacleKills);
      setMaxDomainTier(data.maxDomainTier);
      setSelectedDomainTier(data.selectedDomainTier);
      setSelectedModifierIds(data.selectedModifierIds);
      setCorrupted(data.corrupted);
      if (Object.keys(data.completedRoadmapIds).length > 0) {
        setCompletedRoadmapIds(data.completedRoadmapIds);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invalid save file.' };
    }
  };

  return (
    <div className="relative w-full h-full bg-[#0B0B0F] overflow-hidden">
      {/* Isolated Three.js WebGL Mount */}
      <div
        ref={mountRef}
        data-testid="game-canvas"
        className="absolute inset-0 cursor-crosshair"
      />

      {/* Title Screen */}
      {hud.phase === 'title' && !roadmapOpen && (
        <TitleScreen
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectPreset}
          onStartGame={handleStartFromTitle}
          onStartSanctuary={launchSanctuary}
          onOpenRoadmap={() => setRoadmapOpen(true)}
          roadmapProgressPct={roadmapProgress.pct}
        />
      )}

      {/* Active Playing HUD */}
      {hud.phase !== 'title' && !roadmapOpen && (
        <GameHud
          hud={hud}
          hotbar={hotbar}
          minimalHud={minimalHud}
          muted={muted}
          hudScale={hudScale}
          onCastSlot={(idx) => engineRef.current?.tryCastSlot(idx)}
          onUseFlask={() => engineRef.current?.useFlask()}
          onToggleBuild={handleToggleBuild}
          onOpenRoadmap={handleOpenRoadmap}
          onToggleMinimal={() => setMinimalHud((m) => !m)}
          onToggleMute={() => {
            soundEngine.muted = !soundEngine.muted;
            setMuted(soundEngine.muted);
          }}
          onTogglePause={() => {
            if (hud.phase === 'playing') engineRef.current?.setPhase('paused');
            else if (hud.phase === 'paused' && !hud.pendingSkillUpgrade)
              engineRef.current?.setPhase('playing');
          }}
          onUpdateSanctuaryConfig={(partial: Partial<SanctuaryConfig>) =>
            engineRef.current?.setSanctuaryConfig(partial)
          }
          onResetSanctuary={() => engineRef.current?.resetSanctuaryTelemetry()}
        />
      )}

      {/* Build, Aspects, Gear & Domain Drawer */}
      <BuildDrawer
        open={buildOpen && !roadmapOpen}
        stats={stats}
        hotbar={hotbar}
        activeAspects={activeAspects}
        unlockedAspects={unlockedAspects}
        aspectSlotCap={aspectSlotCap}
        skillProgress={skillProgress}
        equipment={equipment}
        bag={bag}
        shards={shards}
        maxDomainTier={maxDomainTier}
        selectedDomainTier={selectedDomainTier}
        selectedModifierIds={selectedModifierIds}
        corrupted={corrupted}
        onClose={() => {
          setBuildOpen(false);
          engineRef.current?.setPhase('playing');
        }}
        onAssignHotbarSlot={handleAssignHotbarSlot}
        onToggleAspect={handleToggleAspect}
        onEquipFromBag={handleEquipFromBag}
        onSalvageFromBag={handleSalvageFromBag}
        onCraftEquipped={handleCraftEquipped}
        onSelectDomainTier={setSelectedDomainTier}
        onToggleDomainModifier={(id) =>
          setSelectedModifierIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }
        onToggleCorrupted={() => setCorrupted((c) => !c)}
        onLaunchDomain={() =>
          launchDomainRun(selectedDomainTier, corrupted, selectedModifierIds, false)
        }
        onEnterSanctuary={launchSanctuary}
        onExportSave={handleExportSave}
        onImportSave={handleImportSave}
        customModels={customModels}
        onUploadCustomModel={async (slot: ModelSlotId, file: File) => {
          await engineRef.current?.loadCustomModelFile(slot, file);
        }}
        onClearCustomModel={(slot: ModelSlotId) => {
          engineRef.current?.clearCustomModel(slot);
        }}
        onExportStarterKnightGlb={async () => {
          await engineRef.current?.exportStarterKnightGlb();
        }}
      />

      {/* Pause / Skill Upgrade / Victory / Game Over Modals */}
      {!buildOpen && !roadmapOpen && (
        <Modals
          hud={hud}
          hudScale={hudScale}
          highContrastTelegraphs={highContrastTelegraphs}
          hitstopEnabled={hitstopEnabled}
          screenShakeEnabled={screenShakeEnabled}
          onChangeHudScale={setHudScale}
          onToggleHighContrast={() => setHighContrastTelegraphs((v) => !v)}
          onToggleHitstop={() => setHitstopEnabled((v) => !v)}
          onToggleScreenShake={() => setScreenShakeEnabled((v) => !v)}
          onEnterSanctuary={launchSanctuary}
          onResume={() => engineRef.current?.setPhase('playing')}
          onRestart={() =>
            launchDomainRun(selectedDomainTier, corrupted, selectedModifierIds, false)
          }
          onNextDomainTier={() => {
            const nextTier = hud.domainTier + 1;
            setSelectedDomainTier(nextTier);
            launchDomainRun(nextTier, corrupted, selectedModifierIds, false);
          }}
          onReturnTitle={() => {
            setBuildOpen(false);
            setHasActiveRun(false);
            engineRef.current?.setPhase('title');
          }}
          onOpenRoadmap={handleOpenRoadmap}
          onSelectSkillUpgrade={(skillId: SkillId, tier: UpgradeTier, branch: UpgradeBranch) =>
            engineRef.current?.resolveSkillUpgrade(skillId, tier, branch)
          }
        />
      )}

      {/* Interactive 5-Phase Godot 4 Development Roadmap Workspace */}
      {roadmapOpen && (
        <RoadmapWorkspace
          completedIds={completedRoadmapIds}
          onToggleDeliverable={(id) =>
            setCompletedRoadmapIds((prev) => ({ ...prev, [id]: !prev[id] }))
          }
          onResetChecklist={() => setCompletedRoadmapIds({})}
          onMarkAllChecklist={() => setCompletedRoadmapIds({ ...ALL_ROADMAP_DONE })}
          onBackToTitle={() => {
            setRoadmapOpen(false);
            setHasActiveRun(false);
            engineRef.current?.setPhase('title');
          }}
          onEnterVerticalSlice={() => {
            setRoadmapOpen(false);
            if (hasActiveRun && hud.phase !== 'title' && hud.outcome === null) {
              engineRef.current?.setPhase('playing');
            } else {
              handleStartFromTitle();
            }
          }}
          hasActiveRun={hasActiveRun && hud.phase !== 'title' && hud.outcome === null}
          primarySkillId={hotbar[0]}
          activeAspects={activeAspects}
          equipment={equipment}
          skillProgress={skillProgress}
          playerLevel={hud.playerLevel}
        />
      )}
    </div>
  );
}
