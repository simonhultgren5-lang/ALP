import React from 'react';
import { RARITY_COLORS, SKILLS } from '../game/data';
import { HudScaleOption, HudSnapshot, SanctuaryConfig, SkillId } from '../game/types';
import { SkillIcon, UtilityIcon } from './Icons';

interface GameHudProps {
  hud: HudSnapshot;
  hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId];
  minimalHud: boolean;
  muted: boolean;
  hudScale: HudScaleOption;
  onCastSlot: (idx: number) => void;
  onUseFlask: () => void;
  onToggleBuild: () => void;
  onOpenRoadmap: () => void;
  onToggleMinimal: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onUpdateSanctuaryConfig: (partial: Partial<SanctuaryConfig>) => void;
  onResetSanctuary: () => void;
}

const KEY_LABELS = ['RMB', '2', '3', '4', 'Space'];

export function GameHud({
  hud,
  hotbar,
  minimalHud,
  muted,
  hudScale,
  onCastSlot,
  onUseFlask,
  onToggleBuild,
  onOpenRoadmap,
  onToggleMinimal,
  onToggleMute,
  onTogglePause,
  onUpdateSanctuaryConfig,
  onResetSanctuary,
}: GameHudProps) {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const ghostPct = Math.max(0, Math.min(100, (hud.ghostHp / Math.max(1, hud.maxHp)) * 100));
  const mpPct = Math.max(0, Math.min(100, (hud.mp / Math.max(1, hud.maxMp)) * 100));
  const esPct = hud.maxEs > 0 ? Math.max(0, Math.min(100, (hud.es / hud.maxEs) * 100)) : 0;
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpToNext)) * 100));
  const critPct =
    hud.sanctuaryTelemetry.hitCount > 0
      ? Math.round((hud.sanctuaryTelemetry.critCount / hud.sanctuaryTelemetry.hitCount) * 100)
      : 0;
  const breakdown = hud.sanctuaryTelemetry.lastHitBreakdown;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 md:p-5">
      {/* Top Row: Contextual Boss Bar (Center) + Minimap & Utility Cluster (Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Subtle Buffs / Status only when active */}
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          {!minimalHud && (hud.eclipseReady || hud.shadeReady || hud.critMomentumTimer > 0 || hud.barrierTimer > 0) && (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono-tabular">
              {hud.eclipseReady && (
                <span className="px-2 py-0.5 rounded bg-[#17171F]/95 border border-[#D99B38] text-[#FDE68A]">
                  Eclipse +60%
                </span>
              )}
              {hud.shadeReady && (
                <span className="px-2 py-0.5 rounded bg-[#17171F]/95 border border-[#A855F7] text-[#E9D5FF]">
                  Shade +40%
                </span>
              )}
              {hud.critMomentumTimer > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#17171F]/95 border border-[#FACC15] text-[#FEF08A]">
                  Momentum {hud.critMomentumTimer.toFixed(1)}s
                </span>
              )}
              {hud.barrierTimer > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#17171F]/95 border border-[#38BDF8] text-[#BAE6FD]">
                  Barrier {hud.barrierTimer.toFixed(1)}s
                </span>
              )}
            </div>
          )}
          {hud.recentLootToast && (
            <div
              className="px-3 py-1.5 rounded bg-[#17171F]/95 border border-[#272733] text-xs font-medium shadow-md"
              style={{ color: RARITY_COLORS[hud.recentLootToast.rarity] }}
            >
              Acquired: {hud.recentLootToast.name}
            </div>
          )}
        </div>

        {/* Top-Center: Contextual Boss Health Bar, Sanctuary Banner, or Chamber Cleared Banner */}
        <div className="flex-1 flex justify-center">
          {hud.inSanctuary ? (
            <div className="px-4 py-1.5 rounded-lg bg-[#17171F]/95 border border-[#D99B38]/60 text-xs font-medium text-[#FDE68A] whitespace-nowrap">
              Sanctuary Practice Arena · Open Build [I] to Swap Skills &amp; Aspects Live
            </div>
          ) : hud.bossActive ? (
            <div
              className={`w-full max-w-md bg-[#17171F]/95 border rounded-lg px-4 py-2.5 ${
                hud.bossPhase === 2 ? 'border-[#DC2626]' : 'border-[#272733]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display font-semibold text-[#F8FAFC] tracking-wide truncate">
                    {hud.bossName}
                  </span>
                  {hud.bossPhase === 2 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#DC2626]/20 border border-[#DC2626] font-mono-tabular text-[10px] font-bold text-[#FCA5A5] shrink-0">
                      PHASE II
                    </span>
                  )}
                </div>
                <span className="font-mono-tabular text-[#D99B38] shrink-0">
                  {hud.bossHp} / {hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#0B0B0F] rounded overflow-hidden border border-[#272733]">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    hud.bossPhase === 2 ? 'bg-[#EF4444]' : 'bg-[#DC2626]'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100))}%` }}
                />
              </div>
            </div>
          ) : hud.roomCleared && hud.currentRoomIndex < hud.totalRooms - 1 ? (
            <div className="px-4 py-1.5 rounded-lg bg-[#17171F]/95 border border-[#D99B38]/70 text-xs font-medium text-[#FDE68A]">
              Chamber Cleared · Enter Gold Portal on East Wall
            </div>
          ) : null}
        </div>

        {/* Top-Right: Corner-Scaled Utility Controls + Minimap / Sanctuary DPS Telemetry */}
        <div
          className="flex flex-col items-end gap-2 origin-top-right"
          style={{ transform: `scale(${hudScale})` }}
        >
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenRoadmap();
              }}
              aria-label="Open Development Roadmap"
              title="Development Roadmap"
              className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded bg-[#17171F] hover:bg-[#232330] border border-[#272733] text-xs text-[#E6E4DD] cursor-pointer"
            >
              <UtilityIcon kind="roadmap" className="w-4 h-4 text-[#D99B38]" />
              <span className="hidden sm:inline">Roadmap</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              title="Toggle Mute [M]"
              className="w-9 h-9 inline-flex items-center justify-center rounded bg-[#17171F] hover:bg-[#232330] border border-[#272733] text-[#E6E4DD] cursor-pointer"
            >
              <UtilityIcon kind={muted ? 'mute' : 'unmute'} className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMinimal();
              }}
              aria-label="Toggle Minimal HUD"
              title="Minimal HUD [H]"
              className={`w-9 h-9 inline-flex items-center justify-center rounded border cursor-pointer ${
                minimalHud
                  ? 'bg-[#D99B38]/20 border-[#D99B38] text-[#FDE68A]'
                  : 'bg-[#17171F] hover:bg-[#232330] border-[#272733] text-[#E6E4DD]'
              }`}
            >
              <UtilityIcon kind="minimal" className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              aria-label="Pause Game"
              title="Pause [P]"
              className="w-9 h-9 inline-flex items-center justify-center rounded bg-[#17171F] hover:bg-[#232330] border border-[#272733] text-[#E6E4DD] cursor-pointer"
            >
              <UtilityIcon kind="pause" className="w-4 h-4" />
            </button>
          </div>

          {!minimalHud && !hud.inSanctuary && (
            <div className="bg-[#17171F]/95 border border-[#272733] rounded-lg px-3 py-2 w-48">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular mb-1.5">
                <span className="text-[#D99B38] font-semibold">
                  Tier {hud.domainTier}{hud.corrupted ? ' · Corrupted' : ''}
                </span>
                <span className="text-[#94A3B8]">Foes {hud.totalRoomEnemies}</span>
              </div>
              {/* Compact Room-Graph Minimap */}
              <svg viewBox="0 0 160 32" className="w-full h-7" aria-label="Domain room graph">
                {hud.roomConnections.map(([a, b], idx) => (
                  <line
                    key={idx}
                    x1={20 + a * 40}
                    y1={16}
                    x2={20 + b * 40}
                    y2={16}
                    stroke="#3F3F52"
                    strokeWidth="2"
                  />
                ))}
                {hud.roomNames.map((_, idx) => {
                  const cx = 20 + idx * 40;
                  const isCurrent = idx === hud.currentRoomIndex;
                  const isCleared = hud.clearedRooms[idx];
                  const isBoss = idx === hud.totalRooms - 1;
                  return (
                    <g key={idx}>
                      <circle
                        cx={cx}
                        cy={16}
                        r={isBoss ? 7 : 5.5}
                        fill={isCurrent ? '#D99B38' : isCleared ? '#3F3F52' : '#0B0B0F'}
                        stroke={isCurrent ? '#FDE68A' : isBoss ? '#DC2626' : '#64748B'}
                        strokeWidth={isCurrent ? 2 : 1.5}
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                {hud.roomNames[hud.currentRoomIndex]}
              </div>
            </div>
          )}

          {!minimalHud && hud.inSanctuary && (
            <div
              data-testid="sanctuary-telemetry"
              className="pointer-events-auto bg-[#17171F]/95 border border-[#272733] rounded-lg px-3.5 py-3 w-64 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F8FAFC]">Sanctuary Telemetry</span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onResetSanctuary();
                  }}
                  className="text-[11px] font-mono-tabular text-[#D99B38] hover:text-[#FDE68A] underline cursor-pointer"
                >
                  Reset Dummy
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center font-mono-tabular">
                <div className="bg-[#0B0B0F] border border-[#272733] rounded p-1.5">
                  <div className="text-[10px] text-[#94A3B8]">Live DPS</div>
                  <div className="text-xs font-bold text-[#F8FAFC]">{hud.dpsEstimate}</div>
                </div>
                <div className="bg-[#0B0B0F] border border-[#272733] rounded p-1.5">
                  <div className="text-[10px] text-[#94A3B8]">Peak Hit</div>
                  <div className="text-xs font-bold text-[#D99B38]">{hud.sanctuaryTelemetry.peakHit}</div>
                </div>
                <div className="bg-[#0B0B0F] border border-[#272733] rounded p-1.5">
                  <div className="text-[10px] text-[#94A3B8]">Crit %</div>
                  <div className="text-xs font-bold text-[#FACC15]">{critPct}%</div>
                </div>
              </div>

              <div className="bg-[#0B0B0F] border border-[#272733] rounded p-2 space-y-1 text-[11px] font-mono-tabular">
                <div className="flex items-center justify-between text-[#94A3B8]">
                  <span>Last Hit</span>
                  <span className="text-[#E6E4DD] truncate max-w-[130px]">
                    {hud.sanctuaryTelemetry.lastHitSkill || 'Hit Dummy'}
                    {hud.sanctuaryTelemetry.lastHitIsCrit ? ' (CRIT)' : ''}
                  </span>
                </div>
                {breakdown ? (
                  <>
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>1. Base+Flat</span>
                      <span className="text-[#E6E4DD]">{Math.round(breakdown.baseAndFlat)}</span>
                    </div>
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>2. Increased</span>
                      <span className="text-[#E6E4DD]">{Math.round(breakdown.afterIncreased)}</span>
                    </div>
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>
                        3. More ({breakdown.moreMultipliersApplied.length}×)
                      </span>
                      <span className="text-[#E6E4DD]">{Math.round(breakdown.afterMore)}</span>
                    </div>
                    <div className="flex justify-between text-[#94A3B8]">
                      <span>4. Crit</span>
                      <span className="text-[#FACC15]">{Math.round(breakdown.afterCrit)}</span>
                    </div>
                    <div className="flex justify-between text-[#D99B38] font-semibold border-t border-[#272733] pt-1">
                      <span>5. Post-Mit</span>
                      <span>{breakdown.finalDamage}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-[#64748B]">
                    Attack either Training Dummy to inspect each multiplicative formula step.
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-0.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#94A3B8]">Ward Dummy</span>
                  <div className="flex items-center gap-1 font-mono-tabular">
                    {[
                      { label: '0', arm: 0, res: 0 },
                      { label: 'Low', arm: 120, res: 25 },
                      { label: 'Boss', arm: 280, res: 50 },
                    ].map((preset) => {
                      const active =
                        hud.sanctuaryConfig.dummyArmour === preset.arm &&
                        hud.sanctuaryConfig.dummyResistPct === preset.res;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onUpdateSanctuaryConfig({
                              dummyArmour: preset.arm,
                              dummyResistPct: preset.res,
                            });
                          }}
                          className={`px-2 py-0.5 rounded border cursor-pointer ${
                            active
                              ? 'bg-[#D99B38]/20 border-[#D99B38] text-[#FDE68A]'
                              : 'bg-[#0B0B0F] border-[#272733] text-[#94A3B8]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUpdateSanctuaryConfig({ sparringPulse: !hud.sanctuaryConfig.sparringPulse });
                  }}
                  className={`w-full py-1 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                    hud.sanctuaryConfig.sparringPulse
                      ? 'bg-[#F97316]/20 border-[#F97316] text-[#FDBA74]'
                      : 'bg-[#0B0B0F] border-[#272733] text-[#94A3B8] hover:text-[#E6E4DD]'
                  }`}
                >
                  {hud.sanctuaryConfig.sparringPulse
                    ? 'Sparring Ward Pulse: Active'
                    : 'Enable Sparring Ward Pulse'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Crimson HP / Sapphire MP Orbs (Left) + 5-Slot Hotbar (Center) + Quick Stats (Right) */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Corner-Scaled Orbs + Flask + XP Bar */}
        <div
          className="flex flex-col gap-2 pointer-events-auto origin-bottom-left"
          style={{ transform: `scale(${hudScale})` }}
        >
          <div className="flex items-end gap-2.5">
            {/* Crimson HP Orb with Ghost Damage & ES/Veil Arc */}
            <div className="relative w-20 h-20 rounded-full bg-[#0B0B0F] border-2 border-[#272733] overflow-hidden shadow-lg">
              <div
                className="absolute bottom-0 inset-x-0 bg-[#7F1D1D]"
                style={{ height: `${ghostPct}%` }}
              />
              <div
                className="absolute bottom-0 inset-x-0 bg-[#DC2626]"
                style={{ height: `${hpPct}%` }}
              />
              {hud.maxEs > 0 && (
                <div
                  className="absolute inset-0 rounded-full border-2 border-[#38BDF8]/80 pointer-events-none"
                  style={{ opacity: Math.max(0.15, esPct / 100) }}
                />
              )}
              {hud.veilShield > 0 && (
                <div className="absolute inset-1 rounded-full border-2 border-[#22D3EE] pointer-events-none" />
              )}
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center leading-tight">
                <span className="font-mono-tabular text-xs font-bold text-[#F8FAFC] drop-shadow">
                  {hud.hp}
                </span>
                {hud.es > 0 && (
                  <span className="font-mono-tabular text-[10px] font-semibold text-[#7DD3FC]">
                    +{hud.es} ES
                  </span>
                )}
                {hud.veilShield > 0 && (
                  <span className="font-mono-tabular text-[9px] font-semibold text-[#22D3EE]">
                    +{hud.veilShield} Veil
                  </span>
                )}
              </div>
            </div>

            {/* Sapphire Mana Orb */}
            <div className="relative w-14 h-14 rounded-full bg-[#0B0B0F] border-2 border-[#272733] overflow-hidden shadow-lg">
              <div
                className="absolute bottom-0 inset-x-0 bg-[#2563EB]"
                style={{ height: `${mpPct}%` }}
              />
              <div className="relative z-10 h-full flex items-center justify-center">
                <span className="font-mono-tabular text-[11px] font-bold text-[#F8FAFC] drop-shadow">
                  {hud.mp}
                </span>
              </div>
            </div>

            {/* Flask Button [Q] */}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onUseFlask();
              }}
              aria-label="Use Recovery Flask"
              className="h-12 px-3 rounded-lg bg-[#17171F] hover:bg-[#232330] border border-[#272733] flex flex-col items-center justify-center cursor-pointer"
            >
              <span className="font-mono-tabular text-xs font-bold text-[#10B981]">
                {hud.flaskCharges}/{hud.maxFlaskCharges}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-tabular">[Q] Flask</span>
            </button>
          </div>

          {/* Thin Ember-Gold XP Bar */}
          {!minimalHud && (
            <div className="w-52 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#94A3B8]">
                <span>Lv {hud.playerLevel}</span>
                <span>{hud.shards} Shards</span>
              </div>
              <div className="h-1.5 w-full bg-[#17171F] rounded-full overflow-hidden border border-[#272733]">
                <div className="h-full bg-[#D99B38]" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Center: Corner-Scaled 5-Slot Skill Hotbar with Conic Radial Cooldown Sweeps & Input Buffer Ring */}
        <div
          className="flex items-end gap-2 pointer-events-auto origin-bottom"
          style={{ transform: `scale(${hudScale})` }}
        >
          <div className="flex items-center gap-1.5 bg-[#17171F]/95 border border-[#272733] rounded-xl p-1.5">
            {hotbar.map((skillId, idx) => {
              const skill = SKILLS[skillId];
              const cd = hud.cooldowns[idx] || 0;
              const maxCd = Math.max(0.01, hud.maxCooldowns[idx] || skill.cooldown);
              const cdDeg = cd > 0 ? Math.min(360, (cd / maxCd) * 360) : 0;
              const cost = hud.skillCosts[idx] ?? skill.manaCost;
              const usesLife = hud.skillUsesLife[idx] ?? false;
              const isEmpowered = hud.eclipseReady && skill.category !== 'defensive';
              const isBuffered = hud.bufferedSlot === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCastSlot(idx);
                  }}
                  aria-label={`Cast ${skill.name} (${KEY_LABELS[idx]})`}
                  title={`${skill.name} — ${skill.description}`}
                  className={`relative w-13 h-13 md:w-14 md:h-14 rounded-lg bg-[#0B0B0F] border flex items-center justify-center overflow-hidden cursor-pointer transition-transform active:scale-95 ${
                    isBuffered
                      ? 'border-[#FDE047] ring-2 ring-[#FDE047]/60'
                      : isEmpowered
                        ? 'border-[#D99B38]'
                        : 'border-[#272733] hover:border-[#3F3F52]'
                  }`}
                >
                  <SkillIcon skillId={skillId} className="w-7 h-7" />

                  {/* Conic Radial Cooldown Overlay */}
                  {cd > 0 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: `conic-gradient(rgba(11,11,15,0.82) ${cdDeg}deg, transparent ${cdDeg}deg)`,
                      }}
                    >
                      <span className="font-mono-tabular text-xs font-bold text-[#F8FAFC]">
                        {cd.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {/* Keybind Badge */}
                  <span className="absolute top-0.5 left-1 font-mono-tabular text-[10px] font-semibold text-[#94A3B8]">
                    {KEY_LABELS[idx]}
                  </span>

                  {/* Cost Badge (Crimson if Blood Aspect active) */}
                  <span
                    className={`absolute bottom-0.5 right-1 font-mono-tabular text-[10px] font-semibold ${
                      usesLife ? 'text-[#F87171]' : 'text-[#60A5FA]'
                    }`}
                  >
                    {cost}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleBuild();
            }}
            aria-label="Open Build, Aspects, Gear and Domain Drawer"
            className="h-14 px-4 rounded-xl bg-[#17171F] hover:bg-[#232330] border border-[#272733] text-xs font-semibold text-[#E6E4DD] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <UtilityIcon kind="build" className="w-4 h-4 text-[#D99B38]" />
            <span>Build [I]</span>
          </button>
        </div>

        {/* Bottom-Right: Compact DPS & Kills Readout */}
        {!minimalHud ? (
          <div className="hidden md:flex flex-col items-end text-right font-mono-tabular text-xs text-[#94A3B8] min-w-[120px]">
            <span className="text-[#E6E4DD] font-semibold">{hud.dpsEstimate} DPS</span>
            <span>{hud.kills} Slain</span>
          </div>
        ) : (
          <div className="hidden md:block min-w-[120px]" />
        )}
      </div>
    </div>
  );
}
