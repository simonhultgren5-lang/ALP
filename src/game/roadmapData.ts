import { aggregateGearStats, calculateSkillDamage } from './combatMath';
import { SKILLS } from './data';
import { AspectId, EquipSlot, GearItem, SkillId, SkillProgress } from './types';

export type RoadmapPhaseId = 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'phase5';

export interface RoadmapDeliverable {
  id: string;
  milestoneCode: string;
  title: string;
  detail: string;
  gateTag: 'Math' | 'Engine' | 'VFX' | 'Content' | 'QA';
}

export interface RoadmapPhase {
  id: RoadmapPhaseId;
  number: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  targetEngine: string;
  durationEstimate: string;
  goal: string;
  deliverables: RoadmapDeliverable[];
  balanceGates: string[];
}

export interface BenchmarkProfile {
  name: string;
  skillId: SkillId;
  aspects: AspectId[];
  lv10Target: number;
  lv25Target: number;
  lv50Target: number;
  survivabilityNote: string;
}

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    id: 'phase1',
    number: '01',
    shortLabel: 'Prototype',
    title: 'Combat Math Prototype & Core Loop',
    subtitle: 'Deterministic Damage Pipeline & Classless Pillars',
    targetEngine: 'Web TypeScript / Canvas2D Prototype',
    durationEstimate: 'Weeks 1–3',
    goal: 'Validate the 6-step damage order, Aspect drawbacks, and Lv 1–20 pacing before committing to Godot 4 asset production.',
    deliverables: [
      {
        id: 'p1_d1',
        milestoneCode: 'M1.1',
        title: '6-Step Damage & Mitigation Pipeline',
        detail: 'Enforce Base + Flat -> Additive Increased % -> Sequential More Multipliers -> Crit -> Enemy Resist & Armour.',
        gateTag: 'Math',
      },
      {
        id: 'p1_d2',
        milestoneCode: 'M1.2',
        title: '10 Starting Skills with Lv 5 / 10 / 15 Branches',
        detail: 'Implement A/B/C upgrade paths across Cinder Slash, Ember Bolt, Frost Lance, Ashen Nova, Shadow Step, Storm Spike, Bone Spear, Seismic Slam, Void Tendrils, and Radiant Barrier.',
        gateTag: 'Content',
      },
      {
        id: 'p1_d3',
        milestoneCode: 'M1.3',
        title: '15 Trade-Off Aspects & Resource Loops',
        detail: 'Wire Blood (Life cost), Iron (No Evade), Aether (-20% Max Life), Siphon, Shade, and Eclipse interactions with unit test coverage.',
        gateTag: 'Math',
      },
      {
        id: 'p1_d4',
        milestoneCode: 'M1.4',
        title: '5 Enemy Policies & Attack Token Pool',
        detail: 'Prototype Chaser, Kiter, Charger, Flanker, and Boss telegraphs capped at 4 simultaneous attackers.',
        gateTag: 'Engine',
      },
    ],
    balanceGates: [
      'Lv 10 baseline hits stay within ~42–81 across Fire, Cold, and Lightning archetypes.',
      'Near-zero More multiplier stacking in Lv 1–20 so early builds stay tight and readable.',
      '100% pass rate on deterministic combat math & mitigation unit tests.',
    ],
  },
  {
    id: 'phase2',
    number: '02',
    shortLabel: 'Godot 4',
    title: 'Godot 4 Migration & 2026 Hybrid HUD',
    subtitle: 'Native 2D Core, Input Buffering & Unobstructed Viewport',
    targetEngine: 'Godot 4 (GDScript / C# Sim Core)',
    durationEstimate: 'Weeks 4–7',
    goal: 'Port the validated combat math into Godot 4 with native 2D physics, hitstop, trauma camera shake, and the small persistent core HUD.',
    deliverables: [
      {
        id: 'p2_d1',
        milestoneCode: 'M2.1',
        title: 'Godot 4 Project & Decoupled Resource Architecture',
        detail: 'Separate pure stat/combat Resource scripts from CharacterBody2D scene nodes and signal-driven HUD layers.',
        gateTag: 'Engine',
      },
      {
        id: 'p2_d2',
        milestoneCode: 'M2.2',
        title: 'Hitstop, Trauma Shake & Input Buffering',
        detail: 'Clamp delta steps, add 0.03–0.07s sim hitstop on crits/kills, trauma^2 shake, and 0.12s skill input buffering.',
        gateTag: 'Engine',
      },
      {
        id: 'p2_d3',
        milestoneCode: 'M2.3',
        title: '2026 Hybrid HUD Implementation',
        detail: 'Ship bottom-left HP/ES/MP orbs, bottom-center 5-slot hotbar with radial cooldown sweeps, and compact room-graph minimap.',
        gateTag: 'VFX',
      },
      {
        id: 'p2_d4',
        milestoneCode: 'M2.4',
        title: 'Safe Chamber Arrival & Telegraph System',
        detail: 'Guarantee >=2-tile open arrival lanes and 0.3–0.7s ground/sightline windups on all heavy enemy hits.',
        gateTag: 'QA',
      },
    ],
    balanceGates: [
      'Sustained 60 FPS on mid-tier hardware during 25+ active enemies without GC frame spikes.',
      'Center playfield remains >= 85% unobstructed during active combat.',
      'Player survives first 10 seconds of every chamber without immediate off-screen hits.',
    ],
  },
  {
    id: 'phase3',
    number: '03',
    shortLabel: 'VFX & Glow',
    title: 'Visual Identity, 5-Layer VFX & Glow Pipeline',
    subtitle: 'Emissive Hierarchy, Ribbon Trails & Post-Processing',
    targetEngine: 'Godot 4 GPUParticles2D + Environment Glow',
    durationEstimate: 'Weeks 8–11',
    goal: 'Make build identity immediately visible on character silhouettes and skills while preserving crisp combat readability.',
    deliverables: [
      {
        id: 'p3_d1',
        milestoneCode: 'M3.1',
        title: '5-Tier Emissive Readability Hierarchy',
        detail: 'Calibrate luminance: Player Skills > Player Character > Elites/Bosses > Ground Loot Beams > Environment Accents.',
        gateTag: 'VFX',
      },
      {
        id: 'p3_d2',
        milestoneCode: 'M3.2',
        title: '5-Layer Pooled Particle Architecture',
        detail: 'Pre-allocate GPUParticles2D pools for Core, Mid, Outer Glow, Detail Sparks, and Ground Decals (burn, frost, slam cracks).',
        gateTag: 'VFX',
      },
      {
        id: 'p3_d3',
        milestoneCode: 'M3.3',
        title: '3-Layer Post-Processing Stack',
        detail: 'Tune Dual-Kawase Base Bloom (high threshold), horizontal Anamorphic Streaks, and Spectral Chromatic Streaks for Crits/Empowered hits.',
        gateTag: 'VFX',
      },
      {
        id: 'p3_d4',
        milestoneCode: 'M3.4',
        title: 'Aspect Armour & Weapon Ribbon Visuals',
        detail: 'Render Blood veins, Iron molten cracks, Aether shield shell, Storm shoulder arcs, and orbiting Eclipse sigil.',
        gateTag: 'Content',
      },
    ],
    balanceGates: [
      'Zero runtime heap allocations inside particle/projectile pools during combat ticks.',
      'Post-processing bloom + streak passes stay under 2.5ms at half/quarter resolution.',
      'All 5 damage types (Fire, Cold, Lightning, Physical, Chaos) are distinguishable in motion.',
    ],
  },
  {
    id: 'phase4',
    number: '04',
    shortLabel: 'Endgame',
    title: 'Endgame Content, Marks & Pinnacle Bosses',
    subtitle: '18–20 Skills, 25–30 Aspects, Domains & Crafting Bench',
    targetEngine: 'Godot 4 Procedural Domain & Loot Systems',
    durationEstimate: 'Weeks 12–16',
    goal: 'Expand the vertical slice into a deep, replayable endgame grind with high-tier specialization and chase rewards.',
    deliverables: [
      {
        id: 'p4_d1',
        milestoneCode: 'M4.1',
        title: 'Skill & Aspect Pool Expansion',
        detail: 'Scale roster from 10 -> 18–20 Skills and 15 -> 25–30 Aspects without introducing passive-tree bloat.',
        gateTag: 'Content',
      },
      {
        id: 'p4_d2',
        milestoneCode: 'M4.2',
        title: 'Tier 1–20+ Domains, Modifiers & Corruption',
        detail: 'Add 15–20 Domain Modifiers with explicit risk/reward scaling and optional Corruption layers.',
        gateTag: 'Content',
      },
      {
        id: 'p4_d3',
        milestoneCode: 'M4.3',
        title: '8+ Chase Marks, Legendaries & Simple Crafting Bench',
        detail: 'Deploy Pinnacle Marks, build-defining Legendaries, and deterministic bench crafts (Life, Resistances, Mod Tiers).',
        gateTag: 'Math',
      },
      {
        id: 'p4_d4',
        milestoneCode: 'M4.4',
        title: '5–6 Multi-Phase Pinnacle Boss Encounters',
        detail: 'Author distinct multi-phase boss arenas guarding exclusive Aspect slots, Marks, and Legendary drops.',
        gateTag: 'Content',
      },
    ],
    balanceGates: [
      'Lv 25 -> Lv 50 hit power scales 8–12x over Lv 10 via multiplicative Aspect + Mark layers.',
      'All 6 core archetypes (Blood Reaver, Storm Conduit, Frost Controller, Ashen Bomber, Shadow Hunter, Iron Colossus) clear Tier 15+.',
      'No single Aspect or Mark exceeds 40% pick-rate dominance across endgame test builds.',
    ],
  },
  {
    id: 'phase5',
    number: '05',
    shortLabel: 'Polish & Ship',
    title: 'Final Polish, Accessibility, QA & Release',
    subtitle: 'Audio Foley, Endurance Soak Tests & Ship Candidate',
    targetEngine: 'Godot 4 Release Export (Windows / Linux / Web)',
    durationEstimate: 'Weeks 17–20',
    goal: 'Harden accessibility, audio feedback, save integrity, and performance stability for public launch.',
    deliverables: [
      {
        id: 'p5_d1',
        milestoneCode: 'M5.1',
        title: 'Accessibility, Font Scaling & Minimal HUD Mode',
        detail: 'Verify HUD readability scaling, high-contrast telegraphs, shape-coded loot beams, and one-toggle Minimal HUD.',
        gateTag: 'QA',
      },
      {
        id: 'p5_d2',
        milestoneCode: 'M5.2',
        title: 'Layered Combat Audio & Boss Stingers',
        detail: 'Polish pitch-varied skill Foley, crit resonance, legendary drop chimes, and dynamic encounter mixing.',
        gateTag: 'VFX',
      },
      {
        id: 'p5_d3',
        milestoneCode: 'M5.3',
        title: 'Endurance Soak & Save Migration QA',
        detail: 'Run automated math regression suites, 2-hour memory leak soak tests, and save-format roundtrip validation.',
        gateTag: 'QA',
      },
      {
        id: 'p5_d4',
        milestoneCode: 'M5.4',
        title: 'Release Packaging & Storefront Readiness',
        detail: 'Produce signed release builds, verify controller/mouse-keyboard parity, and lock zero-P0 launch checklist.',
        gateTag: 'Engine',
      },
    ],
    balanceGates: [
      'Zero P0/P1 collision, progression, or save-corruption defects in release candidate.',
      'Full keyboard + mouse and gamepad navigation parity across HUD, Build Drawer, and Crafting Bench.',
      'Clean 120-minute Domain grind session with < 2% frame-time variance.',
    ],
  },
];

export const BENCHMARK_PROFILES: BenchmarkProfile[] = [
  {
    name: 'Blood Reaver',
    skillId: 'cinder_slash',
    aspects: ['blood', 'iron', 'siphon', 'eclipse'],
    lv10Target: 81,
    lv25Target: 280,
    lv50Target: 810,
    survivabilityNote: '~4,200 Life · 55–65% Phys DR · 15% Leech',
  },
  {
    name: 'Storm Conduit',
    skillId: 'storm_spike',
    aspects: ['storm', 'overload', 'shade', 'hunter'],
    lv10Target: 51,
    lv25Target: 210,
    lv50Target: 760,
    survivabilityNote: '~2,800 Life + 1,800 ES · Speed & Shadow Step',
  },
  {
    name: 'Frost Controller',
    skillId: 'frost_lance',
    aspects: ['frigid', 'aether', 'veil', 'regrowth'],
    lv10Target: 42,
    lv25Target: 130,
    lv50Target: 380,
    survivabilityNote: '~2,200 Life + ~5,200 ES · Veil Absorb & Chill',
  },
];

export function computeRoadmapProgress(completedIds: Record<string, boolean>): {
  done: number;
  total: number;
  pct: number;
} {
  let total = 0;
  let done = 0;
  for (const phase of ROADMAP_PHASES) {
    for (const d of phase.deliverables) {
      total++;
      if (completedIds[d.id]) done++;
    }
  }
  return {
    done,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export function evaluateCurrentBuildBenchmark(
  primarySkillId: SkillId,
  activeAspects: AspectId[],
  equipment: Partial<Record<EquipSlot, GearItem>>,
  skillProgress: Record<SkillId, SkillProgress>,
  playerLevel: number
): {
  currentHit: number;
  critHit: number;
  effectiveLife: number;
  effectiveEs: number;
  scaleFactorFromLv1: number;
  gateStatus: 'Early Parity' | 'Mid Scaling' | 'Endgame Ready';
} {
  const stats = aggregateGearStats(equipment, activeAspects, playerLevel);
  const skill = SKILLS[primarySkillId];
  const prog = skillProgress[primarySkillId];

  const normalHit = calculateSkillDamage({
    skill,
    skillProgress: prog,
    stats,
    activeAspects,
    isMovementEmpowered: activeAspects.includes('shade'),
    isEclipseEmpowered: activeAspects.includes('eclipse'),
    isDistantTarget: skill.tags.includes('projectile'),
    isLowLife: stats.activeMarks.includes('low_life_covenant'),
    isCrit: false,
    enemyResistPct: 0,
    enemyArmour: 0,
  });

  const critHit = calculateSkillDamage({
    skill,
    skillProgress: prog,
    stats,
    activeAspects,
    isMovementEmpowered: activeAspects.includes('shade'),
    isEclipseEmpowered: activeAspects.includes('eclipse'),
    isDistantTarget: skill.tags.includes('projectile'),
    isLowLife: stats.activeMarks.includes('low_life_covenant'),
    isCrit: true,
    enemyResistPct: 0,
    enemyArmour: 0,
  });

  const baseLv1 = skill.baseDamage;
  const scaleFactorFromLv1 = Number((normalHit.finalDamage / Math.max(1, baseLv1)).toFixed(1));
  const gateStatus =
    playerLevel < 15 && activeAspects.length <= 2
      ? 'Early Parity'
      : scaleFactorFromLv1 >= 6
        ? 'Endgame Ready'
        : 'Mid Scaling';

  return {
    currentHit: normalHit.finalDamage,
    critHit: critHit.finalDamage,
    effectiveLife: stats.maxLife,
    effectiveEs: stats.maxEnergyShield,
    scaleFactorFromLv1,
    gateStatus,
  };
}

export interface GodotCoreLoopStep {
  step: number;
  title: string;
  canvasSource: string;
  godotTarget: string;
  instructions: string;
}

export interface ReactToNodeMapping {
  reactOrigin: string;
  godotNodeOrAutoload: string;
  signalOrResource: string;
  migrationNotes: string;
}

export const GODOT_MIGRATION_BLUEPRINT: {
  coreLoopSteps: GodotCoreLoopStep[];
  stateMappings: ReactToNodeMapping[];
  sceneTree: string;
  gdscriptLoopSnippet: string;
} = {
  coreLoopSteps: [
    {
      step: 1,
      title: 'Replace requestAnimationFrame Loop with Fixed _physics_process',
      canvasSource: 'AshenEngine.startLoop() & update(dt) in engine.ts',
      godotTarget: 'ArenaController.gd + PlayerController.gd (_physics_process)',
      instructions:
        'Move variable rAF delta clamping (min 0.05s) into Godot physics ticks (60 Hz default). Gate simulation ticks on hitstop_timer so crits/kills freeze kinematics without pausing input buffering or Camera2D trauma decay.',
    },
    {
      step: 2,
      title: 'Convert Manual Keyboard/Mouse Polling to InputMap & Buffered Actions',
      canvasSource: 'keys Set, mouseScreenX/Y, tryCastSlot(), bufferedSlot (0.12s)',
      godotTarget: 'InputMap (move_*, cast_1..4, dash) + _unhandled_input()',
      instructions:
        'Replace window key listeners and screenToWorld() math with get_global_mouse_position() and Input.get_vector(). Store buffered_slot + buffer_timer (0.12s) in PlayerController so queued skills fire immediately on cooldown/hitstop exit.',
    },
    {
      step: 3,
      title: 'Port Pre-Allocated Canvas2D Pools to GPUParticles2D & Shaders',
      canvasSource: 'PARTICLE_POOL_SIZE (480), CRIT_STREAK_POOL_SIZE (24), render()',
      godotTarget: 'VfxPool.gd (pre-warmed GPUParticles2D) + anamorphic_glow.gdshader',
      instructions:
        'Replace manual ctx.arc/createLinearGradient loops with pooled GPUParticles2D emitters and CanvasItem/WorldEnvironment glow shaders. Drive squash-and-stretch on Sprite2D scale and trauma^2 offsets directly on Camera2D.',
    },
    {
      step: 4,
      title: 'Keep Combat Math & Domain Generation Pure Inside Static Classes',
      canvasSource: 'combatMath.ts (6-step pipeline) & domainGen.ts',
      godotTarget: 'CombatMath.gd (RefCounted) + DomainGenerator.gd + SkillData Resource',
      instructions:
        'Translate calculateSkillDamage() and rollGearDrop() into pure static GDScript functions operating on typed Resource files (.tres) so balance tests run headlessly without spawning scene nodes.',
    },
  ],
  stateMappings: [
    {
      reactOrigin: 'App.tsx useState (hotbar, activeAspects, equipment, shards)',
      godotNodeOrAutoload: 'GameState (Autoload Singleton Node)',
      signalOrResource: 'BuildProfile Resource + build_changed(profile)',
      migrationNotes:
        'Centralize cross-scene progression in an Autoload instead of lifting React state and calling engine.syncBuild(). Persist SkillProgress and GearItem dictionaries as typed Resource instances.',
    },
    {
      reactOrigin: 'AshenEngine.emitHudSnapshot() -> GameHud.tsx props',
      godotNodeOrAutoload: 'HybridHUD (CanvasLayer) with Control Orbs & Hotbar',
      signalOrResource: 'hp_changed, es_changed, cooldown_tick, boss_phase_shifted',
      migrationNotes:
        'Eliminate 15–60 Hz snapshot object cloning. PlayerController and BossAI emit targeted Godot signals only when HP, Veil Shield, cooldowns, or Sanctuary DPS telemetry actually change.',
    },
    {
      reactOrigin: 'BuildDrawer.tsx & Modals.tsx (setPhase("paused"))',
      godotNodeOrAutoload: 'UILayer (CanvasLayer, process_mode = WHEN_PAUSED)',
      signalOrResource: 'get_tree().paused = true + pause_toggled(is_open)',
      migrationNotes:
        'Mount BuildDrawer and Level-Up Upgrade modals as Control sub-scenes inside UILayer. Setting SceneTree.paused freezes MainArena simulation nodes while keeping UI buttons responsive.',
    },
    {
      reactOrigin: 'saveSystem.ts (localStorage + JSON export/import)',
      godotNodeOrAutoload: 'SaveManager (Autoload Singleton Node)',
      signalOrResource: 'user://ashen_eclipse_save.json (schemaVersion = 2)',
      migrationNotes:
        'Mirror exportSaveJson / importSaveJson validation using FileAccess and JSON.parse_string(), migrating v1 keys and backfilling missing Phase 4 skill levels automatically on load.',
    },
  ],
  sceneTree: `Autoloads (Project Settings)
├─ GameState        (BuildProfile, Aspects, Shards, Domain Tier)
├─ AudioManager     (Pitch-varied Foley & Boss Phase Stingers)
└─ SaveManager      (user://ashen_eclipse_save.json v2 I/O)

MainArena (Node2D)
├─ WorldTileMap     (TileMapLayer + Safe Chamber Arrival Lanes)
├─ DecalPool        (Ground burn, frost, & slam crack sprites)
├─ VfxPool          (Pre-allocated GPUParticles2D + Crit Streaks)
├─ EnemySpawner     (Chaser, Kiter, Charger, Flanker, Pinnacle Boss)
├─ Player           (CharacterBody2D · PlayerController.gd)
│  ├─ AspectVisuals (Blood veins, Iron plates, Aether shell, Eclipse sigil)
│  └─ Camera2D      (Trauma^2 shake + WorldEnvironment Bloom/Streaks)
├─ HybridHUD        (CanvasLayer · HP/ES/Veil/MP Orbs, Hotbar, Minimap)
└─ UILayer          (CanvasLayer · PROCESS_MODE_WHEN_PAUSED)
   ├─ BuildDrawer   (Skills, 25 Aspects, Gear & Crafting Bench)
   └─ SanctuaryHUD  (Target Dummy Config & Live DPS Breakdown)`,
  gdscriptLoopSnippet: `# PlayerController.gd — Translates AshenEngine.update(dt)
extends CharacterBody2D

signal hp_changed(hp: float, max_hp: float, es: float, veil: float)
signal cooldown_updated(slot: int, remaining: float, total: float)

var hitstop_timer: float = 0.0
var buffered_slot: int = -1
var buffer_timer: float = 0.0

func _unhandled_input(event: InputEvent) -> void:
\tfor slot in 5:
\t\tif event.is_action_pressed("cast_%d" % (slot + 1)):
\t\t\tbuffered_slot = slot
\t\t\tbuffer_timer = 0.12 # Matches AshenEngine buffer window

func _physics_process(raw_delta: float) -> void:
\tvar dt := minf(raw_delta, 0.05)
\tif buffer_timer > 0.0:
\t\tbuffer_timer -= dt
\tif hitstop_timer > 0.0:
\t\thitstop_timer -= dt
\t\treturn # Freeze kinematics on crits/kills without dropping input
\t
\tvar dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
\tvelocity = dir * GameState.stats.movement_speed
\tmove_and_slide()
\t_process_buffered_cast()`,
};
