import React, { useState } from 'react';
import { BenchCraftAction } from '../game/combatMath';
import {
  ALL_ASPECT_IDS,
  ALL_SKILL_IDS,
  ASPECTS,
  DOMAIN_MODIFIERS,
  EQUIP_SLOT_LABELS,
  MARKS,
  RARITY_COLORS,
  SKILLS,
} from '../game/data';
import {
  AspectId,
  ComputedPlayerStats,
  EquipSlot,
  GearItem,
  SkillId,
  SkillProgress,
} from '../game/types';
import { SkillIcon } from './Icons';

interface BuildDrawerProps {
  open: boolean;
  stats: ComputedPlayerStats;
  hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId];
  activeAspects: AspectId[];
  unlockedAspects: AspectId[];
  aspectSlotCap: number;
  skillProgress: Record<SkillId, SkillProgress>;
  equipment: Partial<Record<EquipSlot, GearItem>>;
  bag: GearItem[];
  shards: number;
  maxDomainTier: number;
  selectedDomainTier: number;
  selectedModifierIds: string[];
  corrupted: boolean;
  onClose: () => void;
  onAssignHotbarSlot: (slotIdx: number, skillId: SkillId) => void;
  onToggleAspect: (aspectId: AspectId) => void;
  onEquipFromBag: (itemId: string) => void;
  onSalvageFromBag: (itemId: string) => void;
  onCraftEquipped: (slot: EquipSlot, action: BenchCraftAction) => void;
  onSelectDomainTier: (tier: number) => void;
  onToggleDomainModifier: (id: string) => void;
  onToggleCorrupted: () => void;
  onLaunchDomain: () => void;
  onEnterSanctuary: () => void;
}

type DrawerTab = 'skills' | 'aspects' | 'gear' | 'domain';

export function BuildDrawer({
  open,
  stats,
  hotbar,
  activeAspects,
  unlockedAspects,
  aspectSlotCap,
  skillProgress,
  equipment,
  bag,
  shards,
  maxDomainTier,
  selectedDomainTier,
  selectedModifierIds,
  corrupted,
  onClose,
  onAssignHotbarSlot,
  onToggleAspect,
  onEquipFromBag,
  onSalvageFromBag,
  onCraftEquipped,
  onSelectDomainTier,
  onToggleDomainModifier,
  onToggleCorrupted,
  onLaunchDomain,
  onEnterSanctuary,
}: BuildDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('skills');
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(0);
  const [craftSlot, setCraftSlot] = useState<EquipSlot>('weapon');

  if (!open) return null;

  const equippedSlots = Object.keys(EQUIP_SLOT_LABELS) as EquipSlot[];
  const craftItem = equipment[craftSlot];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 md:p-6">
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-[#17171F] border border-[#272733] rounded-xl overflow-hidden shadow-2xl">
        {/* Drawer Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#272733] bg-[#121218]">
          <div className="flex items-center gap-6">
            <h2 className="font-display text-xl font-bold text-[#F8FAFC] whitespace-nowrap">
              Character &amp; Domain
            </h2>
            <nav className="flex items-center gap-1 p-1 bg-[#0B0B0F] rounded-lg border border-[#272733]">
              {(
                [
                  ['skills', 'Skills'],
                  ['aspects', 'Aspects'],
                  ['gear', 'Gear & Bench'],
                  ['domain', 'Domain Portal'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    tab === id
                      ? 'bg-[#232330] text-[#D99B38]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#0B0B0F] hover:bg-[#232330] border border-[#272733] text-xs font-medium text-[#E6E4DD] cursor-pointer"
          >
            Close [I]
          </button>
        </div>

        {/* Stat Strip */}
        <div className="px-6 py-2.5 border-b border-[#272733] bg-[#0B0B0F] flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono-tabular text-[#94A3B8]">
          <span>
            Life <strong className="text-[#F8FAFC]">{stats.maxLife}</strong>
          </span>
          <span>
            ES <strong className="text-[#7DD3FC]">{stats.maxEnergyShield}</strong>
          </span>
          <span>
            Armour <strong className="text-[#E2E8F0]">{stats.armour}</strong>
          </span>
          <span>
            {stats.canEvade ? (
              <>
                Evasion <strong className="text-[#E2E8F0]">{stats.evasion}</strong>
              </>
            ) : (
              <span className="text-[#F87171]">Cannot Evade</span>
            )}
          </span>
          <span>
            Crit <strong className="text-[#FACC15]">{Math.round(stats.critChance * 100)}%</strong> ·{' '}
            <strong className="text-[#FACC15]">{Math.round(stats.critMultiplier * 100)}%</strong>
          </span>
          <span>
            Res F/C/L{' '}
            <strong className="text-[#E6E4DD]">
              {stats.fireRes}/{stats.coldRes}/{stats.lightningRes}%
            </strong>
          </span>
          <span>
            Shards <strong className="text-[#D99B38]">{shards}</strong>
          </span>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto ae-scroll p-6">
          {tab === 'skills' && (
            <div className="space-y-6">
              <div>
                <div className="text-xs text-[#94A3B8] mb-2">
                  Select a hotbar slot below, then click any Skill to equip it. Skills level up through combat use and unlock upgrade branches at Lv 5, 10, and 15.
                </div>
                <div className="grid grid-cols-5 gap-2.5">
                  {hotbar.map((sid, idx) => {
                    const s = SKILLS[sid];
                    const selected = idx === selectedSlotIdx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSlotIdx(idx)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                          selected
                            ? 'bg-[#232330] border-[#D99B38]'
                            : 'bg-[#0B0B0F] border-[#272733] hover:border-[#3F3F52]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#94A3B8] mb-1">
                          <span>Slot {idx === 4 ? 'Space' : idx + 1}</span>
                          <span>Lv {skillProgress[sid].level}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SkillIcon skillId={sid} className="w-5 h-5 shrink-0" />
                          <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                            {s.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_SKILL_IDS.map((sid) => {
                  const skill = SKILLS[sid];
                  const prog = skillProgress[sid];
                  const equippedIndex = hotbar.indexOf(sid);
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => onAssignHotbarSlot(selectedSlotIdx, sid)}
                      className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                        equippedIndex >= 0
                          ? 'bg-[#1C1C26] border-[#D99B38]/60'
                          : 'bg-[#0B0B0F] border-[#272733] hover:border-[#3F3F52]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <SkillIcon skillId={sid} className="w-7 h-7 shrink-0" />
                          <div>
                            <div className="font-semibold text-sm text-[#F8FAFC]">{skill.name}</div>
                            <div className="text-xs text-[#94A3B8] font-mono-tabular">
                              {skill.damageType} · {skill.category} · Lv {prog.level}/20
                            </div>
                          </div>
                        </div>
                        {equippedIndex >= 0 && (
                          <span className="text-[11px] font-mono-tabular text-[#D99B38]">
                            Slot {equippedIndex === 4 ? 'Space' : equippedIndex + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#A1A1B5] mt-2">{skill.description}</p>
                      <div className="text-[11px] font-mono-tabular text-[#94A3B8] mt-2">
                        Branches:{' '}
                        {([5, 10, 15] as const)
                          .map((t) => `Lv${t}:${prog.choices[t] ?? '—'}`)
                          .join(' · ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'aspects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>
                  Every Aspect pairs a multiplicative bonus with a build-defining drawback.
                </span>
                <span className="font-mono-tabular text-[#D99B38]">
                  Active Slots: {activeAspects.length} / {aspectSlotCap}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ALL_ASPECT_IDS.map((aid) => {
                  const asp = ASPECTS[aid];
                  const active = activeAspects.includes(aid);
                  const unlocked = unlockedAspects.includes(aid);
                  return (
                    <button
                      key={aid}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onToggleAspect(aid)}
                      className={`text-left p-4 rounded-lg border transition-colors ${
                        !unlocked
                          ? 'bg-[#0B0B0F]/60 border-[#272733]/60 opacity-55 cursor-not-allowed'
                          : active
                            ? 'bg-[#1D1D28] border-[#D99B38] cursor-pointer'
                            : 'bg-[#0B0B0F] border-[#272733] hover:border-[#3F3F52] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#F8FAFC]">{asp.name}</span>
                        <span className="text-[11px] font-mono-tabular text-[#94A3B8]">
                          {!unlocked ? 'Boss/Lv Unlock' : active ? 'Active' : asp.category}
                        </span>
                      </div>
                      <div className="text-xs text-[#E2E8F0] mt-2">{asp.bonusText}</div>
                      <div className="text-xs text-[#F87171] mt-1">Drawback: {asp.drawbackText}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'gear' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: 9 Equipment Slots */}
              <div className="lg:col-span-5 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Equipped Gear (9 Slots)
                </h3>
                <div className="space-y-2">
                  {equippedSlots.map((slot) => {
                    const item = equipment[slot];
                    const selectedForCraft = craftSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setCraftSlot(slot)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                          selectedForCraft
                            ? 'bg-[#232330] border-[#D99B38]'
                            : 'bg-[#0B0B0F] border-[#272733] hover:border-[#3F3F52]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono-tabular text-[#94A3B8]">
                            {EQUIP_SLOT_LABELS[slot]}
                          </span>
                          {item && (
                            <span className="text-[11px] font-mono-tabular text-[#94A3B8]">
                              iLvl {item.itemLevel} · T{item.modTier}
                            </span>
                          )}
                        </div>
                        {item ? (
                          <div className="mt-0.5">
                            <div
                              className="text-xs font-semibold"
                              style={{ color: RARITY_COLORS[item.rarity] }}
                            >
                              {item.name}
                            </div>
                            {item.markId && (
                              <div className="text-[11px] text-[#D99B38] mt-0.5">
                                Mark: {MARKS[item.markId].name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-[#525266] mt-0.5">Empty Slot</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Simple Crafting Bench + Bag */}
              <div className="lg:col-span-7 space-y-6">
                <div className="p-4 rounded-lg bg-[#0B0B0F] border border-[#272733] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#F8FAFC]">Simple Crafting Bench</h3>
                    <span className="font-mono-tabular text-xs text-[#D99B38]">
                      {shards} Shards Available
                    </span>
                  </div>
                  {craftItem ? (
                    <>
                      <div className="text-xs text-[#94A3B8]">
                        Modifying{' '}
                        <strong style={{ color: RARITY_COLORS[craftItem.rarity] }}>
                          {craftItem.name}
                        </strong>{' '}
                        (Tier {craftItem.modTier})
                      </div>
                      <div className="text-xs font-mono-tabular text-[#CBD5E1]">
                        {Object.entries(craftItem.mods)
                          .filter(([, v]) => Boolean(v))
                          .map(([k, v]) => `${k}: +${v}`)
                          .join(' · ')}
                      </div>
                      {craftItem.legendaryEffectText && (
                        <div className="text-xs text-[#F97316]">
                          {craftItem.legendaryEffectText}
                        </div>
                      )}
                      {craftItem.markId && (
                        <div className="text-xs text-[#D99B38]">
                          Mark — {MARKS[craftItem.markId].name}: {MARKS[craftItem.markId].description}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={shards < 6}
                          onClick={() => onCraftEquipped(craftSlot, 'add_life')}
                          className="px-3 py-1.5 rounded bg-[#17171F] hover:bg-[#232330] disabled:opacity-40 border border-[#272733] text-xs text-[#E6E4DD] cursor-pointer"
                        >
                          +28 Max Life (6 Shards)
                        </button>
                        <button
                          type="button"
                          disabled={shards < 8}
                          onClick={() => onCraftEquipped(craftSlot, 'fix_resist')}
                          className="px-3 py-1.5 rounded bg-[#17171F] hover:bg-[#232330] disabled:opacity-40 border border-[#272733] text-xs text-[#E6E4DD] cursor-pointer"
                        >
                          +12% Elemental Res (8 Shards)
                        </button>
                        <button
                          type="button"
                          disabled={shards < 12 || craftItem.modTier >= 5}
                          onClick={() => onCraftEquipped(craftSlot, 'upgrade_tier')}
                          className="px-3 py-1.5 rounded bg-[#17171F] hover:bg-[#232330] disabled:opacity-40 border border-[#D99B38]/60 text-xs text-[#D99B38] cursor-pointer"
                        >
                          Upgrade Mod Tier (12 Shards)
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-[#94A3B8]">
                      Select an equipped slot on the left to craft improvements.
                    </div>
                  )}
                </div>

                {/* Collected Loot Bag */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Loot Bag ({bag.length})
                  </h3>
                  {bag.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#0B0B0F] border border-[#272733] text-xs text-[#94A3B8]">
                      Defeat elites and bosses to collect Magic, Rare, Mark-bearing, and Legendary drops.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bag.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg bg-[#0B0B0F] border border-[#272733] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div
                              className="text-xs font-semibold truncate"
                              style={{ color: RARITY_COLORS[item.rarity] }}
                            >
                              {item.name}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-[#94A3B8]">
                              {EQUIP_SLOT_LABELS[item.slot]} · iLvl {item.itemLevel}
                              {item.markId ? ` · Mark: ${MARKS[item.markId].name}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEquipFromBag(item.id)}
                              className="px-3 py-1.5 rounded bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] text-xs font-semibold cursor-pointer"
                            >
                              Equip
                            </button>
                            <button
                              type="button"
                              onClick={() => onSalvageFromBag(item.id)}
                              className="px-3 py-1.5 rounded bg-[#17171F] hover:bg-[#232330] border border-[#272733] text-xs text-[#94A3B8] cursor-pointer"
                            >
                              Salvage (+5)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'domain' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#F8FAFC]">
                    Procedural Domain Configuration
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Scale Domain Tier and stack risk/reward Modifiers before opening a new run.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8]">Tier:</span>
                  {Array.from({ length: Math.min(20, maxDomainTier + 1) }, (_, i) => i + 1).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onSelectDomainTier(t)}
                        className={`w-8 h-8 rounded font-mono-tabular text-xs font-semibold border cursor-pointer ${
                          selectedDomainTier === t
                            ? 'bg-[#D99B38] border-[#D99B38] text-[#0B0B0F]'
                            : 'bg-[#0B0B0F] border-[#272733] text-[#E6E4DD]'
                        }`}
                      >
                        {t}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DOMAIN_MODIFIERS.map((mod) => {
                  const active = selectedModifierIds.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => onToggleDomainModifier(mod.id)}
                      className={`text-left p-4 rounded-lg border cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#201A14] border-[#D99B38]'
                          : 'bg-[#0B0B0F] border-[#272733] hover:border-[#3F3F52]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-[#F8FAFC]">{mod.name}</span>
                        <span className="text-xs font-mono-tabular text-[#D99B38]">
                          {active ? 'Active' : 'Add'}
                        </span>
                      </div>
                      <div className="text-xs text-[#F87171] mt-1">{mod.riskText}</div>
                      <div className="text-xs text-[#10B981] mt-0.5">{mod.rewardText}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#272733]">
                <button
                  type="button"
                  onClick={onToggleCorrupted}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                    corrupted
                      ? 'bg-[#3B0764]/40 border-[#A855F7] text-[#E9D5FF]'
                      : 'bg-[#0B0B0F] border-[#272733] text-[#94A3B8]'
                  }`}
                >
                  {corrupted
                    ? 'Corruption Active (+25% Enemy Life, +35% Rarity)'
                    : 'Add Eclipse Corruption Layer'}
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onEnterSanctuary}
                    className="px-4 py-2.5 rounded-lg bg-[#17171F] hover:bg-[#232330] border border-[#D99B38]/60 text-[#FDE68A] text-xs font-medium cursor-pointer"
                  >
                    Enter Practice Sanctuary
                  </button>
                  <button
                    type="button"
                    onClick={onLaunchDomain}
                    className="px-6 py-2.5 rounded-lg bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] text-sm font-semibold cursor-pointer"
                  >
                    Open Tier {selectedDomainTier} Domain
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
