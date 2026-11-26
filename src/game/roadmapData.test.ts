import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSkillProgress, createStarterEquipment } from './data';
import {
  GODOT_MIGRATION_BLUEPRINT,
  ROADMAP_PHASES,
  computeRoadmapProgress,
  evaluateCurrentBuildBenchmark,
} from './roadmapData';

test('ROADMAP_PHASES covers all 5 sequential stages with deliverables and balance gates', () => {
  assert.equal(ROADMAP_PHASES.length, 5);
  for (const phase of ROADMAP_PHASES) {
    assert.ok(phase.deliverables.length >= 4);
    assert.ok(phase.balanceGates.length >= 3);
  }
});

test('computeRoadmapProgress tracks completion percentage accurately', () => {
  const empty = computeRoadmapProgress({});
  assert.equal(empty.done, 0);
  assert.equal(empty.total, 20);
  assert.equal(empty.pct, 0);

  const partial = computeRoadmapProgress({ p1_d1: true, p1_d2: true, p2_d1: true });
  assert.equal(partial.done, 3);
  assert.equal(partial.pct, 15);
});

test('evaluateCurrentBuildBenchmark reflects early parity and endgame scaling', () => {
  const progress = createInitialSkillProgress();
  const gear = createStarterEquipment('Tempered Ashblade');
  const early = evaluateCurrentBuildBenchmark('cinder_slash', ['blood', 'iron'], gear, progress, 1);
  assert.equal(early.gateStatus, 'Early Parity');
  assert.ok(early.currentHit > 35 && early.critHit > early.currentHit);

  progress.cinder_slash.level = 18;
  progress.cinder_slash.choices = { 5: 'A', 10: 'A', 15: 'A' };
  const late = evaluateCurrentBuildBenchmark(
    'cinder_slash',
    ['blood', 'cinder', 'shade', 'eclipse'],
    gear,
    progress,
    30
  );
  assert.equal(late.gateStatus, 'Endgame Ready');
  assert.ok(late.scaleFactorFromLv1 >= 6);
});

test('GODOT_MIGRATION_BLUEPRINT covers AshenEngine core loop and React-to-Node state mappings', () => {
  assert.ok(GODOT_MIGRATION_BLUEPRINT.coreLoopSteps.length >= 4);
  assert.ok(GODOT_MIGRATION_BLUEPRINT.stateMappings.length >= 4);
  assert.ok(GODOT_MIGRATION_BLUEPRINT.sceneTree.includes('MainArena'));
  assert.ok(GODOT_MIGRATION_BLUEPRINT.sceneTree.includes('GameState'));
  assert.ok(GODOT_MIGRATION_BLUEPRINT.gdscriptLoopSnippet.includes('_physics_process'));
});
