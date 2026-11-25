export type DamageType = 'fire' | 'cold' | 'lightning' | 'physical' | 'chaos';

export type SkillCategory = 'melee' | 'projectile' | 'area' | 'movement' | 'spell' | 'dot' | 'defensive';

export type SkillId =
  | 'cinder_slash'
  | 'ember_bolt'
  | 'frost_lance'
  | 'ashen_nova'
  | 'shadow_step'
  | 'storm_spike'
  | 'bone_spear'
  | 'seismic_slam'
  | 'void_tendrils'
  | 'radiant_barrier';

export type UpgradeBranch = 'A' | 'B' | 'C';
export type UpgradeTier = 5 | 10 | 15;

export interface SkillUpgradeChoice {
  branch: UpgradeBranch;
  name: string;
  summary: string;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  category: SkillCategory;
  tags: SkillCategory[];
  damageType: DamageType;
  baseDamage: number;
  damagePerLevel: number;
  manaCost: number;
  cooldown: number;
  critChance: number; // e.g. 0.08 = 8%
  range: number;
  radius: number;
  description: string;
  upgrades: Record<UpgradeTier, [SkillUpgradeChoice, SkillUpgradeChoice, SkillUpgradeChoice]>;
}

export interface SkillProgress {
  level: number; // 1..20
  xp: number;
  choices: Partial<Record<UpgradeTier, UpgradeBranch>>;
}

export type AspectId =
  | 'blood'
  | 'cinder'
  | 'storm'
  | 'precision'
  | 'overload'
  | 'iron'
  | 'aether'
  | 'veil'
  | 'regrowth'
  | 'hunter'
  | 'earthquake'
  | 'shade'
  | 'siphon'
  | 'eclipse'
  | 'frigid';

export type AspectCategory = 'offense' | 'defense' | 'utility';

export interface AspectDef {
  id: AspectId;
  name: string;
  category: AspectCategory;
  bonusText: string;
  drawbackText: string;
  accentColor: string;
}

export type MarkId =
  | 'repeating_echoes'
  | 'critical_momentum'
  | 'withering_touch'
  | 'flowing_shadow'
  | 'low_life_covenant'
  | 'fortress_heart'
  | 'aether_overflow'
  | 'eclipse_core';

export interface MarkDef {
  id: MarkId;
  name: string;
  description: string;
}

export type EquipSlot =
  | 'weapon'
  | 'body'
  | 'helmet'
  | 'gloves'
  | 'boots'
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'belt';

export type Rarity = 'normal' | 'magic' | 'rare' | 'legendary';

export interface ItemMods {
  flatDamage?: number;
  maxLife?: number;
  maxMana?: number;
  maxEnergyShield?: number;
  armour?: number;
  evasion?: number;
  increasedDamagePct?: number;
  critChancePct?: number;
  critMultiplierPct?: number;
  attackCastSpeedPct?: number;
  movementSpeedPct?: number;
  fireResPct?: number;
  coldResPct?: number;
  lightningResPct?: number;
  chaosResPct?: number;
  skillLevelBonus?: number;
}

export interface GearItem {
  id: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  itemLevel: number;
  mods: ItemMods;
  markId?: MarkId;
  legendaryId?: string;
  legendaryEffectText?: string;
  modTier: number; // 1..5
}

export interface DomainModifier {
  id: string;
  name: string;
  riskText: string;
  rewardText: string;
  enemyLifeMult: number;
  enemyDamageMult: number;
  enemySpeedMult: number;
  lootRarityBonus: number; // e.g. 0.35 = +35%
  xpBonus: number;
  burningGround?: boolean;
}

export interface ComputedPlayerStats {
  maxLife: number;
  maxMana: number;
  maxEnergyShield: number;
  armour: number;
  evasion: number;
  canEvade: boolean;
  flatDamage: number;
  increasedDamagePct: number;
  critChance: number;
  critMultiplier: number;
  actionSpeedMult: number;
  areaMult: number;
  movementSpeed: number;
  lifeLeechRate: number;
  lifeCostsSkills: boolean;
  fireRes: number;
  coldRes: number;
  lightningRes: number;
  chaosRes: number;
  chillEffectMult: number;
  veilShieldMax: number;
  veilCooldown: number;
  regrowthPctPerSec: number;
  flaskRecoveryMult: number;
  fireDamageTakenMult: number;
  skillLevelBonus: number;
  extraChains: number;
  repeatChance: number;
  areaRepeatChance: number;
  activeMarks: MarkId[];
  activeLegendaries: string[];
}

export interface DamageCalculationInput {
  skill: SkillDef;
  skillProgress: SkillProgress;
  stats: ComputedPlayerStats;
  activeAspects: AspectId[];
  isMovementEmpowered: boolean; // Shade Aspect
  isEclipseEmpowered: boolean;  // Eclipse Aspect
  isDistantTarget: boolean;     // Hunter Aspect
  isLowLife: boolean;           // Life <= 35% or Low Life Covenant
  isCrit: boolean;
  enemyResistPct: number;       // 0..75
  enemyArmour: number;
}

export interface DamageCalculationResult {
  baseAndFlat: number;
  afterIncreased: number;
  moreMultipliersApplied: number[];
  afterMore: number;
  afterCrit: number;
  finalDamage: number;
  leechAmount: number;
}

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export interface EnemySnapshot {
  archetype: 'thrall' | 'cultist' | 'charger' | 'stalker' | 'boss';
  name: string;
}

export type HudScaleOption = 0.85 | 1 | 1.15;

export interface SanctuaryConfig {
  dummyArmour: number;
  dummyResistPct: number;
  sparringPulse: boolean;
}

export interface SanctuaryTelemetry {
  peakHit: number;
  hitCount: number;
  critCount: number;
  lastHitSkill: string;
  lastHitIsCrit: boolean;
  lastHitBreakdown: DamageCalculationResult | null;
}

export interface HudSnapshot {
  phase: GamePhase;
  outcome: 'victory' | 'defeat' | null;
  hp: number;
  maxHp: number;
  ghostHp: number;
  es: number;
  maxEs: number;
  veilShield: number;
  mp: number;
  maxMp: number;
  playerLevel: number;
  xp: number;
  xpToNext: number;
  flaskCharges: number;
  maxFlaskCharges: number;
  shards: number;
  kills: number;
  totalRoomEnemies: number;
  roomCleared: boolean;
  domainTier: number;
  corrupted: boolean;
  currentRoomIndex: number;
  totalRooms: number;
  roomNames: string[];
  clearedRooms: boolean[];
  roomConnections: [number, number][];
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  eclipseReady: boolean;
  eclipseTimer: number;
  shadeReady: boolean;
  critMomentumTimer: number;
  barrierTimer: number;
  cooldowns: number[]; // length 5
  maxCooldowns: number[]; // length 5
  skillCosts: number[]; // length 5
  skillUsesLife: boolean[]; // length 5
  bufferedSlot: number | null;
  inSanctuary: boolean;
  sanctuaryConfig: SanctuaryConfig;
  sanctuaryTelemetry: SanctuaryTelemetry;
  dpsEstimate: number;
  elapsedSeconds: number;
  damageTakenTotal: number;
  pendingSkillUpgrade: { skillId: SkillId; tier: UpgradeTier } | null;
  recentLootToast: { name: string; rarity: Rarity } | null;
}
