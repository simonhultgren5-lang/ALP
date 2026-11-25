import {
  AspectDef,
  AspectId,
  DomainModifier,
  EquipSlot,
  GearItem,
  MarkDef,
  MarkId,
  SkillDef,
  SkillId,
  SkillProgress,
} from './types';

export const DAMAGE_COLORS = {
  fire: '#F97316',
  cold: '#22D3EE',
  lightning: '#7DD3FC',
  physical: '#E2E8F0',
  chaos: '#A855F7',
} as const;

export const RARITY_COLORS = {
  normal: '#CBD5E1',
  magic: '#60A5FA',
  rare: '#FACC15',
  legendary: '#F97316',
} as const;

export const SKILLS: Record<SkillId, SkillDef> = {
  cinder_slash: {
    id: 'cinder_slash',
    name: 'Cinder Slash',
    category: 'melee',
    tags: ['melee', 'area'],
    damageType: 'fire',
    baseDamage: 38,
    damagePerLevel: 12,
    manaCost: 8,
    cooldown: 0.45,
    critChance: 0.08,
    range: 115,
    radius: 95,
    description: 'Wide burning arc cleave that sears all enemies in front.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Serrated Edge', summary: '+25% Bleed/Burn DoT and +15% base damage' },
        { branch: 'B', name: 'Sunfire Arc', summary: '+30% wider slash arc' },
        { branch: 'C', name: 'Swift Ashes', summary: '20% faster cooldown' },
      ],
      10: [
        { branch: 'A', name: 'Charred Marrow', summary: '+25% Crit Multiplier on Cinder Slash' },
        { branch: 'B', name: 'Molten Wake', summary: 'Leaves scorching embers on hit' },
        { branch: 'C', name: 'Lunging Strike', summary: 'Steps slightly forward when slashing' },
      ],
      15: [
        { branch: 'A', name: 'Executioner Flame', summary: '+35% More damage vs Low Life enemies' },
        { branch: 'B', name: 'Eclipse Cleave', summary: 'Triggers a secondary cinder wave' },
        { branch: 'C', name: 'Relentless', summary: 'Refunds 40% mana/life on kill' },
      ],
    },
  },
  ember_bolt: {
    id: 'ember_bolt',
    name: 'Ember Bolt',
    category: 'projectile',
    tags: ['projectile', 'spell'],
    damageType: 'fire',
    baseDamage: 30,
    damagePerLevel: 10,
    manaCost: 7,
    cooldown: 0.35,
    critChance: 0.09,
    range: 520,
    radius: 14,
    description: 'Fast searing fire projectile launched toward your cursor.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Piercing Cinder', summary: 'Bolts pierce +2 additional enemies' },
        { branch: 'B', name: 'Detonating Spark', summary: 'Explodes in small fire area on impact' },
        { branch: 'C', name: 'Split Volley', summary: 'Fires +2 extra side bolts' },
      ],
      10: [
        { branch: 'A', name: 'Long Fuse', summary: '+25% Projectile speed and range' },
        { branch: 'B', name: 'Volatile Core', summary: '+25% explosion radius and damage' },
        { branch: 'C', name: 'Rapid Ember', summary: '18% reduced cooldown' },
      ],
      15: [
        { branch: 'A', name: 'Heartseeker', summary: '+10% Base Critical Strike Chance' },
        { branch: 'B', name: 'Inferno Burst', summary: 'Hits apply strong burning DoT' },
        { branch: 'C', name: 'Fan of Ashes', summary: 'Fires 5 bolts in a tight arc' },
      ],
    },
  },
  frost_lance: {
    id: 'frost_lance',
    name: 'Frost Lance',
    category: 'projectile',
    tags: ['projectile', 'spell'],
    damageType: 'cold',
    baseDamage: 32,
    damagePerLevel: 10,
    manaCost: 10,
    cooldown: 0.48,
    critChance: 0.12,
    range: 560,
    radius: 13,
    description: 'Piercing lance of glacial ice that chills enemies.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Deep Chill', summary: '+35% stronger Chill slow on hit' },
        { branch: 'B', name: 'Crystal Edge', summary: '+8% Base Crit Chance & +30% Crit Mult' },
        { branch: 'C', name: 'Glacial Fork', summary: 'Splits into 2 shards on first hit' },
      ],
      10: [
        { branch: 'A', name: 'Rime Shackle', summary: 'Chilled foes take 15% more Cold DoT' },
        { branch: 'B', name: 'Brittle Fracture', summary: 'Crits shatter for small area splash' },
        { branch: 'C', name: 'Piercing Spire', summary: 'Pierces all enemies in line' },
      ],
      15: [
        { branch: 'A', name: 'Permafrost', summary: 'Applies heavy 25% Chill + Frostbite DoT' },
        { branch: 'B', name: 'Absolute Zero', summary: '+30% More damage on Critical Strikes' },
        { branch: 'C', name: 'Hailstorm', summary: 'Fires 2 parallel lances' },
      ],
    },
  },
  ashen_nova: {
    id: 'ashen_nova',
    name: 'Ashen Nova',
    category: 'area',
    tags: ['area', 'spell'],
    damageType: 'fire',
    baseDamage: 48,
    damagePerLevel: 14,
    manaCost: 18,
    cooldown: 1.4,
    critChance: 0.08,
    range: 0,
    radius: 155,
    description: 'Erupts a ring of ash and flame around your character.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Expanding Ash', summary: '+30% Nova radius' },
        { branch: 'B', name: 'Cinder Burn', summary: 'Applies strong burning DoT' },
        { branch: 'C', name: 'Kindled Reserve', summary: '-30% Mana/Life cost' },
      ],
      10: [
        { branch: 'A', name: 'Shockwave Ring', summary: 'Knocks enemies back from center' },
        { branch: 'B', name: 'Scorched Earth', summary: 'Leaves burning ground for 3s' },
        { branch: 'C', name: 'Quick Ignition', summary: '-20% Cooldown' },
      ],
      15: [
        { branch: 'A', name: 'Cataclysmic Ring', summary: '+40% More Area Damage' },
        { branch: 'B', name: 'Double Eruption', summary: 'Pulses a second smaller nova 0.3s later' },
        { branch: 'C', name: 'Ashen Siphon', summary: 'Restores 5% Life per enemy hit' },
      ],
    },
  },
  shadow_step: {
    id: 'shadow_step',
    name: 'Shadow Step',
    category: 'movement',
    tags: ['movement'],
    damageType: 'physical',
    baseDamage: 18,
    damagePerLevel: 6,
    manaCost: 6,
    cooldown: 1.6,
    critChance: 0.06,
    range: 240,
    radius: 65,
    description: 'Instant shadow dash toward your cursor with brief invulnerability.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Long Stride', summary: '+35% dash distance' },
        { branch: 'B', name: 'Arrival Blade', summary: 'Deals physical damage at destination' },
        { branch: 'C', name: 'Ash Decoy', summary: 'Leaves an exploding shadow decoy behind' },
      ],
      10: [
        { branch: 'A', name: 'Phase Cloak', summary: 'Extended 0.35s invulnerability' },
        { branch: 'B', name: 'Phantom Edge', summary: 'Arrival burst chills and weakens enemies' },
        { branch: 'C', name: 'Fleetfoot', summary: '+25% Move Speed for 2s after dash' },
      ],
      15: [
        { branch: 'A', name: 'Blink Mastery', summary: '-25% Shadow Step cooldown' },
        { branch: 'B', name: 'Shadow Rend', summary: 'Arrival burst guarantees a Critical Strike' },
        { branch: 'C', name: 'Double Mirage', summary: 'Restores 10 Mana on arrival' },
      ],
    },
  },
  storm_spike: {
    id: 'storm_spike',
    name: 'Storm Spike',
    category: 'spell',
    tags: ['spell'],
    damageType: 'lightning',
    baseDamage: 34,
    damagePerLevel: 11,
    manaCost: 12,
    cooldown: 0.65,
    critChance: 0.1,
    range: 460,
    radius: 36,
    description: 'Calls down an instant arc bolt that chains between nearby foes.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Arc Conductor', summary: '+2 additional lightning chains' },
        { branch: 'B', name: 'High Voltage', summary: '+25% More Lightning damage' },
        { branch: 'C', name: 'Static Shock', summary: 'Shocks foes (+18% damage taken for 3s)' },
      ],
      10: [
        { branch: 'A', name: 'Wide Arc', summary: '+40% chain jump radius' },
        { branch: 'B', name: 'Overcharged', summary: '+10% Crit Chance on first target' },
        { branch: 'C', name: 'Thunderclap', summary: 'Small stun pulse at strike point' },
      ],
      15: [
        { branch: 'A', name: 'Tempest Web', summary: '+3 chains and forks on kill' },
        { branch: 'B', name: 'Judgment Bolt', summary: '+45% More damage if hitting single target' },
        { branch: 'C', name: 'Conduit Flow', summary: '-25% Cooldown' },
      ],
    },
  },
  bone_spear: {
    id: 'bone_spear',
    name: 'Bone Spear',
    category: 'projectile',
    tags: ['projectile', 'melee'],
    damageType: 'physical',
    baseDamage: 36,
    damagePerLevel: 11,
    manaCost: 9,
    cooldown: 0.55,
    critChance: 0.12,
    range: 460,
    radius: 15,
    description: 'Hurls a jagged bone spear that pierces out and returns to you.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Returning Fang', summary: '+50% damage on the return pass' },
        { branch: 'B', name: 'Bone Splinters', summary: 'Splits into 2 shards at apex' },
        { branch: 'C', name: 'Crimson Marrow', summary: 'Leeches 8% of damage as Life' },
      ],
      10: [
        { branch: 'A', name: 'Heavy Shaft', summary: 'Knocks enemies back on return' },
        { branch: 'B', name: 'Razor Spine', summary: '+8% Base Crit Chance' },
        { branch: 'C', name: 'Swift Hurl', summary: '+25% projectile velocity' },
      ],
      15: [
        { branch: 'A', name: 'Execution Return', summary: 'Return pass always Crits' },
        { branch: 'B', name: 'Shatter Volley', summary: 'Fires 3 returning spears in narrow cone' },
        { branch: 'C', name: 'Bloodied Ivory', summary: '+30% More Physical damage' },
      ],
    },
  },
  seismic_slam: {
    id: 'seismic_slam',
    name: 'Seismic Slam',
    category: 'melee',
    tags: ['melee', 'area'],
    damageType: 'physical',
    baseDamage: 56,
    damagePerLevel: 16,
    manaCost: 16,
    cooldown: 1.5,
    critChance: 0.08,
    range: 90,
    radius: 145,
    description: 'Shatters the obsidian floor in a heavy shockwave ahead of you.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Tectonic Reach', summary: '+30% slam radius' },
        { branch: 'B', name: 'Concussive Blow', summary: 'Stuns enemies for 0.8s' },
        { branch: 'C', name: 'Aftershock', summary: 'Triggers a 60% damage aftershock' },
      ],
      10: [
        { branch: 'A', name: 'Crushing Weight', summary: '+25% More Melee/Area damage' },
        { branch: 'B', name: 'Shattered Guard', summary: 'Breaks enemy armour (+20% phys taken)' },
        { branch: 'C', name: 'Quake Cadence', summary: '-20% Cooldown' },
      ],
      15: [
        { branch: 'A', name: 'Colossus Impact', summary: 'Gains bonus damage from 10% of Armour' },
        { branch: 'B', name: 'Double Rupture', summary: 'Two cascading seismic rings' },
        { branch: 'C', name: 'Earthshaker', summary: '+12% Base Crit Chance on stunned foes' },
      ],
    },
  },
  void_tendrils: {
    id: 'void_tendrils',
    name: 'Void Tendrils',
    category: 'dot',
    tags: ['dot', 'area', 'spell'],
    damageType: 'chaos',
    baseDamage: 24,
    damagePerLevel: 8,
    manaCost: 14,
    cooldown: 2.2,
    critChance: 0.05,
    range: 420,
    radius: 135,
    description: 'Summons abyssal tendrils at target area that snare and drain foes over 3.5s.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Lingering Abyss', summary: '+1.5s Tendril duration' },
        { branch: 'B', name: 'Wither Rot', summary: '+30% Chaos DoT damage' },
        { branch: 'C', name: 'Grasping Pull', summary: 'Gently pulls enemies toward center' },
      ],
      10: [
        { branch: 'A', name: 'Abyssal Maw', summary: '+25% Area radius' },
        { branch: 'B', name: 'Soul Drain', summary: 'Heals 2% Max Life per second while active' },
        { branch: 'C', name: 'Entropy Web', summary: 'Slows enemies inside by 35%' },
      ],
      15: [
        { branch: 'A', name: 'Eternal Eclipse', summary: '-30% Cooldown' },
        { branch: 'B', name: 'Void Collapse', summary: 'Detonates for heavy Chaos burst on expiry' },
        { branch: 'C', name: 'Twin Rifts', summary: 'Applies 2 stacks of Chaos decay' },
      ],
    },
  },
  radiant_barrier: {
    id: 'radiant_barrier',
    name: 'Radiant Barrier',
    category: 'defensive',
    tags: ['defensive', 'area'],
    damageType: 'physical',
    baseDamage: 22,
    damagePerLevel: 7,
    manaCost: 15,
    cooldown: 5.5,
    critChance: 0.05,
    range: 0,
    radius: 110,
    description: 'Grants a temporary Energy Shield barrier for 3.5s that reflects and heals.',
    upgrades: {
      5: [
        { branch: 'A', name: 'Aegis Ward', summary: '+45% stronger barrier absorb' },
        { branch: 'B', name: 'Thorns of Light', summary: 'Reflects 80% melee/contact hits as AoE' },
        { branch: 'C', name: 'Sanctuary Pulse', summary: 'Heals 4% Max Life per second while active' },
      ],
      10: [
        { branch: 'A', name: 'Bastion', summary: '+1.5s Barrier duration' },
        { branch: 'B', name: 'Blinding Ward', summary: 'Slows nearby attackers on cast' },
        { branch: 'C', name: 'Quick Invocation', summary: '-20% Cooldown' },
      ],
      15: [
        { branch: 'A', name: 'Unbreakable', summary: 'Grants +25% Armour & Resistances while active' },
        { branch: 'B', name: 'Shatter Nova', summary: 'Explodes for heavy damage when barrier ends' },
        { branch: 'C', name: 'Graceful Recharge', summary: 'Immediately restores 35% Energy Shield' },
      ],
    },
  },
};

export const ALL_SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const ASPECTS: Record<AspectId, AspectDef> = {
  blood: {
    id: 'blood',
    name: 'Blood Aspect',
    category: 'offense',
    bonusText: '+35% more Melee Damage',
    drawbackText: 'Skills cost Life instead of Mana',
    accentColor: '#DC2626',
  },
  cinder: {
    id: 'cinder',
    name: 'Cinder Aspect',
    category: 'offense',
    bonusText: 'Fire skills gain +40% more Damage',
    drawbackText: 'Take 12% increased Fire Damage',
    accentColor: '#F97316',
  },
  storm: {
    id: 'storm',
    name: 'Storm Aspect',
    category: 'offense',
    bonusText: 'Lightning skills chain +2 times',
    drawbackText: '15% less Critical Strike Chance',
    accentColor: '#60A5FA',
  },
  precision: {
    id: 'precision',
    name: 'Precision Aspect',
    category: 'offense',
    bonusText: '+50% Critical Strike Multiplier',
    drawbackText: 'Non-critical hits deal 20% less damage',
    accentColor: '#FACC15',
  },
  overload: {
    id: 'overload',
    name: 'Overload Aspect',
    category: 'offense',
    bonusText: 'Skills have 25% chance to repeat',
    drawbackText: 'Repeating costs 50% more resources',
    accentColor: '#38BDF8',
  },
  iron: {
    id: 'iron',
    name: 'Iron Aspect',
    category: 'defense',
    bonusText: '+60% more Armour',
    drawbackText: 'Cannot Evade attacks',
    accentColor: '#94A3B8',
  },
  aether: {
    id: 'aether',
    name: 'Aether Aspect',
    category: 'defense',
    bonusText: '+45% more Energy Shield',
    drawbackText: '20% less Maximum Life',
    accentColor: '#3B82F6',
  },
  veil: {
    id: 'veil',
    name: 'Veil Aspect',
    category: 'defense',
    bonusText: 'Gain a damage absorb shield every 7s',
    drawbackText: '-15% Movement Speed while shield is active',
    accentColor: '#22D3EE',
  },
  regrowth: {
    id: 'regrowth',
    name: 'Regrowth Aspect',
    category: 'defense',
    bonusText: '3% of damage taken regenerated over 4s',
    drawbackText: '-20% Recovery Rate from flasks',
    accentColor: '#10B981',
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter Aspect',
    category: 'utility',
    bonusText: '+25% more Projectile Damage, +15% more vs Distant',
    drawbackText: '10% less Melee Area radius',
    accentColor: '#EAB308',
  },
  earthquake: {
    id: 'earthquake',
    name: 'Earthquake Aspect',
    category: 'utility',
    bonusText: 'Area skills have +30% increased Area',
    drawbackText: '15% less Attack/Cast Speed on Area skills',
    accentColor: '#D97706',
  },
  shade: {
    id: 'shade',
    name: 'Shade Aspect',
    category: 'utility',
    bonusText: 'After Movement skill, next skill deals +40% more damage',
    drawbackText: '+10% Movement skill cooldown',
    accentColor: '#A855F7',
  },
  siphon: {
    id: 'siphon',
    name: 'Siphon Aspect',
    category: 'utility',
    bonusText: '15% of damage dealt leeched as Life',
    drawbackText: 'Life Leech halved while on Full Life',
    accentColor: '#EF4444',
  },
  eclipse: {
    id: 'eclipse',
    name: 'Eclipse Aspect',
    category: 'utility',
    bonusText: 'Every 8s your next skill is Empowered (+60% more damage)',
    drawbackText: 'Empowered skills cost double resources',
    accentColor: '#D99B38',
  },
  frigid: {
    id: 'frigid',
    name: 'Frigid Aspect',
    category: 'utility',
    bonusText: 'Cold skills have +30% more effect of Chill',
    drawbackText: 'Move 8% slower',
    accentColor: '#06B6D4',
  },
};

export const ALL_ASPECT_IDS = Object.keys(ASPECTS) as AspectId[];

export const MARKS: Record<MarkId, MarkDef> = {
  repeating_echoes: {
    id: 'repeating_echoes',
    name: 'Repeating Echoes',
    description: 'Area skills have 20% chance to repeat.',
  },
  critical_momentum: {
    id: 'critical_momentum',
    name: 'Critical Momentum',
    description: 'On Critical Strike, gain +15% Action Speed for 3s.',
  },
  withering_touch: {
    id: 'withering_touch',
    name: 'Withering Touch',
    description: 'DoTs you apply reduce enemy damage by 12%.',
  },
  flowing_shadow: {
    id: 'flowing_shadow',
    name: 'Flowing Shadow',
    description: 'Movement skills reset the cooldown of your lowest-cooldown skill.',
  },
  low_life_covenant: {
    id: 'low_life_covenant',
    name: 'Low Life Covenant',
    description: 'You count as always being on Low Life for Aspects and Leech.',
  },
  fortress_heart: {
    id: 'fortress_heart',
    name: 'Fortress Heart',
    description: 'Extra 12% physical damage reduction while Iron Aspect is active.',
  },
  aether_overflow: {
    id: 'aether_overflow',
    name: 'Aether Overflow',
    description: '10% of Maximum Energy Shield is added as flat spell/attack damage.',
  },
  eclipse_core: {
    id: 'eclipse_core',
    name: 'Eclipse Core',
    description: 'Eclipse Aspect cycles 25% faster and grants +15% Critical Strike Chance when Empowered.',
  },
};

export const ALL_MARK_IDS = Object.keys(MARKS) as MarkId[];

export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Weapon',
  body: 'Body Armour',
  helmet: 'Helmet',
  gloves: 'Gloves',
  boots: 'Boots',
  amulet: 'Amulet',
  ring1: 'Left Ring',
  ring2: 'Right Ring',
  belt: 'Belt',
};

export const LEGENDARY_TEMPLATES: Array<Omit<GearItem, 'id' | 'itemLevel'>> = [
  {
    name: 'Heart of the Berserker',
    slot: 'amulet',
    rarity: 'legendary',
    modTier: 5,
    legendaryId: 'heart_berserker',
    legendaryEffectText: 'Blood Aspect grants +12% Life Leech; permanently count as Low Life.',
    markId: 'low_life_covenant',
    mods: { maxLife: 85, flatDamage: 14, fireResPct: 22 },
  },
  {
    name: 'Chain of the Stormlord',
    slot: 'belt',
    rarity: 'legendary',
    modTier: 5,
    legendaryId: 'chain_stormlord',
    legendaryEffectText: 'Storm Aspect chains +2 additional times; +15% skill repeat chance.',
    mods: { maxLife: 65, maxEnergyShield: 55, lightningResPct: 30, attackCastSpeedPct: 12 },
  },
  {
    name: 'Crown of Endless Winter',
    slot: 'helmet',
    rarity: 'legendary',
    modTier: 5,
    legendaryId: 'crown_winter',
    legendaryEffectText: 'Removes Frigid Aspect movement penalty; +20% stronger Chill.',
    mods: { maxEnergyShield: 120, coldResPct: 35, increasedDamagePct: 24, skillLevelBonus: 1 },
  },
  {
    name: 'Ashen Core',
    slot: 'body',
    rarity: 'legendary',
    modTier: 5,
    legendaryId: 'ashen_core',
    legendaryEffectText: 'Area Fire skills have 25% chance to trigger a secondary nova.',
    markId: 'repeating_echoes',
    mods: { maxLife: 110, armour: 180, fireResPct: 32, increasedDamagePct: 28 },
  },
  {
    name: "Veilwalker's Step",
    slot: 'boots',
    rarity: 'legendary',
    modTier: 5,
    legendaryId: 'veilwalkers_step',
    legendaryEffectText: 'Shade Aspect bonus lasts longer; Movement skills grant +15% Action Speed.',
    markId: 'flowing_shadow',
    mods: { movementSpeedPct: 22, evasion: 110, maxEnergyShield: 60 },
  },
  {
    name: 'Iron Vow Plate',
    slot: 'body',
    rarity: 'legendary',
    modTier: 5,
    legendaryId: 'iron_vow_plate',
    legendaryEffectText: 'Iron Aspect grants 8% of Armour as Maximum Life.',
    markId: 'fortress_heart',
    mods: { armour: 320, maxLife: 130, fireResPct: 20, coldResPct: 20 },
  },
];

export const DOMAIN_MODIFIERS: DomainModifier[] = [
  {
    id: 'volatile_embers',
    name: 'Volatile Embers',
    riskText: '+25% Enemy Damage · Burning Ground patches',
    rewardText: '+40% Loot Rarity · +20% XP',
    enemyLifeMult: 1.05,
    enemyDamageMult: 1.25,
    enemySpeedMult: 1.0,
    lootRarityBonus: 0.4,
    xpBonus: 0.2,
    burningGround: true,
  },
  {
    id: 'obsidian_carapace',
    name: 'Obsidian Carapace',
    riskText: '+45% Enemy Life',
    rewardText: '+45% Loot Rarity · +25% XP',
    enemyLifeMult: 1.45,
    enemyDamageMult: 1.0,
    enemySpeedMult: 1.0,
    lootRarityBonus: 0.45,
    xpBonus: 0.25,
  },
  {
    id: 'frenzied_hunt',
    name: 'Frenzied Hunt',
    riskText: '+22% Enemy Speed · +15% Enemy Damage',
    rewardText: '+35% Loot Rarity · +30% XP',
    enemyLifeMult: 1.0,
    enemyDamageMult: 1.15,
    enemySpeedMult: 1.22,
    lootRarityBonus: 0.35,
    xpBonus: 0.3,
  },
  {
    id: 'blood_moon',
    name: 'Blood Moon Eclipse',
    riskText: '+30% Enemy Life · +20% Enemy Damage',
    rewardText: '+60% Loot Rarity · +35% XP',
    enemyLifeMult: 1.3,
    enemyDamageMult: 1.2,
    enemySpeedMult: 1.08,
    lootRarityBonus: 0.6,
    xpBonus: 0.35,
  },
];

export interface StarterPreset {
  id: string;
  name: string;
  subtitle: string;
  hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId];
  aspects: AspectId[];
  starterWeaponName: string;
}

export const STARTER_PRESETS: StarterPreset[] = [
  {
    id: 'cinder_vanguard',
    name: 'Cinder Vanguard',
    subtitle: 'Cinder Slash · Seismic Slam · Ashen Nova · Shadow Step',
    hotbar: ['cinder_slash', 'seismic_slam', 'ashen_nova', 'radiant_barrier', 'shadow_step'],
    aspects: ['blood', 'iron'],
    starterWeaponName: 'Tempered Ashblade',
  },
  {
    id: 'storm_conduit',
    name: 'Storm Conduit',
    subtitle: 'Storm Spike · Ember Bolt · Bone Spear · Shadow Step',
    hotbar: ['storm_spike', 'ember_bolt', 'bone_spear', 'ashen_nova', 'shadow_step'],
    aspects: ['storm', 'shade'],
    starterWeaponName: 'Voltaic Scepter',
  },
  {
    id: 'frost_warden',
    name: 'Frost Warden',
    subtitle: 'Frost Lance · Void Tendrils · Radiant Barrier · Shadow Step',
    hotbar: ['frost_lance', 'void_tendrils', 'radiant_barrier', 'ember_bolt', 'shadow_step'],
    aspects: ['frigid', 'aether'],
    starterWeaponName: 'Glacial Wand',
  },
];

export function createInitialSkillProgress(): Record<SkillId, SkillProgress> {
  return {
    cinder_slash: { level: 1, xp: 0, choices: {} },
    ember_bolt: { level: 1, xp: 0, choices: {} },
    frost_lance: { level: 1, xp: 0, choices: {} },
    ashen_nova: { level: 1, xp: 0, choices: {} },
    shadow_step: { level: 1, xp: 0, choices: {} },
    storm_spike: { level: 1, xp: 0, choices: {} },
    bone_spear: { level: 1, xp: 0, choices: {} },
    seismic_slam: { level: 1, xp: 0, choices: {} },
    void_tendrils: { level: 1, xp: 0, choices: {} },
    radiant_barrier: { level: 1, xp: 0, choices: {} },
  };
}

export function createStarterEquipment(weaponName: string): Partial<Record<EquipSlot, GearItem>> {
  return {
    weapon: {
      id: 'starter_weapon',
      name: weaponName,
      slot: 'weapon',
      rarity: 'magic',
      itemLevel: 1,
      modTier: 1,
      mods: { flatDamage: 8, increasedDamagePct: 10 },
    },
    body: {
      id: 'starter_body',
      name: 'Worn Obsidian Coat',
      slot: 'body',
      rarity: 'normal',
      itemLevel: 1,
      modTier: 1,
      mods: { maxLife: 30, armour: 35 },
    },
  };
}

export function getUnlockedAspectSlots(playerLevel: number, pinnacleKills: number): number {
  const fromLevel = Math.floor((playerLevel - 1) / 8); // +1 at 9, 17, 25...
  return Math.min(7, 2 + fromLevel + pinnacleKills);
}
