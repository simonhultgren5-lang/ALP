import { soundEngine } from './audio';
import {
  aggregateGearStats,
  calculateSkillDamage,
  computeIncomingDamageMitigation,
  computeLifeLeechHeal,
  rollGearDrop,
} from './combatMath';
import {
  ASPECTS,
  DAMAGE_COLORS,
  RARITY_COLORS,
  SKILLS,
  getUnlockedAspectSlots,
} from './data';
import { DomainLayout, ObstacleRect, generateDomainLayout } from './domainGen';
import {
  AspectId,
  ComputedPlayerStats,
  DamageType,
  DomainModifier,
  EquipSlot,
  GamePhase,
  GearItem,
  HudSnapshot,
  Rarity,
  SanctuaryConfig,
  SanctuaryTelemetry,
  SkillId,
  SkillProgress,
  UpgradeTier,
} from './types';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  layer: 'core' | 'mid' | 'outer' | 'spark';
}

interface GroundDecal {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'burn' | 'frost' | 'crack' | 'void';
  tickTimer?: number;
  dps?: number;
}

interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  isCrit: boolean;
  life: number;
  maxLife: number;
}

interface SlashArcEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightningBoltEffect {
  points: Array<{ x: number; y: number }>;
  color: string;
  life: number;
  maxLife: number;
}

interface CritStreak {
  active: boolean;
  x: number;
  y: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
  chromatic: boolean;
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  skillId?: SkillId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damageType: DamageType;
  damage: number;
  isCrit: boolean;
  life: number;
  pierceLeft: number;
  returning?: boolean;
  returnDist?: number;
  originX: number;
  originY: number;
  explodeRadius?: number;
  hitIds: Set<number>;
  empowered?: boolean;
}

interface Enemy {
  id: number;
  archetype: 'thrall' | 'cultist' | 'charger' | 'stalker' | 'boss';
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  armour: number;
  resistPct: number;
  /** 0–100. Reduces duration of applied status effects. */
  statusResistPct: number;
  isElite: boolean;
  hitFlash: number;
  koTimer: number; // > 0 when dying
  chillTimer: number;
  chillStrength: number;
  shockTimer: number;
  burnTimer: number;
  burnDps: number;
  witheredTimer: number;
  stunTimer: number;
  state: 'idle' | 'windup' | 'attack' | 'recover';
  stateTimer: number;
  windupDuration: number;
  attackCooldown: number;
  aimAngle: number;
  orbitDir: number;
  bossAttackIndex: number;
  bossPhase?: 1 | 2;
  scaleX: number;
  scaleY: number;
  isDummy?: boolean;
}

interface GroundLoot {
  id: string;
  x: number;
  y: number;
  item: GearItem;
  pulsePhase: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onLootCollected: (item: GearItem) => void;
  onShardsChanged: (delta: number) => void;
  onSkillProgressChanged: (progress: Record<SkillId, SkillProgress>) => void;
  onPlayerLevelChanged: (level: number, xp: number, xpToNext: number) => void;
  onAspectUnlockCheck: () => void;
  onPinnacleBossKilled: () => void;
}

const PARTICLE_POOL_SIZE = 480;
const DECAL_POOL_SIZE = 100;
const FLOATING_TEXT_POOL_SIZE = 80;
const CRIT_STREAK_POOL_SIZE = 24;
const MAX_CONCURRENT_ATTACKERS = 4;

export interface AshenEngineOptions {
  headless?: boolean;
  screenToWorldOverride?: (clientX: number, clientY: number) => { x: number; y: number };
}

export class AshenEngine {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private callbacks: EngineCallbacks;
  private headless: boolean;
  private screenToWorldOverride?: (clientX: number, clientY: number) => { x: number; y: number };

  private rafId: number | null = null;
  private lastTime = 0;
  private simTime = 0;
  private hitstopTimer = 0;
  private trauma = 0;
  private screenFlash = 0; // 0–1, decays each frame – used for crit/kill flash
  private screenFlashColor = '#FFF7ED';
  /** 0–1 FOV kick strength; renderer lerps camera.fov from this */
  private fovKick = 0;
  /** +1 zoom-in (crit/kill), -1 widen (player hurt) */
  private fovKickSign = 1;
  private hudSyncTimer = 0;
  private needsStaticRedraw = true;

  // Input state (Diablo / PoE Click-to-Move + RMB Skill + Hybrid WASD)
  private keys = new Set<string>();
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private leftMouseDown = false;
  private rightMouseDown = false;
  private pointerInitialized = false;
  private moveTargetActive = false;
  private moveTargetX = 0;
  private moveTargetY = 0;
  private moveTargetKind: 'move' | 'attack' | 'interact' = 'move';
  private targetEnemyId: number | null = null;
  private targetLootId: string | null = null;
  private targetPortal = false;
  private stuckMoveTimer = 0;
  private lastStepPx = 0;
  private lastStepPy = 0;

  // Game & Build State
  public phase: GamePhase = 'title';
  public outcome: 'victory' | 'defeat' | null = null;
  public hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId] = [
    'cinder_slash',
    'seismic_slam',
    'ashen_nova',
    'radiant_barrier',
    'shadow_step',
  ];
  public activeAspects: AspectId[] = ['blood', 'iron'];
  public equipment: Partial<Record<EquipSlot, GearItem>> = {};
  public skillProgress: Record<SkillId, SkillProgress>;
  public stats: ComputedPlayerStats;

  // Player runtime state
  private px = 240;
  private py = 470;
  private pvx = 0;
  private pvy = 0;
  private pAimAngle = 0;
  private pWalkPhase = 0;
  private pHp = 180;
  private pGhostHp = 180;
  private pEs = 20;
  private pEsRechargeDelay = 0;
  private pVeilShield = 0;
  private pVeilTimer = 0;
  private pMp = 90;
  private pInvulnTimer = 0;
  private pHitFlash = 0;
  private pLevel = 1;
  private pXp = 0;
  private pXpToNext = 120;
  private pFlaskCharges = 3;
  private pMaxFlaskCharges = 3;
  private pFlaskRefillProgress = 0;
  private pShards = 20;
  private pCooldowns = [0, 0, 0, 0, 0];
  private pMaxCooldowns = [0.45, 1.5, 1.4, 5.5, 1.6];
  private pScaleX = 1;
  private pScaleY = 1;
  private bufferedSlot: number | null = null;
  private bufferedTimer = 0;

  // Phase 2 Accessibility & Sanctuary Practice Arena
  private highContrastTelegraphs = false;
  private hitstopEnabled = true;
  private screenShakeEnabled = true;
  private inSanctuary = false;
  private sanctuaryConfig: SanctuaryConfig = {
    dummyArmour: 120,
    dummyResistPct: 25,
    sparringPulse: false,
  };
  private sanctuaryPulseTimer = 2.6;
  private sanctuaryTelemetry: SanctuaryTelemetry = {
    peakHit: 0,
    hitCount: 0,
    critCount: 0,
    lastHitSkill: '',
    lastHitIsCrit: false,
    lastHitBreakdown: null,
  };

  // Buff & Aspect timers
  private shadeEmpowered = false;
  private shadeTimer = 0;
  private eclipseTimer = 8;
  private eclipseReady = false;
  private critMomentumTimer = 0;
  private barrierTimer = 0;
  private fleetfootTimer = 0;
  // Twin Spin (Crimson Whirlwind Lv15 B) — delayed second cleave
  private twinSpinTimer = 0;
  private twinSpinParams: {
    x: number;
    y: number;
    radius: number;
    angle: number;
    isShadeEmpowered: boolean;
    isEclipseEmpowered: boolean;
  } | null = null;
  // Seismic Slam delayed effects (Aftershock / Double Rupture)
  private seismicDelayTimer = 0;
  private seismicDelayParams: {
    x: number;
    y: number;
    radius: number;
    damageMult: number;
    isShadeEmpowered: boolean;
    isEclipseEmpowered: boolean;
    isDoubleRupture: boolean;
  } | null = null;
  // Eclipse Cleave (Cinder Slash Lv15 B) — delayed second slash
  private eclipseCleaveTimer = 0;
  private eclipseCleaveParams: {
    x: number;
    y: number;
    angle: number;
    arc: number;
    radius: number;
    isShadeEmpowered: boolean;
    isEclipseEmpowered: boolean;
  } | null = null;
  // Double Eruption (Ashen Nova Lv15 B) — delayed second nova
  private doubleEruptionTimer = 0;
  private doubleEruptionParams: {
    x: number;
    y: number;
    radius: number;
    isShadeEmpowered: boolean;
    isEclipseEmpowered: boolean;
  } | null = null;
  // Burn floating number throttle
  private burnTextTimer = 0;
  private regrowthBank = 0;

  // Run telemetry
  private kills = 0;
  private elapsedSeconds = 0;
  private damageTakenTotal = 0;
  private recentDamageDealt = 0;
  private dpsTimer = 0;
  private dpsEstimate = 0;
  private pendingSkillUpgrade: { skillId: SkillId; tier: UpgradeTier } | null = null;
  private recentLootToast: { name: string; rarity: Rarity } | null = null;
  private lootToastTimer = 0;

  // Domain & World
  private domain: DomainLayout;
  private currentRoomIdx = 0;
  private enemies: Enemy[] = [];
  private nextEnemyId = 1;
  private projectiles: Projectile[] = [];
  private groundLoot: GroundLoot[] = [];
  private slashEffects: SlashArcEffect[] = [];
  private lightningEffects: LightningBoltEffect[] = [];
  private afterImages: Array<{ x: number; y: number; life: number; color: string }> = [];

  // Zero-GC Pools
  private particles: Particle[];
  private particleCursor = 0;
  private decals: GroundDecal[];
  private decalCursor = 0;
  private floatingTexts: FloatingText[];
  private textCursor = 0;
  private critStreaks: CritStreak[];
  private critStreakCursor = 0;

  // Camera
  private camX = 0;
  private camY = 0;

  // Weapon ribbon trail
  private weaponTrail: Array<{ x: number; y: number; life: number; color: string }> = [];

  constructor(
    canvas: HTMLCanvasElement | null,
    initialSkillProgress: Record<SkillId, SkillProgress>,
    callbacks: EngineCallbacks,
    options?: AshenEngineOptions
  ) {
    this.canvas = canvas;
    this.headless = Boolean(options?.headless || !canvas);
    this.screenToWorldOverride = options?.screenToWorldOverride;
    if (canvas && !this.headless) {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas2D unsupported');
      this.ctx = context;
    } else {
      this.ctx = null;
    }
    this.callbacks = callbacks;
    this.skillProgress = initialSkillProgress;
    this.stats = aggregateGearStats(this.equipment, this.activeAspects, this.pLevel);
    this.domain = generateDomainLayout(1, false, []);

    this.particles = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#F97316',
      layer: 'core',
    }));

    this.decals = Array.from({ length: DECAL_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 20,
      life: 0,
      maxLife: 1,
      color: '#F97316',
      kind: 'burn',
    }));

    this.floatingTexts = Array.from({ length: FLOATING_TEXT_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -30,
      text: '',
      color: '#F8FAFC',
      isCrit: false,
      life: 0,
      maxLife: 0.7,
    }));

    this.critStreaks = Array.from({ length: CRIT_STREAK_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      width: 90,
      color: '#D99B38',
      life: 0,
      maxLife: 0.22,
      chromatic: false,
    }));

    this.bindEvents();
    if (!this.headless) {
      this.resizeCanvas();
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (this.phase !== 'playing') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }
    const firstPress = !this.keys.has(code);
    this.keys.add(code);
    if (!firstPress) return;

    if (code === 'Digit1') this.tryCastSlot(0);
    else if (code === 'Digit2') this.tryCastSlot(1);
    else if (code === 'Digit3') this.tryCastSlot(2);
    else if (code === 'Digit4') this.tryCastSlot(3);
    else if (code === 'Space') this.tryCastSlot(4);
    else if (code === 'KeyQ') this.useFlask();
    else if (code === 'KeyF') this.tryEnterPortalOrPickup();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent) => {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
    this.pointerInitialized = true;
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.handleExternalPointerDown(e.clientX, e.clientY, e.button);
  };

  private handleContextMenu = (e: MouseEvent) => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  public handleExternalPointerDown(clientX: number, clientY: number, button = 0) {
    if (this.phase !== 'playing') return;
    this.mouseScreenX = clientX;
    this.mouseScreenY = clientY;
    this.pointerInitialized = true;

    const world = this.screenToWorld(clientX, clientY);
    const room = this.domain.rooms[this.currentRoomIdx];

    // RMB: Cast Primary Skill (Slot 0) directly at cursor (Diablo / PoE signature skill)
    if (button === 2) {
      this.rightMouseDown = true;
      this.moveTargetActive = false;
      this.targetEnemyId = null;
      this.targetLootId = null;
      this.targetPortal = false;
      this.pAimAngle = Math.atan2(world.y - this.py, world.x - this.px);
      this.tryCastSlot(0);
      return;
    }

    if (button !== 0) return;
    this.leftMouseDown = true;

    // Shift + LMB: Force Stand-Still Attack toward cursor
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      this.moveTargetActive = false;
      this.targetEnemyId = null;
      this.targetLootId = null;
      this.targetPortal = false;
      this.pAimAngle = Math.atan2(world.y - this.py, world.x - this.px);
      this.tryCastSlot(0);
      return;
    }

    // 1. Click Ground Loot: collect immediately if close, else run to it
    for (let i = 0; i < this.groundLoot.length; i++) {
      const g = this.groundLoot[i];
      if (Math.hypot(g.x - world.x, g.y - world.y) < 46) {
        if (Math.hypot(g.x - this.px, g.y - this.py) < 82) {
          this.collectLoot(i);
          this.moveTargetActive = false;
        } else {
          this.targetLootId = g.id;
          this.targetEnemyId = null;
          this.targetPortal = false;
          this.moveTargetX = g.x;
          this.moveTargetY = g.y;
          this.moveTargetKind = 'interact';
          this.moveTargetActive = true;
        }
        return;
      }
    }

    // 2. Click Active Portal: enter if close, else run to portal
    if (
      !this.inSanctuary &&
      room.cleared &&
      this.currentRoomIdx < this.domain.rooms.length - 1 &&
      Math.hypot(world.x - room.portalX, world.y - room.portalY) < 76
    ) {
      if (Math.hypot(this.px - room.portalX, this.py - room.portalY) < 92) {
        this.enterRoom(this.currentRoomIdx + 1);
        soundEngine.playDash();
        this.moveTargetActive = false;
      } else {
        this.targetPortal = true;
        this.targetLootId = null;
        this.targetEnemyId = null;
        this.moveTargetX = room.portalX;
        this.moveTargetY = room.portalY;
        this.moveTargetKind = 'interact';
        this.moveTargetActive = true;
      }
      return;
    }

    // 3. Click Enemy: attack-move / chase into skill reach & strike
    let clickedEnemy: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (e.koTimer > 0) continue;
      const d = Math.hypot(e.x - world.x, e.y - world.y);
      if (d <= e.radius + 30 && d < bestDist) {
        bestDist = d;
        clickedEnemy = e;
      }
    }
    if (clickedEnemy) {
      this.targetEnemyId = clickedEnemy.id;
      this.targetLootId = null;
      this.targetPortal = false;
      const skill = SKILLS[this.hotbar[0]];
      const reach =
        skill.category === 'melee'
          ? Math.max(96, skill.range * 0.88)
          : Math.max(280, skill.range * 0.78);
      if (Math.hypot(clickedEnemy.x - this.px, clickedEnemy.y - this.py) <= reach + clickedEnemy.radius) {
        this.moveTargetActive = false;
        this.pAimAngle = Math.atan2(clickedEnemy.y - this.py, clickedEnemy.x - this.px);
        this.tryCastSlot(0);
      } else {
        this.moveTargetX = clickedEnemy.x;
        this.moveTargetY = clickedEnemy.y;
        this.moveTargetKind = 'attack';
        this.moveTargetActive = true;
      }
      return;
    }

    // 4. Click Open Ground: set click-to-move waypoint
    this.targetEnemyId = null;
    this.targetLootId = null;
    this.targetPortal = false;
    this.moveTargetX = Math.max(36, Math.min(room.width - 36, world.x));
    this.moveTargetY = Math.max(36, Math.min(room.height - 36, world.y));
    this.moveTargetKind = 'move';
    this.moveTargetActive = true;
    this.stuckMoveTimer = 0;
  }

  public handleExternalPointerUp(button = 0) {
    if (button === 0) this.leftMouseDown = false;
    else if (button === 2) this.rightMouseDown = false;
  }

  public setExternalPointerMove(clientX: number, clientY: number) {
    this.mouseScreenX = clientX;
    this.mouseScreenY = clientY;
    this.pointerInitialized = true;
  }

  private handleMouseUp = (e: MouseEvent) => {
    this.handleExternalPointerUp(e.button);
  };

  private handleBlur = () => {
    this.keys.clear();
    this.leftMouseDown = false;
    this.rightMouseDown = false;
  };

  private handleVisibility = () => {
    if (document.hidden) {
      this.keys.clear();
      this.leftMouseDown = false;
      this.rightMouseDown = false;
    }
  };

  private resizeObserver: ResizeObserver | null = null;

  private resizeCanvas = () => {
    if (!this.canvas || !this.ctx) return;
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(320, Math.floor(w * dpr));
    this.canvas.height = Math.max(240, Math.floor(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.needsStaticRedraw = true;
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    if (this.canvas && !this.headless) {
      this.canvas.addEventListener('mousedown', this.handleMouseDown);
      this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    }
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
    if (typeof ResizeObserver !== 'undefined' && this.canvas?.parentElement && !this.headless) {
      this.resizeObserver = new ResizeObserver(this.resizeCanvas);
      this.resizeObserver.observe(this.canvas.parentElement);
    }
    if (!this.headless) {
      window.addEventListener('resize', this.resizeCanvas);
    }
  }

  public destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas?.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas?.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('resize', this.resizeCanvas);
    this.resizeObserver?.disconnect();
  }

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    if (this.screenToWorldOverride) {
      return this.screenToWorldOverride(clientX, clientY);
    }
    if (!this.canvas) return { x: this.px, y: this.py };
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: sx + this.camX - rect.width / 2,
      y: sy + this.camY - rect.height / 2,
    };
  }

  public stepSimulation(dt: number) {
    this.update(dt);
  }

  public startLoop() {
    if (this.headless || this.rafId !== null) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt);
      if (this.phase === 'playing' || this.needsStaticRedraw) {
        this.render();
        if (this.phase !== 'playing') {
          this.needsStaticRedraw = false;
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public setAccessibility(opts: {
    highContrastTelegraphs?: boolean;
    hitstopEnabled?: boolean;
    screenShakeEnabled?: boolean;
  }) {
    if (opts.highContrastTelegraphs !== undefined) {
      this.highContrastTelegraphs = opts.highContrastTelegraphs;
    }
    if (opts.hitstopEnabled !== undefined) {
      this.hitstopEnabled = opts.hitstopEnabled;
      if (!this.hitstopEnabled) this.hitstopTimer = 0;
    }
    if (opts.screenShakeEnabled !== undefined) {
      this.screenShakeEnabled = opts.screenShakeEnabled;
      if (!this.screenShakeEnabled) this.trauma = 0;
    }
    this.needsStaticRedraw = true;
  }

  public setPhase(nextPhase: GamePhase) {
    this.phase = nextPhase;
    this.needsStaticRedraw = true;
    if (nextPhase !== 'playing') {
      this.keys.clear();
      this.leftMouseDown = false;
      this.rightMouseDown = false;
      this.moveTargetActive = false;
      this.targetEnemyId = null;
      this.targetLootId = null;
      this.targetPortal = false;
      this.bufferedSlot = null;
      this.bufferedTimer = 0;
    }
    this.emitHudSnapshot();
  }

  public syncBuild(
    hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId],
    activeAspects: AspectId[],
    equipment: Partial<Record<EquipSlot, GearItem>>,
    skillProgress: Record<SkillId, SkillProgress>,
    shards: number
  ) {
    this.hotbar = [...hotbar];
    this.activeAspects = [...activeAspects];
    this.equipment = { ...equipment };
    this.skillProgress = skillProgress;
    this.pShards = shards;
    this.recomputeStats(false);
    this.emitHudSnapshot();
  }

  private recomputeStats(healToFull = false) {
    this.stats = aggregateGearStats(
      this.equipment,
      this.activeAspects,
      this.pLevel,
      this.critMomentumTimer > 0,
      this.barrierTimer > 0
    );
    if (healToFull) {
      this.pHp = this.stats.maxLife;
      this.pGhostHp = this.stats.maxLife;
      this.pMp = this.stats.maxMana;
      this.pEs = this.stats.maxEnergyShield;
    } else {
      this.pHp = Math.min(this.pHp, this.stats.maxLife);
      this.pMp = Math.min(this.pMp, this.stats.maxMana);
      this.pEs = Math.min(this.pEs, this.stats.maxEnergyShield);
    }
  }

  public startNewRun(
    tier: number,
    corrupted: boolean,
    modifiers: DomainModifier[],
    resetProgression = false
  ) {
    this.inSanctuary = false;
    if (resetProgression) {
      this.pLevel = 1;
      this.pXp = 0;
      this.pXpToNext = 120;
      this.kills = 0;
      this.elapsedSeconds = 0;
      this.damageTakenTotal = 0;
    }
    this.outcome = null;
    this.pendingSkillUpgrade = null;
    this.bufferedSlot = null;
    this.bufferedTimer = 0;
    this.pScaleX = 1;
    this.pScaleY = 1;
    this.domain = generateDomainLayout(tier, corrupted, modifiers);
    this.recomputeStats(true);
    this.pFlaskCharges = this.pMaxFlaskCharges;
    this.pCooldowns = [0, 0, 0, 0, 0];
    this.shadeEmpowered = false;
    this.eclipseReady = this.activeAspects.includes('eclipse');
    this.eclipseTimer = 8;
    this.critMomentumTimer = 0;
    this.barrierTimer = 0;
    this.enterRoom(0);
    this.setPhase('playing');
  }

  public startSanctuary() {
    this.inSanctuary = true;
    this.outcome = null;
    this.pendingSkillUpgrade = null;
    this.bufferedSlot = null;
    this.bufferedTimer = 0;
    this.pScaleX = 1;
    this.pScaleY = 1;
    this.recentDamageDealt = 0;
    this.dpsEstimate = 0;
    this.dpsTimer = 0;
    this.sanctuaryPulseTimer = 2.6;
    this.sanctuaryTelemetry = {
      peakHit: 0,
      hitCount: 0,
      critCount: 0,
      lastHitSkill: '',
      lastHitIsCrit: false,
      lastHitBreakdown: null,
    };

    this.domain = {
      tier: 1,
      corrupted: false,
      modifiers: [],
      connections: [],
      rooms: [
        {
          index: 0,
          name: 'Sanctuary Practice Arena',
          width: 1380,
          height: 940,
          spawnX: 450,
          spawnY: 470,
          portalX: 1290,
          portalY: 470,
          isBossRoom: false,
          cleared: true,
          obstacles: [
            { x: 180, y: 150, w: 68, h: 68 },
            { x: 1130, y: 150, w: 68, h: 68 },
            { x: 180, y: 720, w: 68, h: 68 },
            { x: 1130, y: 720, w: 68, h: 68 },
          ],
          enemySpawns: [],
        },
      ],
    };

    this.recomputeStats(true);
    this.pFlaskCharges = this.pMaxFlaskCharges;
    this.pCooldowns = [0, 0, 0, 0, 0];
    this.shadeEmpowered = false;
    this.eclipseReady = this.activeAspects.includes('eclipse');
    this.eclipseTimer = 8;
    this.critMomentumTimer = 0;
    this.barrierTimer = 0;

    this.enterRoom(0);
    this.pAimAngle = 0;
    this.enemies = [
      {
        id: this.nextEnemyId++,
        archetype: 'thrall',
        name: 'Ash Training Dummy',
        x: 680,
        y: 395,
        vx: 0,
        vy: 0,
        radius: 26,
        hp: 50000,
        maxHp: 50000,
        speed: 0,
        damage: 0,
        armour: 0,
        resistPct: 0,
        statusResistPct: 0,
        isElite: false,
        hitFlash: 0,
        koTimer: 0,
        chillTimer: 0,
        chillStrength: 0,
        shockTimer: 0,
        burnTimer: 0,
        burnDps: 0,
        witheredTimer: 0,
        stunTimer: 0,
        state: 'idle',
        stateTimer: 1,
        windupDuration: 1,
        attackCooldown: 99,
        aimAngle: Math.PI,
        orbitDir: 1,
        bossAttackIndex: 0,
        scaleX: 1,
        scaleY: 1,
        isDummy: true,
      },
      {
        id: this.nextEnemyId++,
        archetype: 'charger',
        name: 'Armored Ward Dummy',
        x: 680,
        y: 545,
        vx: 0,
        vy: 0,
        radius: 28,
        hp: 50000,
        maxHp: 50000,
        speed: 0,
        damage: 0,
        armour: this.sanctuaryConfig.dummyArmour,
        resistPct: this.sanctuaryConfig.dummyResistPct,
        statusResistPct: 0,
        isElite: true,
        hitFlash: 0,
        koTimer: 0,
        chillTimer: 0,
        chillStrength: 0,
        shockTimer: 0,
        burnTimer: 0,
        burnDps: 0,
        witheredTimer: 0,
        stunTimer: 0,
        state: 'idle',
        stateTimer: 1,
        windupDuration: 1,
        attackCooldown: 99,
        aimAngle: Math.PI,
        orbitDir: 1,
        bossAttackIndex: 0,
        scaleX: 1,
        scaleY: 1,
        isDummy: true,
      },
    ];
    this.setPhase('playing');
  }

  public setSanctuaryConfig(partial: Partial<SanctuaryConfig>) {
    this.sanctuaryConfig = { ...this.sanctuaryConfig, ...partial };
    if (this.inSanctuary) {
      for (const e of this.enemies) {
        if (e.isDummy && e.isElite) {
          e.armour = this.sanctuaryConfig.dummyArmour;
          e.resistPct = this.sanctuaryConfig.dummyResistPct;
        }
      }
      this.needsStaticRedraw = true;
    }
    this.emitHudSnapshot();
  }

  public resetSanctuaryTelemetry(emit = true) {
    this.sanctuaryTelemetry = {
      peakHit: 0,
      hitCount: 0,
      critCount: 0,
      lastHitSkill: '',
      lastHitIsCrit: false,
      lastHitBreakdown: null,
    };
    this.recentDamageDealt = 0;
    this.dpsEstimate = 0;
    this.dpsTimer = 0;
    for (const e of this.enemies) {
      if (e.isDummy) {
        e.hp = e.maxHp;
      }
    }
    if (this.inSanctuary) {
      this.recomputeStats(true);
    }
    if (emit) this.emitHudSnapshot();
  }

  public enterRoom(roomIndex: number) {
    this.currentRoomIdx = roomIndex;
    const room = this.domain.rooms[roomIndex];
    this.px = room.spawnX;
    this.py = room.spawnY;
    this.camX = this.px;
    this.camY = this.py;
    this.pvx = 0;
    this.pvy = 0;
    this.projectiles = [];
    this.groundLoot = [];
    this.slashEffects = [];
    this.lightningEffects = [];
    this.twinSpinTimer = 0;
    this.twinSpinParams = null;
    this.seismicDelayTimer = 0;
    this.seismicDelayParams = null;
    this.eclipseCleaveTimer = 0;
    this.eclipseCleaveParams = null;
    this.doubleEruptionTimer = 0;
    this.doubleEruptionParams = null;
    this.decals.forEach((d) => (d.active = false));
    this.enemies = [];

    if (!room.cleared) {
      const tier = this.domain.tier;
      const modLife = this.domain.modifiers.reduce((acc, m) => acc * m.enemyLifeMult, 1) * (this.domain.corrupted ? 1.25 : 1);
      const modDmg = this.domain.modifiers.reduce((acc, m) => acc * m.enemyDamageMult, 1) * (this.domain.corrupted ? 1.2 : 1);
      const modSpeed = this.domain.modifiers.reduce((acc, m) => acc * m.enemySpeedMult, 1);

      for (const sp of room.enemySpawns) {
        const tierLifeScale = 1 + (tier - 1) * 0.42;
        const tierDmgScale = 1 + (tier - 1) * 0.22;
        const eliteMult = sp.isElite ? 1.85 : 1;
        const isBoss = sp.archetype === 'boss';

        const baseHp = isBoss
          ? 760
          : sp.archetype === 'charger'
            ? 145
            : sp.archetype === 'cultist'
              ? 88
              : sp.archetype === 'stalker'
                ? 105
                : 98;
        const baseDmg = isBoss
          ? 34
          : sp.archetype === 'charger'
            ? 24
            : sp.archetype === 'cultist'
              ? 18
              : 15;
        const baseSpeed = isBoss
          ? 128
          : sp.archetype === 'stalker'
            ? 175
            : sp.archetype === 'charger'
              ? 110
              : sp.archetype === 'cultist'
                ? 112
                : 142;

        const maxHp = Math.round(baseHp * tierLifeScale * modLife * (isBoss ? 1 : eliteMult));
        this.enemies.push({
          id: this.nextEnemyId++,
          archetype: sp.archetype,
          name: isBoss
            ? room.name
            : sp.isElite
              ? `Ashen ${sp.archetype[0].toUpperCase()}${sp.archetype.slice(1)}`
              : sp.archetype,
          x: sp.x,
          y: sp.y,
          vx: 0,
          vy: 0,
          radius: isBoss ? 34 : sp.archetype === 'charger' ? 23 : sp.isElite ? 22 : 17,
          hp: maxHp,
          maxHp,
          speed: baseSpeed * modSpeed,
          damage: Math.round(baseDmg * tierDmgScale * modDmg * (sp.isElite && !isBoss ? 1.25 : 1)),
          armour: isBoss ? 80 + tier * 15 : sp.archetype === 'charger' ? 45 + tier * 8 : 15 + tier * 4,
          resistPct: Math.min(50, tier * 2),
          statusResistPct: isBoss ? 65 : sp.isElite ? 30 : Math.min(15, tier * 1.5),
          isElite: sp.isElite,
          hitFlash: 0,
          koTimer: 0,
          chillTimer: 0,
          chillStrength: 0,
          shockTimer: 0,
          burnTimer: 0,
          burnDps: 0,
          witheredTimer: 0,
          stunTimer: 0,
          state: 'idle',
          stateTimer: 0.3 + Math.random() * 0.6,
          windupDuration: 0.5,
          attackCooldown: 0.7 + Math.random() * 0.6,
          aimAngle: Math.PI,
          orbitDir: Math.random() < 0.5 ? 1 : -1,
          bossAttackIndex: 0,
          bossPhase: isBoss ? 1 : undefined,
          scaleX: 1,
          scaleY: 1,
        });
      }

      if (this.domain.modifiers.some((m) => m.burningGround)) {
        for (let b = 0; b < 5; b++) {
          this.spawnDecal(
            420 + b * 175,
            240 + ((b * 180) % (room.height - 420)),
            64,
            999,
            '#F97316',
            'burn',
            10 + tier * 3
          );
        }
      }
      if (this.domain.modifiers.some((m) => m.chillingGround)) {
        for (let c = 0; c < 4; c++) {
          this.spawnDecal(
            480 + c * 195,
            210 + ((c * 210) % (room.height - 380)),
            72,
            999,
            '#22D3EE',
            'frost',
            1
          );
        }
      }
    }

    this.emitHudSnapshot();
  }

  public resolveSkillUpgrade(skillId: SkillId, tier: UpgradeTier, branch: 'A' | 'B' | 'C') {
    this.skillProgress[skillId].choices[tier] = branch;
    this.pendingSkillUpgrade = null;
    this.callbacks.onSkillProgressChanged({ ...this.skillProgress });
    this.setPhase('playing');
  }

  public useFlask() {
    if (this.phase !== 'playing') return;
    if (this.pFlaskCharges <= 0) return;
    if (this.pHp >= this.stats.maxLife && this.pMp >= this.stats.maxMana) return;
    this.pFlaskCharges--;
    const heal = Math.round(this.stats.maxLife * 0.42 * this.stats.flaskRecoveryMult);
    const manaRestore = Math.round(this.stats.maxMana * 0.35 * this.stats.flaskRecoveryMult);
    this.pHp = Math.min(this.stats.maxLife, this.pHp + heal);
    this.pMp = Math.min(this.stats.maxMana, this.pMp + manaRestore);
    this.spawnFloatingText(this.px, this.py - 28, `+${heal}`, '#10B981', false);
    this.burstParticles(this.px, this.py, '#10B981', 12, 'mid');
    soundEngine.playDash();
    this.emitHudSnapshot();
  }

  private tryEnterPortalOrPickup() {
    if (this.groundLoot.length > 0) {
      for (let i = this.groundLoot.length - 1; i >= 0; i--) {
        const g = this.groundLoot[i];
        if (Math.hypot(g.x - this.px, g.y - this.py) < 120) {
          this.collectLoot(i);
          return;
        }
      }
    }
    const room = this.domain.rooms[this.currentRoomIdx];
    if (room.cleared && Math.hypot(this.px - room.portalX, this.py - room.portalY) < 95) {
      if (this.currentRoomIdx < this.domain.rooms.length - 1) {
        this.enterRoom(this.currentRoomIdx + 1);
        soundEngine.playDash();
      }
    }
  }

  private collectLoot(index: number) {
    const drop = this.groundLoot[index];
    if (!drop) return;
    this.groundLoot.splice(index, 1);
    this.callbacks.onLootCollected(drop.item);
    this.recentLootToast = { name: drop.item.name, rarity: drop.item.rarity };
    this.lootToastTimer = 2.6;
    soundEngine.playLootChime(drop.item.rarity === 'legendary');
    this.emitHudSnapshot();
  }

  public tryCastSlot(slotIdx: number) {
    if (this.phase !== 'playing') return;
    if (this.pCooldowns[slotIdx] > 0) {
      // 0.12s Skill Input Buffer
      this.bufferedSlot = slotIdx;
      this.bufferedTimer = 0.12;
      this.emitHudSnapshot();
      return;
    }
    if (this.bufferedSlot === slotIdx) {
      this.bufferedSlot = null;
      this.bufferedTimer = 0;
    }

    const skillId = this.hotbar[slotIdx];
    const skill = SKILLS[skillId];
    const prog = this.skillProgress[skillId];
    // Aim toward cursor when casting any skill & pause walk waypoint for non-movement casts
    if (this.pointerInitialized && this.targetEnemyId === null) {
      const world = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
      this.pAimAngle = Math.atan2(world.y - this.py, world.x - this.px);
    }
    if (skill.category !== 'movement') {
      this.moveTargetActive = false;
    } else {
      this.moveTargetActive = false;
      this.targetEnemyId = null;
      this.targetLootId = null;
      this.targetPortal = false;
    }

    // Resource cost calculation
    let cost = Math.round(skill.manaCost * this.stats.manaCostMult);
    if (skill.id === 'ashen_nova' && prog.choices[5] === 'C') cost = Math.round(cost * 0.7);
    const isEclipseEmpowered =
      this.activeAspects.includes('eclipse') && this.eclipseReady && skill.category !== 'defensive';
    if (isEclipseEmpowered) cost *= 2;

    const usesLife = this.stats.lifeCostsSkills && skill.category !== 'defensive';
    if (usesLife) {
      if (this.pHp <= cost + 8) return; // Never suicide on cast
      this.pHp -= cost;
    } else {
      if (this.pMp < cost) return;
      this.pMp -= cost;
    }

    // Cooldown calculation
    let cd = (skill.cooldown * this.stats.cooldownRecoveryMult) / this.stats.actionSpeedMult;
    if (skill.tags.includes('area') && this.activeAspects.includes('earthquake')) {
      cd *= 1.15;
    }
    if (skill.category === 'movement' && this.activeAspects.includes('shade')) {
      cd *= 1.1;
    }
    if (skill.id === 'cinder_slash' && prog.choices[5] === 'C') cd *= 0.8;
    if (skill.id === 'ember_bolt' && prog.choices[10] === 'C') cd *= 0.82;
    if (skill.id === 'ashen_nova' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'shadow_step' && prog.choices[15] === 'A') cd *= 0.75;
    if (skill.id === 'storm_spike' && prog.choices[15] === 'C') cd *= 0.75;
    if (skill.id === 'seismic_slam' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'void_tendrils' && prog.choices[15] === 'A') cd *= 0.7;
    if (skill.id === 'radiant_barrier' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'crimson_whirlwind' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'arcane_orb' && prog.choices[15] === 'C') cd *= 0.75;
    if (skill.id === 'glacial_cascade' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'rift_blade' && prog.choices[15] === 'C') cd *= 0.75;
    if (skill.id === 'soul_harvest' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'meteor_brand' && prog.choices[10] === 'C') cd *= 0.78;
    if (skill.id === 'tempest_nova' && prog.choices[10] === 'C') cd *= 0.8;
    if (skill.id === 'bulwark_charge' && prog.choices[10] === 'C') cd *= 0.75;

    this.pCooldowns[slotIdx] = cd;
    this.pMaxCooldowns[slotIdx] = cd;

    // Consume Empower / Shade buffs
    const useShade = this.shadeEmpowered && skill.category !== 'movement';
    if (useShade) {
      this.shadeEmpowered = false;
      this.shadeTimer = 0;
    }
    if (isEclipseEmpowered) {
      this.eclipseReady = false;
      this.eclipseTimer = this.stats.activeMarks.includes('eclipse_core') ? 6 : 8;
    }

    this.executeSkill(skillId, useShade, isEclipseEmpowered, false);

    // Overload / Repeating Echoes check
    const repeatRoll =
      this.stats.repeatChance + (skill.tags.includes('area') ? this.stats.areaRepeatChance : 0);
    if (skill.category !== 'movement' && skill.category !== 'defensive' && Math.random() < repeatRoll) {
      if (this.activeAspects.includes('overload')) {
        const extraCost = Math.round(cost * 0.5);
        if (usesLife) this.pHp = Math.max(10, this.pHp - extraCost);
        else this.pMp = Math.max(0, this.pMp - extraCost);
      }
      this.executeSkill(skillId, useShade, isEclipseEmpowered, true);
    }

    // Grant Skill XP on use
    this.grantSkillXp(skillId, 16);
    this.emitHudSnapshot();
  }

  private grantSkillXp(skillId: SkillId, amount: number) {
    const p = this.skillProgress[skillId];
    if (p.level >= 20) return;
    p.xp += amount;
    const needed = 60 + p.level * 28;
    if (p.xp >= needed) {
      p.xp -= needed;
      p.level += 1;
      this.callbacks.onSkillProgressChanged({ ...this.skillProgress });
      this.spawnFloatingText(this.px, this.py - 40, `${SKILLS[skillId].name} Lv ${p.level}!`, '#D99B38', true);
      if ((p.level === 5 || p.level === 10 || p.level === 15) && !p.choices[p.level]) {
        this.pendingSkillUpgrade = { skillId, tier: p.level };
        this.setPhase('paused');
      }
    }
  }

  private executeSkill(
    skillId: SkillId,
    isShadeEmpowered: boolean,
    isEclipseEmpowered: boolean,
    isRepeat: boolean
  ) {
    const skill = SKILLS[skillId];
    const prog = this.skillProgress[skillId];
    const angle = this.pAimAngle + (isRepeat ? (Math.random() - 0.5) * 0.25 : 0);
    const color = DAMAGE_COLORS[skill.damageType];
    soundEngine.playSwing(skill.damageType);

    if (skillId === 'shadow_step') {
      const dist = prog.choices[5] === 'A' ? skill.range * 1.35 : skill.range;
      const room = this.domain.rooms[this.currentRoomIdx];
      const oldX = this.px;
      const oldY = this.py;

      // Spawn Shade afterimages along path
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        this.afterImages.push({
          x: oldX + Math.cos(angle) * dist * t,
          y: oldY + Math.sin(angle) * dist * t,
          life: 0.35 - i * 0.05,
          color: this.activeAspects.includes('shade') ? '#A855F7' : '#94A3B8',
        });
      }

      const targetX = Math.max(40, Math.min(room.width - 40, this.px + Math.cos(angle) * dist));
      const targetY = Math.max(40, Math.min(room.height - 40, this.py + Math.sin(angle) * dist));
      this.px = targetX;
      this.py = targetY;
      this.resolvePlayerObstacles();
      this.pInvulnTimer = Math.max(this.pInvulnTimer, prog.choices[10] === 'A' ? 0.35 : 0.22);

      if (this.activeAspects.includes('shade')) {
        this.shadeEmpowered = true;
        this.shadeTimer = this.stats.activeLegendaries.includes('veilwalkers_step') ? 6 : 4;
      }
      if (prog.choices[10] === 'C') this.fleetfootTimer = 2.0;
      if (prog.choices[15] === 'C') this.pMp = Math.min(this.stats.maxMana, this.pMp + 10);

      // Flowing Shadow Mark: reset lowest cooldown skill
      if (this.stats.activeMarks.includes('flowing_shadow')) {
        let minIdx = -1;
        let minVal = 999;
        for (let i = 0; i < 4; i++) {
          if (this.pCooldowns[i] > 0 && this.pCooldowns[i] < minVal) {
            minVal = this.pCooldowns[i];
            minIdx = i;
          }
        }
        if (minIdx >= 0) this.pCooldowns[minIdx] = 0;
      }

      // Arrival blade or decoy
      if (prog.choices[5] === 'B' || prog.choices[5] === 'C') {
        const burstX = prog.choices[5] === 'C' ? oldX : this.px;
        const burstY = prog.choices[5] === 'C' ? oldY : this.py;
        this.damageEnemiesInRadius(burstX, burstY, skill.radius, skillId, isShadeEmpowered, isEclipseEmpowered, prog.choices[15] === 'B');
        this.burstParticles(burstX, burstY, '#A855F7', 16, 'mid');
      }
      this.pScaleX = 0.76;
      this.pScaleY = 1.26;
      soundEngine.playDash();
      this.burstParticles(this.px, this.py, '#CBD5E1', 10, 'core');
      return;
    }

    if (skillId === 'radiant_barrier') {
      const dur = prog.choices[10] === 'A' ? 5.0 : 3.5;
      this.barrierTimer = dur;
      const bonusShield = Math.round((45 + prog.level * 10) * (prog.choices[5] === 'A' ? 1.45 : 1));
      this.pEs = Math.min(this.stats.maxEnergyShield + bonusShield, this.pEs + bonusShield);
      if (prog.choices[15] === 'C') {
        this.pEs = Math.min(this.stats.maxEnergyShield, this.pEs + Math.round(this.stats.maxEnergyShield * 0.35));
      }
      this.burstParticles(this.px, this.py, '#38BDF8', 22, 'outer');
      // Blinding Ward (Lv10 B) — slow nearby attackers
      if (prog.choices[10] === 'B') {
        for (const e of this.enemies) {
          if (e.koTimer > 0) continue;
          if (Math.hypot(e.x - this.px, e.y - this.py) <= 160) {
            this.applyStatus(e, 'chill', 2.0, 0.3);
          }
        }
      }
      this.recomputeStats(false);
      return;
    }

    if (skillId === 'cinder_slash') {
      if (prog.choices[10] === 'C') {
        this.px += Math.cos(angle) * 26;
        this.py += Math.sin(angle) * 26;
        this.resolvePlayerObstacles();
      }
      const arc = (prog.choices[5] === 'B' ? 2.45 : 1.85);
      const radius = skill.radius * this.stats.areaMult;
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle,
        arc,
        radius,
        color: isEclipseEmpowered ? '#D99B38' : color,
        life: 0.22,
        maxLife: 0.22,
      });

      // Weapon ribbon trail points
      for (let i = -3; i <= 3; i++) {
        const a = angle + (i / 3) * (arc * 0.48);
        this.weaponTrail.push({
          x: this.px + Math.cos(a) * radius * 0.85,
          y: this.py + Math.sin(a) * radius * 0.85,
          life: 0.18,
          color,
        });
      }

      for (const enemy of this.enemies) {
        if (enemy.koTimer > 0) continue;
        const dx = enemy.x - this.px;
        const dy = enemy.y - this.py;
        const dist = Math.hypot(dx, dy);
        if (dist <= radius + enemy.radius) {
          let diff = Math.atan2(dy, dx) - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) <= arc * 0.58 || dist < 42) {
            this.applyHitToEnemy(enemy, skillId, isShadeEmpowered, isEclipseEmpowered, false, Math.cos(angle) * 140, Math.sin(angle) * 140);
            if (prog.choices[5] === 'A' || prog.choices[10] === 'B') {
              // Skill-level scaled burn (improved)
              const scaledBurn = Math.round((12 + prog.level * 3.5) * this.stats.burnMagnitudeMult);
              enemy.burnTimer = 2.5;
              enemy.burnDps = Math.max(enemy.burnDps, scaledBurn);
            }
          }
        }
      }
      // Eclipse Cleave (Lv15 B) — delayed second slash
      if (prog.choices[15] === 'B') {
        this.eclipseCleaveTimer = 0.2;
        this.eclipseCleaveParams = {
          x: this.px,
          y: this.py,
          angle: angle + Math.PI * 0.4,
          arc,
          radius: radius * 1.05,
          isShadeEmpowered,
          isEclipseEmpowered,
        };
      }
      this.pScaleX = 1.18;
      this.pScaleY = 0.84;
      this.burstDamageVfx(
        this.px + Math.cos(angle) * 55,
        this.py + Math.sin(angle) * 55,
        'fire',
        0.9
      );
      return;
    }

    if (skillId === 'ashen_nova') {
      const radius = skill.radius * (prog.choices[5] === 'A' ? 1.3 : 1) * this.stats.areaMult;
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle: 0,
        arc: Math.PI * 2,
        radius,
        color: isEclipseEmpowered ? '#D99B38' : color,
        life: 0.3,
        maxLife: 0.3,
      });
      this.damageEnemiesInRadius(this.px, this.py, radius, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      if (prog.choices[10] === 'B') {
        this.spawnDecal(this.px, this.py, radius * 0.75, 3.0, '#F97316', 'burn', 16 + prog.level * 4);
      } else {
        this.spawnDecal(this.px, this.py, radius * 0.65, 2.2, '#F97316', 'crack');
      }
      this.pScaleX = 1.22;
      this.pScaleY = 0.80;
      this.burstDamageVfx(this.px, this.py, 'fire', 1.35);
      this.addTrauma(0.28);
      // Double Eruption (Lv15 B) — delayed second nova
      if (prog.choices[15] === 'B') {
        this.doubleEruptionTimer = 0.3;
        this.doubleEruptionParams = {
          x: this.px,
          y: this.py,
          radius: radius * 0.72,
          isShadeEmpowered,
          isEclipseEmpowered,
        };
      }
      return;
    }

    if (skillId === 'seismic_slam') {
      const slamX = this.px + Math.cos(angle) * 62;
      const slamY = this.py + Math.sin(angle) * 62;
      const radius = skill.radius * (prog.choices[5] === 'A' ? 1.3 : 1) * this.stats.areaMult;
      this.slashEffects.push({
        x: slamX,
        y: slamY,
        angle: 0,
        arc: Math.PI * 2,
        radius,
        color: '#E2E8F0',
        life: 0.28,
        maxLife: 0.28,
      });
      this.spawnDecal(slamX, slamY, radius * 0.75, 3.5, '#94A3B8', 'crack');
      const hits = this.damageEnemiesInRadius(slamX, slamY, radius, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      for (const e of hits) {
        if (prog.choices[5] === 'B') this.applyStatus(e, 'stun', 0.85);
        if (prog.choices[10] === 'B') e.armour = Math.max(0, Math.round(e.armour * 0.8));
      }
      this.pScaleX = 1.24;
      this.pScaleY = 0.78;
      this.burstParticles(slamX, slamY, '#E2E8F0', 22, 'spark');
      this.burstDamageVfx(slamX, slamY, 'physical', 1.1);
      this.addTrauma(0.35);

      // Aftershock (Lv5 C) — 60% damage follow-up
      // Double Rupture (Lv15 B) — cascading larger ring
      if (prog.choices[5] === 'C' || prog.choices[15] === 'B') {
        this.seismicDelayTimer = prog.choices[15] === 'B' ? 0.22 : 0.16;
        this.seismicDelayParams = {
          x: slamX,
          y: slamY,
          radius: prog.choices[15] === 'B' ? radius * 1.35 : radius * 0.85,
          damageMult: prog.choices[5] === 'C' ? 0.6 : 0.75,
          isShadeEmpowered,
          isEclipseEmpowered,
          isDoubleRupture: prog.choices[15] === 'B',
        };
      }
      return;
    }

    if (skillId === 'ember_bolt' || skillId === 'frost_lance' || skillId === 'bone_spear') {
      const count =
        skillId === 'ember_bolt'
          ? prog.choices[15] === 'C'
            ? 5
            : prog.choices[5] === 'C'
              ? 3
              : 1
          : skillId === 'frost_lance' && prog.choices[15] === 'C'
            ? 2
            : skillId === 'bone_spear' && prog.choices[15] === 'B'
              ? 3
              : 1;

      const spread = 0.16;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spread;
        const a = angle + offset;
        const speed =
          skillId === 'frost_lance'
            ? 640
            : skillId === 'bone_spear'
              ? prog.choices[10] === 'C'
                ? 620
                : 500
              : prog.choices[10] === 'A'
                ? 650
                : 520;
        const pierceLeft =
          skillId === 'frost_lance'
            ? prog.choices[10] === 'C'
              ? 99
              : 3
            : skillId === 'bone_spear'
              ? 99
              : prog.choices[5] === 'A'
                ? 2
                : 0;

        this.projectiles.push({
          active: true,
          fromPlayer: true,
          skillId,
          x: this.px + Math.cos(a) * 20,
          y: this.py + Math.sin(a) * 20,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          radius: skill.radius,
          damageType: skill.damageType,
          damage: 0, // computed per hit
          isCrit: false,
          life: skillId === 'bone_spear' ? 1.4 : 1.0,
          pierceLeft,
          returning: false,
          returnDist: skillId === 'bone_spear' ? 320 : undefined,
          originX: this.px,
          originY: this.py,
          explodeRadius: skillId === 'ember_bolt' && prog.choices[5] === 'B' ? 75 : undefined,
          hitIds: new Set(),
          empowered: isShadeEmpowered || isEclipseEmpowered,
        });
      }
      this.pScaleX = 1.12;
      this.pScaleY = 0.90;
      // Muzzle flash per damage type
      this.burstDamageVfx(
        this.px + Math.cos(angle) * 22,
        this.py + Math.sin(angle) * 22,
        skill.damageType,
        0.7
      );
      return;
    }

    if (skillId === 'storm_spike') {
      const world = this.pointerInitialized
        ? this.screenToWorld(this.mouseScreenX, this.mouseScreenY)
        : { x: this.px + Math.cos(angle) * 240, y: this.py + Math.sin(angle) * 240 };

      // Find nearest enemy to cursor or along aim ray
      let primary: Enemy | null = null;
      let bestDist = 280;
      for (const e of this.enemies) {
        if (e.koTimer > 0) continue;
        const d = Math.hypot(e.x - world.x, e.y - world.y);
        if (d < bestDist) {
          bestDist = d;
          primary = e;
        }
      }
      if (!primary) {
        // Fallback nearest enemy in range
        let minD = skill.range;
        for (const e of this.enemies) {
          if (e.koTimer > 0) continue;
          const d = Math.hypot(e.x - this.px, e.y - this.py);
          if (d < minD) {
            minD = d;
            primary = e;
          }
        }
      }

      const maxChains = 2 + this.stats.extraChains + (prog.choices[5] === 'A' ? 2 : 0) + (prog.choices[15] === 'A' ? 3 : 0);
      const chainJumpRadius = prog.choices[10] === 'A' ? 310 : 220;

      if (!primary) {
        this.lightningEffects.push({
          points: [
            { x: this.px, y: this.py },
            { x: world.x, y: world.y },
          ],
          color,
          life: 0.16,
          maxLife: 0.16,
        });
        this.burstParticles(world.x, world.y, color, 10, 'spark');
        return;
      }

      const hitSet = new Set<number>();
      const points: Array<{ x: number; y: number }> = [{ x: this.px, y: this.py }];
      let curr: Enemy | null = primary;

      for (let c = 0; c <= maxChains && curr; c++) {
        hitSet.add(curr.id);
        points.push({ x: curr.x, y: curr.y });
        this.applyHitToEnemy(curr, skillId, isShadeEmpowered, isEclipseEmpowered, false, 0, 0);
        if (prog.choices[5] === 'C') this.applyStatus(curr, 'shock', 3.0);
        if (prog.choices[10] === 'C' && c === 0) this.applyStatus(curr, 'stun', 0.35);
        this.burstParticles(curr.x, curr.y, color, 9, 'core');

        // Find next unhit enemy
        let nextTarget: Enemy | null = null;
        let nextDist = chainJumpRadius;
        for (const cand of this.enemies) {
          if (cand.koTimer > 0 || hitSet.has(cand.id)) continue;
          const d = Math.hypot(cand.x - curr.x, cand.y - curr.y);
          if (d < nextDist) {
            nextDist = d;
            nextTarget = cand;
          }
        }
        curr = nextTarget;
      }

      this.lightningEffects.push({
        points,
        color: isEclipseEmpowered ? '#D99B38' : color,
        life: 0.18,
        maxLife: 0.18,
      });
      return;
    }

    if (skillId === 'void_tendrils') {
      const world = this.pointerInitialized
        ? this.screenToWorld(this.mouseScreenX, this.mouseScreenY)
        : { x: this.px + Math.cos(angle) * 200, y: this.py + Math.sin(angle) * 200 };
      const dist = Math.min(skill.range, Math.hypot(world.x - this.px, world.y - this.py));
      const tx = this.px + Math.cos(angle) * dist;
      const ty = this.py + Math.sin(angle) * dist;
      const radius = skill.radius * (prog.choices[10] === 'A' ? 1.25 : 1) * this.stats.areaMult;
      const dur = prog.choices[5] === 'A' ? 5.0 : 3.5;

      const calc = calculateSkillDamage({
        skill,
        skillProgress: prog,
        stats: this.stats,
        activeAspects: this.activeAspects,
        isMovementEmpowered: isShadeEmpowered,
        isEclipseEmpowered,
        isDistantTarget: dist > 200,
        isLowLife: this.isPlayerLowLife(),
        isCrit: false,
        enemyResistPct: 0,
        enemyArmour: 0,
      });

      this.spawnDecal(tx, ty, radius, dur, '#A855F7', 'void', calc.finalDamage * 0.9);
      this.burstDamageVfx(tx, ty, 'chaos', 1.2);
      // Extra tendril wisps along the path
      for (let t = 0.25; t <= 1; t += 0.25) {
        this.burstParticles(
          this.px + (tx - this.px) * t,
          this.py + (ty - this.py) * t,
          '#7C3AED',
          4,
          'mid'
        );
      }
      return;
    }

    if (skillId === 'crimson_whirlwind') {
      const radius = skill.radius * (prog.choices[5] === 'B' ? 1.3 : 1) * this.stats.areaMult;
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle,
        arc: Math.PI * 2,
        radius,
        color: isEclipseEmpowered ? '#D99B38' : '#DC2626',
        life: 0.28,
        maxLife: 0.28,
      });
      for (let i = 0; i <= 8; i++) {
        const a = angle + (i / 8) * Math.PI * 2;
        this.weaponTrail.push({
          x: this.px + Math.cos(a) * radius * 0.78,
          y: this.py + Math.sin(a) * radius * 0.78,
          life: 0.2,
          color: '#DC2626',
        });
      }
      const hits = this.damageEnemiesInRadius(this.px, this.py, radius, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      if (prog.choices[5] === 'C' && hits.length > 0) {
        this.pHp = Math.min(this.stats.maxLife, this.pHp + hits.length * 12);
      }
      if (prog.choices[10] === 'B') {
        for (const e of hits) {
          if (!e.isDummy && e.archetype !== 'boss') {
            e.x += (this.px - e.x) * 0.25;
            e.y += (this.py - e.y) * 0.25;
          }
        }
      }
      if (prog.choices[15] === 'C') this.fleetfootTimer = 1.5;

      // Twin Spin (Lv15 B) — schedule a second cleave
      if (prog.choices[15] === 'B') {
        this.twinSpinTimer = 0.18;
        this.twinSpinParams = {
          x: this.px,
          y: this.py,
          radius,
          angle: angle + Math.PI * 0.5, // offset so it feels like a continued spin
          isShadeEmpowered,
          isEclipseEmpowered,
        };
      }

      this.pScaleX = 1.2;
      this.pScaleY = 0.82;
      this.burstParticles(this.px, this.py, '#DC2626', 18, 'spark');
      // Modest impact shake on the first spin
      this.addTrauma(0.18);
      return;
    }

    if (skillId === 'arcane_orb') {
      const count = prog.choices[5] === 'C' ? 2 : 1;
      const spd = prog.choices[10] === 'B' ? 430 : 330;
      const explodeRadius = prog.choices[5] === 'B' ? 120 : 88;
      for (let i = 0; i < count; i++) {
        const a = angle + (count === 2 ? (i === 0 ? -0.14 : 0.14) : 0);
        this.projectiles.push({
          active: true,
          fromPlayer: true,
          skillId,
          x: this.px + Math.cos(a) * 22,
          y: this.py + Math.sin(a) * 22,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          radius: skill.radius,
          damageType: skill.damageType,
          damage: 0,
          isCrit: false,
          life: 1.5,
          pierceLeft: 6,
          originX: this.px,
          originY: this.py,
          explodeRadius,
          hitIds: new Set(),
          empowered: isShadeEmpowered || isEclipseEmpowered,
        });
      }
      this.pScaleX = 1.14;
      this.pScaleY = 0.88;
      this.burstParticles(this.px + Math.cos(angle) * 22, this.py + Math.sin(angle) * 22, color, 12, 'outer');
      return;
    }

    if (skillId === 'glacial_cascade') {
      const steps = prog.choices[15] === 'B' ? 4 : 3;
      const stepDist = prog.choices[5] === 'C' ? 115 : 90;
      const rad = skill.radius * this.stats.areaMult;
      for (let s = 1; s <= steps; s++) {
        const cx = this.px + Math.cos(angle) * (s * stepDist);
        const cy = this.py + Math.sin(angle) * (s * stepDist);
        this.slashEffects.push({
          x: cx,
          y: cy,
          angle: 0,
          arc: Math.PI * 2,
          radius: rad * (0.85 + s * 0.1),
          color,
          life: 0.25 + s * 0.04,
          maxLife: 0.25 + s * 0.04,
        });
        this.damageEnemiesInRadius(cx, cy, rad, skillId, isShadeEmpowered, isEclipseEmpowered, false);
        this.burstParticles(cx, cy, color, 10, 'core');
      }
      if (prog.choices[10] === 'B') {
        this.spawnDecal(this.px + Math.cos(angle) * 180, this.py + Math.sin(angle) * 180, 110, 3.0, '#22D3EE', 'frost', 1);
      }
      if (prog.choices[15] === 'C') {
        this.pEs = Math.min(this.stats.maxEnergyShield, this.pEs + 12);
      }
      this.pScaleX = 1.18;
      this.pScaleY = 0.84;
      return;
    }

    if (skillId === 'rift_blade') {
      const dist = prog.choices[5] === 'B' ? skill.range * 1.25 : skill.range;
      const room = this.domain.rooms[this.currentRoomIdx];
      const oldX = this.px;
      const oldY = this.py;
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const ix = oldX + Math.cos(angle) * dist * t;
        const iy = oldY + Math.sin(angle) * dist * t;
        this.afterImages.push({ x: ix, y: iy, life: 0.34, color: '#A855F7' });
        this.weaponTrail.push({ x: ix, y: iy, life: 0.2, color: '#A855F7' });
      }
      this.px = Math.max(40, Math.min(room.width - 40, oldX + Math.cos(angle) * dist));
      this.py = Math.max(40, Math.min(room.height - 40, oldY + Math.sin(angle) * dist));
      this.resolvePlayerObstacles();
      this.pInvulnTimer = Math.max(this.pInvulnTimer, prog.choices[10] === 'C' ? 0.35 : 0.2);

      const width = skill.radius * (prog.choices[10] === 'B' ? 1.3 : 1) * this.stats.areaMult;
      const hits = this.damageEnemiesInRadius(
        (oldX + this.px) * 0.5,
        (oldY + this.py) * 0.5,
        dist * 0.55 + width * 0.4,
        skillId,
        isShadeEmpowered,
        isEclipseEmpowered,
        prog.choices[15] === 'A'
      );
      if (prog.choices[5] === 'C') {
        for (const e of hits) e.witheredTimer = Math.max(e.witheredTimer, 3.0);
      }
      if (prog.choices[15] === 'B') {
        this.spawnDecal(this.px, this.py, 85, 2.5, '#A855F7', 'void', 22 + prog.level * 5);
      }
      if (this.activeAspects.includes('shade')) {
        this.shadeEmpowered = true;
        this.shadeTimer = 4;
      }
      this.pScaleX = 0.78;
      this.pScaleY = 1.24;
      this.burstParticles(this.px, this.py, '#A855F7', 16, 'spark');
      soundEngine.playDash();
      return;
    }

    if (skillId === 'soul_harvest') {
      const radius = skill.radius * (prog.choices[5] === 'C' ? 1.25 : 1) * this.stats.areaMult;
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle: 0,
        arc: Math.PI * 2,
        radius,
        color: '#A855F7',
        life: 0.3,
        maxLife: 0.3,
      });
      const hits = this.damageEnemiesInRadius(this.px, this.py, radius, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      for (const e of hits) {
        if (prog.choices[10] === 'B') {
          // Entropy Chill — 35% slow
          this.applyStatus(e, 'chill', 2.5, 0.35);
        }
        this.applyStatus(e, 'wither', 2.5);
      }
      if (prog.choices[5] === 'B' && hits.length > 0) {
        this.pHp = Math.min(this.stats.maxLife, this.pHp + Math.round(this.stats.maxLife * 0.04 * hits.length));
      }
      if (prog.choices[15] === 'C' && hits.length > 0) {
        this.pMp = Math.min(this.stats.maxMana, this.pMp + 15 * hits.length);
      }
      if (prog.choices[10] === 'A') {
        this.spawnDecal(this.px, this.py, radius * 0.75, 3.0, '#A855F7', 'void', 24 + prog.level * 5);
      }
      this.pScaleX = 1.18;
      this.pScaleY = 0.84;
      this.burstParticles(this.px, this.py, '#A855F7', 22, 'outer');
      return;
    }

    if (skillId === 'meteor_brand') {
      const world = this.pointerInitialized
        ? this.screenToWorld(this.mouseScreenX, this.mouseScreenY)
        : { x: this.px + Math.cos(angle) * 200, y: this.py + Math.sin(angle) * 200 };
      const dist = Math.min(skill.range, Math.hypot(world.x - this.px, world.y - this.py));
      const tx = this.px + Math.cos(angle) * dist;
      const ty = this.py + Math.sin(angle) * dist;
      const radius = skill.radius * (prog.choices[5] === 'B' ? 1.3 : 1) * this.stats.areaMult;

      this.slashEffects.push({
        x: tx,
        y: ty,
        angle: 0,
        arc: Math.PI * 2,
        radius,
        color: isEclipseEmpowered ? '#D99B38' : '#F97316',
        life: 0.34,
        maxLife: 0.34,
      });
      this.spawnDecal(tx, ty, radius * 0.72, 3.2, '#F97316', 'crack');
      const hits = this.damageEnemiesInRadius(tx, ty, radius, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      for (const e of hits) {
        if (prog.choices[5] === 'C') {
          e.burnTimer = 3.0;
          e.burnDps = Math.max(e.burnDps, (24 + prog.level * 6) * this.stats.burnMagnitudeMult);
        }
        if (prog.choices[10] === 'B') e.stunTimer = Math.max(e.stunTimer, 0.8);
      }
      if (prog.choices[15] === 'B') {
        this.damageEnemiesInRadius(tx + 70, ty - 45, radius * 0.65, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      }
      this.burstParticles(tx, ty, '#F97316', 28, 'outer');
      this.addTrauma(0.35);
      return;
    }

    if (skillId === 'tempest_nova') {
      const radius = skill.radius * (prog.choices[5] === 'C' ? 1.3 : 1) * this.stats.areaMult;
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle: 0,
        arc: Math.PI * 2,
        radius,
        color,
        life: 0.28,
        maxLife: 0.28,
      });
      const hits = this.damageEnemiesInRadius(this.px, this.py, radius, skillId, isShadeEmpowered, isEclipseEmpowered, false);
      if (prog.choices[5] === 'B') {
        for (const e of hits) e.shockTimer = Math.max(e.shockTimer, 3.0);
      }
      if (prog.choices[10] === 'A' && hits.length > 0) {
        const pts: Array<{ x: number; y: number }> = [{ x: this.px, y: this.py }];
        for (let i = 0; i < Math.min(3, hits.length); i++) pts.push({ x: hits[i].x, y: hits[i].y });
        this.lightningEffects.push({ points: pts, color, life: 0.18, maxLife: 0.18 });
      }
      if (prog.choices[15] === 'C') {
        this.pEs = Math.min(this.stats.maxEnergyShield, this.pEs + 12);
      }
      this.burstParticles(this.px, this.py, color, 22, 'spark');
      this.addTrauma(0.24);
      return;
    }

    if (skillId === 'bulwark_charge') {
      const room = this.domain.rooms[this.currentRoomIdx];
      const dist = skill.range;
      this.px = Math.max(40, Math.min(room.width - 40, this.px + Math.cos(angle) * dist));
      this.py = Math.max(40, Math.min(room.height - 40, this.py + Math.sin(angle) * dist));
      this.resolvePlayerObstacles();
      this.pInvulnTimer = Math.max(this.pInvulnTimer, prog.choices[10] === 'A' ? 0.4 : 0.22);
      if (prog.choices[5] === 'B') {
        this.pEs = Math.min(this.stats.maxEnergyShield, this.pEs + 40);
      }
      if (prog.choices[15] === 'B') {
        this.barrierTimer = Math.max(this.barrierTimer, 3.0);
        this.recomputeStats(false);
      }
      const hits = this.damageEnemiesInRadius(
        this.px,
        this.py,
        skill.radius * this.stats.areaMult,
        skillId,
        isShadeEmpowered,
        isEclipseEmpowered,
        prog.choices[15] === 'C'
      );
      for (const e of hits) {
        if (prog.choices[5] === 'C') e.stunTimer = Math.max(e.stunTimer, 0.9);
        if (prog.choices[10] === 'B') e.armour = Math.max(0, Math.round(e.armour * 0.75));
      }
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle: angle,
        arc: 2.1,
        radius: skill.radius,
        color: '#D99B38',
        life: 0.24,
        maxLife: 0.24,
      });
      this.pScaleX = 1.24;
      this.pScaleY = 0.78;
      this.burstParticles(this.px, this.py, '#D99B38', 18, 'core');
      soundEngine.playDash();
    }
  }

  private damageEnemiesInRadius(
    cx: number,
    cy: number,
    radius: number,
    skillId: SkillId,
    isShadeEmpowered: boolean,
    isEclipseEmpowered: boolean,
    forceCrit: boolean,
    extraDamageMult = 1
  ): Enemy[] {
    const hit: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.koTimer > 0) continue;
      const dx = e.x - cx;
      const dy = e.y - cy;
      const d = Math.hypot(dx, dy);
      if (d <= radius + e.radius) {
        const nx = d > 0 ? dx / d : 1;
        const ny = d > 0 ? dy / d : 0;
        this.applyHitToEnemy(
          e,
          skillId,
          isShadeEmpowered,
          isEclipseEmpowered,
          forceCrit,
          nx * 130,
          ny * 130,
          extraDamageMult
        );
        hit.push(e);
      }
    }
    return hit;
  }

  /**
   * Apply a status effect with status resistance reduction.
   * Returns the actual duration applied (0 if fully resisted).
   */
  private applyStatus(
    enemy: Enemy,
    type: 'chill' | 'burn' | 'shock' | 'stun' | 'wither',
    duration: number,
    strength?: number
  ): number {
    const resist = Math.min(0.9, Math.max(0, enemy.statusResistPct / 100));
    const actual = duration * (1 - resist);
    if (actual <= 0.05) return 0;

    switch (type) {
      case 'chill':
        enemy.chillTimer = Math.max(enemy.chillTimer, actual);
        if (strength !== undefined) {
          enemy.chillStrength = Math.max(enemy.chillStrength, strength * (1 - resist * 0.5));
        }
        break;
      case 'burn':
        enemy.burnTimer = Math.max(enemy.burnTimer, actual);
        if (strength !== undefined) {
          enemy.burnDps = Math.max(enemy.burnDps, strength);
        }
        break;
      case 'shock':
        enemy.shockTimer = Math.max(enemy.shockTimer, actual);
        break;
      case 'stun':
        enemy.stunTimer = Math.max(enemy.stunTimer, actual);
        break;
      case 'wither':
        enemy.witheredTimer = Math.max(enemy.witheredTimer, actual);
        break;
    }
    return actual;
  }

  private isPlayerLowLife(): boolean {
    return this.pHp <= this.stats.maxLife * 0.35 || this.stats.activeMarks.includes('low_life_covenant');
  }

  private applyHitToEnemy(
    enemy: Enemy,
    skillId: SkillId,
    isShadeEmpowered: boolean,
    isEclipseEmpowered: boolean,
    forceCrit: boolean,
    kx: number,
    ky: number,
    extraDamageMult = 1
  ) {
    const skill = SKILLS[skillId];
    const prog = this.skillProgress[skillId];
    let critChance = this.stats.critChance + skill.critChance;
    if (skillId === 'ember_bolt' && prog.choices[15] === 'A') critChance += 0.1;
    if (skillId === 'frost_lance' && prog.choices[5] === 'B') critChance += 0.08;
    if (skillId === 'bone_spear' && prog.choices[10] === 'B') critChance += 0.08;
    if (skillId === 'crimson_whirlwind' && prog.choices[10] === 'A') critChance += 0.1;
    if (skillId === 'glacial_cascade' && prog.choices[10] === 'A') critChance += 0.1;
    if (skillId === 'rift_blade' && prog.choices[10] === 'A') critChance += 0.12;
    if (skillId === 'soul_harvest' && prog.choices[15] === 'B') critChance += 0.15;
    if (skillId === 'meteor_brand' && prog.choices[10] === 'A') critChance += 0.1;
    if (skillId === 'tempest_nova' && prog.choices[10] === 'B') critChance += 0.1;
    if (isEclipseEmpowered && this.stats.activeMarks.includes('eclipse_core')) critChance += 0.15;
    // Earthshaker (Seismic Slam Lv15 C) — +12% crit vs stunned
    if (skillId === 'seismic_slam' && prog.choices[15] === 'C' && enemy.stunTimer > 0) {
      critChance += 0.12;
    }

    const isCrit = forceCrit || Math.random() < Math.min(0.95, critChance);
    const dist = Math.hypot(enemy.x - this.px, enemy.y - this.py);

    const dmgResult = calculateSkillDamage({
      skill,
      skillProgress: prog,
      stats: this.stats,
      activeAspects: this.activeAspects,
      isMovementEmpowered: isShadeEmpowered,
      isEclipseEmpowered,
      isDistantTarget: dist > 210,
      isLowLife: this.isPlayerLowLife(),
      isCrit,
      isTargetChilled: enemy.chillTimer > 0,
      isHighMana: this.pMp >= this.stats.maxMana * 0.6,
      enemyResistPct: enemy.resistPct,
      enemyArmour: enemy.armour,
    });

    let finalDmg = Math.round(dmgResult.finalDamage * extraDamageMult);
    if (enemy.shockTimer > 0) finalDmg = Math.round(finalDmg * 1.18);

    enemy.hp -= finalDmg;
    enemy.hitFlash = 0.08;
    enemy.scaleX = isCrit ? 1.28 : 1.18;
    enemy.scaleY = isCrit ? 0.74 : 0.84;

    if (!enemy.isDummy) {
      enemy.vx += kx * (enemy.archetype === 'boss' ? 0.15 : 0.7);
      enemy.vy += ky * (enemy.archetype === 'boss' ? 0.15 : 0.7);
    } else {
      enemy.hp = Math.max(1, enemy.hp);
    }

    // Multi-Phase Pinnacle Boss Enrage at <= 50% HP (M4.4)
    if (enemy.archetype === 'boss' && enemy.bossPhase === 1 && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.bossPhase = 2;
      enemy.speed *= 1.25;
      enemy.damage = Math.round(enemy.damage * 1.18);
      this.slashEffects.push({
        x: enemy.x,
        y: enemy.y,
        angle: 0,
        arc: Math.PI * 2,
        radius: 220,
        color: '#DC2626',
        life: 0.45,
        maxLife: 0.45,
      });
      this.burstParticles(enemy.x, enemy.y, '#DC2626', 32, 'outer');
      this.spawnFloatingText(enemy.x, enemy.y - 54, 'PHASE II — ECLIPSE ENRAGE!', '#DC2626', true);
      soundEngine.playBossPhaseShift();
      this.addTrauma(0.45);
    }

    if (this.inSanctuary && enemy.isDummy) {
      this.sanctuaryTelemetry.hitCount += 1;
      if (isCrit) this.sanctuaryTelemetry.critCount += 1;
      if (finalDmg > this.sanctuaryTelemetry.peakHit) {
        this.sanctuaryTelemetry.peakHit = finalDmg;
      }
      this.sanctuaryTelemetry.lastHitSkill = skill.name;
      this.sanctuaryTelemetry.lastHitIsCrit = isCrit;
      this.sanctuaryTelemetry.lastHitBreakdown = {
        ...dmgResult,
        finalDamage: finalDmg,
      };
    }

    // Cold Chill
    if (skill.damageType === 'cold') {
      let chillStr = 0.25 * this.stats.chillEffectMult;
      let chillDur = 2.6;
      // Permafrost (Frost Lance Lv15 A) — heavy chill + frost DoT
      if (skillId === 'frost_lance' && prog.choices[15] === 'A') {
        chillStr = Math.min(0.7, chillStr * 1.6);
        chillDur = 3.4;
        const frostDps = Math.round(finalDmg * 0.18);
        this.applyStatus(enemy, 'burn', 2.8, frostDps);
      }
      this.applyStatus(enemy, 'chill', chillDur, chillStr);
    }
    // Fire Burn scaling with Pyromancer Aspect
    if (skill.damageType === 'fire' && this.activeAspects.includes('pyromancer')) {
      const burnDps = Math.round(finalDmg * 0.22 * this.stats.burnMagnitudeMult);
      this.applyStatus(enemy, 'burn', 2.5, burnDps);
    }

    // Critical Momentum Mark
    if (isCrit && this.stats.activeMarks.includes('critical_momentum')) {
      this.critMomentumTimer = 3.0;
      this.recomputeStats(false);
    }

    // Life Leech
    const heal = computeLifeLeechHeal(
      finalDmg,
      this.stats.lifeLeechRate,
      this.pHp >= this.stats.maxLife,
      this.stats.activeMarks.includes('low_life_covenant')
    );
    if (heal > 0) {
      this.pHp = Math.min(this.stats.maxLife, this.pHp + heal);
    }

    this.recentDamageDealt += finalDmg;
    this.spawnFloatingText(
      enemy.x + (Math.random() - 0.5) * 16,
      enemy.y - enemy.radius - 10,
      isCrit ? `${finalDmg}!` : `${finalDmg}`,
      isCrit ? '#D99B38' : DAMAGE_COLORS[skill.damageType],
      isCrit
    );
    this.burstDamageVfx(
      enemy.x,
      enemy.y,
      skill.damageType,
      isCrit ? 1.45 : 0.85
    );
    if (isCrit || isEclipseEmpowered) {
      this.spawnCritStreak(enemy.x, enemy.y, DAMAGE_COLORS[skill.damageType], isEclipseEmpowered);
    }
    soundEngine.playHit(isCrit);

    const killed = !enemy.isDummy && enemy.hp <= 0;
    if (isCrit || killed) {
      // Stronger hitstop on big crits / kills
      if (this.hitstopEnabled) {
        let stop = isCrit ? 0.048 : 0.028;
        if (killed) stop = Math.max(stop, 0.062);
        // Extra freeze for chunky crits
        if (isCrit && finalDmg >= 80) stop += 0.018;
        if (isCrit && finalDmg >= 180) stop += 0.022;
        this.hitstopTimer = Math.max(this.hitstopTimer, stop);
      }
      this.addTrauma(killed ? 0.28 : isCrit ? 0.2 : 0.14);

      // Screen flash – gold on crit, white-red on kill
      if (isCrit) {
        this.screenFlash = Math.max(this.screenFlash, finalDmg >= 120 ? 0.72 : 0.48);
        this.screenFlashColor = '#FDE68A';
        const kick = finalDmg >= 180 ? 0.85 : finalDmg >= 80 ? 0.65 : 0.45;
        this.fovKick = Math.max(this.fovKick, kick);
        this.fovKickSign = 1; // zoom-in
      } else if (killed) {
        this.screenFlash = Math.max(this.screenFlash, 0.4);
        this.screenFlashColor = '#FEE2E2';
        this.fovKick = Math.max(this.fovKick, 0.55);
        this.fovKickSign = 1;
      }
    }

    if (!enemy.isDummy && enemy.hp <= 0 && enemy.koTimer === 0) {
      this.onEnemyKilled(enemy);
    }
  }

  private onEnemyKilled(enemy: Enemy) {
    enemy.koTimer = 0.3;
    this.kills++;
    this.pFlaskRefillProgress += enemy.archetype === 'boss' ? 3 : enemy.isElite ? 0.6 : 0.22;
    while (this.pFlaskRefillProgress >= 1 && this.pFlaskCharges < this.pMaxFlaskCharges) {
      this.pFlaskRefillProgress -= 1;
      this.pFlaskCharges++;
    }

    const xpMult = 1 + this.domain.modifiers.reduce((acc, m) => acc + m.xpBonus, 0) + (this.domain.corrupted ? 0.25 : 0);
    const xpGain = Math.round(
      (enemy.archetype === 'boss' ? 160 : enemy.isElite ? 45 : 18) * (1 + (this.domain.tier - 1) * 0.25) * xpMult
    );
    this.grantPlayerXp(xpGain);

    // Loot drop chance
    const lootRarityBonus =
      this.domain.modifiers.reduce((acc, m) => acc + m.lootRarityBonus, 0) + (this.domain.corrupted ? 0.35 : 0);
    if (enemy.archetype === 'boss' || Math.random() < (enemy.isElite ? 0.55 : 0.18)) {
      const item = rollGearDrop(this.domain.tier, lootRarityBonus, enemy.archetype === 'boss');
      this.groundLoot.push({
        id: item.id,
        x: enemy.x,
        y: enemy.y,
        item,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    if (this.stats.killLifeGain > 0) {
      this.pHp = Math.min(this.stats.maxLife, this.pHp + this.stats.killLifeGain);
    }
    if (this.stats.killManaGain > 0) {
      this.pMp = Math.min(this.stats.maxMana, this.pMp + this.stats.killManaGain);
    }

    if (enemy.archetype === 'boss') {
      this.callbacks.onPinnacleBossKilled();
    }

    // Relentless (Cinder Slash Lv15 C) — refund on kill
    const cinderProg = this.skillProgress['cinder_slash'];
    if (cinderProg?.choices[15] === 'C') {
      const skill = SKILLS['cinder_slash'];
      const refund = Math.round(skill.manaCost * 0.4);
      if (this.stats.lifeCostsSkills) {
        this.pHp = Math.min(this.stats.maxLife, this.pHp + refund);
      } else {
        this.pMp = Math.min(this.stats.maxMana, this.pMp + refund);
      }
    }
  }

  private grantPlayerXp(amount: number) {
    this.pXp += amount;
    while (this.pXp >= this.pXpToNext) {
      this.pXp -= this.pXpToNext;
      this.pLevel++;
      this.pXpToNext = Math.round(120 * Math.pow(1.22, this.pLevel - 1));
      this.recomputeStats(true);
      this.spawnFloatingText(this.px, this.py - 44, `LEVEL ${this.pLevel}`, '#D99B38', true);
      this.burstParticles(this.px, this.py, '#D99B38', 28, 'outer');
      soundEngine.playLootChime(true);
      this.callbacks.onAspectUnlockCheck();
    }
    this.callbacks.onPlayerLevelChanged(this.pLevel, this.pXp, this.pXpToNext);
  }

  private addTrauma(amount: number) {
    if (!this.screenShakeEnabled) {
      this.trauma = 0;
      return;
    }
    this.trauma = Math.min(0.95, this.trauma + amount);
  }

  private spawnCritStreak(x: number, y: number, color: string, chromatic: boolean) {
    const s = this.critStreaks[this.critStreakCursor];
    this.critStreakCursor = (this.critStreakCursor + 1) % CRIT_STREAK_POOL_SIZE;
    s.active = true;
    s.x = x;
    s.y = y;
    s.width = chromatic ? 210 : 150;
    s.color = color;
    s.maxLife = chromatic ? 0.32 : 0.26;
    s.life = s.maxLife;
    s.chromatic = chromatic;
  }

  private burstParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    layer: Particle['layer']
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 190;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.maxLife = 0.25 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.size = layer === 'outer' ? 6 + Math.random() * 5 : 2 + Math.random() * 3;
      p.color = color;
      p.layer = layer;
    }
  }

  /**
   * Multi-layer, damage-type-specific impact VFX.
   * Fire: rising embers + wide orange outer
   * Cold: sharp radial shards + slow drift
   * Lightning: long fast sparks
   * Chaos/void: inward then outward purple pull
   * Physical: tight bright core sparks
   */
  private burstDamageVfx(
    x: number,
    y: number,
    damageType: DamageType,
    intensity = 1
  ) {
    const n = (base: number) => Math.max(3, Math.round(base * intensity));
    const color = DAMAGE_COLORS[damageType];

    if (damageType === 'fire') {
      // Hot core
      for (let i = 0; i < n(8); i++) {
        const p = this.particles[this.particleCursor];
        this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const a = Math.random() * Math.PI * 2;
        const spd = 50 + Math.random() * 120;
        p.active = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * spd;
        p.vy = Math.sin(a) * spd - 40; // rise
        p.maxLife = 0.3 + Math.random() * 0.25;
        p.life = p.maxLife;
        p.size = 3 + Math.random() * 3;
        p.color = Math.random() > 0.4 ? color : '#FDE68A';
        p.layer = 'core';
      }
      // Smoky outer
      this.burstParticles(x, y, '#9A3412', n(12), 'outer');
      this.burstParticles(x, y, color, n(6), 'spark');
    } else if (damageType === 'cold') {
      // Ice shards – more directional, longer life
      for (let i = 0; i < n(14); i++) {
        const p = this.particles[this.particleCursor];
        this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const a = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 160;
        p.active = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * spd;
        p.vy = Math.sin(a) * spd;
        p.maxLife = 0.35 + Math.random() * 0.3;
        p.life = p.maxLife;
        p.size = 2 + Math.random() * 2.5;
        p.color = Math.random() > 0.5 ? color : '#E0F2FE';
        p.layer = i % 2 === 0 ? 'spark' : 'core';
      }
      this.burstParticles(x, y, '#67E8F9', n(8), 'mid');
    } else if (damageType === 'lightning') {
      for (let i = 0; i < n(16); i++) {
        const p = this.particles[this.particleCursor];
        this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const a = Math.random() * Math.PI * 2;
        const spd = 140 + Math.random() * 220;
        p.active = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * spd;
        p.vy = Math.sin(a) * spd;
        p.maxLife = 0.12 + Math.random() * 0.18;
        p.life = p.maxLife;
        p.size = 1.5 + Math.random() * 2;
        p.color = Math.random() > 0.35 ? color : '#F0F9FF';
        p.layer = 'spark';
      }
      this.burstParticles(x, y, color, n(5), 'core');
    } else if (damageType === 'chaos') {
      // Inward void pull then residual sparks
      for (let i = 0; i < n(12); i++) {
        const p = this.particles[this.particleCursor];
        this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const a = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        p.active = true;
        p.x = x + Math.cos(a) * dist;
        p.y = y + Math.sin(a) * dist;
        p.vx = -Math.cos(a) * (60 + Math.random() * 80);
        p.vy = -Math.sin(a) * (60 + Math.random() * 80);
        p.maxLife = 0.28 + Math.random() * 0.22;
        p.life = p.maxLife;
        p.size = 3 + Math.random() * 4;
        p.color = Math.random() > 0.4 ? color : '#6B21A8';
        p.layer = 'outer';
      }
      this.burstParticles(x, y, '#E9D5FF', n(7), 'core');
    } else {
      // Physical – tight bright debris
      this.burstParticles(x, y, color, n(10), 'core');
      this.burstParticles(x, y, '#94A3B8', n(8), 'spark');
      this.burstParticles(x, y, '#64748B', n(5), 'mid');
    }
  }

  private spawnDecal(
    x: number,
    y: number,
    radius: number,
    maxLife: number,
    color: string,
    kind: GroundDecal['kind'],
    dps?: number
  ) {
    const d = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % DECAL_POOL_SIZE;
    d.active = true;
    d.x = x;
    d.y = y;
    d.radius = radius;
    d.life = maxLife;
    d.maxLife = maxLife;
    d.color = color;
    d.kind = kind;
    d.dps = dps;
    d.tickTimer = 0.25;
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, isCrit: boolean) {
    const t = this.floatingTexts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % FLOATING_TEXT_POOL_SIZE;
    t.active = true;
    // Slight random offset so stacked hits fan out
    t.x = x + (Math.random() - 0.5) * (isCrit ? 18 : 12);
    t.y = y + (Math.random() - 0.5) * 6;
    t.vy = isCrit ? -68 : -42;
    t.text = text;
    t.color = color;
    t.isCrit = isCrit;
    t.maxLife = isCrit ? 1.15 : 0.72;
    t.life = t.maxLife;
  }

  private update(dt: number) {
    // Visual effects & shake tick even during hitstop or title idle
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 3.8);
    }
    if (this.fovKick > 0) {
      // Slightly slower than flash so zoom eases out smoothly
      this.fovKick = Math.max(0, this.fovKick - dt * 2.8);
    }
    for (const p of this.particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
    for (const f of this.floatingTexts) {
      if (!f.active) continue;
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) f.active = false;
    }
    for (const s of this.critStreaks) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) s.active = false;
    }
    for (let i = this.slashEffects.length - 1; i >= 0; i--) {
      this.slashEffects[i].life -= dt;
      if (this.slashEffects[i].life <= 0) this.slashEffects.splice(i, 1);
    }
    for (let i = this.lightningEffects.length - 1; i >= 0; i--) {
      this.lightningEffects[i].life -= dt;
      if (this.lightningEffects[i].life <= 0) this.lightningEffects.splice(i, 1);
    }
    for (let i = this.weaponTrail.length - 1; i >= 0; i--) {
      this.weaponTrail[i].life -= dt;
      if (this.weaponTrail[i].life <= 0) this.weaponTrail.splice(i, 1);
    }
    for (let i = this.afterImages.length - 1; i >= 0; i--) {
      this.afterImages[i].life -= dt;
      if (this.afterImages[i].life <= 0) this.afterImages.splice(i, 1);
    }

    // Squash & stretch exponential spring recovery even during hitstop
    const spring = Math.min(1, dt * 16);
    this.pScaleX += (1 - this.pScaleX) * spring;
    this.pScaleY += (1 - this.pScaleY) * spring;
    for (const e of this.enemies) {
      e.scaleX += (1 - e.scaleX) * spring;
      e.scaleY += (1 - e.scaleY) * spring;
    }

    if (this.phase !== 'playing') return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    // Twin Spin delayed cleave
    if (this.twinSpinTimer > 0) {
      this.twinSpinTimer = Math.max(0, this.twinSpinTimer - dt);
      if (this.twinSpinTimer <= 0 && this.twinSpinParams) {
        const p = this.twinSpinParams;
        this.twinSpinParams = null;
        // Second slash (slightly larger, different color tint)
        this.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: p.angle,
          arc: Math.PI * 2,
          radius: p.radius * 1.08,
          color: p.isEclipseEmpowered ? '#FBBF24' : '#F43F5E',
          life: 0.26,
          maxLife: 0.26,
        });
        // Extra blade trails
        for (let i = 0; i <= 10; i++) {
          const a = p.angle + (i / 10) * Math.PI * 2;
          this.weaponTrail.push({
            x: p.x + Math.cos(a) * p.radius * 0.85,
            y: p.y + Math.sin(a) * p.radius * 0.85,
            life: 0.18,
            color: '#F43F5E',
          });
        }
        this.damageEnemiesInRadius(
          p.x,
          p.y,
          p.radius,
          'crimson_whirlwind',
          p.isShadeEmpowered,
          p.isEclipseEmpowered,
          false
        );
        this.burstParticles(p.x, p.y, '#F43F5E', 14, 'spark');
        this.burstDamageVfx(p.x, p.y, 'physical', 0.7);
        // Secondary shake — lighter than the first so it feels like a follow-through
        this.addTrauma(0.12);
      }
    }

    // Seismic Slam delayed (Aftershock / Double Rupture)
    if (this.seismicDelayTimer > 0) {
      this.seismicDelayTimer = Math.max(0, this.seismicDelayTimer - dt);
      if (this.seismicDelayTimer <= 0 && this.seismicDelayParams) {
        const p = this.seismicDelayParams;
        this.seismicDelayParams = null;
        this.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: 0,
          arc: Math.PI * 2,
          radius: p.radius,
          color: p.isDoubleRupture ? '#CBD5E1' : '#94A3B8',
          life: 0.3,
          maxLife: 0.3,
        });
        this.spawnDecal(p.x, p.y, p.radius * 0.7, 2.2, '#64748B', 'crack');
        this.damageEnemiesInRadius(
          p.x,
          p.y,
          p.radius,
          'seismic_slam',
          p.isShadeEmpowered,
          p.isEclipseEmpowered,
          false,
          p.damageMult
        );
        this.burstParticles(p.x, p.y, '#E2E8F0', 16, 'spark');
        this.burstDamageVfx(p.x, p.y, 'physical', 0.6);
        this.addTrauma(p.isDoubleRupture ? 0.22 : 0.14);
      }
    }

    // Eclipse Cleave delayed slash
    if (this.eclipseCleaveTimer > 0) {
      this.eclipseCleaveTimer = Math.max(0, this.eclipseCleaveTimer - dt);
      if (this.eclipseCleaveTimer <= 0 && this.eclipseCleaveParams) {
        const p = this.eclipseCleaveParams;
        this.eclipseCleaveParams = null;
        this.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: p.angle,
          arc: p.arc,
          radius: p.radius,
          color: p.isEclipseEmpowered ? '#FBBF24' : '#F97316',
          life: 0.24,
          maxLife: 0.24,
        });
        this.damageEnemiesInRadius(p.x, p.y, p.radius, 'cinder_slash', p.isShadeEmpowered, p.isEclipseEmpowered, false, 0.7);
        this.burstDamageVfx(p.x, p.y, 'fire', 0.6);
        this.addTrauma(0.1);
      }
    }

    // Double Eruption delayed nova
    if (this.doubleEruptionTimer > 0) {
      this.doubleEruptionTimer = Math.max(0, this.doubleEruptionTimer - dt);
      if (this.doubleEruptionTimer <= 0 && this.doubleEruptionParams) {
        const p = this.doubleEruptionParams;
        this.doubleEruptionParams = null;
        this.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: 0,
          arc: Math.PI * 2,
          radius: p.radius,
          color: p.isEclipseEmpowered ? '#FBBF24' : '#F97316',
          life: 0.28,
          maxLife: 0.28,
        });
        this.damageEnemiesInRadius(p.x, p.y, p.radius, 'ashen_nova', p.isShadeEmpowered, p.isEclipseEmpowered, false, 0.65);
        this.burstDamageVfx(p.x, p.y, 'fire', 0.8);
        this.addTrauma(0.16);
      }
    }

    this.simTime += dt;
    this.elapsedSeconds += dt;

    // Ghost HP trailing bar
    this.pGhostHp += (this.pHp - this.pGhostHp) * Math.min(1, dt * 4.5);

    if (this.lootToastTimer > 0) {
      this.lootToastTimer -= dt;
      if (this.lootToastTimer <= 0) this.recentLootToast = null;
    }

    // Cooldowns & 0.12s Skill Input Buffer resolution
    for (let i = 0; i < 5; i++) {
      if (this.pCooldowns[i] > 0) this.pCooldowns[i] = Math.max(0, this.pCooldowns[i] - dt);
    }
    if (this.bufferedSlot !== null) {
      this.bufferedTimer -= dt;
      if (this.bufferedTimer <= 0) {
        this.bufferedSlot = null;
        this.bufferedTimer = 0;
      } else if (this.pCooldowns[this.bufferedSlot] <= 0) {
        const queued = this.bufferedSlot;
        this.bufferedSlot = null;
        this.bufferedTimer = 0;
        this.tryCastSlot(queued);
      }
    }
    if (this.pInvulnTimer > 0) this.pInvulnTimer -= dt;
    if (this.pHitFlash > 0) this.pHitFlash -= dt;
    if (this.shadeTimer > 0) {
      this.shadeTimer -= dt;
      if (this.shadeTimer <= 0) this.shadeEmpowered = false;
    }
    if (this.critMomentumTimer > 0) {
      this.critMomentumTimer -= dt;
      if (this.critMomentumTimer <= 0) this.recomputeStats(false);
    }
    if (this.barrierTimer > 0) {
      this.barrierTimer -= dt;
      if (this.barrierTimer <= 0) this.recomputeStats(false);
    }
    if (this.fleetfootTimer > 0) this.fleetfootTimer -= dt;

    // Eclipse Aspect Timer
    if (this.activeAspects.includes('eclipse') && !this.eclipseReady) {
      this.eclipseTimer -= dt;
      if (this.eclipseTimer <= 0) {
        this.eclipseReady = true;
      }
    }

    // Veil Aspect Shield Timer
    if (this.activeAspects.includes('veil')) {
      if (this.pVeilShield <= 0) {
        this.pVeilTimer -= dt;
        if (this.pVeilTimer <= 0) {
          this.pVeilShield = this.stats.veilShieldMax;
          this.pVeilTimer = this.stats.veilCooldown;
        }
      }
    } else {
      this.pVeilShield = 0;
    }

    // Energy Shield & Mana & Regrowth regen (with Immortal Ward ES recharge speed)
    this.pMp = Math.min(this.stats.maxMana, this.pMp + (10 + this.stats.maxMana * 0.08) * dt);
    if (this.pEsRechargeDelay > 0) {
      this.pEsRechargeDelay -= dt * this.stats.esRechargeMult;
    } else if (this.pEs < this.stats.maxEnergyShield) {
      this.pEs = Math.min(
        this.stats.maxEnergyShield,
        this.pEs + Math.max(12, this.stats.maxEnergyShield * 0.25) * this.stats.esRechargeMult * dt
      );
    }
    if (this.regrowthBank > 0) {
      const healTick = Math.min(this.regrowthBank, Math.max(4, this.regrowthBank * 0.6) * dt);
      this.regrowthBank -= healTick;
      this.pHp = Math.min(this.stats.maxLife, this.pHp + healTick);
    }

    const room = this.domain.rooms[this.currentRoomIdx];
    const shiftHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Held RMB or Shift+LMB auto-repeat primary skill toward cursor
    if (this.rightMouseDown || (this.leftMouseDown && shiftHeld)) {
      this.moveTargetActive = false;
      if (this.pointerInitialized) {
        const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
        this.pAimAngle = Math.atan2(worldMouse.y - this.py, worldMouse.x - this.px);
      }
      if (this.pCooldowns[0] <= 0) {
        this.tryCastSlot(0);
      }
    } else if (
      this.leftMouseDown &&
      this.targetEnemyId === null &&
      this.targetLootId === null &&
      !this.targetPortal &&
      this.pointerInitialized
    ) {
      // Holding LMB steers continuously toward cursor (Diablo / PoE continuous click-move)
      const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
      this.moveTargetX = Math.max(36, Math.min(room.width - 36, worldMouse.x));
      this.moveTargetY = Math.max(36, Math.min(room.height - 36, worldMouse.y));
      this.moveTargetKind = 'move';
      this.moveTargetActive = true;
    }

    // Track targeted enemy (chase into skill range & attack)
    if (this.targetEnemyId !== null) {
      const target = this.enemies.find((en) => en.id === this.targetEnemyId && en.koTimer === 0);
      if (!target) {
        this.targetEnemyId = null;
        this.moveTargetActive = false;
      } else {
        const skill = SKILLS[this.hotbar[0]];
        const reach =
          skill.category === 'melee'
            ? Math.max(96, skill.range * 0.88)
            : Math.max(280, skill.range * 0.78);
        const dist = Math.hypot(target.x - this.px, target.y - this.py);
        if (dist <= reach + target.radius) {
          this.moveTargetActive = false;
          this.pAimAngle = Math.atan2(target.y - this.py, target.x - this.px);
          if (this.pCooldowns[0] <= 0) {
            this.tryCastSlot(0);
          }
          if (!this.leftMouseDown) {
            this.targetEnemyId = null;
          }
        } else {
          this.moveTargetX = target.x;
          this.moveTargetY = target.y;
          this.moveTargetKind = 'attack';
          this.moveTargetActive = true;
        }
      }
    }

    // Track clicked loot item
    if (this.targetLootId !== null) {
      const lootIdx = this.groundLoot.findIndex((g) => g.id === this.targetLootId);
      if (lootIdx < 0) {
        this.targetLootId = null;
        this.moveTargetActive = false;
      } else {
        const g = this.groundLoot[lootIdx];
        if (Math.hypot(g.x - this.px, g.y - this.py) <= 72) {
          this.collectLoot(lootIdx);
          this.targetLootId = null;
          this.moveTargetActive = false;
        }
      }
    }

    // Track clicked exit portal
    if (this.targetPortal) {
      if (!room.cleared || this.currentRoomIdx >= this.domain.rooms.length - 1) {
        this.targetPortal = false;
        this.moveTargetActive = false;
      } else if (Math.hypot(room.portalX - this.px, room.portalY - this.py) <= 88) {
        this.targetPortal = false;
        this.moveTargetActive = false;
        this.enterRoom(this.currentRoomIdx + 1);
        soundEngine.playDash();
        return;
      }
    }

    // Movement vector: WASD/Arrows override click-to-move cleanly (PoE2 dual input)
    let ix = 0;
    let iy = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;

    const hasKeyboardMove = ix !== 0 || iy !== 0;
    if (hasKeyboardMove) {
      this.moveTargetActive = false;
      this.targetEnemyId = null;
      this.targetLootId = null;
      this.targetPortal = false;
      const ilen = Math.hypot(ix, iy);
      ix /= ilen;
      iy /= ilen;
      if (this.pointerInitialized) {
        const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
        this.pAimAngle = Math.atan2(worldMouse.y - this.py, worldMouse.x - this.px);
      }
    } else if (this.moveTargetActive) {
      const dx = this.moveTargetX - this.px;
      const dy = this.moveTargetY - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= 10) {
        this.moveTargetActive = false;
      } else {
        ix = dx / dist;
        iy = dy / dist;
        this.pAimAngle = Math.atan2(iy, ix);
      }
    } else if (this.pointerInitialized) {
      const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
      this.pAimAngle = Math.atan2(worldMouse.y - this.py, worldMouse.x - this.px);
    }

    let moveSpeed = this.stats.movementSpeed;
    // Status resist reduces aspect movement drawbacks
    const resist = Math.min(0.75, this.stats.statusResistPct / 100);
    if (this.pVeilShield > 0) {
      // Veil: -15% base, reduced by status resist
      moveSpeed *= 1 - 0.15 * (1 - resist);
    }
    if (this.fleetfootTimer > 0) moveSpeed *= 1.25;
    // Frigid / Bastion drawbacks also mitigated
    if (this.activeAspects.includes('frigid') && !this.stats.activeLegendaries.includes('crown_winter')) {
      moveSpeed *= 1 - 0.08 * (1 - resist);
    }
    if (this.activeAspects.includes('bastion')) {
      moveSpeed *= 1 - 0.10 * (1 - resist);
    }
    // Chilling Ground — slow reduced by status resistance
    for (const d of this.decals) {
      if (d.active && d.kind === 'frost' && Math.hypot(this.px - d.x, this.py - d.y) <= d.radius) {
        // Base 18% slow, reduced by status resist (75% resist = ~4.5% slow)
        const resist = Math.min(0.75, this.stats.statusResistPct / 100);
        const slowFactor = 0.82 + 0.18 * resist; // 0.82 at 0%, 1.0 at 100%
        moveSpeed *= slowFactor;
        break;
      }
    }

    this.lastStepPx = this.px;
    this.lastStepPy = this.py;
    this.pvx = ix * moveSpeed;
    this.pvy = iy * moveSpeed;
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;
    this.pWalkPhase += Math.hypot(this.pvx * dt, this.pvy * dt) * 0.08;
    this.resolvePlayerObstacles();

    // Cancel unheld ground waypoint if blocked on a wall/pillar
    if (this.moveTargetActive && !this.leftMouseDown && this.targetEnemyId === null) {
      const moved = Math.hypot(this.px - this.lastStepPx, this.py - this.lastStepPy);
      if (moved < moveSpeed * dt * 0.12) {
        this.stuckMoveTimer += dt;
        if (this.stuckMoveTimer > 0.25) {
          this.moveTargetActive = false;
          this.stuckMoveTimer = 0;
        }
      } else {
        this.stuckMoveTimer = 0;
      }
    }

    // Smooth camera follow
    this.camX += (this.px - this.camX) * Math.min(1, dt * 10);
    this.camY += (this.py - this.camY) * Math.min(1, dt * 10);

    // Ambient Aspect particles on player
    if (Math.random() < 0.35) {
      if (this.activeAspects.includes('blood')) {
        this.burstParticles(this.px + (Math.random() - 0.5) * 18, this.py + (Math.random() - 0.5) * 18, '#DC2626', 1, 'spark');
      } else if (this.activeAspects.includes('storm')) {
        this.burstParticles(this.px + (Math.random() - 0.5) * 20, this.py + (Math.random() - 0.5) * 20, '#7DD3FC', 1, 'core');
      }
    }

    // Update Decals & DoTs
    for (const d of this.decals) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        // Void Collapse (Void Tendrils Lv15 B) — detonate on expiry
        if (d.kind === 'void' && this.skillProgress['void_tendrils']?.choices[15] === 'B') {
          this.burstDamageVfx(d.x, d.y, 'chaos', 1.3);
          this.burstParticles(d.x, d.y, '#A855F7', 22, 'outer');
          this.damageEnemiesInRadius(d.x, d.y, d.radius * 0.9, 'void_tendrils', false, false, false, 0.8);
          this.addTrauma(0.18);
        }
        d.active = false;
        continue;
      }
      if (d.dps && d.dps > 0) {
        d.tickTimer = (d.tickTimer ?? 0.25) - dt;
        if (d.tickTimer <= 0) {
          d.tickTimer = 0.35;
          if (d.kind === 'void') {
            for (const e of this.enemies) {
              if (e.koTimer > 0) continue;
              if (Math.hypot(e.x - d.x, e.y - d.y) <= d.radius + e.radius) {
                const tickDmg = Math.round(d.dps * 0.35);
                e.hp -= tickDmg;
                // Entropy Web (Void Tendrils Lv10 C) — 35% slow inside zone
                const voidProg = this.skillProgress['void_tendrils'];
                if (voidProg?.choices[10] === 'C') {
                  this.applyStatus(e, 'chill', 0.6, 0.35);
                } else {
                  e.chillTimer = Math.max(e.chillTimer, 0.45);
                  e.chillStrength = Math.max(e.chillStrength, 0.28);
                }
                if (this.stats.activeMarks.includes('withering_touch')) {
                  this.applyStatus(e, 'wither', 2.0);
                }
                this.recentDamageDealt += tickDmg;
                this.spawnFloatingText(e.x, e.y - 16, `${tickDmg}`, '#A855F7', false);
                if (e.isDummy) {
                  e.hp = Math.max(1, e.hp);
                } else if (e.hp <= 0 && e.koTimer === 0) {
                  this.onEnemyKilled(e);
                }
              }
            }
          } else if (d.kind === 'burn') {
            // Burning ground from Volatile Embers damages player slightly if standing in it
            if (Math.hypot(this.px - d.x, this.py - d.y) <= d.radius) {
              this.damagePlayer(Math.round(d.dps * 0.25), 'fire');
            }
          }
        }
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (!pr.active) {
        this.projectiles.splice(i, 1);
        continue;
      }
      pr.life -= dt;
      if (pr.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.returnDist && !pr.returning) {
        if (Math.hypot(pr.x - pr.originX, pr.y - pr.originY) >= pr.returnDist) {
          pr.returning = true;
          pr.hitIds.clear();
        }
      }
      if (pr.returning) {
        const ang = Math.atan2(this.py - pr.y, this.px - pr.x);
        const spd = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(ang) * spd;
        pr.vy = Math.sin(ang) * spd;
        if (Math.hypot(this.px - pr.x, this.py - pr.y) < 26) {
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      // Wall / obstacle collision
      if (pr.x < 18 || pr.x > room.width - 18 || pr.y < 18 || pr.y > room.height - 18) {
        this.projectiles.splice(i, 1);
        continue;
      }
      let hitWall = false;
      for (const ob of room.obstacles) {
        if (pr.x > ob.x && pr.x < ob.x + ob.w && pr.y > ob.y && pr.y < ob.y + ob.h) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        this.burstParticles(pr.x, pr.y, DAMAGE_COLORS[pr.damageType], 5, 'spark');
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer && pr.skillId) {
        for (const e of this.enemies) {
          if (e.koTimer > 0 || pr.hitIds.has(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) <= pr.radius + e.radius) {
            pr.hitIds.add(e.id);
            const prog = this.skillProgress[pr.skillId];
            const returnMult = pr.returning && prog.choices[5] === 'A' ? 1.5 : 1;
            const forceReturnCrit = Boolean(pr.returning && prog.choices[15] === 'A');

            this.applyHitToEnemy(
              e,
              pr.skillId,
              false,
              Boolean(pr.empowered),
              forceReturnCrit,
              pr.vx * 0.14,
              pr.vy * 0.14,
              returnMult
            );

            // Inferno Burst (Ember Bolt Lv15 B) — strong burn on hit
            if (pr.skillId === 'ember_bolt' && prog.choices[15] === 'B') {
              const strongBurn = Math.round(28 + prog.level * 6) * this.stats.burnMagnitudeMult;
              this.applyStatus(e, 'burn', 3.2, strongBurn);
            }

            if (pr.explodeRadius) {
              this.burstParticles(pr.x, pr.y, '#F97316', 14, 'outer');
              this.damageEnemiesInRadius(pr.x, pr.y, pr.explodeRadius, pr.skillId, false, false, false);
            }

            if (pr.pierceLeft > 0) {
              pr.pierceLeft--;
            } else {
              this.projectiles.splice(i, 1);
              break;
            }
          }
        }
      } else if (!pr.fromPlayer) {
        if (Math.hypot(this.px - pr.x, this.py - pr.y) <= pr.radius + 16) {
          this.damagePlayer(pr.damage, pr.damageType);
          this.projectiles.splice(i, 1);
        }
      }
    }

    // Update Enemies (with Attack Token Pool)
    let activeAttackers = 0;
    for (const e of this.enemies) {
      if (e.state === 'windup' || e.state === 'attack') activeAttackers++;
    }

    let aliveCount = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.koTimer > 0) {
        e.koTimer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.88;
        e.vy *= 0.88;
        if (e.koTimer <= 0) this.enemies.splice(i, 1);
        continue;
      }
      aliveCount++;

      // Status ticks
      if (e.chillTimer > 0) e.chillTimer -= dt;
      if (e.shockTimer > 0) e.shockTimer -= dt;
      if (e.witheredTimer > 0) e.witheredTimer -= dt;
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        const burnTick = e.burnDps * dt;
        e.hp -= burnTick;
        // Burn floating numbers (throttled)
        this.burnTextTimer -= dt;
        if (this.burnTextTimer <= 0 && burnTick > 2) {
          this.burnTextTimer = 0.18;
          this.spawnFloatingText(e.x, e.y - e.radius - 4, `${Math.round(burnTick * 4)}`, '#F97316', false);
        }
        if (e.hp <= 0) {
          this.onEnemyKilled(e);
          continue;
        }
      }
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        continue;
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);
      const dirX = dist > 0 ? dx / dist : 1;
      const dirY = dist > 0 ? dy / dist : 0;
      const speedMult = e.chillTimer > 0 ? 1 - e.chillStrength : 1;

      if (e.attackCooldown > 0) e.attackCooldown -= dt;

      // Training Dummies stay stationary and regenerate smoothly
      if (e.isDummy) {
        if (e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + 950 * dt);
        }
        continue;
      }

      if (e.state === 'idle') {
        if (e.archetype === 'thrall') {
          // Chaser
          if (dist > e.radius + 26) {
            e.x += dirX * e.speed * speedMult * dt;
            e.y += dirY * e.speed * speedMult * dt;
          } else if (e.attackCooldown <= 0 && activeAttackers < MAX_CONCURRENT_ATTACKERS) {
            e.state = 'windup';
            e.windupDuration = 0.42;
            e.stateTimer = 0.42;
            e.aimAngle = Math.atan2(dy, dx);
            activeAttackers++;
          }
        } else if (e.archetype === 'cultist') {
          // Kiter/Ranged
          if (dist < 210) {
            e.x -= dirX * e.speed * 0.85 * speedMult * dt;
            e.y -= dirY * e.speed * 0.85 * speedMult * dt;
          } else if (dist > 340) {
            e.x += dirX * e.speed * speedMult * dt;
            e.y += dirY * e.speed * speedMult * dt;
          }
          if (dist < 420 && e.attackCooldown <= 0 && activeAttackers < MAX_CONCURRENT_ATTACKERS) {
            e.state = 'windup';
            e.windupDuration = 0.55;
            e.stateTimer = 0.55;
            e.aimAngle = Math.atan2(dy, dx);
            activeAttackers++;
          }
        } else if (e.archetype === 'charger') {
          // Line-of-Sight Charger
          if (dist > 280) {
            e.x += dirX * e.speed * speedMult * dt;
            e.y += dirY * e.speed * speedMult * dt;
          } else if (e.attackCooldown <= 0 && activeAttackers < MAX_CONCURRENT_ATTACKERS) {
            e.state = 'windup';
            e.windupDuration = 0.65;
            e.stateTimer = 0.65;
            e.aimAngle = Math.atan2(dy, dx);
            activeAttackers++;
          }
        } else if (e.archetype === 'stalker') {
          // Orbiter/Flanker
          const perpX = -dirY * e.orbitDir;
          const perpY = dirX * e.orbitDir;
          const moveX = (dist > 150 ? dirX * 0.6 : -dirX * 0.3) + perpX * 0.9;
          const moveY = (dist > 150 ? dirY * 0.6 : -dirY * 0.3) + perpY * 0.9;
          const mLen = Math.hypot(moveX, moveY) || 1;
          e.x += (moveX / mLen) * e.speed * speedMult * dt;
          e.y += (moveY / mLen) * e.speed * speedMult * dt;
          if (dist < 185 && e.attackCooldown <= 0 && activeAttackers < MAX_CONCURRENT_ATTACKERS) {
            e.state = 'windup';
            e.windupDuration = 0.38;
            e.stateTimer = 0.38;
            e.aimAngle = Math.atan2(dy, dx);
            activeAttackers++;
          }
        } else if (e.archetype === 'boss') {
          if (dist > 140) {
            e.x += dirX * e.speed * speedMult * dt;
            e.y += dirY * e.speed * speedMult * dt;
          }
          if (e.attackCooldown <= 0) {
            e.state = 'windup';
            const isPhase2 = e.bossPhase === 2;
            e.windupDuration = isPhase2 ? 0.56 : 0.72;
            e.stateTimer = e.windupDuration;
            e.aimAngle = Math.atan2(dy, dx);
            e.bossAttackIndex = (e.bossAttackIndex + 1) % (isPhase2 ? 4 : 3);
            soundEngine.playBossTelegraph();
          }
        }
      } else if (e.state === 'windup') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'attack';
          if (e.archetype === 'charger' || e.archetype === 'stalker') {
            e.stateTimer = 0.32;
            e.vx = Math.cos(e.aimAngle) * (e.archetype === 'charger' ? 490 : 380);
            e.vy = Math.sin(e.aimAngle) * (e.archetype === 'charger' ? 490 : 380);
          } else if (e.archetype === 'cultist') {
            this.projectiles.push({
              active: true,
              fromPlayer: false,
              x: e.x,
              y: e.y,
              vx: Math.cos(e.aimAngle) * 310,
              vy: Math.sin(e.aimAngle) * 310,
              radius: 9,
              damageType: 'fire',
              damage: Math.round(e.damage * (e.witheredTimer > 0 ? 0.88 : 1)),
              isCrit: false,
              life: 1.8,
              pierceLeft: 0,
              originX: e.x,
              originY: e.y,
              hitIds: new Set(),
            });
            e.state = 'recover';
            e.stateTimer = 0.4;
            e.attackCooldown = 1.65;
          } else if (e.archetype === 'boss') {
            this.executeBossAttack(e);
            e.state = 'recover';
            e.stateTimer = e.bossPhase === 2 ? 0.42 : 0.55;
            e.attackCooldown = e.bossPhase === 2 ? 1.25 : 1.75;
          } else {
            // Thrall melee strike
            if (dist <= e.radius + 42) {
              this.damagePlayer(Math.round(e.damage * (e.witheredTimer > 0 ? 0.88 : 1)), 'physical');
            }
            e.state = 'recover';
            e.stateTimer = 0.35;
            e.attackCooldown = 1.15;
          }
        }
      } else if (e.state === 'attack') {
        e.stateTimer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (Math.hypot(this.px - e.x, this.py - e.y) < e.radius + 18) {
          this.damagePlayer(Math.round(e.damage * (e.witheredTimer > 0 ? 0.88 : 1)), 'physical');
          e.state = 'recover';
          e.stateTimer = 0.45;
          e.attackCooldown = 1.7;
          e.vx = 0;
          e.vy = 0;
        } else if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = 0.4;
          e.attackCooldown = 1.5;
          e.vx = 0;
          e.vy = 0;
        }
      } else if (e.state === 'recover') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) e.state = 'idle';
      }

      // Clamp enemy inside room
      e.x = Math.max(e.radius + 16, Math.min(room.width - e.radius - 16, e.x));
      e.y = Math.max(e.radius + 16, Math.min(room.height - e.radius - 16, e.y));
    }

    // Sanctuary Sparring Pulse
    if (this.inSanctuary && this.sanctuaryConfig.sparringPulse) {
      this.sanctuaryPulseTimer -= dt;
      if (this.sanctuaryPulseTimer <= 0) {
        this.sanctuaryPulseTimer = 2.6;
        const cx = 560;
        const cy = 470;
        this.slashEffects.push({
          x: cx,
          y: cy,
          angle: 0,
          arc: Math.PI * 2,
          radius: 220,
          color: '#F97316',
          life: 0.35,
          maxLife: 0.35,
        });
        this.burstParticles(cx, cy, '#F97316', 18, 'outer');
        if (Math.hypot(this.px - cx, this.py - cy) <= 220) {
          this.damagePlayer(28, 'fire');
        }
      }
    }

    // Check room cleared (non-Sanctuary)
    if (!this.inSanctuary && aliveCount === 0 && !room.cleared) {
      room.cleared = true;
      if (room.isBossRoom) {
        this.outcome = 'victory';
        this.setPhase('gameover');
        return;
      }
      this.spawnFloatingText(this.px, this.py - 44, 'Chamber Cleared — Portal Open', '#D99B38', true);
      soundEngine.playChamberClear();
    }

    // Auto-walkover loot pickup
    for (let i = this.groundLoot.length - 1; i >= 0; i--) {
      const g = this.groundLoot[i];
      g.pulsePhase += dt * 3;
      if (Math.hypot(g.x - this.px, g.y - this.py) < 34) {
        this.collectLoot(i);
      }
    }

    // Auto-enter portal when walking onto active portal pad
    if (!this.inSanctuary && room.cleared && !room.isBossRoom) {
      if (Math.hypot(this.px - room.portalX, this.py - room.portalY) < 42) {
        this.enterRoom(this.currentRoomIdx + 1);
        soundEngine.playDash();
      }
    }

    // DPS estimate + HUD sync
    this.dpsTimer += dt;
    if (this.dpsTimer >= 1.0) {
      this.dpsEstimate = Math.round(this.recentDamageDealt / this.dpsTimer);
      this.recentDamageDealt = 0;
      this.dpsTimer = 0;
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.emitHudSnapshot();
    }
  }

  private executeBossAttack(boss: Enemy) {
    const dmg = Math.round(boss.damage * (boss.witheredTimer > 0 ? 0.88 : 1));
    if (boss.bossAttackIndex === 0) {
      // Heavy Slam Ring
      const rad = boss.bossPhase === 2 ? 195 : 170;
      this.slashEffects.push({
        x: boss.x,
        y: boss.y,
        angle: 0,
        arc: Math.PI * 2,
        radius: rad,
        color: '#DC2626',
        life: 0.3,
        maxLife: 0.3,
      });
      this.burstParticles(boss.x, boss.y, '#DC2626', 24, 'outer');
      this.addTrauma(0.32);
      if (Math.hypot(this.px - boss.x, this.py - boss.y) < rad) {
        this.damagePlayer(dmg, 'fire');
      }
    } else if (boss.bossAttackIndex === 1) {
      // Radial Orb Volley (8 or 12 orbs in Phase II)
      const orbCount = boss.bossPhase === 2 ? 12 : 8;
      for (let k = 0; k < orbCount; k++) {
        const a = boss.aimAngle + (k * Math.PI * 2) / orbCount;
        this.projectiles.push({
          active: true,
          fromPlayer: false,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 285,
          vy: Math.sin(a) * 285,
          radius: 11,
          damageType: 'fire',
          damage: Math.round(dmg * 0.8),
          isCrit: false,
          life: 2.2,
          pierceLeft: 0,
          originX: boss.x,
          originY: boss.y,
          hitIds: new Set(),
        });
      }
    } else if (boss.bossAttackIndex === 2) {
      // Focused 3-bolt (or 5-bolt in Phase II) lance barrage
      const half = boss.bossPhase === 2 ? 2 : 1;
      for (let k = -half; k <= half; k++) {
        const a = boss.aimAngle + k * 0.19;
        this.projectiles.push({
          active: true,
          fromPlayer: false,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 365,
          vy: Math.sin(a) * 365,
          radius: 10,
          damageType: 'chaos',
          damage: Math.round(dmg * 0.85),
          isCrit: false,
          life: 1.8,
          pierceLeft: 0,
          originX: boss.x,
          originY: boss.y,
          hitIds: new Set(),
        });
      }
    } else {
      // Phase II Special: Dual-Spiral Chaos Surge + Ground Rift
      for (let k = 0; k < 6; k++) {
        const a = boss.aimAngle + k * (Math.PI / 3) + 0.25;
        this.projectiles.push({
          active: true,
          fromPlayer: false,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 250,
          vy: Math.sin(a) * 250,
          radius: 12,
          damageType: 'chaos',
          damage: Math.round(dmg * 0.9),
          isCrit: false,
          life: 2.4,
          pierceLeft: 0,
          originX: boss.x,
          originY: boss.y,
          hitIds: new Set(),
        });
      }
      this.spawnDecal(boss.x, boss.y, 120, 2.5, '#A855F7', 'crack');
    }
  }

  private damagePlayer(rawDamage: number, type: DamageType) {
    if (this.pInvulnTimer > 0 || this.phase !== 'playing') return;

    // Evasion check (disabled when Iron Aspect active)
    if (this.stats.canEvade) {
      const evadeChance = Math.min(0.45, this.stats.evasion / (this.stats.evasion + 350));
      if (Math.random() < evadeChance) {
        this.spawnFloatingText(this.px, this.py - 28, 'Evaded', '#94A3B8', false);
        this.pInvulnTimer = 0.12;
        return;
      }
    }

    let dmg = computeIncomingDamageMitigation(rawDamage, type, this.stats);
    this.damageTakenTotal += dmg;
    this.pInvulnTimer = 0.22;
    this.pHitFlash = 0.14;
    this.pScaleX = 1.2;
    this.pScaleY = 0.82;
    this.pEsRechargeDelay = 2.8;
    soundEngine.playPlayerHurt();
    this.addTrauma(0.28);
    // Widen FOV briefly on player hurt (disorient)
    this.fovKick = Math.max(this.fovKick, 0.4);
    this.fovKickSign = -1;

    // Regrowth Aspect queues 3% of damage taken as regen
    if (this.activeAspects.includes('regrowth')) {
      this.regrowthBank += dmg * 0.35;
    }

    // Absorb with Veil Shield first
    if (this.pVeilShield > 0) {
      const absorbed = Math.min(this.pVeilShield, dmg);
      this.pVeilShield -= absorbed;
      dmg -= absorbed;
    }
    // Then Energy Shield
    if (dmg > 0 && this.pEs > 0) {
      const absorbed = Math.min(this.pEs, dmg);
      this.pEs -= absorbed;
      dmg -= absorbed;
    }
    // Remaining hits Life
    if (dmg > 0) {
      this.pHp -= dmg;
      this.spawnFloatingText(this.px, this.py - 26, `-${dmg}`, '#DC2626', false);
    }

    // Radiant Barrier reflect
    if (this.barrierTimer > 0 && this.skillProgress.radiant_barrier.choices[5] === 'B') {
      for (const e of this.enemies) {
        if (e.koTimer > 0) continue;
        if (Math.hypot(e.x - this.px, e.y - this.py) < 120) {
          e.hp -= Math.round(rawDamage * 0.8);
          if (e.isDummy) e.hp = Math.max(1, e.hp);
          else if (e.hp <= 0 && e.koTimer === 0) this.onEnemyKilled(e);
        }
      }
    }

    if (this.pHp <= 0) {
      if (this.inSanctuary) {
        this.pHp = Math.max(1, Math.round(this.stats.maxLife * 0.25));
        this.spawnFloatingText(this.px, this.py - 34, 'Sanctuary Saved', '#D99B38', true);
      } else {
        this.pHp = 0;
        this.outcome = 'defeat';
        this.setPhase('gameover');
      }
    }
    this.emitHudSnapshot();
  }

  private resolvePlayerObstacles() {
    const room = this.domain.rooms[this.currentRoomIdx];
    const r = 16;
    this.px = Math.max(r + 16, Math.min(room.width - r - 16, this.px));
    this.py = Math.max(r + 16, Math.min(room.height - r - 16, this.py));
    for (const ob of room.obstacles) {
      this.pushCircleOutOfRect(ob, r);
    }
  }

  private pushCircleOutOfRect(rect: ObstacleRect, r: number) {
    const cx = Math.max(rect.x, Math.min(this.px, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(this.py, rect.y + rect.h));
    const dx = this.px - cx;
    const dy = this.py - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < r) {
      if (dist > 0.001) {
        this.px = cx + (dx / dist) * r;
        this.py = cy + (dy / dist) * r;
      } else {
        this.px = rect.x - r;
      }
    }
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    ctx.fillStyle = '#0B0B0F';
    ctx.fillRect(0, 0, w, h);

    const shake = this.trauma * this.trauma * 12;
    const sx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    ctx.translate(w / 2 - this.camX + sx, h / 2 - this.camY + sy);

    const room = this.domain.rooms[this.currentRoomIdx];

    // Arena floor tiles
    ctx.fillStyle = '#121218';
    ctx.fillRect(0, 0, room.width, room.height);

    ctx.strokeStyle = '#1E1E28';
    ctx.lineWidth = 1;
    const tile = 64;
    ctx.beginPath();
    for (let x = 0; x <= room.width; x += tile) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, room.height);
    }
    for (let y = 0; y <= room.height; y += tile) {
      ctx.moveTo(0, y);
      ctx.lineTo(room.width, y);
    }
    ctx.stroke();

    // Arena boundary obsidian trim
    ctx.strokeStyle = '#2E2E3E';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, room.width - 8, room.height - 8);

    // Layer 5: Ground Decals (burn, frost crystal, slam cracks, void tendrils)
    for (const d of this.decals) {
      if (!d.active) continue;
      const alpha = Math.min(1, d.life / Math.min(1, d.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha * 0.42;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.7;
      ctx.stroke();
      if (d.kind === 'crack') {
        ctx.beginPath();
        for (let c = 0; c < 6; c++) {
          const a = (c * Math.PI) / 3 + 0.2;
          ctx.moveTo(d.x + Math.cos(a) * 8, d.y + Math.sin(a) * 8);
          ctx.lineTo(d.x + Math.cos(a) * d.radius * 0.9, d.y + Math.sin(a) * d.radius * 0.9);
        }
        ctx.stroke();
      } else if (d.kind === 'frost') {
        ctx.beginPath();
        for (let c = 0; c < 6; c++) {
          const a = (c * Math.PI) / 3;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + Math.cos(a) * d.radius * 0.72, d.y + Math.sin(a) * d.radius * 0.72);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Exit Portal (when chamber cleared and not boss room / not sanctuary)
    if (!this.inSanctuary && !room.isBossRoom) {
      const pulse = 0.65 + Math.sin(this.simTime * 4) * 0.25;
      ctx.save();
      ctx.beginPath();
      ctx.arc(room.portalX, room.portalY, 34, 0, Math.PI * 2);
      ctx.fillStyle = room.cleared ? `rgba(217, 155, 56, ${0.22 * pulse})` : 'rgba(39, 39, 51, 0.35)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = room.cleared ? '#D99B38' : '#3F3F52';
      ctx.stroke();
      ctx.fillStyle = room.cleared ? '#FDE68A' : '#64748B';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.cleared ? 'NEXT CHAMBER' : 'SEALED', room.portalX, room.portalY - 42);
      ctx.restore();
    }

    // Sanctuary Arena Sparring Crystal & Dummy Pedestals
    if (this.inSanctuary) {
      const cx = 560;
      const cy = 470;
      ctx.save();
      if (this.sanctuaryConfig.sparringPulse && this.sanctuaryPulseTimer <= 0.75) {
        const prog = Math.max(0, Math.min(1, 1 - this.sanctuaryPulseTimer / 0.75));
        ctx.fillStyle = this.highContrastTelegraphs
          ? 'rgba(253, 224, 71, 0.16)'
          : 'rgba(249, 115, 22, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, 220 * prog, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.highContrastTelegraphs ? '#FDE047' : '#F97316';
        ctx.lineWidth = this.highContrastTelegraphs ? 3.5 : 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 220, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = this.sanctuaryConfig.sparringPulse ? '#D99B38' : '#272733';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx + 14, cy);
      ctx.lineTo(cx, cy + 18);
      ctx.lineTo(cx - 14, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.sanctuaryConfig.sparringPulse ? '#FDE68A' : '#525266';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPARRING WARD', cx, cy + 32);
      ctx.restore();
    }

    // Obstacles (Obsidian Pillars)
    for (const ob of room.obstacles) {
      ctx.fillStyle = '#1B1B24';
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      ctx.strokeStyle = '#323244';
      ctx.lineWidth = 2;
      ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
      ctx.fillStyle = 'rgba(217, 155, 56, 0.14)';
      ctx.fillRect(ob.x + 8, ob.y + 8, ob.w - 16, 4);
    }

    // Shape-Coded Ground Loot Beams (M5.1 Accessibility + Tier 4 Hierarchy)
    for (const g of this.groundLoot) {
      const c = RARITY_COLORS[g.item.rarity];
      const beamH = g.item.rarity === 'legendary' ? 72 : g.item.rarity === 'rare' ? 48 : 30;
      const pulse = 7 + Math.sin(g.pulsePhase) * 1.4;
      ctx.save();
      const grad = ctx.createLinearGradient(g.x, g.y, g.x, g.y - beamH);
      grad.addColorStop(0, c);
      grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - 4, g.y - beamH, 8, beamH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = c;
      ctx.strokeStyle = '#0B0B0F';
      ctx.lineWidth = 1.5;

      if (g.item.rarity === 'legendary' || g.item.markId) {
        // 6-point hex/star crest for Legendary or Mark-bearing chase drops
        ctx.beginPath();
        for (let p = 0; p < 6; p++) {
          const a = (p * Math.PI) / 3 - Math.PI / 6;
          const r = p % 2 === 0 ? pulse + 3.5 : pulse + 1;
          const px = g.x + Math.cos(a) * r;
          const py = g.y + Math.sin(a) * r;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (g.item.rarity === 'rare') {
        // Diamond for Rare drops
        ctx.beginPath();
        ctx.moveTo(g.x, g.y - pulse - 2);
        ctx.lineTo(g.x + pulse + 2, g.y);
        ctx.lineTo(g.x, g.y + pulse + 2);
        ctx.lineTo(g.x - pulse - 2, g.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Circle for Normal / Magic drops
        ctx.beginPath();
        ctx.arc(g.x, g.y, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.item.name, g.x, g.y + 22);
      ctx.restore();
    }

    // Enemy Attack Telegraphs with Progress Fill & High-Contrast Mode (behind actors)
    const hc = this.highContrastTelegraphs;
    for (const e of this.enemies) {
      if (e.koTimer > 0 || e.state !== 'windup') continue;
      const progress = e.windupDuration > 0
        ? Math.max(0.05, Math.min(1, 1 - e.stateTimer / e.windupDuration))
        : 0.5;
      ctx.save();
      if (e.archetype === 'charger') {
        const len = 240;
        const tx = e.x + Math.cos(e.aimAngle) * len;
        const ty = e.y + Math.sin(e.aimAngle) * len;
        const px = e.x + Math.cos(e.aimAngle) * (len * progress);
        const py = e.y + Math.sin(e.aimAngle) * (len * progress);
        ctx.strokeStyle = hc ? 'rgba(253, 224, 71, 0.35)' : 'rgba(220, 38, 38, 0.28)';
        ctx.lineWidth = e.radius * 1.8;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.strokeStyle = hc ? 'rgba(255, 46, 76, 0.85)' : 'rgba(220, 38, 38, 0.68)';
        ctx.lineWidth = e.radius * 1.3;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(px, py);
        ctx.stroke();

        if (hc) {
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      } else if (e.archetype === 'cultist') {
        const len = 320;
        ctx.strokeStyle = hc ? '#FDE047' : 'rgba(249, 115, 22, 0.55)';
        ctx.lineWidth = hc ? 3 : 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * len, e.y + Math.sin(e.aimAngle) * len);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = hc ? '#FF2E4C' : '#F97316';
        ctx.lineWidth = hc ? 4 : 2.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * (len * progress), e.y + Math.sin(e.aimAngle) * (len * progress));
        ctx.stroke();
      } else if (e.archetype === 'boss') {
        if (e.bossAttackIndex === 0) {
          ctx.fillStyle = hc ? 'rgba(255, 46, 76, 0.24)' : 'rgba(220, 38, 38, 0.14)';
          ctx.beginPath();
          ctx.arc(e.x, e.y, 170 * progress, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = hc ? '#FDE047' : 'rgba(220, 38, 38, 0.9)';
          ctx.lineWidth = hc ? 4 : 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 170, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const rays = e.bossAttackIndex === 1 ? 8 : 3;
          ctx.strokeStyle = hc ? '#FDE047' : 'rgba(220, 38, 38, 0.72)';
          ctx.lineWidth = hc ? 3 : 2;
          for (let k = 0; k < rays; k++) {
            const a = e.bossAttackIndex === 1
              ? e.aimAngle + (k * Math.PI * 2) / 8
              : e.aimAngle + (k - 1) * 0.22;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + Math.cos(a) * (200 * progress), e.y + Math.sin(a) * (200 * progress));
            ctx.stroke();
          }
        }
      } else {
        // Thrall / Stalker melee or lunge telegraph
        const reach = e.archetype === 'stalker' ? 160 : e.radius + 38;
        ctx.strokeStyle = hc ? '#FDE047' : 'rgba(250, 204, 21, 0.65)';
        ctx.lineWidth = hc ? 3.5 : 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 8, e.aimAngle - 0.75, e.aimAngle + 0.75);
        ctx.stroke();
        ctx.strokeStyle = hc ? 'rgba(255, 46, 76, 0.85)' : 'rgba(249, 115, 22, 0.6)';
        ctx.lineWidth = hc ? 4 : 2.5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAngle) * (reach * progress), e.y + Math.sin(e.aimAngle) * (reach * progress));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Enemies (with Squash & Stretch + Training Dummy Pedestals)
    for (const e of this.enemies) {
      if (e.isDummy) {
        ctx.save();
        ctx.fillStyle = '#1B1B24';
        ctx.beginPath();
        ctx.arc(e.x, e.y + 6, e.radius + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = e.isElite ? '#D99B38' : '#3F3F52';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#94A3B8';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          e.isElite ? `WARD (${e.armour} ARM / ${e.resistPct}% RES)` : 'ASH DUMMY (0 MIT)',
          e.x,
          e.y + e.radius + 28
        );
        ctx.restore();
      }

      ctx.save();
      if (e.koTimer > 0) {
        ctx.globalAlpha = Math.max(0, e.koTimer / 0.3);
      }
      ctx.translate(e.x, e.y);
      ctx.scale(e.scaleX, e.scaleY);

      const isFlash = e.hitFlash > 0;
      const baseColor = isFlash
        ? '#FFFFFF'
        : e.isDummy
          ? e.isElite
            ? '#B45309'
            : '#475569'
          : e.archetype === 'boss'
            ? '#D99B38'
            : e.archetype === 'charger'
              ? '#DC2626'
              : e.archetype === 'cultist'
                ? '#F97316'
                : e.archetype === 'stalker'
                  ? '#A855F7'
                  : '#64748B';

      // Silhouette by archetype
      ctx.fillStyle = e.chillTimer > 0 && !isFlash ? '#22D3EE' : baseColor;
      ctx.beginPath();
      if (e.archetype === 'charger') {
        // Diamond armored juggernaut
        ctx.moveTo(0, -e.radius);
        ctx.lineTo(e.radius, 0);
        ctx.lineTo(0, e.radius);
        ctx.lineTo(-e.radius, 0);
        ctx.closePath();
      } else if (e.archetype === 'cultist') {
        // Triangle hood
        ctx.moveTo(0, -e.radius);
        ctx.lineTo(e.radius, e.radius * 0.85);
        ctx.lineTo(-e.radius, e.radius * 0.85);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.lineWidth = e.isElite || e.archetype === 'boss' ? 3 : 1.5;
      ctx.strokeStyle = e.state === 'windup' ? '#FDE047' : e.isElite ? '#D99B38' : '#0B0B0F';
      ctx.stroke();
      ctx.restore();

      // HP bar above damaged non-boss enemies
      if (e.koTimer === 0 && e.archetype !== 'boss' && e.hp < e.maxHp) {
        const bw = e.radius * 2.2;
        ctx.fillStyle = '#0B0B0F';
        ctx.fillRect(e.x - bw / 2, e.y - e.radius - 10, bw, 4);
        ctx.fillStyle = e.isDummy ? '#D99B38' : '#DC2626';
        ctx.fillRect(e.x - bw / 2, e.y - e.radius - 10, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    // Shade afterimages
    for (const img of this.afterImages) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, img.life / 0.35) * 0.45;
      ctx.fillStyle = img.color;
      ctx.beginPath();
      ctx.arc(img.x, img.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Player Character + Aspect Visual Identity + Glowing Weapon
    this.renderPlayer(ctx);

    // Weapon Ribbon Trail
    if (this.weaponTrail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < this.weaponTrail.length; i++) {
        const prev = this.weaponTrail[i - 1];
        const curr = this.weaponTrail[i];
        ctx.globalAlpha = Math.max(0, curr.life / 0.18) * 0.75;
        ctx.strokeStyle = curr.color;
        ctx.lineWidth = 6 * (curr.life / 0.18);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Slash Arcs & Rings
    for (const s of this.slashEffects) {
      const t = s.life / s.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.85;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 8 * t;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * (1.06 - t * 0.1), s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.stroke();
      ctx.restore();
    }

    // Lightning Chains
    for (const l of this.lightningEffects) {
      const t = l.life / l.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i < l.points.length; i++) {
        const pt = l.points[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          const prev = l.points[i - 1];
          const midX = (prev.x + pt.x) / 2 + (Math.random() - 0.5) * 24;
          const midY = (prev.y + pt.y) / 2 + (Math.random() - 0.5) * 24;
          ctx.lineTo(midX, midY);
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Projectiles (High Emissive Priority, fast layered glow without CPU shadowBlur)
    for (const pr of this.projectiles) {
      ctx.save();
      const c = pr.fromPlayer ? DAMAGE_COLORS[pr.damageType] : '#EF4444';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * 1.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

      // Additive Emissive Particle Layers
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.layer === 'outer' ? alpha * 0.32 : alpha * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.layer === 'outer' ? 1.8 : 1), 0, Math.PI * 2);
      ctx.fill();
    }

    // M3.3 Anamorphic Horizontal Crit Streaks & Spectral Chromatic Flares
    for (const s of this.critStreaks) {
      if (!s.active) continue;
      const t = Math.max(0, s.life / s.maxLife);
      const halfW = s.width * (0.65 + (1 - t) * 0.45);
      const grad = ctx.createLinearGradient(s.x - halfW, s.y, s.x + halfW, s.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, s.color);
      grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = t * 0.85;
      ctx.fillStyle = grad;
      ctx.fillRect(s.x - halfW, s.y - 2.5, halfW * 2, 5);
      if (s.chromatic) {
        ctx.globalAlpha = t * 0.45;
        ctx.fillStyle = '#22D3EE';
        ctx.fillRect(s.x - halfW * 0.8, s.y - 5, halfW * 1.6, 2);
        ctx.fillStyle = '#F97316';
        ctx.fillRect(s.x - halfW * 0.8, s.y + 3, halfW * 1.6, 2);
      }
    }
    ctx.restore();

    // Floating Damage Numbers
    for (const f of this.floatingTexts) {
      if (!f.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 1.4);
      ctx.font = f.isCrit
        ? '700 17px "JetBrains Mono", monospace'
        : '600 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0B0B0F';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const bob = Math.sin(this.pWalkPhase) * 2;
    ctx.save();

    // M3.4 Aspect Armour & Aura Visual Identity
    if (this.activeAspects.includes('cinder') || this.activeAspects.includes('pyromancer')) {
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 22 + Math.sin(this.simTime * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.activeAspects.includes('frigid') || this.activeAspects.includes('frostbite')) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + this.simTime * 0.5;
        const x1 = this.px + Math.cos(a) * 20;
        const y1 = this.py + Math.sin(a) * 20;
        const x2 = this.px + Math.cos(a) * 26;
        const y2 = this.py + Math.sin(a) * 26;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    if (this.activeAspects.includes('iron') || this.activeAspects.includes('bastion')) {
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.35;
        ctx.arc(this.px, this.py, 21, a, a + 0.9);
      }
      ctx.stroke();
    }
    if (this.activeAspects.includes('storm')) {
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 2;
      for (let side of [-1, 1]) {
        const sa = this.pAimAngle + side * 1.45;
        const sx = this.px + Math.cos(sa) * 18;
        const sy = this.py + Math.sin(sa) * 18;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(sa + 0.4) * 8, sy + Math.sin(sa + 0.4) * 8);
        ctx.lineTo(sx + Math.cos(sa - 0.3) * 12, sy + Math.sin(sa - 0.3) * 12);
        ctx.stroke();
      }
    }
    if (this.activeAspects.includes('aether') || this.pEs > 0 || this.barrierTimer > 0) {
      ctx.strokeStyle = this.barrierTimer > 0 ? '#7DD3FC' : 'rgba(59, 130, 246, 0.72)';
      ctx.lineWidth = this.barrierTimer > 0 ? 3 : 1.6;
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const a = (h * Math.PI) / 3;
        const hx = this.px + Math.cos(a) * 25;
        const hy = this.py + Math.sin(a) * 25;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
    if (this.activeAspects.includes('eclipse')) {
      const orbitA = this.simTime * 2.2;
      const ex = this.px + Math.cos(orbitA) * 29;
      const ey = this.py + Math.sin(orbitA) * 29;
      ctx.fillStyle = this.eclipseReady ? '#D99B38' : '#525266';
      ctx.beginPath();
      ctx.arc(ex, ey, this.eclipseReady ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.shadeEmpowered) {
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(this.px, this.py, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Player body (with squash & stretch + Blood Aspect pulsing veins)
    ctx.save();
    ctx.translate(this.px, this.py + bob * 0.4);
    ctx.scale(this.pScaleX, this.pScaleY);
    ctx.fillStyle = this.pHitFlash > 0 ? '#FFFFFF' : '#E2E8F0';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    if (this.activeAspects.includes('blood') || this.activeAspects.includes('berserk')) {
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-1, 2);
      ctx.lineTo(7, -6);
      ctx.moveTo(-4, 8);
      ctx.lineTo(3, 1);
      ctx.lineTo(9, 6);
      ctx.stroke();
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.activeAspects.includes('blood') ? '#DC2626' : '#D99B38';
    ctx.stroke();
    ctx.restore();

    // Glowing Weapon facing cursor (fast layered stroke without CPU shadowBlur)
    const mainSkillColor = DAMAGE_COLORS[SKILLS[this.hotbar[0]].damageType];
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.rotate(this.pAimAngle);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = mainSkillColor;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(12, 6);
    ctx.lineTo(30, 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = mainSkillColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(12, 6);
    ctx.lineTo(30, 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  public emitHudSnapshot() {
    const room = this.domain.rooms[this.currentRoomIdx];
    const boss = this.enemies.find((e) => e.archetype === 'boss' && e.koTimer === 0);

    const skillCosts = this.hotbar.map((id) => {
      const s = SKILLS[id];
      const prog = this.skillProgress[id];
      let c = Math.round(s.manaCost * this.stats.manaCostMult);
      if (s.id === 'ashen_nova' && prog.choices[5] === 'C') c = Math.round(c * 0.7);
      if (this.eclipseReady && s.category !== 'defensive') c *= 2;
      return c;
    });

    const skillUsesLife = this.hotbar.map((id) => {
      const s = SKILLS[id];
      return this.stats.lifeCostsSkills && s.category !== 'defensive';
    });

    this.callbacks.onHudUpdate({
      phase: this.phase,
      outcome: this.outcome,
      hp: Math.round(this.pHp),
      maxHp: this.stats.maxLife,
      ghostHp: Math.round(this.pGhostHp),
      es: Math.round(this.pEs),
      maxEs: this.stats.maxEnergyShield,
      veilShield: Math.round(this.pVeilShield),
      mp: Math.round(this.pMp),
      maxMp: this.stats.maxMana,
      playerLevel: this.pLevel,
      xp: this.pXp,
      xpToNext: this.pXpToNext,
      flaskCharges: this.pFlaskCharges,
      maxFlaskCharges: this.pMaxFlaskCharges,
      shards: this.pShards,
      kills: this.kills,
      totalRoomEnemies: this.enemies.filter((e) => e.koTimer === 0).length,
      roomCleared: room.cleared,
      domainTier: this.domain.tier,
      corrupted: this.domain.corrupted,
      currentRoomIndex: this.currentRoomIdx,
      totalRooms: this.domain.rooms.length,
      roomNames: this.domain.rooms.map((r) => r.name),
      clearedRooms: this.domain.rooms.map((r) => r.cleared),
      roomConnections: this.domain.connections,
      bossActive: Boolean(boss),
      bossName: boss?.name ?? '',
      bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
      bossMaxHp: boss?.maxHp ?? 1,
      bossPhase: boss?.bossPhase ?? 1,
      eclipseReady: this.eclipseReady,
      eclipseTimer: this.eclipseTimer,
      shadeReady: this.shadeEmpowered,
      critMomentumTimer: this.critMomentumTimer,
      barrierTimer: this.barrierTimer,
      cooldowns: [...this.pCooldowns],
      maxCooldowns: [...this.pMaxCooldowns],
      skillCosts,
      skillUsesLife,
      bufferedSlot: this.bufferedSlot,
      inSanctuary: this.inSanctuary,
      sanctuaryConfig: { ...this.sanctuaryConfig },
      sanctuaryTelemetry: { ...this.sanctuaryTelemetry },
      dpsEstimate: this.dpsEstimate,
      elapsedSeconds: this.elapsedSeconds,
      damageTakenTotal: this.damageTakenTotal,
      pendingSkillUpgrade: this.pendingSkillUpgrade,
      recentLootToast: this.recentLootToast,
    });
  }

  public getAspectSlotCap(pinnacleKills: number): number {
    return getUnlockedAspectSlots(this.pLevel, pinnacleKills);
  }

  public getThreeRenderState() {
    const room = this.domain.rooms[this.currentRoomIdx];
    return {
      phase: this.phase,
      simTime: this.simTime,
      hitstopTimer: this.hitstopTimer,
      trauma: this.screenShakeEnabled ? this.trauma : 0,
      screenFlash: this.screenFlash,
      screenFlashColor: this.screenFlashColor,
      fovKick: this.fovKick,
      fovKickSign: this.fovKickSign,
      highContrastTelegraphs: this.highContrastTelegraphs,
      inSanctuary: this.inSanctuary,
      roomIndex: this.currentRoomIdx,
      roomWidth: room.width,
      roomHeight: room.height,
      roomCleared: room.cleared,
      isBossRoom: room.isBossRoom,
      obstacles: room.obstacles,
      portalX: room.portalX,
      portalY: room.portalY,
      player: {
        x: this.px,
        y: this.py,
        vx: this.pvx,
        vy: this.pvy,
        aimAngle: this.pAimAngle,
        walkPhase: this.pWalkPhase,
        scaleX: this.pScaleX,
        scaleY: this.pScaleY,
        hitFlash: this.pHitFlash,
        invuln: this.pInvulnTimer > 0,
        es: this.pEs,
        veilShield: this.pVeilShield,
        barrierActive: this.barrierTimer > 0,
        eclipseReady: this.eclipseReady,
        eclipseTimer: this.eclipseTimer,
        activeAspects: this.activeAspects,
        primaryDamageType: SKILLS[this.hotbar[0]].damageType,
        moveTarget: {
          active: this.moveTargetActive,
          x: this.moveTargetX,
          y: this.moveTargetY,
          kind: this.moveTargetKind,
        },
      },
      enemies: this.enemies,
      projectiles: this.projectiles,
      groundLoot: this.groundLoot,
      slashEffects: this.slashEffects,
      lightningEffects: this.lightningEffects,
      afterImages: this.afterImages,
      weaponTrail: this.weaponTrail,
      particles: this.particles,
      decals: this.decals,
      critStreaks: this.critStreaks,
      floatingTexts: this.floatingTexts,
    };
  }
}
