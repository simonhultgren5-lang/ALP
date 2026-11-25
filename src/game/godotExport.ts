export interface ZipEntryInput {
  path: string;
  content: string;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a valid uncompressed (STORE) PKZIP archive in pure TypeScript.
 */
export function buildZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = encoder.encode(entry.content);
    const checksum = crc32(dataBytes);

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local header signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // Compression method 0 (STORE)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0, true); // Mod date
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  // End of Central Directory (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const archive = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(eocd, cursor);
  return archive;
}

export function generateGodotStarterFiles(): ZipEntryInput[] {
  const projectGodot = `; Engine configuration file for Ashen Eclipse (Godot 4.3+)
config_version=5

[application]
config/name="Ashen Eclipse"
run/main_scene="res://scenes/main_arena.tscn"
config/features=PackedStringArray("4.3", "Forward Plus")

[display]
window/size/viewport_width=1440
window/size/viewport_height=900
window/stretch/mode="canvas_items"

[rendering]
environment/defaults/default_clear_color=Color(0.043, 0.043, 0.059, 1)

[input]
move_up={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":87,"physical_keycode":0,"key_label":0,"unicode":119,"location":0,"echo":false,"script":null)]
}
move_down={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":83,"physical_keycode":0,"key_label":0,"unicode":115,"location":0,"echo":false,"script":null)]
}
move_left={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":65,"physical_keycode":0,"key_label":0,"unicode":97,"location":0,"echo":false,"script":null)]
}
move_right={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":68,"physical_keycode":0,"key_label":0,"unicode":100,"location":0,"echo":false,"script":null)]
}
skill_1={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":49,"physical_keycode":0,"key_label":0,"unicode":49,"location":0,"echo":false,"script":null)]
}
skill_2={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":50,"physical_keycode":0,"key_label":0,"unicode":50,"location":0,"echo":false,"script":null)]
}
skill_3={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":51,"physical_keycode":0,"key_label":0,"unicode":51,"location":0,"echo":false,"script":null)]
}
skill_4={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":52,"physical_keycode":0,"key_label":0,"unicode":52,"location":0,"echo":false,"script":null)]
}
shadow_step={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":32,"physical_keycode":0,"key_label":0,"unicode":32,"location":0,"echo":false,"script":null)]
}
`;

  const combatMathGd = `class_name CombatMath
extends RefCounted

## Exact 6-step Damage Calculation Order from Ashen Eclipse Master Plan:
## 1. Base skill damage (scaled by skill level)
## 2. + Flat added damage
## 3. * (1 + sum of all Increased Damage %) [Additive]
## 4. * each More Damage multiplier sequentially [Multiplicative]
## 5. * Critical Strike Multiplier (if hit crits)
## 6. -> Enemy resistances & armour mitigation applied last

static func calculate_skill_damage(
	base_damage: float,
	damage_per_level: float,
	skill_level: int,
	flat_added: float,
	increased_pct: float,
	more_multipliers: Array[float],
	is_crit: bool,
	crit_multiplier: float,
	damage_type: String,
	enemy_resist_pct: float,
	enemy_armour: float
) -> Dictionary:
	var base := base_damage + float(max(0, skill_level - 1)) * damage_per_level
	var base_and_flat := base + flat_added
	var after_increased := base_and_flat * (1.0 + increased_pct / 100.0)

	var after_more := after_increased
	for mult in more_multipliers:
		after_more *= mult

	var after_crit := after_more * crit_multiplier if is_crit else after_more

	var resist_factor := 1.0 - clampf(enemy_resist_pct / 100.0, -0.5, 0.75)
	var armour_reduction := 0.0
	if damage_type == "physical":
		armour_reduction = enemy_armour / (enemy_armour + maxf(40.0, after_crit * 3.0))

	var final_damage := maxi(1, roundi(after_crit * resist_factor * (1.0 - armour_reduction)))
	return {
		"base_and_flat": base_and_flat,
		"after_increased": after_increased,
		"after_more": after_more,
		"after_crit": after_crit,
		"final_damage": final_damage,
	}

static func compute_incoming_mitigation(
	raw_damage: float,
	damage_type: String,
	armour: float,
	resist_pct: float,
	fortress_heart_active: bool
) -> int:
	var dmg := raw_damage
	if damage_type == "physical":
		var armour_mit := clampf(armour / (armour + maxf(120.0, raw_damage * 5.0)), 0.0, 0.75)
		dmg *= (1.0 - armour_mit)
		if fortress_heart_active:
			dmg *= 0.88
	else:
		dmg *= (1.0 - clampf(resist_pct, -50.0, 75.0) / 100.0)
	return maxi(1, roundi(dmg))
`;

  const playerControllerGd = `extends CharacterBody2D

## Phase 2 Player Controller:
## - Clamped frame dt
## - 0.12s skill input buffering
## - Sim-level hitstop + squash-and-stretch springs

@export var move_speed: float = 235.0
@export var input_buffer_window: float = 0.12

var cooldowns: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0]
var max_cooldowns: Array[float] = [0.45, 1.5, 1.4, 5.5, 1.6]
var buffered_slot: int = -1
var buffered_timer: float = 0.0
var hitstop_timer: float = 0.0

var squash_scale: Vector2 = Vector2.ONE
var aim_angle: float = 0.0

signal skill_cast(slot_index: int, aim_angle: float)

func _physics_process(raw_dt: float) -> void:
	var dt := minf(raw_dt, 0.05)

	# Decay squash-and-stretch spring smoothly even during hitstop
	squash_scale = squash_scale.lerp(Vector2.ONE, minf(1.0, dt * 16.0))
	scale = squash_scale

	if hitstop_timer > 0.0:
		hitstop_timer = maxf(0.0, hitstop_timer - dt)
		return

	for i in range(cooldowns.size()):
		if cooldowns[i] > 0.0:
			cooldowns[i] = maxf(0.0, cooldowns[i] - dt)

	if buffered_slot >= 0:
		buffered_timer -= dt
		if buffered_timer <= 0.0:
			buffered_slot = -1
		elif cooldowns[buffered_slot] <= 0.0:
			var slot := buffered_slot
			buffered_slot = -1
			_execute_slot(slot)

	var dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = dir * move_speed
	move_and_slide()

	var mouse_pos := get_global_mouse_position()
	aim_angle = (mouse_pos - global_position).angle()

	_poll_skill_inputs()

func _poll_skill_inputs() -> void:
	var actions := ["skill_1", "skill_2", "skill_3", "skill_4", "shadow_step"]
	for i in range(actions.size()):
		if Input.is_action_just_pressed(actions[i]):
			try_cast_or_buffer(i)

func try_cast_or_buffer(slot: int) -> void:
	if cooldowns[slot] <= 0.0:
		_execute_slot(slot)
	else:
		buffered_slot = slot
		buffered_timer = input_buffer_window

func _execute_slot(slot: int) -> void:
	cooldowns[slot] = max_cooldowns[slot]
	if slot == 4:
		squash_scale = Vector2(1.26, 0.78)
		global_position += Vector2.RIGHT.rotated(aim_angle) * 220.0
	else:
		squash_scale = Vector2(1.18, 0.86)
	emit_signal("skill_cast", slot, aim_angle)

func trigger_hitstop(duration: float = 0.045) -> void:
	hitstop_timer = maxf(hitstop_timer, duration)
`;

  const hudControllerGd = `extends CanvasLayer

## 2026 Hybrid HUD Controller:
## - Supports Compact (0.85), Standard (1.0), and Large (1.15) perimeter scaling
## - Keeps >= 85% center viewport unobstructed

@export_range(0.85, 1.15, 0.15) var hud_scale: float = 1.0

@onready var orb_cluster: Control = $BottomLeftOrbs
@onready var hotbar_cluster: Control = $BottomCenterHotbar
@onready var minimap_cluster: Control = $TopRightMinimap

func _ready() -> void:
	apply_hud_scale(hud_scale)

func apply_hud_scale(next_scale: float) -> void:
	hud_scale = clampf(next_scale, 0.85, 1.15)
	if orb_cluster:
		orb_cluster.scale = Vector2.ONE * hud_scale
	if hotbar_cluster:
		hotbar_cluster.scale = Vector2.ONE * hud_scale
	if minimap_cluster:
		minimap_cluster.scale = Vector2.ONE * hud_scale
`;

  const mainArenaTscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/player_controller.gd" id="1_player"]
[ext_resource type="Script" path="res://scripts/hud_controller.gd" id="2_hud"]

[node name="MainArena" type="Node2D"]

[node name="Player" type="CharacterBody2D" parent="."]
position = Vector2(720, 450)
script = ExtResource("1_player")

[node name="Camera2D" type="Camera2D" parent="Player"]
position_smoothing_enabled = true
position_smoothing_speed = 10.0

[node name="HybridHUD" type="CanvasLayer" parent="."]
script = ExtResource("2_hud")

[node name="BottomLeftOrbs" type="Control" parent="HybridHUD"]
anchors_preset = 2
anchor_top = 1.0
anchor_bottom = 1.0

[node name="BottomCenterHotbar" type="Control" parent="HybridHUD"]
anchors_preset = 7
anchor_left = 0.5
anchor_top = 1.0
anchor_right = 0.5
anchor_bottom = 1.0

[node name="TopRightMinimap" type="Control" parent="HybridHUD"]
anchors_preset = 1
anchor_left = 1.0
anchor_right = 1.0
`;

  const readmeMd = `# Ashen Eclipse — Godot 4 Starter Kit (Phase 2)

Generated directly from your Ashen Eclipse Roadmap Workspace.

## Included Files
- \`project.godot\`: Preconfigured 1440x900 obsidian viewport (\`#0B0B0F\`) and InputMap (\`WASD\`, \`1-4\`, \`Space\`).
- \`scripts/combat_math.gd\`: Pure GDScript implementation of the 6-step Damage Calculation Order and incoming mitigation.
- \`scripts/player_controller.gd\`: \`CharacterBody2D\` controller featuring clamped \`dt\`, \`0.12s\` skill input buffering, hitstop freeze frames, and squash-and-stretch springs.
- \`scripts/hud_controller.gd\`: \`CanvasLayer\` managing perimeter HUD scaling (\`0.85x\` / \`1.0x\` / \`1.15x\`).
- \`scenes/main_arena.tscn\`: Entry 2D scene wired with \`Player\`, \`Camera2D\`, and \`HybridHUD\`.

## Quick Start
1. Extract this archive into a new folder.
2. Open **Godot 4.3+** and click **Import** -> select \`project.godot\`.
3. Press **F5** to launch \`scenes/main_arena.tscn\`, then attach your Phase 3 \`GPUParticles2D\` and Dual-Kawase glow nodes.
`;

  return [
    { path: 'project.godot', content: projectGodot },
    { path: 'scripts/combat_math.gd', content: combatMathGd },
    { path: 'scripts/player_controller.gd', content: playerControllerGd },
    { path: 'scripts/hud_controller.gd', content: hudControllerGd },
    { path: 'scenes/main_arena.tscn', content: mainArenaTscn },
    { path: 'README.md', content: readmeMd },
  ];
}

export function downloadGodotStarterZip(): void {
  const files = generateGodotStarterFiles();
  const bytes = buildZipArchive(files);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ashen-eclipse-godot4-starter.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
