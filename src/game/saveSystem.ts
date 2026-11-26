import {
  ALL_ASPECT_IDS,
  ALL_SKILL_IDS,
  DOMAIN_MODIFIERS,
  createInitialSkillProgress,
} from './data';
import {
  AspectId,
  EquipSlot,
  GearItem,
  SkillId,
  SkillProgress,
} from './types';

export interface AshenSavePayload {
  schemaVersion: 2;
  savedAt: string;
  hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId];
  activeAspects: AspectId[];
  unlockedAspects: AspectId[];
  skillProgress: Record<SkillId, SkillProgress>;
  equipment: Partial<Record<EquipSlot, GearItem>>;
  bag: GearItem[];
  shards: number;
  pinnacleKills: number;
  maxDomainTier: number;
  selectedDomainTier: number;
  selectedModifierIds: string[];
  corrupted: boolean;
  completedRoadmapIds: Record<string, boolean>;
}

export function exportSaveJson(state: Omit<AshenSavePayload, 'schemaVersion' | 'savedAt'>): string {
  const payload: AshenSavePayload = {
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    ...state,
  };
  return JSON.stringify(payload, null, 2);
}

export function importSaveJson(raw: string): AshenSavePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON save file.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Save file root must be an object.');
  }

  const obj = parsed as Record<string, unknown>;
  const ver = obj.schemaVersion ?? obj.version ?? 1;
  if (ver !== 1 && ver !== 2) {
    throw new Error(`Unsupported save schema version: ${String(ver)}`);
  }

  // Validate & migrate hotbar
  const validSkills = new Set<string>(ALL_SKILL_IDS);
  const rawHotbar = Array.isArray(obj.hotbar) ? obj.hotbar : [];
  const defaultHotbar: [SkillId, SkillId, SkillId, SkillId, SkillId] = [
    'cinder_slash',
    'seismic_slam',
    'ashen_nova',
    'radiant_barrier',
    'shadow_step',
  ];
  const hotbar = [0, 1, 2, 3, 4].map((idx) => {
    const candidate = rawHotbar[idx];
    return typeof candidate === 'string' && validSkills.has(candidate)
      ? (candidate as SkillId)
      : defaultHotbar[idx];
  }) as [SkillId, SkillId, SkillId, SkillId, SkillId];

  // Validate aspects
  const validAspects = new Set<string>(ALL_ASPECT_IDS);
  const activeAspects = (Array.isArray(obj.activeAspects) ? obj.activeAspects : ['blood', 'iron'])
    .filter((a): a is AspectId => typeof a === 'string' && validAspects.has(a))
    .slice(0, 7);

  const unlockedAspects = (
    Array.isArray(obj.unlockedAspects) ? obj.unlockedAspects : ALL_ASPECT_IDS.slice(0, 10)
  ).filter((a): a is AspectId => typeof a === 'string' && validAspects.has(a));

  // Migrate skill progress (ensuring any Phase 4 skills exist even on v1 saves)
  const skillProgress = createInitialSkillProgress();
  if (obj.skillProgress && typeof obj.skillProgress === 'object') {
    const rawProg = obj.skillProgress as Record<string, Partial<SkillProgress>>;
    for (const sid of ALL_SKILL_IDS) {
      const entry = rawProg[sid];
      if (entry && typeof entry.level === 'number') {
        skillProgress[sid] = {
          level: Math.max(1, Math.min(20, Math.round(entry.level))),
          xp: typeof entry.xp === 'number' ? Math.max(0, entry.xp) : 0,
          choices: entry.choices && typeof entry.choices === 'object' ? { ...entry.choices } : {},
        };
      }
    }
  }

  const validModIds = new Set(DOMAIN_MODIFIERS.map((m) => m.id));
  const selectedModifierIds = (
    Array.isArray(obj.selectedModifierIds) ? obj.selectedModifierIds : []
  ).filter((id): id is string => typeof id === 'string' && validModIds.has(id));

  const equipment =
    obj.equipment && typeof obj.equipment === 'object'
      ? (obj.equipment as Partial<Record<EquipSlot, GearItem>>)
      : {};
  const bag = Array.isArray(obj.bag) ? (obj.bag as GearItem[]).slice(0, 24) : [];

  return {
    schemaVersion: 2,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    hotbar,
    activeAspects,
    unlockedAspects: unlockedAspects.length > 0 ? unlockedAspects : ALL_ASPECT_IDS.slice(0, 10),
    skillProgress,
    equipment,
    bag,
    shards: typeof obj.shards === 'number' ? Math.max(0, Math.round(obj.shards)) : 20,
    pinnacleKills:
      typeof obj.pinnacleKills === 'number' ? Math.max(0, Math.round(obj.pinnacleKills)) : 0,
    maxDomainTier:
      typeof obj.maxDomainTier === 'number' ? Math.max(1, Math.round(obj.maxDomainTier)) : 1,
    selectedDomainTier:
      typeof obj.selectedDomainTier === 'number'
        ? Math.max(1, Math.min(20, Math.round(obj.selectedDomainTier)))
        : 1,
    selectedModifierIds,
    corrupted: Boolean(obj.corrupted),
    completedRoadmapIds:
      obj.completedRoadmapIds && typeof obj.completedRoadmapIds === 'object'
        ? (obj.completedRoadmapIds as Record<string, boolean>)
        : {},
  };
}
