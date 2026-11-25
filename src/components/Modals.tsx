import React from 'react';
import { SKILLS } from '../game/data';
import { HudScaleOption, HudSnapshot, SkillId, UpgradeBranch, UpgradeTier } from '../game/types';
import { SkillIcon } from './Icons';

interface ModalsProps {
  hud: HudSnapshot;
  hudScale: HudScaleOption;
  highContrastTelegraphs: boolean;
  hitstopEnabled: boolean;
  screenShakeEnabled: boolean;
  onChangeHudScale: (scale: HudScaleOption) => void;
  onToggleHighContrast: () => void;
  onToggleHitstop: () => void;
  onToggleScreenShake: () => void;
  onEnterSanctuary: () => void;
  onResume: () => void;
  onRestart: () => void;
  onNextDomainTier: () => void;
  onReturnTitle: () => void;
  onOpenRoadmap: () => void;
  onSelectSkillUpgrade: (skillId: SkillId, tier: UpgradeTier, branch: UpgradeBranch) => void;
}

export function Modals({
  hud,
  hudScale,
  highContrastTelegraphs,
  hitstopEnabled,
  screenShakeEnabled,
  onChangeHudScale,
  onToggleHighContrast,
  onToggleHitstop,
  onToggleScreenShake,
  onEnterSanctuary,
  onResume,
  onRestart,
  onNextDomainTier,
  onReturnTitle,
  onOpenRoadmap,
  onSelectSkillUpgrade,
}: ModalsProps) {
  // 1. Skill Level 5 / 10 / 15 Upgrade Picker
  if (hud.phase === 'paused' && hud.pendingSkillUpgrade) {
    const { skillId, tier } = hud.pendingSkillUpgrade;
    const skill = SKILLS[skillId];
    const options = skill.upgrades[tier];

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-2xl bg-[#17171F] border border-[#272733] rounded-xl p-6 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-[#0B0B0F] border border-[#D99B38] flex items-center justify-center">
              <SkillIcon skillId={skillId} className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[#F8FAFC]">
                {skill.name} · Level {tier} Specialization
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Choose one permanent upgrade branch for this skill.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {options.map((opt) => (
              <button
                key={opt.branch}
                type="button"
                onClick={() => onSelectSkillUpgrade(skillId, tier, opt.branch)}
                className="text-left p-4 rounded-lg bg-[#0B0B0F] hover:bg-[#1E1E29] border border-[#272733] hover:border-[#D99B38] transition-colors cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular text-xs font-bold text-[#D99B38]">
                    Branch {opt.branch}
                  </span>
                </div>
                <div className="font-semibold text-sm text-[#F8FAFC]">{opt.name}</div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{opt.summary}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Pause Modal
  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-sm bg-[#17171F] border border-[#272733] rounded-xl p-6 space-y-5 shadow-2xl">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-[#F8FAFC]">Paused</h2>
            <p className="text-xs text-[#94A3B8] font-mono-tabular">
              {hud.inSanctuary
                ? 'Sanctuary Practice Arena'
                : `Domain Tier ${hud.domainTier} · ${hud.roomNames[hud.currentRoomIndex]}`}
            </p>
          </div>

          {/* Phase 2 HUD & Telegraph Settings */}
          <div className="bg-[#0B0B0F] border border-[#272733] rounded-lg p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#CBD5E1]">HUD Scale</span>
              <div className="flex items-center gap-1 font-mono-tabular">
                {(
                  [
                    [0.85, '85%'],
                    [1, '100%'],
                    [1.15, '115%'],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChangeHudScale(val)}
                    className={`px-2 py-1 rounded text-[11px] border cursor-pointer ${
                      hudScale === val
                        ? 'bg-[#D99B38] border-[#D99B38] text-[#0B0B0F] font-semibold'
                        : 'bg-[#17171F] border-[#272733] text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#CBD5E1]">High-Contrast Telegraphs</span>
              <button
                type="button"
                onClick={onToggleHighContrast}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular border cursor-pointer ${
                  highContrastTelegraphs
                    ? 'bg-[#FDE047]/15 border-[#FDE047] text-[#FDE047] font-semibold'
                    : 'bg-[#17171F] border-[#272733] text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {highContrastTelegraphs ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#CBD5E1]">Hitstop (Crit / Kill)</span>
              <button
                type="button"
                aria-label="Toggle Hitstop"
                onClick={onToggleHitstop}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular border cursor-pointer ${
                  hitstopEnabled
                    ? 'bg-[#D99B38]/20 border-[#D99B38] text-[#FDE68A] font-semibold'
                    : 'bg-[#17171F] border-[#272733] text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {hitstopEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#CBD5E1]">Screen Shake</span>
              <button
                type="button"
                aria-label="Toggle Screen Shake"
                onClick={onToggleScreenShake}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-tabular border cursor-pointer ${
                  screenShakeEnabled
                    ? 'bg-[#D99B38]/20 border-[#D99B38] text-[#FDE68A] font-semibold'
                    : 'bg-[#17171F] border-[#272733] text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {screenShakeEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 px-4 rounded-lg bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] font-semibold text-sm cursor-pointer"
            >
              Resume Combat
            </button>
            {!hud.inSanctuary && (
              <button
                type="button"
                onClick={onEnterSanctuary}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0B0B0F] hover:bg-[#1E1E29] border border-[#D99B38]/60 text-[#FDE68A] font-medium text-sm cursor-pointer"
              >
                Enter Practice Sanctuary
              </button>
            )}
            <button
              type="button"
              onClick={onOpenRoadmap}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0B0B0F] hover:bg-[#1E1E29] border border-[#272733] text-[#E6E4DD] font-medium text-sm cursor-pointer"
            >
              View Development Roadmap
            </button>
            <button
              type="button"
              onClick={hud.inSanctuary ? onEnterSanctuary : onRestart}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0B0B0F] hover:bg-[#1E1E29] border border-[#272733] text-[#E6E4DD] font-medium text-sm cursor-pointer"
            >
              {hud.inSanctuary ? 'Reset Sanctuary' : 'Restart Domain'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-[#0B0B0F] text-[#94A3B8] hover:text-[#F8FAFC] text-sm cursor-pointer"
            >
              Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Victory / Defeat Modal
  if (hud.phase === 'gameover') {
    const isVictory = hud.outcome === 'victory';
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-md bg-[#17171F] border border-[#272733] rounded-xl p-6 space-y-5 shadow-2xl">
          <div className="space-y-1">
            <h2
              className={`font-display text-2xl font-bold ${
                isVictory ? 'text-[#D99B38]' : 'text-[#DC2626]'
              }`}
            >
              {isVictory ? 'Domain Conquered' : 'Fallen in the Eclipse'}
            </h2>
            <p className="text-xs text-[#94A3B8]">
              {isVictory
                ? `Tier ${hud.domainTier} Pinnacle Boss defeated. Higher Domain Tiers and Aspect potential unlocked.`
                : `Defeated in ${hud.roomNames[hud.currentRoomIndex]} (Tier ${hud.domainTier}).`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-[#0B0B0F] border border-[#272733] rounded-lg p-3">
              <div className="text-[11px] text-[#94A3B8]">Time</div>
              <div className="font-mono-tabular text-base font-bold text-[#F8FAFC] mt-0.5">
                {Math.floor(hud.elapsedSeconds)}s
              </div>
            </div>
            <div className="bg-[#0B0B0F] border border-[#272733] rounded-lg p-3">
              <div className="text-[11px] text-[#94A3B8]">Slain</div>
              <div className="font-mono-tabular text-base font-bold text-[#F8FAFC] mt-0.5">
                {hud.kills}
              </div>
            </div>
            <div className="bg-[#0B0B0F] border border-[#272733] rounded-lg p-3">
              <div className="text-[11px] text-[#94A3B8]">
                {isVictory ? 'Dmg Taken' : 'Chamber'}
              </div>
              <div className="font-mono-tabular text-base font-bold text-[#F8FAFC] mt-0.5">
                {isVictory ? hud.damageTakenTotal : `${hud.currentRoomIndex + 1}/${hud.totalRooms}`}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {isVictory ? (
              <button
                type="button"
                data-start="true"
                onClick={onNextDomainTier}
                className="w-full py-2.5 px-4 rounded-lg bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] font-semibold text-sm cursor-pointer"
              >
                Enter Domain Tier {hud.domainTier + 1}
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="w-full py-2.5 px-4 rounded-lg bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] font-semibold text-sm cursor-pointer"
              >
                Try Again
              </button>
            )}
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0B0B0F] hover:bg-[#1E1E29] border border-[#272733] text-[#E6E4DD] text-sm cursor-pointer"
            >
              Return to Title
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
