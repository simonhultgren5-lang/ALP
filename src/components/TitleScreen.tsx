import React, { useState } from 'react';
import { STARTER_PRESETS, StarterPreset } from '../game/data';
import { EclipseCrestSvg, UtilityIcon } from './Icons';

interface TitleScreenProps {
  selectedPresetId: string;
  onSelectPreset: (preset: StarterPreset) => void;
  onStartGame: () => void;
  onStartSanctuary: () => void;
  onOpenRoadmap: () => void;
  roadmapProgressPct: number;
}

export function TitleScreen({
  selectedPresetId,
  onSelectPreset,
  onStartGame,
  onStartSanctuary,
  onOpenRoadmap,
  roadmapProgressPct,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-[#0B0B0F] text-[#E6E4DD] overflow-hidden">
      {/* Key-Art Stage */}
      <div className="absolute inset-0 pointer-events-none">
        {!imgFailed ? (
          <img
            src="/src/assets/images/title_bg_1795645840006.jpg"
            alt="Shattered obsidian citadel beneath an ember solar eclipse"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_72%_32%,rgba(217,155,56,0.28),transparent_48%),linear-gradient(120deg,#0B0B0F_25%,#17171F_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B0F] via-[#0B0B0F]/82 to-[#0B0B0F]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-transparent to-[#0B0B0F]/45" />
      </div>

      {/* Main Left-Third Negative Space Composition */}
      <div className="relative z-10 flex flex-1 items-center px-8 md:px-16 lg:px-24">
        <div className="max-w-xl w-full space-y-8">
          {/* Bespoke SVG Title Lockup */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <EclipseCrestSvg className="w-14 h-14 shrink-0" />
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-[#F8FAFC] text-balance leading-tight">
                Ashen Eclipse
              </h1>
            </div>
            <p className="text-sm md:text-base text-[#A1A1B5] leading-relaxed max-w-md">
              A classless dark-fantasy Action RPG shaped by Skills, trade-off Aspects, and endgame Marks.
            </p>
          </div>

          {/* Classless Starter Focus Selector */}
          <div className="space-y-2.5 max-w-lg">
            <div className="text-xs font-medium tracking-wider text-[#94A3B8]">
              Starter Loadout (Swappable Anytime)
            </div>
            <div className="grid grid-cols-1 gap-2">
              {STARTER_PRESETS.map((preset) => {
                const active = preset.id === selectedPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#17171F] border-[#D99B38] text-[#F8FAFC]'
                        : 'bg-[#121218]/90 border-[#272733] text-[#CBD5E1] hover:border-[#3F3F52]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-sm">{preset.name}</span>
                      <span className="text-xs font-mono-tabular text-[#D99B38]">
                        {preset.aspects.map((a) => a[0].toUpperCase() + a.slice(1)).join(' · ')}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-0.5 truncate">{preset.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary & Secondary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onStartGame}
              className="px-5 py-3 rounded-lg bg-[#D99B38] hover:bg-[#E5AA47] text-[#0B0B0F] font-semibold text-sm tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Enter the Eclipse
            </button>
            <button
              type="button"
              onClick={onStartSanctuary}
              className="px-4 py-3 rounded-lg bg-[#17171F] hover:bg-[#20202C] border border-[#D99B38]/60 text-[#FDE68A] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Practice Sanctuary
            </button>
            <button
              type="button"
              onClick={onOpenRoadmap}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-[#17171F] hover:bg-[#20202C] border border-[#272733] text-[#E6E4DD] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <UtilityIcon kind="roadmap" className="w-4 h-4 text-[#D99B38]" />
              <span>Development Roadmap</span>
              <span className="font-mono-tabular text-xs text-[#94A3B8]">{roadmapProgressPct}%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single Flat Borderless Control Hint */}
      <footer className="relative z-10 px-8 md:px-16 lg:px-24 pb-6">
        <p className="text-xs text-[#94A3B8] font-mono-tabular">
          LMB Move / Interact · RMB Primary · Shift+LMB Stand Attack · 1–4 &amp; Space Skills · Q Flask · WASD Optional · P Pause
        </p>
      </footer>
    </div>
  );
}
