import React from 'react';
import { SkillId } from '../game/types';

export function EclipseCrestSvg({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="24" stroke="#D99B38" strokeWidth="1.5" strokeOpacity="0.45" />
      <circle cx="32" cy="32" r="16" fill="#0B0B0F" stroke="#D99B38" strokeWidth="2.5" />
      <circle cx="35" cy="30" r="12.5" fill="#0B0B0F" />
      <path d="M32 4V12M32 52V60M4 32H12M52 32H60" stroke="#D99B38" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12.2 12.2L17.8 17.8M46.2 46.2L51.8 51.8M51.8 12.2L46.2 17.8M17.8 46.2L12.2 51.8" stroke="#D99B38" strokeWidth="1.2" strokeOpacity="0.65" strokeLinecap="round" />
    </svg>
  );
}

export function SkillIcon({
  skillId,
  className = 'w-6 h-6',
}: {
  skillId: SkillId;
  className?: string;
}) {
  switch (skillId) {
    case 'cinder_slash':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 19C8 14 13 9 20 5C17 11 12 16 6 20L4 19Z" fill="#F97316" stroke="#0B0B0F" strokeWidth="1.2" />
          <path d="M6 17C10 13 14 9 19 6" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'ember_bolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M19 5L11 11L14 13L5 19L12 13L9 11L19 5Z" fill="#F97316" stroke="#FDE68A" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="17" cy="7" r="2.2" fill="#FDE68A" />
        </svg>
      );
    case 'frost_lance':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M20 4L14 14L10 10L20 4Z" fill="#22D3EE" stroke="#E0F2FE" strokeWidth="1.2" />
          <path d="M12 12L4 20" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M8 10L14 16" stroke="#E0F2FE" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'ashen_nova':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" stroke="#F97316" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="#FDE68A" />
          <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'shadow_step':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M5 17C8 12 11 8 18 6C15 11 13 15 10 18L5 17Z" fill="#A855F7" stroke="#E2E8F0" strokeWidth="1.2" />
          <circle cx="7" cy="16" r="2" fill="#E2E8F0" fillOpacity="0.6" />
        </svg>
      );
    case 'storm_spike':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M13 3L6 13H12L10 21L18 10H12L13 3Z" fill="#7DD3FC" stroke="#F8FAFC" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'bone_spear':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M19 5L14 14L10 10L19 5Z" fill="#E2E8F0" stroke="#0B0B0F" strokeWidth="1.1" />
          <path d="M12 12L5 19" stroke="#CBD5E1" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M7 15L9 17" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'seismic_slam':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4 17H20M7 14L12 5L17 14" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 20L12 17L16 20" stroke="#D99B38" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'void_tendrils':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M6 19C6 13 9 11 9 6M12 19C12 13 15 10 14 5M18 19C18 14 16 11 19 7" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="12" cy="19" rx="7" ry="2" fill="#581C87" stroke="#A855F7" strokeWidth="1.2" />
        </svg>
      );
    case 'radiant_barrier':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3L19 6V12C19 16.5 16 19.5 12 21C8 19.5 5 16.5 5 12V6L12 3Z" fill="#1E3A8A" stroke="#7DD3FC" strokeWidth="1.8" />
          <path d="M12 7V16M8.5 11.5H15.5" stroke="#E0F2FE" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export function UtilityIcon({
  kind,
  className = 'w-4 h-4',
}: {
  kind: 'mute' | 'unmute' | 'pause' | 'minimal' | 'roadmap' | 'build';
  className?: string;
}) {
  if (kind === 'mute') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M11 5L6 9H3V15H6L11 19V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16 9L21 15M21 9L16 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'unmute') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M11 5L6 9H3V15H6L11 19V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 6C21 8.8 21 15.2 18.5 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'pause') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
        <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'minimal') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 15H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'roadmap') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="5" cy="12" r="2.2" fill="currentColor" />
        <circle cx="12" cy="7" r="2.2" fill="currentColor" />
        <circle cx="19" cy="15" r="2.2" fill="currentColor" />
        <path d="M7 11L10 8M14 8.5L17 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
