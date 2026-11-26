import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZipArchive, crc32, generateGodotStarterFiles } from './godotExport';

test('crc32 produces standard IEEE 802.3 checksum for known input', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

test('generateGodotStarterFiles includes core Godot 4 project, scene, and Phase 1-5 scripts/shaders', () => {
  const files = generateGodotStarterFiles();
  const paths = files.map((f) => f.path);
  assert.ok(paths.includes('project.godot'));
  assert.ok(paths.includes('scripts/combat_math.gd'));
  assert.ok(paths.includes('scripts/arena_controller.gd'));
  assert.ok(paths.includes('scripts/player_controller.gd'));
  assert.ok(paths.includes('scripts/hud_controller.gd'));
  assert.ok(paths.includes('shaders/anamorphic_glow.gdshader'));
  assert.ok(paths.includes('scripts/vfx_pool.gd'));
  assert.ok(paths.includes('scripts/domain_generator.gd'));
  assert.ok(paths.includes('scripts/audio_manager.gd'));
  assert.ok(paths.includes('scripts/save_manager.gd'));
  assert.ok(paths.includes('scenes/main_arena.tscn'));
  assert.ok(paths.includes('README.md'));
  const sceneFile = files.find((f) => f.path === 'scenes/main_arena.tscn');
  assert.ok(sceneFile?.content.includes('arena_controller.gd'));
  assert.ok(sceneFile?.content.includes('OverlayRoot'));
  for (const f of files) {
    assert.ok(f.content.length > 50, `Expected non-empty content for ${f.path}`);
  }
});

test('buildZipArchive generates valid PKZIP headers and EOCD footer', () => {
  const files = generateGodotStarterFiles();
  const zip = buildZipArchive(files);
  const view = new DataView(zip.buffer);
  // Local File Header signature: 0x04034b50 ("PK\x03\x04")
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // End of Central Directory signature at zip.length - 22: 0x06054b50
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 12, true), files.length);
});
