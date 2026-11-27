import {
  ALL_MARK_IDS,
  LEGENDARY_TEMPLATES,
} from './data';
import {
  AspectId,
  ComputedPlayerStats,
  DamageCalculationInput,
  DamageCalculationResult,
  EquipSlot,
  GearItem,
  MarkId,
  Rarity,
} from './types';

export function aggregateGearStats(
  equipment: Partial<Record<EquipSlot, GearItem>>,
  activeAspects: AspectId[],
  playerLevel: number,
  critMomentumActive = false,
  radiantBarrierActive = false
): ComputedPlayerStats {
  const hasAspect = (id: AspectId) => activeAspects.includes(id);

  let maxLife = 160 + (playerLevel - 1) * 32;
  let maxMana = 90 + (playerLevel - 1) * 8;
  let maxEnergyShield = 20 + (playerLevel - 1) * 4;
  let armour = 40 + (playerLevel - 1) * 10;
  let evasion = 25 + (playerLevel - 1) * 6;
  let flatDamage = (playerLevel - 1) * 2;
  let increasedDamagePct = 0;
  let critChancePct = 0;
  let critMultiplierPct = 150; // 1.5x baseline
  let attackCastSpeedPct = 0;
  let movementSpeedPct = 0;
  let fireRes = 0;
  let coldRes = 0;
  let lightningRes = 0;
  let chaosRes = 0;
  let statusResistPct = 0;
  let skillLevelBonus = 0;

  const activeMarksSet = new Set<MarkId>();
  const activeLegendaries: string[] = [];

  for (const item of Object.values(equipment)) {
    if (!item) continue;
    const m = item.mods;
    if (m.flatDamage) flatDamage += m.flatDamage;
    if (m.maxLife) maxLife += m.maxLife;
    if (m.maxMana) maxMana += m.maxMana;
    if (m.maxEnergyShield) maxEnergyShield += m.maxEnergyShield;
    if (m.armour) armour += m.armour;
    if (m.evasion) evasion += m.evasion;
    if (m.increasedDamagePct) increasedDamagePct += m.increasedDamagePct;
    if (m.critChancePct) critChancePct += m.critChancePct;
    if (m.critMultiplierPct) critMultiplierPct += m.critMultiplierPct;
    if (m.attackCastSpeedPct) attackCastSpeedPct += m.attackCastSpeedPct;
    if (m.movementSpeedPct) movementSpeedPct += m.movementSpeedPct;
    if (m.fireResPct) fireRes += m.fireResPct;
    if (m.coldResPct) coldRes += m.coldResPct;
    if (m.lightningResPct) lightningRes += m.lightningResPct;
    if (m.chaosResPct) chaosRes += m.chaosResPct;
    if (m.statusResistPct) statusResistPct += m.statusResistPct;
    if (m.skillLevelBonus) skillLevelBonus += m.skillLevelBonus;
    if (item.markId) activeMarksSet.add(item.markId);
    if (item.legendaryId) activeLegendaries.push(item.legendaryId);
  }

  const activeMarks = Array.from(activeMarksSet);
  const hasMark = (id: MarkId) => activeMarksSet.has(id);
  const hasLeg = (id: string) => activeLegendaries.includes(id);

  // Iron Aspect: +60% more Armour, Cannot Evade
  let canEvade = true;
  if (hasAspect('iron')) {
    armour = Math.round(armour * 1.6);
    canEvade = false;
    evasion = 0;
  }

  // Bastion Aspect: +35% Armour & +15% All Elemental Resistances, -10% Move Speed
  if (hasAspect('bastion')) {
    armour = Math.round(armour * 1.35);
    fireRes += 15;
    coldRes += 15;
    lightningRes += 15;
    movementSpeedPct -= 10;
  }

  // Phantom (evasion_master) Aspect: +60% more Evasion & +12% Move Speed, -25% Armour
  if (hasAspect('evasion_master')) {
    if (canEvade) {
      evasion = Math.round(evasion * 1.6);
    }
    movementSpeedPct += 12;
    armour = Math.round(armour * 0.75);
  }

  // Pyromancer Aspect: -15% Cold Res
  if (hasAspect('pyromancer')) {
    coldRes -= 15;
  }

  // Iron Vow Plate legendary: Iron Aspect grants 8% of Armour as Max Life
  if (hasAspect('iron') && hasLeg('iron_vow_plate')) {
    maxLife += Math.round(armour * 0.08);
  }

  // Aether Aspect: +45% more Energy Shield, 20% less Maximum Life
  if (hasAspect('aether')) {
    maxEnergyShield = Math.round(maxEnergyShield * 1.45);
    maxLife = Math.round(maxLife * 0.8);
  }

  // Glass Cannon Aspect: 25% less Max Life & ES
  if (hasAspect('glass_cannon')) {
    maxLife = Math.round(maxLife * 0.75);
    maxEnergyShield = Math.round(maxEnergyShield * 0.75);
  }

  // Chronomancer Aspect: -15% Max Life
  if (hasAspect('chronomancer')) {
    maxLife = Math.round(maxLife * 0.85);
  }

  // Aether Overflow Mark: 10% of Max ES added as flat damage
  if (hasMark('aether_overflow')) {
    flatDamage += Math.round(maxEnergyShield * 0.1);
  }

  // Precision Aspect: +50% Crit Multiplier
  if (hasAspect('precision')) {
    critMultiplierPct += 50;
  }

  // Frostbite & Harvester action speed / crit chance modifiers
  if (hasAspect('frostbite')) {
    attackCastSpeedPct -= 12;
  }

  // Storm Aspect: -15% less Crit Chance, +2 chains
  let critChance = Math.max(0.02, 0.06 + critChancePct / 100);
  if (hasAspect('harvester')) {
    critChance = Math.max(0.02, critChance - 0.1);
  }
  if (hasAspect('storm')) {
    critChance *= 0.85;
  }

  let extraChains = hasAspect('storm') ? 2 : 0;
  if (hasAspect('storm') && hasLeg('chain_stormlord')) {
    extraChains += 2;
  }

  let repeatChance = hasAspect('overload') ? 0.25 : 0;
  if (hasLeg('chain_stormlord')) {
    repeatChance += 0.15;
  }
  const areaRepeatChance = hasMark('repeating_echoes') ? 0.2 : 0;

  // Critical Momentum Mark
  if (critMomentumActive && hasMark('critical_momentum')) {
    attackCastSpeedPct += 15;
  }

  // Frigid Aspect: -8% move speed unless Crown of Endless Winter
  if (hasAspect('frigid') && !hasLeg('crown_winter')) {
    movementSpeedPct -= 8;
  }

  // Radiant Barrier bonus
  if (radiantBarrierActive) {
    armour = Math.round(armour * 1.25);
    fireRes += 20;
    coldRes += 20;
    lightningRes += 20;
  }

  // Siphon Aspect + Heart of the Berserker
  let lifeLeechRate = hasAspect('siphon') ? 0.15 : 0;
  if (hasAspect('blood') && hasLeg('heart_berserker')) {
    lifeLeechRate += 0.12;
  }

  const chillEffectMult =
    (hasAspect('frigid') ? 1.3 : 1.0) * (hasLeg('crown_winter') ? 1.2 : 1.0);

  return {
    maxLife: Math.max(60, Math.round(maxLife)),
    maxMana: Math.max(30, Math.round(maxMana)),
    maxEnergyShield: Math.max(0, Math.round(maxEnergyShield)),
    armour: Math.max(0, Math.round(armour)),
    evasion: canEvade ? Math.max(0, Math.round(evasion)) : 0,
    canEvade,
    flatDamage,
    increasedDamagePct,
    critChance: Math.min(0.85, critChance),
    critMultiplier: critMultiplierPct / 100,
    actionSpeedMult: Math.max(0.65, 1 + attackCastSpeedPct / 100),
    areaMult:
      (hasAspect('earthquake') ? 1.3 : 1.0) *
      (hasAspect('hunter') ? 0.9 : 1.0) *
      (hasAspect('pyromancer') ? 1.2 : 1.0),
    movementSpeed: Math.max(150, Math.round(235 * (1 + movementSpeedPct / 100))),
    lifeLeechRate,
    lifeCostsSkills: hasAspect('blood'),
    fireRes: Math.min(75, fireRes),
    coldRes: Math.min(75, coldRes),
    lightningRes: Math.min(75, lightningRes),
    chaosRes: Math.min(75, chaosRes),
    statusResistPct: Math.min(75, Math.max(0, statusResistPct)),
    chillEffectMult,
    veilShieldMax: hasAspect('veil') ? Math.round(maxLife * 0.22 + 40) : 0,
    veilCooldown: 7,
    regrowthPctPerSec: hasAspect('regrowth') ? 0.0075 : 0, // 3% over 4s
    flaskRecoveryMult: (hasAspect('regrowth') ? 0.8 : 1.0) * (hasAspect('immortal_ward') ? 0.8 : 1.0),
    fireDamageTakenMult: hasAspect('cinder') ? 1.12 : 1.0,
    skillLevelBonus,
    extraChains,
    repeatChance: Math.min(0.6, repeatChance),
    areaRepeatChance,
    cooldownRecoveryMult: hasAspect('chronomancer') ? 0.8 : 1.0,
    esRechargeMult: hasAspect('immortal_ward') ? 1.4 : 1.0,
    burnMagnitudeMult: hasAspect('pyromancer') ? 1.5 : 1.0,
    killLifeGain: hasAspect('harvester') ? 8 : 0,
    killManaGain: hasAspect('harvester') ? 8 : 0,
    manaCostMult: hasAspect('arcane_surge') ? 1.25 : 1.0,
    physicalDamageTakenMult: hasAspect('berserk') ? 1.1 : 1.0,
    activeMarks,
    activeLegendaries,
  };
}

/**
 * Exact 6-step Damage Calculation Order from Master Plan §3.1:
 * 1. Base skill damage (scaled by skill level)
 * 2. + Flat added damage
 * 3. * (1 + sum of all Increased Damage %)  [Additive]
 * 4. * each More Damage multiplier sequentially [Multiplicative]
 * 5. * Critical Strike Multiplier (if crit)
 * 6. -> Enemy resistances & armour mitigation applied last
 */
export function calculateSkillDamage(input: DamageCalculationInput): DamageCalculationResult {
  const { skill, skillProgress, stats, activeAspects } = input;
  const hasAspect = (id: AspectId) => activeAspects.includes(id);

  const effectiveLevel = Math.min(25, skillProgress.level + stats.skillLevelBonus);

  // 1. Base skill damage
  let baseDamage = skill.baseDamage + (effectiveLevel - 1) * skill.damagePerLevel;

  // Skill milestone upgrade flat/base adjustments
  const c5 = skillProgress.choices[5];
  const c10 = skillProgress.choices[10];
  const c15 = skillProgress.choices[15];

  if (skill.id === 'cinder_slash' && c5 === 'A') {
    baseDamage *= 1.15;
  }
  // Colossus Impact (Seismic Slam Lv15 A) — 10% of Armour as flat damage
  if (skill.id === 'seismic_slam' && c15 === 'A') {
    baseDamage += Math.round(stats.armour * 0.1);
  }

  // 2. + Flat added damage
  const baseAndFlat = baseDamage + stats.flatDamage;

  // 3. * (1 + sum of Increased Damage %) [Additive]
  const increasedSum = stats.increasedDamagePct / 100;
  const afterIncreased = baseAndFlat * (1 + increasedSum);

  // 4. * each More Damage multiplier sequentially [Multiplicative]
  const moreMultipliersApplied: number[] = [];

  if (hasAspect('blood') && skill.tags.includes('melee')) {
    moreMultipliersApplied.push(1.35);
  }
  if (hasAspect('cinder') && skill.damageType === 'fire') {
    moreMultipliersApplied.push(1.4);
  }
  if (hasAspect('hunter') && skill.tags.includes('projectile')) {
    moreMultipliersApplied.push(1.25);
    if (input.isDistantTarget) {
      moreMultipliersApplied.push(1.15);
    }
  }
  if (hasAspect('shade') && input.isMovementEmpowered && skill.category !== 'movement') {
    moreMultipliersApplied.push(1.4);
  }
  if (hasAspect('eclipse') && input.isEclipseEmpowered && skill.category !== 'defensive') {
    moreMultipliersApplied.push(1.6);
  }
  if (hasAspect('precision') && !input.isCrit) {
    // Precision drawback: Non-critical hits deal 20% less damage
    moreMultipliersApplied.push(0.8);
  }
  if (hasAspect('berserk') && input.isLowLife && skill.tags.includes('melee')) {
    moreMultipliersApplied.push(1.25);
  }
  if (hasAspect('frostbite') && skill.damageType === 'cold' && input.isTargetChilled) {
    moreMultipliersApplied.push(1.35);
  }
  if (hasAspect('arcane_surge') && skill.tags.includes('spell') && (input.isHighMana ?? true)) {
    moreMultipliersApplied.push(1.3);
  }
  if (hasAspect('glass_cannon')) {
    moreMultipliersApplied.push(1.45);
  }
  if (hasAspect('harvester') && (skill.damageType === 'chaos' || skill.tags.includes('dot'))) {
    moreMultipliersApplied.push(1.25);
  }

  // Skill Lv 5/10/15 Multiplicative Upgrades
  if (skill.id === 'cinder_slash' && c15 === 'A' && input.isLowLife) {
    moreMultipliersApplied.push(1.35);
  }
  if (skill.id === 'ashen_nova' && c15 === 'A') {
    moreMultipliersApplied.push(1.4);
  }
  if (skill.id === 'storm_spike' && c5 === 'B') {
    moreMultipliersApplied.push(1.25);
  }
  if (skill.id === 'seismic_slam' && c10 === 'A') {
    moreMultipliersApplied.push(1.25);
  }
  if (skill.id === 'bone_spear' && c15 === 'C') {
    moreMultipliersApplied.push(1.3);
  }
  if (skill.id === 'frost_lance' && c15 === 'B' && input.isCrit) {
    moreMultipliersApplied.push(1.3);
  }
  if (skill.id === 'void_tendrils' && c5 === 'B') {
    moreMultipliersApplied.push(1.3);
  }
  if (skill.id === 'crimson_whirlwind') {
    if (c5 === 'A') moreMultipliersApplied.push(1.25);
    if (c15 === 'A' && input.isLowLife) moreMultipliersApplied.push(1.4);
  }
  if (skill.id === 'arcane_orb' && c5 === 'A') {
    moreMultipliersApplied.push(1.25);
  }
  if (skill.id === 'glacial_cascade') {
    if (c5 === 'A') moreMultipliersApplied.push(1.25);
    if (c15 === 'A' && input.isTargetChilled) moreMultipliersApplied.push(1.35);
  }
  if (skill.id === 'rift_blade' && c5 === 'A') {
    moreMultipliersApplied.push(1.3);
  }
  if (skill.id === 'soul_harvest') {
    if (c5 === 'A') moreMultipliersApplied.push(1.3);
    if (c15 === 'A' && input.isTargetChilled) moreMultipliersApplied.push(1.45);
  }
  if (skill.id === 'meteor_brand') {
    if (c5 === 'A') moreMultipliersApplied.push(1.3);
    if (c15 === 'A') moreMultipliersApplied.push(1.45);
  }
  if (skill.id === 'tempest_nova' && c5 === 'A') {
    moreMultipliersApplied.push(1.25);
  }
  if (skill.id === 'bulwark_charge' && c5 === 'A') {
    moreMultipliersApplied.push(1.35);
  }

  let afterMore = afterIncreased;
  for (const mult of moreMultipliersApplied) {
    afterMore *= mult;
  }

  // 5. * Critical Strike Multiplier (if hit crits)
  let effectiveCritMult = stats.critMultiplier;
  if (skill.id === 'cinder_slash' && c10 === 'A') effectiveCritMult += 0.25;
  if (skill.id === 'frost_lance' && c5 === 'B') effectiveCritMult += 0.3;
  if (skill.id === 'arcane_orb' && c15 === 'A') effectiveCritMult += 0.35;
  if (skill.id === 'meteor_brand' && c10 === 'A') effectiveCritMult += 0.3;
  if (skill.id === 'tempest_nova' && c15 === 'A') effectiveCritMult += 0.35;

  const afterCrit = input.isCrit ? afterMore * effectiveCritMult : afterMore;

  // 6. Enemy resistances & armour mitigation applied last
  const resistFactor = 1 - Math.max(-0.5, Math.min(0.75, input.enemyResistPct / 100));
  const armourReduction =
    skill.damageType === 'physical'
      ? input.enemyArmour / (input.enemyArmour + Math.max(40, afterCrit * 3))
      : 0;

  const finalDamage = Math.max(1, Math.round(afterCrit * resistFactor * (1 - armourReduction)));

  // Life leech calculation (halved on Full Life unless Low Life Covenant is active)
  let effectiveLeech = stats.lifeLeechRate;
  if (skill.id === 'bone_spear' && c5 === 'C') effectiveLeech += 0.08;
  const fullLifePenalty =
    !input.isLowLife && !stats.activeMarks.includes('low_life_covenant') ? 0.5 : 1.0;
  // Note: fullLifePenalty only applies when player is actually at full life; caller can pass isFullLife or handle via helper.
  void fullLifePenalty;
  const leechAmount = Math.round(finalDamage * effectiveLeech);

  return {
    baseAndFlat,
    afterIncreased,
    moreMultipliersApplied,
    afterMore,
    afterCrit,
    finalDamage,
    leechAmount,
  };
}

export function computeIncomingDamageMitigation(
  rawDamage: number,
  damageType: 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos',
  stats: ComputedPlayerStats
): number {
  let dmg = rawDamage;
  if (damageType === 'physical') {
    const armourMit = stats.armour / (stats.armour + Math.max(120, rawDamage * 5));
    dmg *= 1 - Math.min(0.75, armourMit);
    if (stats.activeMarks.includes('fortress_heart') && !stats.canEvade) {
      dmg *= 0.88; // Extra 12% physical DR
    }
    dmg *= stats.physicalDamageTakenMult;
  } else {
    const res =
      damageType === 'fire'
        ? stats.fireRes
        : damageType === 'cold'
          ? stats.coldRes
          : damageType === 'lightning'
            ? stats.lightningRes
            : stats.chaosRes;
    dmg *= 1 - res / 100;
    if (damageType === 'fire') {
      dmg *= stats.fireDamageTakenMult;
    }
  }
  return Math.max(1, Math.round(dmg));
}

export function computeLifeLeechHeal(
  damageDealt: number,
  leechRate: number,
  isFullLife: boolean,
  hasLowLifeCovenant: boolean
): number {
  if (leechRate <= 0 || damageDealt <= 0) return 0;
  const mult = isFullLife && !hasLowLifeCovenant ? 0.5 : 1.0;
  return Math.max(0, Math.round(damageDealt * leechRate * mult));
}

const PREFIX_POOL = ['Ashen', 'Obsidian', 'Emberforged', 'Stormtouched', 'Glacial', 'Dusk'];
const SUFFIX_POOL = ['of the Eclipse', 'of Ruin', 'of Vigor', 'of Precision', 'of the Bastion'];
const SLOT_BASE_NAMES: Record<EquipSlot, string[]> = {
  weapon: ['Greatsword', 'Runeblade', 'Scepter', 'Warhammer', 'Wand'],
  body: ['Brigandine', 'Plate', 'Shroud', 'Cuirass'],
  helmet: ['Crown', 'Visor', 'Hood', 'Helm'],
  gloves: ['Gauntlets', 'Wraps', 'Grips'],
  boots: ['Greaves', 'Striders', 'Boots'],
  amulet: ['Talisman', 'Pendant', 'Choker'],
  ring1: ['Signet', 'Band', 'Loop'],
  ring2: ['Ring', 'Seal', 'Coil'],
  belt: ['Sash', 'Girdle', 'Cinch'],
};

export function rollGearDrop(
  domainTier: number,
  lootRarityBonus: number,
  forceBossDrop = false,
  rng: () => number = Math.random
): GearItem {
  const slots: EquipSlot[] = ['weapon', 'body', 'helmet', 'gloves', 'boots', 'amulet', 'ring1', 'ring2', 'belt'];
  const ilvl = Math.min(60, 1 + (domainTier - 1) * 3);

  // Rarity roll
  const legRoll = rng() * (1 + lootRarityBonus * 0.7);
  if ((forceBossDrop && rng() < 0.45) || legRoll > 0.96) {
    const tpl = LEGENDARY_TEMPLATES[Math.floor(rng() * LEGENDARY_TEMPLATES.length)];
    return {
      ...tpl,
      id: `item_${Date.now()}_${Math.floor(rng() * 1e6)}`,
      itemLevel: ilvl,
    };
  }

  let rarity: Rarity = 'magic';
  const rRoll = rng() + lootRarityBonus * 0.25;
  if (forceBossDrop || rRoll > 0.72) rarity = 'rare';
  else if (rRoll < 0.22 && domainTier === 1) rarity = 'normal';

  const slot = slots[Math.floor(rng() * slots.length)];
  const baseList = SLOT_BASE_NAMES[slot];
  const baseName = baseList[Math.floor(rng() * baseList.length)];
  const prefix = PREFIX_POOL[Math.floor(rng() * PREFIX_POOL.length)];
  const suffix = SUFFIX_POOL[Math.floor(rng() * SUFFIX_POOL.length)];

  const name =
    rarity === 'normal'
      ? baseName
      : rarity === 'magic'
        ? `${prefix} ${baseName}`
        : `${prefix} ${baseName} ${suffix}`;

  const tierScale = 1 + (domainTier - 1) * 0.22;
  const modTier = Math.min(5, 1 + Math.floor(domainTier / 4));
  const modCount = rarity === 'normal' ? 0 : rarity === 'magic' ? 2 : 4;
  const mods: GearItem['mods'] = {};

  if (slot === 'weapon') {
    mods.flatDamage = Math.round((7 + rng() * 6) * tierScale);
  } else if (slot === 'body' || slot === 'helmet') {
    mods.armour = Math.round((30 + rng() * 25) * tierScale);
    mods.maxLife = Math.round((24 + rng() * 20) * tierScale);
  } else if (slot === 'boots') {
    mods.movementSpeedPct = Math.min(25, Math.round(8 + domainTier * 0.8 + rng() * 5));
  }

  const extraStats = [
    () => (mods.maxLife = (mods.maxLife || 0) + Math.round((20 + rng() * 18) * tierScale)),
    () => (mods.maxEnergyShield = (mods.maxEnergyShield || 0) + Math.round((18 + rng() * 16) * tierScale)),
    () => (mods.increasedDamagePct = (mods.increasedDamagePct || 0) + Math.round(10 + rng() * 12 + domainTier * 1.2)),
    () => (mods.critChancePct = (mods.critChancePct || 0) + Math.round(4 + rng() * 5)),
    () => (mods.critMultiplierPct = (mods.critMultiplierPct || 0) + Math.round(14 + rng() * 16)),
    () => (mods.attackCastSpeedPct = (mods.attackCastSpeedPct || 0) + Math.round(5 + rng() * 6)),
    () => (mods.fireResPct = (mods.fireResPct || 0) + Math.round(10 + rng() * 12)),
    () => (mods.coldResPct = (mods.coldResPct || 0) + Math.round(10 + rng() * 12)),
    () => (mods.lightningResPct = (mods.lightningResPct || 0) + Math.round(10 + rng() * 12)),
    () => (mods.statusResistPct = (mods.statusResistPct || 0) + Math.round(8 + rng() * 10)),
  ];

  for (let i = 0; i < modCount; i++) {
    extraStats[Math.floor(rng() * extraStats.length)]();
  }

  let markId: MarkId | undefined;
  if (rarity === 'rare' && (forceBossDrop || (domainTier >= 2 && rng() < 0.28))) {
    markId = ALL_MARK_IDS[Math.floor(rng() * ALL_MARK_IDS.length)];
  }

  return {
    id: `item_${Date.now()}_${Math.floor(rng() * 1e6)}`,
    name,
    slot,
    rarity,
    itemLevel: ilvl,
    mods,
    markId,
    modTier,
  };
}

export type BenchCraftAction = 'add_life' | 'fix_resist' | 'upgrade_tier';

export function applyCraftingBench(item: GearItem, action: BenchCraftAction): GearItem {
  const updated: GearItem = {
    ...item,
    mods: { ...item.mods },
  };
  if (action === 'add_life') {
    updated.mods.maxLife = (updated.mods.maxLife || 0) + 28;
  } else if (action === 'fix_resist') {
    updated.mods.fireResPct = (updated.mods.fireResPct || 0) + 12;
    updated.mods.coldResPct = (updated.mods.coldResPct || 0) + 12;
    updated.mods.lightningResPct = (updated.mods.lightningResPct || 0) + 12;
    updated.mods.statusResistPct = (updated.mods.statusResistPct || 0) + 8;
  } else if (action === 'upgrade_tier') {
    updated.modTier = Math.min(5, updated.modTier + 1);
    if (updated.mods.flatDamage) updated.mods.flatDamage = Math.round(updated.mods.flatDamage * 1.18);
    if (updated.mods.increasedDamagePct) updated.mods.increasedDamagePct = Math.round(updated.mods.increasedDamagePct * 1.18);
    if (updated.mods.maxLife) updated.mods.maxLife = Math.round(updated.mods.maxLife * 1.15);
    if (updated.mods.armour) updated.mods.armour = Math.round(updated.mods.armour * 1.15);
    if (updated.mods.maxEnergyShield) updated.mods.maxEnergyShield = Math.round(updated.mods.maxEnergyShield * 1.15);
  }
  return updated;
}
