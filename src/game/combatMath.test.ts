import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateGearStats,
  applyCraftingBench,
  calculateSkillDamage,
  computeIncomingDamageMitigation,
  computeLifeLeechHeal,
  rollGearDrop,
} from './combatMath';
import {
  ALL_ASPECT_IDS,
  ALL_SKILL_IDS,
  DOMAIN_MODIFIERS,
  LEGENDARY_TEMPLATES,
  SKILLS,
  createInitialSkillProgress,
} from './data';
import { GearItem } from './types';

test('aggregateGearStats applies Iron Aspect (+60% more Armour, Cannot Evade)', () => {
  const equipment = {
    body: {
      id: 'b1',
      name: 'Plate',
      slot: 'body' as const,
      rarity: 'rare' as const,
      itemLevel: 10,
      modTier: 2,
      mods: { armour: 100, evasion: 80 },
    },
  };
  const base = aggregateGearStats(equipment, [], 1);
  assert.equal(base.canEvade, true);
  assert.equal(base.armour, 140); // 40 base + 100 gear
  assert.equal(base.evasion, 105); // 25 base + 80 gear

  const withIron = aggregateGearStats(equipment, ['iron'], 1);
  assert.equal(withIron.canEvade, false);
  assert.equal(withIron.evasion, 0);
  assert.equal(withIron.armour, Math.round(140 * 1.6));
});

test('aggregateGearStats applies Aether Aspect (+45% more ES, 20% less Max Life)', () => {
  const equipment = {
    helmet: {
      id: 'h1',
      name: 'Crown',
      slot: 'helmet' as const,
      rarity: 'magic' as const,
      itemLevel: 5,
      modTier: 1,
      mods: { maxEnergyShield: 80, maxLife: 40 },
    },
  };
  const base = aggregateGearStats(equipment, [], 1);
  const withAether = aggregateGearStats(equipment, ['aether'], 1);

  assert.equal(withAether.maxEnergyShield, Math.round(base.maxEnergyShield * 1.45));
  assert.equal(withAether.maxLife, Math.round(base.maxLife * 0.8));
});

test('calculateSkillDamage enforces strict Additive vs Multiplicative More order', () => {
  const progress = createInitialSkillProgress();
  const equipment = {
    weapon: {
      id: 'w1',
      name: 'Blade',
      slot: 'weapon' as const,
      rarity: 'rare' as const,
      itemLevel: 10,
      modTier: 2,
      mods: { flatDamage: 12, increasedDamagePct: 50 },
    },
  };
  const aspects = ['blood', 'cinder', 'shade', 'eclipse'] as const;
  const stats = aggregateGearStats(equipment, [...aspects], 1);
  const result = calculateSkillDamage({
    skill: SKILLS.cinder_slash, // base 38, melee + fire
    skillProgress: progress.cinder_slash,
    stats,
    activeAspects: [...aspects],
    isMovementEmpowered: true,
    isEclipseEmpowered: true,
    isDistantTarget: false,
    isLowLife: false,
    isCrit: true,
    enemyResistPct: 0,
    enemyArmour: 0,
  });

  // 1+2: 38 + 12 = 50
  assert.equal(result.baseAndFlat, 50);
  // 3: 50 * 1.5 = 75
  assert.equal(result.afterIncreased, 75);
  // 4: 75 * 1.35 (blood) * 1.4 (cinder) * 1.4 (shade) * 1.6 (eclipse)
  const expectedMore = 75 * 1.35 * 1.4 * 1.4 * 1.6;
  assert.ok(Math.abs(result.afterMore - expectedMore) < 0.001);
  // 5: * 1.5 crit
  assert.ok(Math.abs(result.afterCrit - expectedMore * 1.5) < 0.001);
  assert.equal(result.finalDamage, Math.round(expectedMore * 1.5));
});

test('Siphon Aspect halves Life Leech on Full Life unless Low Life Covenant Mark is equipped', () => {
  const healFull = computeLifeLeechHeal(1000, 0.15, true, false);
  assert.equal(healFull, 75);

  const healWithCovenant = computeLifeLeechHeal(1000, 0.15, true, true);
  assert.equal(healWithCovenant, 150);
});

test('Precision Aspect penalizes non-crit hits by 20% less damage', () => {
  const progress = createInitialSkillProgress();
  const stats = aggregateGearStats({}, ['precision'], 1);

  const nonCrit = calculateSkillDamage({
    skill: SKILLS.ember_bolt,
    skillProgress: progress.ember_bolt,
    stats,
    activeAspects: ['precision'],
    isMovementEmpowered: false,
    isEclipseEmpowered: false,
    isDistantTarget: false,
    isLowLife: false,
    isCrit: false,
    enemyResistPct: 0,
    enemyArmour: 0,
  });

  assert.equal(nonCrit.finalDamage, Math.round(SKILLS.ember_bolt.baseDamage * 0.8));
});

test('Incoming mitigation respects Cinder Aspect fire penalty and Fortress Heart physical DR', () => {
  const itemWithHeart: GearItem = {
    id: 'b2',
    name: 'Bastion',
    slot: 'body',
    rarity: 'rare',
    itemLevel: 20,
    modTier: 3,
    markId: 'fortress_heart',
    mods: { armour: 200 },
  };
  const stats = aggregateGearStats({ body: itemWithHeart }, ['iron', 'cinder'], 1);
  const fireDmg = computeIncomingDamageMitigation(100, 'fire', stats);
  assert.equal(fireDmg, 112);

  const physDmg = computeIncomingDamageMitigation(100, 'physical', stats);
  assert.ok(physDmg < 60);
});

test('Crafting bench and loot generation produce valid items', () => {
  const dropped = rollGearDrop(5, 0.4, true, () => 0.85);
  assert.ok(dropped.name.length > 0);
  const crafted = applyCraftingBench(dropped, 'add_life');
  assert.equal(crafted.mods.maxLife, (dropped.mods.maxLife || 0) + 28);
});

test('Phase 4 roster expansion meets target counts (18 skills, 25 aspects, 12 legendaries, 15 domain mods)', () => {
  assert.equal(ALL_SKILL_IDS.length, 18);
  assert.equal(ALL_ASPECT_IDS.length, 25);
  assert.equal(LEGENDARY_TEMPLATES.length, 12);
  assert.equal(DOMAIN_MODIFIERS.length, 15);
});

test('Phase 4 Aspects apply Glass Cannon, Chronomancer, Bastion, Frostbite, and Harvester rules', () => {
  const base = aggregateGearStats({}, [], 10);
  const gc = aggregateGearStats({}, ['glass_cannon'], 10);
  assert.equal(gc.maxLife, Math.round(base.maxLife * 0.75));
  assert.equal(gc.maxEnergyShield, Math.round(base.maxEnergyShield * 0.75));

  const chrono = aggregateGearStats({}, ['chronomancer'], 10);
  assert.equal(chrono.cooldownRecoveryMult, 0.8);
  assert.equal(chrono.maxLife, Math.round(base.maxLife * 0.85));

  const bastion = aggregateGearStats({}, ['bastion'], 10);
  assert.equal(bastion.fireRes, 15);
  assert.equal(bastion.armour, Math.round(base.armour * 1.35));

  const harvester = aggregateGearStats({}, ['harvester'], 10);
  assert.equal(harvester.killLifeGain, 8);
  assert.equal(harvester.killManaGain, 8);

  const progress = createInitialSkillProgress();
  const frostStats = aggregateGearStats({}, ['frostbite'], 1);
  const coldVsChilled = calculateSkillDamage({
    skill: SKILLS.glacial_cascade,
    skillProgress: progress.glacial_cascade,
    stats: frostStats,
    activeAspects: ['frostbite'],
    isMovementEmpowered: false,
    isEclipseEmpowered: false,
    isDistantTarget: false,
    isLowLife: false,
    isTargetChilled: true,
    isCrit: false,
    enemyResistPct: 0,
    enemyArmour: 0,
  });
  assert.equal(coldVsChilled.finalDamage, Math.round(SKILLS.glacial_cascade.baseDamage * 1.35));
});
