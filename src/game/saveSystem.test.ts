import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SKILL_IDS, createInitialSkillProgress, createStarterEquipment } from './data';
import { exportSaveJson, importSaveJson } from './saveSystem';

test('exportSaveJson and importSaveJson perform lossless v2 roundtrip', () => {
  const skillProgress = createInitialSkillProgress();
  skillProgress.arcane_orb = { level: 7, xp: 42, choices: { 5: 'A' } };

  const json = exportSaveJson({
    hotbar: ['cinder_slash', 'crimson_whirlwind', 'arcane_orb', 'radiant_barrier', 'shadow_step'],
    activeAspects: ['blood', 'chronomancer', 'arcane_surge'],
    unlockedAspects: ['blood', 'iron', 'chronomancer', 'arcane_surge'],
    skillProgress,
    equipment: createStarterEquipment('Ashen Greatsword'),
    bag: [],
    shards: 84,
    pinnacleKills: 2,
    maxDomainTier: 3,
    selectedDomainTier: 2,
    selectedModifierIds: ['volatile_embers', 'glacial_mire'],
    corrupted: true,
    completedRoadmapIds: { p1_d1: true, p5_d3: true },
  });

  const restored = importSaveJson(json);
  assert.equal(restored.schemaVersion, 2);
  assert.deepEqual(restored.hotbar, [
    'cinder_slash',
    'crimson_whirlwind',
    'arcane_orb',
    'radiant_barrier',
    'shadow_step',
  ]);
  assert.equal(restored.shards, 84);
  assert.equal(restored.pinnacleKills, 2);
  assert.equal(restored.maxDomainTier, 3);
  assert.equal(restored.corrupted, true);
  assert.equal(restored.skillProgress.arcane_orb.level, 7);
  assert.equal(restored.skillProgress.arcane_orb.choices[5], 'A');
  assert.equal(restored.completedRoadmapIds.p5_d3, true);
});

test('importSaveJson migrates v1 saves and backfills Phase 4 skillProgress entries', () => {
  const v1Raw = JSON.stringify({
    version: 1,
    hotbar: ['ember_bolt', 'seismic_slam', 'ashen_nova', 'radiant_barrier', 'shadow_step'],
    activeAspects: ['aether', 'invalid_aspect_id'],
    shards: 50,
    skillProgress: {
      ember_bolt: { level: 12, xp: 10, choices: { 5: 'B', 10: 'A' } },
    },
  });

  const migrated = importSaveJson(v1Raw);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.activeAspects, ['aether']);
  assert.equal(migrated.skillProgress.ember_bolt.level, 12);
  for (const sid of ALL_SKILL_IDS) {
    assert.ok(migrated.skillProgress[sid], `Missing backfilled skill ${sid}`);
    assert.ok(migrated.skillProgress[sid].level >= 1);
  }
});

test('importSaveJson rejects malformed JSON and unsupported versions', () => {
  assert.throws(() => importSaveJson('{not valid json'), /Invalid JSON/);
  assert.throws(
    () => importSaveJson(JSON.stringify({ schemaVersion: 99 })),
    /Unsupported save schema version/
  );
});
