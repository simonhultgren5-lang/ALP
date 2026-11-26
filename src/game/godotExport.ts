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
use_flask={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":81,"physical_keycode":0,"key_label":0,"unicode":113,"location":0,"echo":false,"script":null)]
}
interact_portal={
"deadzone": 0.2,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":70,"physical_keycode":0,"key_label":0,"unicode":102,"location":0,"echo":false,"script":null)]
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
	var base := base_damage + float(maxi(0, skill_level - 1)) * damage_per_level
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

## Playable Godot 4 Player Controller:
## - Clamped delta, 0.12s skill input buffering, hitstop, & squash/stretch springs
## - Procedural Ashen Eclipse character & Aspect Armour rendering (_draw)
## - Emits signals to HybridHUD & ArenaController

@export var move_speed: float = 250.0
@export var input_buffer_window: float = 0.12
@export var arena_bounds: Rect2 = Rect2(60, 60, 1480, 960)

var max_hp: float = 220.0
var hp: float = 220.0
var max_es: float = 55.0
var es: float = 55.0
var veil_shield: float = 0.0
var max_mp: float = 100.0
var mp: float = 100.0
var es_recharge_delay: float = 0.0

var flask_charges: int = 3
var max_flask_charges: int = 3
var player_level: int = 1
var shards: int = 20

var cooldowns: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0]
var max_cooldowns: Array[float] = [0.42, 1.45, 1.35, 5.2, 1.4]
var skill_costs: Array[float] = [0.0, 14.0, 16.0, 15.0, 6.0]
var buffered_slot: int = -1
var buffered_timer: float = 0.0
var hitstop_timer: float = 0.0
var invuln_timer: float = 0.0
var barrier_timer: float = 0.0
var hit_flash: float = 0.0
var eclipse_timer: float = 6.0
var eclipse_ready: bool = false

var trauma: float = 0.0
var squash_scale: Vector2 = Vector2.ONE
var aim_angle: float = 0.0
var walk_phase: float = 0.0
var afterimages: Array[Dictionary] = []

@onready var cam: Camera2D = $Camera2D

signal skill_cast(slot_index: int, aim_angle: float, is_eclipse: bool)
signal vitals_changed(hp: float, max_hp: float, es: float, veil: float, mp: float, max_mp: float, flask: int, max_flask: int, shards: int, level: int)
signal cooldowns_changed(cooldowns: Array[float], max_cooldowns: Array[float], buffered_slot: int, eclipse_ready: bool)
signal player_died()

func _ready() -> void:
	_emit_vitals()
	_emit_cooldowns()

func _unhandled_input(event: InputEvent) -> void:
	if hp <= 0.0:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		try_cast_or_buffer(0)

func _physics_process(raw_dt: float) -> void:
	var dt := minf(raw_dt, 0.05)

	# Decay camera shake trauma^2 & squash-and-stretch even during hitstop
	if trauma > 0.0:
		trauma = maxf(0.0, trauma - dt * 2.4)
		var shake := trauma * trauma * 14.0
		if cam:
			cam.offset = Vector2(randf_range(-shake, shake), randf_range(-shake, shake))
	elif cam and cam.offset != Vector2.ZERO:
		cam.offset = Vector2.ZERO

	squash_scale = squash_scale.lerp(Vector2.ONE, minf(1.0, dt * 16.0))
	hit_flash = maxf(0.0, hit_flash - dt * 4.5)

	for i in range(afterimages.size() - 1, -1, -1):
		var img: Dictionary = afterimages[i]
		var next_life: float = float(img["life"]) - dt
		if next_life <= 0.0:
			afterimages.remove_at(i)
		else:
			img["life"] = next_life

	if hitstop_timer > 0.0:
		hitstop_timer = maxf(0.0, hitstop_timer - dt)
		queue_redraw()
		return

	if hp <= 0.0:
		queue_redraw()
		return

	if invuln_timer > 0.0:
		invuln_timer = maxf(0.0, invuln_timer - dt)
	if barrier_timer > 0.0:
		barrier_timer = maxf(0.0, barrier_timer - dt)
		if barrier_timer <= 0.0:
			veil_shield = 0.0

	# Mana & Energy Shield regen
	mp = minf(max_mp, mp + dt * 14.0)
	if es_recharge_delay > 0.0:
		es_recharge_delay = maxf(0.0, es_recharge_delay - dt)
	elif es < max_es:
		es = minf(max_es, es + dt * 18.0)

	# Eclipse aspect cycle
	if not eclipse_ready:
		eclipse_timer -= dt
		if eclipse_timer <= 0.0:
			eclipse_ready = true

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
	global_position.x = clampf(global_position.x, arena_bounds.position.x, arena_bounds.position.x + arena_bounds.size.x)
	global_position.y = clampf(global_position.y, arena_bounds.position.y, arena_bounds.position.y + arena_bounds.size.y)

	if dir.length_squared() > 0.01:
		walk_phase += dt * 10.0

	var mouse_pos := get_global_mouse_position()
	aim_angle = (mouse_pos - global_position).angle()

	_poll_skill_inputs()
	_emit_vitals()
	_emit_cooldowns()
	queue_redraw()

func _poll_skill_inputs() -> void:
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and cooldowns[0] <= 0.0:
		try_cast_or_buffer(0)
	var actions := ["skill_1", "skill_2", "skill_3", "skill_4", "shadow_step"]
	for i in range(actions.size()):
		if Input.is_action_just_pressed(actions[i]):
			try_cast_or_buffer(i)
	if Input.is_action_just_pressed("use_flask"):
		use_flask()

func try_cast_or_buffer(slot: int) -> void:
	if hp <= 0.0:
		return
	if cooldowns[slot] <= 0.0:
		_execute_slot(slot)
	else:
		buffered_slot = slot
		buffered_timer = input_buffer_window

func _execute_slot(slot: int) -> void:
	var cost := skill_costs[slot]
	if mp < cost:
		return
	mp = maxf(0.0, mp - cost)
	cooldowns[slot] = max_cooldowns[slot]

	var used_eclipse := eclipse_ready and slot != 3
	if used_eclipse:
		eclipse_ready = false
		eclipse_timer = 6.0

	if slot == 4:
		# Shadow Step dash with violet afterimages
		for k in range(3):
			afterimages.append({
				"pos": global_position + Vector2.RIGHT.rotated(aim_angle) * float(k) * 44.0,
				"life": 0.24 - float(k) * 0.04,
			})
		invuln_timer = maxf(invuln_timer, 0.28)
		squash_scale = Vector2(1.32, 0.74)
		var target := global_position + Vector2.RIGHT.rotated(aim_angle) * 210.0
		global_position.x = clampf(target.x, arena_bounds.position.x, arena_bounds.position.x + arena_bounds.size.x)
		global_position.y = clampf(target.y, arena_bounds.position.y, arena_bounds.position.y + arena_bounds.size.y)
	elif slot == 3:
		# Radiant Barrier
		barrier_timer = 3.2
		veil_shield = 70.0
		squash_scale = Vector2(1.16, 1.16)
	else:
		squash_scale = Vector2(1.2, 0.84)

	emit_signal("skill_cast", slot, aim_angle, used_eclipse)

func use_flask() -> void:
	if flask_charges <= 0 or hp >= max_hp or hp <= 0.0:
		return
	flask_charges -= 1
	hp = minf(max_hp, hp + max_hp * 0.42)
	mp = minf(max_mp, mp + 30.0)
	squash_scale = Vector2(1.12, 1.12)
	_emit_vitals()

func take_damage(raw_amount: float) -> int:
	if invuln_timer > 0.0 or hp <= 0.0:
		return 0
	var dmg := float(CombatMath.compute_incoming_mitigation(raw_amount, "physical", 160.0, 25.0, barrier_timer > 0.0))
	es_recharge_delay = 2.6
	hit_flash = 1.0
	add_trauma(0.28)

	var remaining := dmg
	if veil_shield > 0.0:
		var absorbed := minf(veil_shield, remaining)
		veil_shield -= absorbed
		remaining -= absorbed
	if es > 0.0 and remaining > 0.0:
		var es_absorbed := minf(es, remaining)
		es -= es_absorbed
		remaining -= es_absorbed
	if remaining > 0.0:
		hp = maxf(0.0, hp - remaining)
	_emit_vitals()
	if hp <= 0.0:
		emit_signal("player_died")
	return roundi(dmg)

func reset_vitals() -> void:
	hp = max_hp
	es = max_es
	mp = max_mp
	veil_shield = 0.0
	barrier_timer = 0.0
	flask_charges = max_flask_charges
	cooldowns = [0.0, 0.0, 0.0, 0.0, 0.0]
	_emit_vitals()
	_emit_cooldowns()

func trigger_hitstop(duration: float = 0.045) -> void:
	hitstop_timer = maxf(hitstop_timer, duration)

func add_trauma(amount: float) -> void:
	trauma = clampf(trauma + amount, 0.0, 1.0)

func _emit_vitals() -> void:
	emit_signal("vitals_changed", hp, max_hp, es, veil_shield, mp, max_mp, flask_charges, max_flask_charges, shards, player_level)

func _emit_cooldowns() -> void:
	emit_signal("cooldowns_changed", cooldowns, max_cooldowns, buffered_slot, eclipse_ready)

func _draw() -> void:
	# Shadow Step afterimages (drawn relative to player)
	for img in afterimages:
		var rel: Vector2 = img["pos"] - global_position
		var a: float = clampf(float(img["life"]) / 0.24, 0.0, 1.0) * 0.45
		draw_circle(rel, 18.0, Color(0.66, 0.33, 0.97, a))

	draw_set_transform(Vector2.ZERO, 0.0, squash_scale)

	# Ground shadow
	draw_circle(Vector2(0, 12), 20.0, Color(0, 0, 0, 0.45))

	# Veil / Radiant Barrier shell
	if veil_shield > 0.0 or barrier_timer > 0.0:
		draw_arc(Vector2.ZERO, 30.0, 0.0, TAU, 36, Color(0.22, 0.74, 0.97, 0.72), 2.5, true)
	if es > 2.0:
		var es_ratio := clampf(es / max_es, 0.0, 1.0)
		draw_arc(Vector2.ZERO, 25.0, -PI * 0.5, -PI * 0.5 + TAU * es_ratio, 32, Color(0.49, 0.83, 0.99, 0.55), 2.0, true)

	# Orbiting Eclipse Sigil
	var orbit_ang := walk_phase * 0.35 + Time.get_ticks_msec() * 0.0022
	var sigil_pos := Vector2.RIGHT.rotated(orbit_ang) * 32.0
	var sigil_col := Color(0.98, 0.8, 0.08, 0.95) if eclipse_ready else Color(0.85, 0.61, 0.22, 0.55)
	draw_circle(sigil_pos, 5.0 if eclipse_ready else 3.5, sigil_col)
	draw_arc(sigil_pos, 8.0, 0.0, TAU, 16, sigil_col, 1.3, true)

	# Aspect Armour body silhouette (Obsidian Plate + Blood Veins)
	var bob := sin(walk_phase) * 1.6
	var body_col := Color(1.0, 0.9, 0.85, 1.0) if hit_flash > 0.2 else Color(0.14, 0.14, 0.2, 1.0)
	draw_circle(Vector2(0, bob), 17.5, body_col)
	draw_arc(Vector2(0, bob), 18.0, 0.0, TAU, 28, Color(0.85, 0.61, 0.22, 0.9), 2.2, true)

	# Blood Aspect glowing core veins
	draw_line(Vector2(-7, -6 + bob), Vector2(0, 2 + bob), Color(0.94, 0.27, 0.27, 0.85), 2.0)
	draw_line(Vector2(7, -6 + bob), Vector2(0, 2 + bob), Color(0.94, 0.27, 0.27, 0.85), 2.0)

	# Directional weapon / aim indicator
	var aim_dir := Vector2.RIGHT.rotated(aim_angle)
	var perp := Vector2(-aim_dir.y, aim_dir.x)
	var tip := aim_dir * 30.0
	var base_l := aim_dir * 14.0 + perp * 6.0
	var base_r := aim_dir * 14.0 - perp * 6.0
	draw_colored_polygon(PackedVector2Array([tip, base_l, base_r]), Color(0.98, 0.57, 0.15, 0.95))

	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
`;

  const vfxPoolGd = `class_name VfxPool
extends Node2D

## Phase 3 M3.2 & M3.3: Zero-Allocation Decal, Particle, Slash Arc, & Crit Streak Pool
const DECAL_POOL_SIZE := 80
const PARTICLE_POOL_SIZE := 260
const STREAK_POOL_SIZE := 24
const TEXT_POOL_SIZE := 48
const SLASH_POOL_SIZE := 24

var _decal_pool: Array[Dictionary] = []
var _particle_pool: Array[Dictionary] = []
var _streak_pool: Array[Dictionary] = []
var _text_pool: Array[Dictionary] = []
var _slash_pool: Array[Dictionary] = []

var _decal_cursor: int = 0
var _particle_cursor: int = 0
var _streak_cursor: int = 0
var _text_cursor: int = 0
var _slash_cursor: int = 0

func _ready() -> void:
	for i in range(DECAL_POOL_SIZE):
		_decal_pool.append({"active": false, "pos": Vector2.ZERO, "radius": 24.0, "life": 0.0, "max_life": 1.0, "color": Color(0.97, 0.45, 0.09, 0.5)})
	for i in range(PARTICLE_POOL_SIZE):
		_particle_pool.append({"active": false, "pos": Vector2.ZERO, "vel": Vector2.ZERO, "radius": 4.0, "life": 0.0, "max_life": 0.4, "color": Color.WHITE})
	for i in range(STREAK_POOL_SIZE):
		_streak_pool.append({"active": false, "pos": Vector2.ZERO, "width": 110.0, "life": 0.0, "max_life": 0.2, "color": Color(0.98, 0.8, 0.08, 1.0)})
	for i in range(TEXT_POOL_SIZE):
		_text_pool.append({"active": false, "pos": Vector2.ZERO, "vel_y": -44.0, "text": "", "life": 0.0, "max_life": 0.65, "color": Color.WHITE, "is_crit": false})
	for i in range(SLASH_POOL_SIZE):
		_slash_pool.append({"active": false, "pos": Vector2.ZERO, "angle": 0.0, "arc": 1.8, "radius": 95.0, "life": 0.0, "max_life": 0.2, "color": Color(0.98, 0.45, 0.09, 1.0), "kind": "slash"})

func spawn_decal(pos: Vector2, radius: float, duration: float, color: Color) -> void:
	var slot: Dictionary = _decal_pool[_decal_cursor]
	_decal_cursor = (_decal_cursor + 1) % DECAL_POOL_SIZE
	slot["active"] = true
	slot["pos"] = pos
	slot["radius"] = radius
	slot["life"] = duration
	slot["max_life"] = duration
	slot["color"] = color

func spawn_burst(pos: Vector2, count: int, speed: float, color: Color, radius: float = 4.0) -> void:
	for i in range(count):
		var slot: Dictionary = _particle_pool[_particle_cursor]
		_particle_cursor = (_particle_cursor + 1) % PARTICLE_POOL_SIZE
		var ang := randf() * TAU
		var spd := randf_range(speed * 0.35, speed)
		slot["active"] = true
		slot["pos"] = pos
		slot["vel"] = Vector2.RIGHT.rotated(ang) * spd
		slot["radius"] = randf_range(radius * 0.6, radius * 1.25)
		slot["life"] = randf_range(0.18, 0.42)
		slot["max_life"] = float(slot["life"])
		slot["color"] = color

func spawn_crit_streak(pos: Vector2, color: Color, width: float = 120.0) -> void:
	var slot: Dictionary = _streak_pool[_streak_cursor]
	_streak_cursor = (_streak_cursor + 1) % STREAK_POOL_SIZE
	slot["active"] = true
	slot["pos"] = pos
	slot["width"] = width
	slot["life"] = 0.2
	slot["max_life"] = 0.2
	slot["color"] = color

func spawn_floating_text(pos: Vector2, text: String, color: Color, is_crit: bool = false) -> void:
	var slot: Dictionary = _text_pool[_text_cursor]
	_text_cursor = (_text_cursor + 1) % TEXT_POOL_SIZE
	slot["active"] = true
	slot["pos"] = pos + Vector2(randf_range(-14, 14), -18)
	slot["vel_y"] = -58.0 if is_crit else -42.0
	slot["text"] = text
	slot["life"] = 0.72 if is_crit else 0.55
	slot["max_life"] = float(slot["life"])
	slot["color"] = color
	slot["is_crit"] = is_crit

func spawn_slash_fx(pos: Vector2, angle: float, radius: float, arc: float, color: Color, kind: String = "slash") -> void:
	var slot: Dictionary = _slash_pool[_slash_cursor]
	_slash_cursor = (_slash_cursor + 1) % SLASH_POOL_SIZE
	slot["active"] = true
	slot["pos"] = pos
	slot["angle"] = angle
	slot["radius"] = radius
	slot["arc"] = arc
	slot["life"] = 0.26 if kind == "ring" else 0.18
	slot["max_life"] = float(slot["life"])
	slot["color"] = color
	slot["kind"] = kind

func _process(raw_dt: float) -> void:
	var dt := minf(raw_dt, 0.05)
	var dirty := false

	for d in _decal_pool:
		if bool(d["active"]):
			dirty = true
			d["life"] = float(d["life"]) - dt
			if float(d["life"]) <= 0.0:
				d["active"] = false

	for p in _particle_pool:
		if bool(p["active"]):
			dirty = true
			p["life"] = float(p["life"]) - dt
			if float(p["life"]) <= 0.0:
				p["active"] = false
			else:
				var vel: Vector2 = p["vel"]
				p["pos"] = Vector2(p["pos"]) + vel * dt
				p["vel"] = vel * maxf(0.0, 1.0 - dt * 5.0)

	for s in _streak_pool:
		if bool(s["active"]):
			dirty = true
			s["life"] = float(s["life"]) - dt
			if float(s["life"]) <= 0.0:
				s["active"] = false

	for fx in _slash_pool:
		if bool(fx["active"]):
			dirty = true
			fx["life"] = float(fx["life"]) - dt
			if float(fx["life"]) <= 0.0:
				fx["active"] = false

	for t in _text_pool:
		if bool(t["active"]):
			dirty = true
			t["life"] = float(t["life"]) - dt
			if float(t["life"]) <= 0.0:
				t["active"] = false
			else:
				t["pos"] = Vector2(t["pos"]) + Vector2(0.0, float(t["vel_y"]) * dt)

	if dirty:
		queue_redraw()

func _draw() -> void:
	for d in _decal_pool:
		if not bool(d["active"]):
			continue
		var alpha := clampf(float(d["life"]) / maxf(0.01, minf(0.8, float(d["max_life"]))), 0.0, 1.0)
		var col: Color = d["color"]
		col.a = alpha * 0.36
		draw_circle(Vector2(d["pos"]), float(d["radius"]), col)

	for fx in _slash_pool:
		if not bool(fx["active"]):
			continue
		var progress := 1.0 - clampf(float(fx["life"]) / maxf(0.01, float(fx["max_life"])), 0.0, 1.0)
		var alpha := 1.0 - progress
		var col: Color = fx["color"]
		var pos: Vector2 = fx["pos"]
		var radius: float = float(fx["radius"])
		var kind: String = str(fx["kind"])
		if kind == "ring":
			var r := lerpf(radius * 0.28, radius, progress)
			draw_arc(pos, r, 0.0, TAU, 40, Color(col.r, col.g, col.b, alpha * 0.85), 8.0 * alpha + 2.0, true)
			draw_circle(pos, r * 0.9, Color(col.r, col.g, col.b, alpha * 0.16))
		else:
			var ang: float = float(fx["angle"])
			var arc: float = float(fx["arc"])
			draw_arc(pos, radius, ang - arc * 0.5, ang + arc * 0.5, 22, Color(col.r, col.g, col.b, alpha * 0.9), 18.0 * alpha + 4.0, true)
			draw_arc(pos, radius * 0.88, ang - arc * 0.45, ang + arc * 0.45, 20, Color(1.0, 0.95, 0.8, alpha), 5.0 * alpha + 1.5, true)

	for p in _particle_pool:
		if not bool(p["active"]):
			continue
		var alpha := clampf(float(p["life"]) / maxf(0.01, float(p["max_life"])), 0.0, 1.0)
		var col: Color = p["color"]
		col.a = alpha
		draw_circle(Vector2(p["pos"]), float(p["radius"]) * (0.4 + 0.6 * alpha), col)

	for s in _streak_pool:
		if not bool(s["active"]):
			continue
		var alpha := clampf(float(s["life"]) / maxf(0.01, float(s["max_life"])), 0.0, 1.0)
		var col: Color = s["color"]
		var pos: Vector2 = s["pos"]
		var half_w := float(s["width"]) * 0.5 * (1.3 - 0.3 * alpha)
		# M3.3 Horizontal Anamorphic Crit Flare + Chromatic Ghost
		draw_line(pos - Vector2(half_w, 0), pos + Vector2(half_w, 0), Color(col.r, col.g, col.b, alpha * 0.85), 4.5 * alpha)
		draw_line(pos - Vector2(half_w * 0.7, 2), pos + Vector2(half_w * 0.7, 2), Color(0.22, 0.82, 0.98, alpha * 0.5), 2.0 * alpha)
		draw_circle(pos, 10.0 * alpha, Color(1.0, 0.96, 0.82, alpha * 0.9))

	var font := ThemeDB.fallback_font
	for t in _text_pool:
		if not bool(t["active"]):
			continue
		var alpha := clampf(float(t["life"]) / maxf(0.01, float(t["max_life"])), 0.0, 1.0)
		var col: Color = t["color"]
		col.a = alpha
		var sz := 18 if bool(t["is_crit"]) else 14
		draw_string(font, Vector2(t["pos"]) + Vector2(-60.0, 0.0), str(t["text"]), HORIZONTAL_ALIGNMENT_CENTER, 120.0, sz, col)
`;

  const arenaControllerGd = `extends Node2D

## Playable Ashen Eclipse Arena Loop (Phases 1-5):
## - Obsidian chamber rendering, Practice Dummy, Enemy AI + telegraphs, & Multi-Phase Pinnacle Boss
## - Deterministic CombatMath 6-step damage + loot drops + Chamber/Domain Tier progression

@onready var player: CharacterBody2D = $Player
@onready var vfx: VfxPool = $VfxPool
@onready var hud: CanvasLayer = $HybridHUD

var arena_rect := Rect2(60, 60, 1480, 960)
var domain_tier: int = 1
var chamber_index: int = 0
var room_names: Array[String] = ["Shattered Threshold", "Cinder Nave", "Obsidian Cloister", "Eclipse Sanctum"]
var cleared_rooms: Array[bool] = [false, false, false, false]
var portal_open: bool = false
var portal_pos := Vector2(1420, 540)

var enemies: Array[Dictionary] = []
var enemy_projectiles: Array[Dictionary] = []
var ground_loot: Array[Dictionary] = []

var kills: int = 0
var damage_window: Array[Dictionary] = []
var sim_time: float = 0.0
var hit_counter: int = 0

func _ready() -> void:
	player.arena_bounds = arena_rect
	player.skill_cast.connect(_on_player_skill_cast)
	player.player_died.connect(_on_player_died)
	if hud.has_method("connect_player"):
		hud.connect_player(player)
	_enter_chamber(0)

func _enter_chamber(idx: int) -> void:
	chamber_index = idx
	portal_open = false
	enemies.clear()
	enemy_projectiles.clear()
	ground_loot.clear()
	player.global_position = Vector2(240, 540)

	# Sanctuary Practice Dummy on left side of Threshold
	if chamber_index == 0:
		enemies.append(_make_enemy("dummy", "Practice Dummy", Vector2(470, 420), 99999.0, 26.0, 0.0, Color(0.85, 0.61, 0.22, 1.0), true))

	var domain := DomainGenerator.build_domain(domain_tier, domain_tier >= 3)
	var life_scale: float = float(domain["enemy_life_scale"])
	var dmg_scale: float = float(domain["enemy_dmg_scale"])

	if chamber_index < 3:
		var count := 4 + chamber_index * 2
		for i in range(count):
			var kind := "chaser" if i % 3 == 0 else ("kiter" if i % 3 == 1 else "charger")
			var spawn := Vector2(randf_range(760, 1380), randf_range(160, 920))
			var col := Color(0.92, 0.32, 0.25, 1.0) if kind == "chaser" else (Color(0.55, 0.35, 0.95, 1.0) if kind == "kiter" else Color(0.95, 0.62, 0.15, 1.0))
			var hp_base := 115.0 if kind == "chaser" else (85.0 if kind == "kiter" else 145.0)
			enemies.append(_make_enemy(kind, kind.capitalize(), spawn, hp_base * life_scale, 18.0, 18.0 * dmg_scale, col, false))
	else:
		var boss_name: String = str(domain["boss_name"])
		enemies.append(_make_enemy("boss", boss_name, Vector2(1140, 540), 760.0 * life_scale, 34.0, 32.0 * dmg_scale, Color(0.85, 0.18, 0.28, 1.0), false))
		enemies.append(_make_enemy("chaser", "Ashen Guard", Vector2(1040, 340), 120.0 * life_scale, 18.0, 18.0 * dmg_scale, Color(0.92, 0.32, 0.25, 1.0), false))
		enemies.append(_make_enemy("kiter", "Void Acolyte", Vector2(1040, 740), 95.0 * life_scale, 18.0, 18.0 * dmg_scale, Color(0.55, 0.35, 0.95, 1.0), false))

	_sync_hud_world()

func _make_enemy(kind: String, label: String, pos: Vector2, max_hp: float, radius: float, dmg: float, color: Color, is_dummy: bool) -> Dictionary:
	return {
		"kind": kind,
		"name": label,
		"pos": pos,
		"vel": Vector2.ZERO,
		"hp": max_hp,
		"max_hp": max_hp,
		"radius": radius,
		"dmg": dmg,
		"color": color,
		"is_dummy": is_dummy,
		"state": "idle",
		"state_timer": randf_range(0.4, 1.1),
		"windup_max": 0.55,
		"aim_dir": Vector2.LEFT,
		"hit_flash": 0.0,
		"burn_timer": 0.0,
		"chill_timer": 0.0,
		"boss_phase": 1,
	}

func _process(raw_dt: float) -> void:
	var dt := minf(raw_dt, 0.05)
	sim_time += dt

	# Trim DPS window (> 3.0s)
	for i in range(damage_window.size() - 1, -1, -1):
		if sim_time - float(damage_window[i]["t"]) > 3.0:
			damage_window.remove_at(i)

	if player.hitstop_timer > 0.0 or player.hp <= 0.0:
		queue_redraw()
		return

	_update_enemies(dt)
	_update_projectiles(dt)
	_check_loot_pickup()
	_check_portal_interaction()
	_sync_hud_world()
	queue_redraw()

func _on_player_skill_cast(slot: int, aim_angle: float, is_eclipse: bool) -> void:
	var p_pos: Vector2 = player.global_position
	var aim_dir := Vector2.RIGHT.rotated(aim_angle)

	if slot == 0:
		# Cinder Slash
		vfx.spawn_slash_fx(p_pos, aim_angle, 108.0, 1.9, Color(0.98, 0.5, 0.12, 1.0), "slash")
		vfx.spawn_burst(p_pos + aim_dir * 60.0, 12, 190.0, Color(0.98, 0.65, 0.2, 1.0), 4.0)
		_damage_arc(p_pos, aim_dir, 118.0, 1.15, 42.0, "fire", is_eclipse, true)
	elif slot == 1:
		# Seismic Slam
		var impact := p_pos + aim_dir * 92.0
		vfx.spawn_slash_fx(impact, 0.0, 125.0, TAU, Color(0.9, 0.85, 0.72, 1.0), "ring")
		vfx.spawn_decal(impact, 95.0, 2.5, Color(0.45, 0.45, 0.55, 0.5))
		vfx.spawn_burst(impact, 18, 240.0, Color(0.92, 0.88, 0.78, 1.0), 4.5)
		player.add_trauma(0.32)
		_damage_radius(impact, 130.0, 62.0, "physical", is_eclipse, false)
	elif slot == 2:
		# Ashen Nova
		vfx.spawn_slash_fx(p_pos, 0.0, 175.0, TAU, Color(0.98, 0.35, 0.08, 1.0), "ring")
		vfx.spawn_decal(p_pos, 110.0, 3.0, Color(0.98, 0.35, 0.08, 0.45))
		vfx.spawn_burst(p_pos, 22, 270.0, Color(0.98, 0.55, 0.15, 1.0), 4.5)
		player.add_trauma(0.24)
		_damage_radius(p_pos, 178.0, 56.0, "fire", is_eclipse, true)
	elif slot == 4:
		vfx.spawn_burst(p_pos, 14, 180.0, Color(0.66, 0.33, 0.97, 1.0), 4.0)

func _damage_arc(origin: Vector2, dir: Vector2, radius: float, half_angle: float, base_dmg: float, dmg_type: String, is_eclipse: bool, apply_burn: bool) -> void:
	for i in range(enemies.size() - 1, -1, -1):
		var e: Dictionary = enemies[i]
		var to_e: Vector2 = Vector2(e["pos"]) - origin
		var dist := to_e.length()
		if dist <= radius + float(e["radius"]):
			var ang := absf(dir.angle_to(to_e.normalized())) if dist > 1.0 else 0.0
			if ang <= half_angle:
				_hit_enemy(i, base_dmg, dmg_type, is_eclipse, apply_burn, dir * 130.0)

func _damage_radius(center: Vector2, radius: float, base_dmg: float, dmg_type: String, is_eclipse: bool, apply_burn: bool) -> void:
	for i in range(enemies.size() - 1, -1, -1):
		var e: Dictionary = enemies[i]
		var to_e: Vector2 = Vector2(e["pos"]) - center
		if to_e.length() <= radius + float(e["radius"]):
			var kb := to_e.normalized() * 170.0 if to_e.length() > 1.0 else Vector2.RIGHT * 120.0
			_hit_enemy(i, base_dmg, dmg_type, is_eclipse, apply_burn, kb)

func _hit_enemy(idx: int, base_dmg: float, dmg_type: String, is_eclipse: bool, apply_burn: bool, knockback: Vector2) -> void:
	var e: Dictionary = enemies[idx]
	hit_counter += 1
	var is_crit := (hit_counter % 4 == 0) or is_eclipse
	var mults: Array[float] = [1.35]
	if is_eclipse:
		mults.append(1.6)
	var calc := CombatMath.calculate_skill_damage(base_dmg, 10.0, player.player_level, 8.0, 24.0, mults, is_crit, 1.75, dmg_type, 15.0 if bool(e["is_dummy"]) else 10.0, 90.0 if bool(e["is_dummy"]) else 45.0)
	var dmg: int = int(calc["final_damage"])

	e["hit_flash"] = 1.0
	if not bool(e["is_dummy"]):
		e["pos"] = Vector2(e["pos"]) + knockback * 0.25
		e["hp"] = float(e["hp"]) - float(dmg)
	else:
		# Reset dummy visually after showing damage
		e["hp"] = maxf(1.0, float(e["max_hp"]) - float(dmg))

	if apply_burn:
		e["burn_timer"] = 2.5

	damage_window.append({"t": sim_time, "dmg": dmg})
	var e_pos: Vector2 = e["pos"]
	var txt_col := Color(0.98, 0.8, 0.08, 1.0) if is_crit else Color(0.97, 0.98, 0.99, 1.0)
	vfx.spawn_floating_text(e_pos, str(dmg) + ("!" if is_crit else ""), txt_col, is_crit)
	vfx.spawn_burst(e_pos, 10 if is_crit else 5, 190.0, txt_col, 3.5)

	if is_crit:
		vfx.spawn_crit_streak(e_pos, txt_col, 130.0)
		player.trigger_hitstop(0.04)
		player.add_trauma(0.18)

	# Boss Phase II Enrage at <= 50% HP
	if str(e["kind"]) == "boss" and int(e["boss_phase"]) == 1 and float(e["hp"]) <= float(e["max_hp"]) * 0.5:
		e["boss_phase"] = 2
		e["color"] = Color(0.98, 0.15, 0.25, 1.0)
		vfx.spawn_slash_fx(e_pos, 0.0, 220.0, TAU, Color(0.98, 0.2, 0.3, 1.0), "ring")
		vfx.spawn_floating_text(e_pos + Vector2(0, -34), "PHASE II — ENRAGE!", Color(0.98, 0.3, 0.35, 1.0), true)
		player.add_trauma(0.42)

	if not bool(e["is_dummy"]) and float(e["hp"]) <= 0.0:
		kills += 1
		player.shards += 4
		vfx.spawn_burst(e_pos, 20, 260.0, Color(0.98, 0.5, 0.15, 1.0), 4.5)
		vfx.spawn_crit_streak(e_pos, Color(0.98, 0.5, 0.15, 1.0), 150.0)
		player.trigger_hitstop(0.05)

		if str(e["kind"]) == "boss" or randf() < 0.45:
			var rarity := "legendary" if str(e["kind"]) == "boss" else ("rare" if randf() < 0.5 else "magic")
			ground_loot.append({"pos": e_pos, "rarity": rarity, "pulse": 0.0})

		enemies.remove_at(idx)
		_check_chamber_cleared()

func _check_chamber_cleared() -> void:
	var hostiles := 0
	for e in enemies:
		if not bool(e["is_dummy"]):
			hostiles += 1
	if hostiles == 0 and not portal_open:
		cleared_rooms[chamber_index] = true
		portal_open = true
		vfx.spawn_slash_fx(portal_pos, 0.0, 85.0, TAU, Color(0.85, 0.61, 0.22, 1.0), "ring")

func _update_enemies(dt: float) -> void:
	var p_pos: Vector2 = player.global_position
	for e in enemies:
		e["hit_flash"] = maxf(0.0, float(e["hit_flash"]) - dt * 5.0)
		if bool(e["is_dummy"]):
			continue

		if float(e["burn_timer"]) > 0.0:
			e["burn_timer"] = float(e["burn_timer"]) - dt

		var e_pos: Vector2 = e["pos"]
		var to_p := p_pos - e_pos
		var dist := to_p.length()
		var dir := to_p.normalized() if dist > 1.0 else Vector2.LEFT
		var kind: String = str(e["kind"])
		var state: String = str(e["state"])
		var timer: float = float(e["state_timer"]) - dt
		var phase2 := int(e["boss_phase"]) == 2

		if state == "idle":
			var spd := 95.0 if kind == "chaser" else (78.0 if kind == "kiter" else (112.0 if kind == "boss" else 105.0))
			if phase2:
				spd *= 1.28
			if kind == "kiter" and dist < 240.0:
				e_pos -= dir * spd * dt
			elif dist > (340.0 if kind == "kiter" else 64.0):
				e_pos += dir * spd * dt

			if timer <= 0.0 and dist < (460.0 if kind == "kiter" or kind == "boss" else 220.0):
				e["state"] = "windup"
				e["windup_max"] = 0.42 if phase2 else 0.58
				e["state_timer"] = float(e["windup_max"])
				e["aim_dir"] = dir
			else:
				e["state_timer"] = timer
		elif state == "windup":
			if timer <= 0.0:
				var aim: Vector2 = e["aim_dir"]
				if kind == "kiter":
					enemy_projectiles.append({"pos": e_pos, "vel": aim * 360.0, "life": 2.4, "dmg": float(e["dmg"]), "color": Color(0.66, 0.33, 0.97, 1.0)})
				elif kind == "boss":
					var count := 7 if phase2 else 5
					for k in range(count):
						var spread := (float(k) - float(count - 1) * 0.5) * 0.24
						enemy_projectiles.append({"pos": e_pos, "vel": aim.rotated(spread) * 340.0, "life": 2.6, "dmg": float(e["dmg"]), "color": Color(0.98, 0.25, 0.35, 1.0)})
					if dist <= 135.0:
						player.take_damage(float(e["dmg"]) * 1.15)
				elif kind == "charger":
					e_pos += aim * 155.0
					if (p_pos - e_pos).length() <= 64.0:
						player.take_damage(float(e["dmg"]))
				else:
					vfx.spawn_slash_fx(e_pos, aim.angle(), 65.0, 1.3, Color(0.95, 0.3, 0.25, 1.0), "slash")
					if dist <= 88.0:
						player.take_damage(float(e["dmg"]))
				e["state"] = "idle"
				e["state_timer"] = 0.9 if phase2 else 1.35
			else:
				e["state_timer"] = timer

		e_pos.x = clampf(e_pos.x, arena_rect.position.x + 20.0, arena_rect.position.x + arena_rect.size.x - 20.0)
		e_pos.y = clampf(e_pos.y, arena_rect.position.y + 20.0, arena_rect.position.y + arena_rect.size.y - 20.0)
		e["pos"] = e_pos

func _update_projectiles(dt: float) -> void:
	var p_pos: Vector2 = player.global_position
	for i in range(enemy_projectiles.size() - 1, -1, -1):
		var pr: Dictionary = enemy_projectiles[i]
		pr["life"] = float(pr["life"]) - dt
		var next_pos: Vector2 = Vector2(pr["pos"]) + Vector2(pr["vel"]) * dt
		pr["pos"] = next_pos
		if float(pr["life"]) <= 0.0 or not arena_rect.has_point(next_pos):
			enemy_projectiles.remove_at(i)
		elif (next_pos - p_pos).length() <= 24.0:
			player.take_damage(float(pr["dmg"]))
			var pr_col: Color = pr["color"]
			vfx.spawn_burst(next_pos, 6, 120.0, pr_col, 3.0)
			enemy_projectiles.remove_at(i)

func _check_loot_pickup() -> void:
	var p_pos: Vector2 = player.global_position
	for i in range(ground_loot.size() - 1, -1, -1):
		var g: Dictionary = ground_loot[i]
		g["pulse"] = float(g["pulse"]) + 0.08
		if (Vector2(g["pos"]) - p_pos).length() <= 38.0:
			var rarity: String = str(g["rarity"])
			var bonus := 18 if rarity == "legendary" else (8 if rarity == "rare" else 4)
			player.shards += bonus
			vfx.spawn_floating_text(p_pos, "+%d Shards (%s)" % [bonus, rarity.capitalize()], Color(0.85, 0.61, 0.22, 1.0), rarity == "legendary")
			ground_loot.remove_at(i)

func _check_portal_interaction() -> void:
	if not portal_open:
		return
	var near_portal := (player.global_position - portal_pos).length() <= 58.0
	if near_portal or Input.is_action_just_pressed("interact_portal"):
		if near_portal:
			if chamber_index < 3:
				_enter_chamber(chamber_index + 1)
			else:
				domain_tier += 1
				cleared_rooms = [false, false, false, false]
				_enter_chamber(0)

func _on_player_died() -> void:
	await get_tree().create_timer(1.4).timeout
	player.reset_vitals()
	_enter_chamber(0)

func _sync_hud_world() -> void:
	if not hud.has_method("update_world_state"):
		return
	var total_recent := 0
	for entry in damage_window:
		total_recent += int(entry["dmg"])
	var dps := roundi(float(total_recent) / 3.0)
	var boss_name := ""
	var boss_hp := 0.0
	var boss_max := 1.0
	var boss_phase := 1
	for e in enemies:
		if str(e["kind"]) == "boss":
			boss_name = str(e["name"])
			boss_hp = float(e["hp"])
			boss_max = float(e["max_hp"])
			boss_phase = int(e["boss_phase"])
	hud.update_world_state(domain_tier, chamber_index, room_names[chamber_index], cleared_rooms, kills, dps, portal_open, boss_name, boss_hp, boss_max, boss_phase)

func _draw() -> void:
	# Obsidian Arena Chamber Floor & Golden Grid
	draw_rect(arena_rect, Color(0.055, 0.055, 0.078, 1.0), true)
	draw_rect(arena_rect, Color(0.85, 0.61, 0.22, 0.45), false, 3.0)

	for x in range(int(arena_rect.position.x), int(arena_rect.position.x + arena_rect.size.x), 80):
		draw_line(Vector2(x, arena_rect.position.y), Vector2(x, arena_rect.position.y + arena_rect.size.y), Color(0.14, 0.14, 0.2, 0.45), 1.0)
	for y in range(int(arena_rect.position.y), int(arena_rect.position.y + arena_rect.size.y), 80):
		draw_line(Vector2(arena_rect.position.x, y), Vector2(arena_rect.position.x + arena_rect.size.x, y), Color(0.14, 0.14, 0.2, 0.45), 1.0)

	# Central Obsidian Eclipse Sigil
	var center := arena_rect.get_center()
	draw_arc(center, 150.0, 0.0, TAU, 48, Color(0.85, 0.61, 0.22, 0.14), 2.0, true)
	draw_arc(center, 90.0, 0.0, TAU, 36, Color(0.85, 0.61, 0.22, 0.18), 1.5, true)

	# Portal when Chamber Cleared
	if portal_open:
		var pulse := 1.0 + sin(sim_time * 5.0) * 0.1
		draw_circle(portal_pos, 36.0 * pulse, Color(0.85, 0.61, 0.22, 0.25))
		draw_arc(portal_pos, 34.0 * pulse, 0.0, TAU, 32, Color(0.99, 0.9, 0.54, 0.95), 3.0, true)
		draw_string(ThemeDB.fallback_font, portal_pos + Vector2(-120.0, -48.0), "DOMAIN PORTAL (WALK IN)", HORIZONTAL_ALIGNMENT_CENTER, 240.0, 13, Color(0.99, 0.9, 0.54, 1.0))

	# Shape-coded Ground Loot (M5.1)
	for g in ground_loot:
		var pos: Vector2 = g["pos"]
		var rarity: String = str(g["rarity"])
		var col := Color(0.98, 0.45, 0.09, 1.0) if rarity == "legendary" else (Color(0.98, 0.8, 0.08, 1.0) if rarity == "rare" else Color(0.38, 0.65, 0.98, 1.0))
		draw_line(pos, pos + Vector2(0, -48), Color(col.r, col.g, col.b, 0.55), 3.0)
		if rarity == "legendary":
			draw_arc(pos, 13.0, 0.0, TAU, 6, col, 2.5, true)
		elif rarity == "rare":
			draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -11), pos + Vector2(11, 0), pos + Vector2(0, 11), pos + Vector2(-11, 0)]), col)
		else:
			draw_circle(pos, 8.0, col)

	# Enemies + Telegraphs
	var font := ThemeDB.fallback_font
	for e in enemies:
		var pos: Vector2 = e["pos"]
		var r: float = float(e["radius"])
		var col: Color = e["color"]
		var flash: float = float(e["hit_flash"])
		var draw_col := col.lerp(Color.WHITE, clampf(flash, 0.0, 1.0))

		if str(e["state"]) == "windup":
			var prog := 1.0 - clampf(float(e["state_timer"]) / maxf(0.01, float(e["windup_max"])), 0.0, 1.0)
			var aim: Vector2 = e["aim_dir"]
			draw_arc(pos, r + 24.0, 0.0, TAU * prog, 28, Color(0.98, 0.25, 0.25, 0.85), 3.0, true)
			draw_line(pos, pos + aim * 120.0, Color(0.98, 0.25, 0.25, 0.6), 2.5)

		draw_circle(pos + Vector2(0, 8), r, Color(0, 0, 0, 0.4))
		draw_circle(pos, r, draw_col)
		draw_arc(pos, r, 0.0, TAU, 24, Color(0.95, 0.95, 0.98, 0.55), 1.8, true)

		if bool(e["is_dummy"]):
			draw_string(font, pos + Vector2(-70.0, -r - 12.0), "Training Dummy", HORIZONTAL_ALIGNMENT_CENTER, 140.0, 12, Color(0.98, 0.88, 0.55, 1.0))
		else:
			var hp_pct := clampf(float(e["hp"]) / maxf(1.0, float(e["max_hp"])), 0.0, 1.0)
			var bar_w := r * 2.2
			var bar_pos := pos + Vector2(-bar_w * 0.5, -r - 12)
			draw_rect(Rect2(bar_pos, Vector2(bar_w, 5)), Color(0.08, 0.08, 0.12, 0.9), true)
			draw_rect(Rect2(bar_pos, Vector2(bar_w * hp_pct, 5)), Color(0.9, 0.22, 0.24, 1.0), true)

	# Enemy Projectiles
	for pr in enemy_projectiles:
		var pos: Vector2 = pr["pos"]
		var col: Color = pr["color"]
		draw_circle(pos, 8.0, col)
		draw_circle(pos, 4.0, Color.WHITE)
`;

  const hudControllerGd = `extends CanvasLayer

## 2026 Hybrid HUD Controller (Procedural Control Drawing):
## - Bottom-Left Crimson HP / Cyan ES / Veil Orb + Sapphire MP Orb + [Q] Flask
## - Bottom-Center 5-Slot Hotbar with live cooldown sweep & Eclipse Ready badge
## - Top-Center Boss HP Bar + Phase II badge
## - Top-Right Room-Graph Minimap + Tier / Kills / Live DPS

@export_range(0.85, 1.15, 0.15) var hud_scale: float = 1.0

var hp: float = 220.0
var max_hp: float = 220.0
var es: float = 55.0
var veil: float = 0.0
var mp: float = 100.0
var max_mp: float = 100.0
var flask: int = 3
var max_flask: int = 3
var shards: int = 20
var player_level: int = 1

var cooldowns: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0]
var max_cooldowns: Array[float] = [0.42, 1.45, 1.35, 5.2, 1.4]
var buffered_slot: int = -1
var eclipse_ready: bool = false

var domain_tier: int = 1
var chamber_index: int = 0
var room_name: String = "Shattered Threshold"
var cleared_rooms: Array[bool] = [false, false, false, false]
var kills: int = 0
var dps: int = 0
var portal_open: bool = false
var boss_name: String = ""
var boss_hp: float = 0.0
var boss_max_hp: float = 1.0
var boss_phase: int = 1

@onready var overlay: Control = $OverlayRoot

func _ready() -> void:
	if overlay:
		overlay.draw.connect(_draw_hud)

func connect_player(player: Node) -> void:
	if player.has_signal("vitals_changed"):
		player.vitals_changed.connect(_on_vitals_changed)
	if player.has_signal("cooldowns_changed"):
		player.cooldowns_changed.connect(_on_cooldowns_changed)

func _on_vitals_changed(p_hp: float, p_max_hp: float, p_es: float, p_veil: float, p_mp: float, p_max_mp: float, p_flask: int, p_max_flask: int, p_shards: int, p_lvl: int) -> void:
	hp = p_hp
	max_hp = p_max_hp
	es = p_es
	veil = p_veil
	mp = p_mp
	max_mp = p_max_mp
	flask = p_flask
	max_flask = p_max_flask
	shards = p_shards
	player_level = p_lvl
	if overlay:
		overlay.queue_redraw()

func _on_cooldowns_changed(cds: Array[float], max_cds: Array[float], buf: int, eclipse: bool) -> void:
	cooldowns = cds
	max_cooldowns = max_cds
	buffered_slot = buf
	eclipse_ready = eclipse
	if overlay:
		overlay.queue_redraw()

func update_world_state(tier: int, room_idx: int, r_name: String, cleared: Array[bool], k: int, d: int, portal: bool, b_name: String, b_hp: float, b_max: float, b_phase: int) -> void:
	domain_tier = tier
	chamber_index = room_idx
	room_name = r_name
	cleared_rooms = cleared
	kills = k
	dps = d
	portal_open = portal
	boss_name = b_name
	boss_hp = b_hp
	boss_max_hp = b_max
	boss_phase = b_phase
	if overlay:
		overlay.queue_redraw()

func _draw_hud() -> void:
	var vp := overlay.get_viewport_rect().size
	var font := ThemeDB.fallback_font

	# 1. Bottom-Left Orbs & Flask
	var hp_center := Vector2(74, vp.y - 74)
	var hp_r := 44.0
	var hp_pct := clampf(hp / maxf(1.0, max_hp), 0.0, 1.0)
	overlay.draw_circle(hp_center, hp_r, Color(0.08, 0.08, 0.11, 0.92))
	overlay.draw_circle(hp_center, hp_r * hp_pct, Color(0.75, 0.16, 0.19, 0.88))
	overlay.draw_arc(hp_center, hp_r, 0.0, TAU, 36, Color(0.2, 0.2, 0.26, 1.0), 2.5, true)
	if es > 0.0 or veil > 0.0:
		overlay.draw_arc(hp_center, hp_r + 5.0, -PI * 0.5, -PI * 0.5 + TAU * clampf((es + veil) / 80.0, 0.15, 1.0), 32, Color(0.22, 0.74, 0.97, 0.9), 3.0, true)
	overlay.draw_string(font, hp_center + Vector2(-18, 4), str(roundi(hp)), HORIZONTAL_ALIGNMENT_CENTER, 36, 16, Color.WHITE)
	overlay.draw_string(font, hp_center + Vector2(-28, 22), "+%d ES" % roundi(es + veil), HORIZONTAL_ALIGNMENT_CENTER, 56, 11, Color(0.49, 0.83, 0.99, 1.0))

	var mp_center := Vector2(150, vp.y - 62)
	var mp_r := 30.0
	overlay.draw_circle(mp_center, mp_r, Color(0.08, 0.08, 0.11, 0.92))
	overlay.draw_circle(mp_center, mp_r * clampf(mp / maxf(1.0, max_mp), 0.0, 1.0), Color(0.16, 0.38, 0.78, 0.9))
	overlay.draw_arc(mp_center, mp_r, 0.0, TAU, 28, Color(0.2, 0.2, 0.26, 1.0), 2.0, true)
	overlay.draw_string(font, mp_center + Vector2(-15, 4), str(roundi(mp)), HORIZONTAL_ALIGNMENT_CENTER, 30, 13, Color.WHITE)

	overlay.draw_string(font, Vector2(28, vp.y - 12), "Lv %d · %d Shards · [Q] Flask %d/%d" % [player_level, shards, flask, max_flask], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.85, 0.61, 0.22, 1.0))

	# 2. Bottom-Center 5-Slot Hotbar
	var labels := ["1/LMB Slash", "2 Slam", "3 Nova", "4 Barrier", "Space Dash"]
	var slot_w := 74.0
	var gap := 10.0
	var total_w := slot_w * 5.0 + gap * 4.0
	var start_x := (vp.x - total_w) * 0.5
	var y_top := vp.y - 82.0

	if eclipse_ready:
		overlay.draw_string(font, Vector2(vp.x * 0.5 - 70, y_top - 12), "ECLIPSE EMPOWERED", HORIZONTAL_ALIGNMENT_CENTER, 140, 12, Color(0.98, 0.8, 0.08, 1.0))

	for i in range(5):
		var rect := Rect2(start_x + float(i) * (slot_w + gap), y_top, slot_w, 56.0)
		var cd := cooldowns[i] if i < cooldowns.size() else 0.0
		var max_cd := max_cooldowns[i] if i < max_cooldowns.size() else 1.0
		var is_buf := (buffered_slot == i)
		overlay.draw_rect(rect, Color(0.09, 0.09, 0.13, 0.94), true)
		overlay.draw_rect(rect, Color(0.85, 0.61, 0.22, 1.0) if (cd <= 0.0 or is_buf) else Color(0.22, 0.22, 0.3, 1.0), false, 2.0)
		if cd > 0.0:
			var ratio := clampf(cd / maxf(0.01, max_cd), 0.0, 1.0)
			overlay.draw_rect(Rect2(rect.position.x, rect.position.y + rect.size.y * (1.0 - ratio), rect.size.x, rect.size.y * ratio), Color(0.0, 0.0, 0.0, 0.65), true)
			overlay.draw_string(font, rect.position + Vector2(4, 34), "%.1f" % cd, HORIZONTAL_ALIGNMENT_CENTER, int(slot_w) - 8, 14, Color(0.98, 0.8, 0.08, 1.0))
		overlay.draw_string(font, rect.position + Vector2(4, 18), labels[i], HORIZONTAL_ALIGNMENT_CENTER, int(slot_w) - 8, 11, Color(0.9, 0.9, 0.94, 1.0))

	# 3. Top-Right Minimap & Telemetry
	var mm_rect := Rect2(vp.x - 246, 20, 224, 72)
	overlay.draw_rect(mm_rect, Color(0.07, 0.07, 0.1, 0.9), true)
	overlay.draw_rect(mm_rect, Color(0.2, 0.2, 0.28, 1.0), false, 1.5)
	overlay.draw_string(font, mm_rect.position + Vector2(12, 20), "Tier %d · %s" % [domain_tier, room_name], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.98, 0.98, 0.99, 1.0))
	for i in range(4):
		var node_pos := mm_rect.position + Vector2(24 + i * 56, 44)
		if i < 3:
			overlay.draw_line(node_pos, node_pos + Vector2(56, 0), Color(0.28, 0.28, 0.38, 1.0), 2.0)
		var col := Color(0.85, 0.61, 0.22, 1.0) if i == chamber_index else (Color(0.06, 0.72, 0.5, 1.0) if cleared_rooms[i] else Color(0.22, 0.22, 0.3, 1.0))
		overlay.draw_circle(node_pos, 6.0 if i == chamber_index else 4.5, col)
	overlay.draw_string(font, Vector2(vp.x - 160, vp.y - 20), "%d DPS · %d Slain" % [dps, kills], HORIZONTAL_ALIGNMENT_RIGHT, 140, 12, Color(0.75, 0.8, 0.88, 1.0))

	# 4. Top-Center Pinnacle Boss Bar
	if boss_name != "" and boss_hp > 0.0:
		var bw := 420.0
		var bx := (vp.x - bw) * 0.5
		overlay.draw_rect(Rect2(bx, 20, bw, 36), Color(0.07, 0.07, 0.1, 0.92), true)
		overlay.draw_rect(Rect2(bx, 20, bw, 36), Color(0.94, 0.27, 0.27, 1.0) if boss_phase == 2 else Color(0.3, 0.3, 0.38, 1.0), false, 2.0)
		var pct := clampf(boss_hp / maxf(1.0, boss_max_hp), 0.0, 1.0)
		overlay.draw_rect(Rect2(bx + 10, 40, (bw - 20) * pct, 8), Color(0.85, 0.16, 0.2, 1.0), true)
		var title := boss_name + (" [PHASE II]" if boss_phase == 2 else "")
		overlay.draw_string(font, Vector2(bx + 10, 34), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.98, 0.92, 0.85, 1.0))

	if portal_open:
		overlay.draw_string(font, Vector2(vp.x * 0.5 - 160, 74), "CHAMBER CLEARED — ENTER AMBER PORTAL", HORIZONTAL_ALIGNMENT_CENTER, 320, 13, Color(0.99, 0.9, 0.54, 1.0))
`;

  const mainArenaTscn = `[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://scripts/arena_controller.gd" id="1_arena"]
[ext_resource type="Script" path="res://scripts/player_controller.gd" id="2_player"]
[ext_resource type="Script" path="res://scripts/vfx_pool.gd" id="3_vfx"]
[ext_resource type="Script" path="res://scripts/hud_controller.gd" id="4_hud"]

[node name="MainArena" type="Node2D"]
script = ExtResource("1_arena")

[node name="VfxPool" type="Node2D" parent="."]
script = ExtResource("3_vfx")

[node name="Player" type="CharacterBody2D" parent="."]
position = Vector2(240, 540)
script = ExtResource("2_player")

[node name="Camera2D" type="Camera2D" parent="Player"]
position_smoothing_enabled = true
position_smoothing_speed = 10.0

[node name="HybridHUD" type="CanvasLayer" parent="."]
script = ExtResource("4_hud")

[node name="OverlayRoot" type="Control" parent="HybridHUD"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
mouse_filter = 2
`;

  const anamorphicShader = `shader_type canvas_item;

// Phase 3 M3.3: 3-Layer Post-Processing Stack helper (Anamorphic + Spectral Chromatic Streak)
uniform vec4 glow_color : source_color = vec4(0.85, 0.61, 0.22, 1.0);
uniform float streak_intensity : hint_range(0.0, 2.0) = 1.25;
uniform float chromatic_offset : hint_range(0.0, 0.05) = 0.012;

void fragment() {
	vec2 uv = UV;
	float r = texture(TEXTURE, uv + vec2(chromatic_offset, 0.0)).r;
	float g = texture(TEXTURE, uv).g;
	float b = texture(TEXTURE, uv - vec2(chromatic_offset, 0.0)).b;
	float a = texture(TEXTURE, uv).a;
	vec4 base = vec4(r, g, b, a);
	float horiz = exp(-abs(uv.y - 0.5) * 14.0) * (1.0 - abs(uv.x - 0.5) * 1.8);
	COLOR = base + glow_color * max(0.0, horiz) * streak_intensity;
}
`;

  const domainGeneratorGd = `class_name DomainGenerator
extends RefCounted

## Phase 4 M4.2 & M4.4: Tier 1-20+ Procedural Domains & 5 Multi-Phase Pinnacle Bosses
const BOSS_NAMES: Array[String] = [
	"Vaelor, The Ashen Sovereign",
	"Malkor, Storm Warden",
	"Sera, Frostbound Oracle",
	"Nyx, Architect of the Void",
	"Kaelen, Iron Colossus",
]

static func build_domain(tier: int, corrupted: bool) -> Dictionary:
	var boss_name := BOSS_NAMES[(tier - 1) % BOSS_NAMES.size()]
	var enemy_life_scale := (1.0 + float(tier - 1) * 0.42) * (1.25 if corrupted else 1.0)
	var enemy_dmg_scale := (1.0 + float(tier - 1) * 0.22) * (1.2 if corrupted else 1.0)
	return {
		"tier": tier,
		"corrupted": corrupted,
		"rooms": 4,
		"boss_name": boss_name,
		"enemy_life_scale": enemy_life_scale,
		"enemy_dmg_scale": enemy_dmg_scale,
		"boss_phase_two_threshold": 0.5,
	}
`;

  const audioManagerGd = `extends Node

## Phase 5 M5.2: Pitch-varied Combat Audio & Boss Phase Stinger Manager
var muted: bool = false

func play_scaled_pitch(player: AudioStreamPlayer, base_pitch: float = 1.0) -> void:
	if muted or player == null:
		return
	player.pitch_scale = base_pitch * randf_range(0.92, 1.08)
	player.play()
`;

  const saveManagerGd = `class_name SaveManager
extends RefCounted

## Phase 5 M5.3: Versioned Save Schema & v1 -> v2 Migration
const SAVE_PATH := "user://ashen_eclipse_save.json"
const SCHEMA_VERSION := 2

static func save_build(payload: Dictionary) -> Error:
	payload["schemaVersion"] = SCHEMA_VERSION
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(payload, "\\t"))
	return OK

static func load_build() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var raw := FileAccess.get_file_as_string(SAVE_PATH)
	var parsed = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	parsed["schemaVersion"] = SCHEMA_VERSION
	return parsed
`;

  const readmeMd = `# Ashen Eclipse — Playable Godot 4 Project (Phases 1–5)

Generated directly from your Ashen Eclipse Roadmap Workspace. Press **F5** in Godot 4.3+ to play immediately!

## Controls in Godot 4
- **WASD**: Move across the obsidian arena
- **Mouse Aim + Left Click / 1**: Cinder Slash (wide burning cleave)
- **2**: Seismic Slam (heavy ground shockwave + radial decal)
- **3**: Ashen Nova (expanding fire ring)
- **4**: Radiant Barrier (defensive Veil Shield ward)
- **Space**: Shadow Step (invulnerable dash + afterimages)
- **Q**: Recovery Flask

## Included Files
- \`project.godot\`: Preconfigured 1440x900 obsidian viewport (\`#0B0B0F\`) and InputMap.
- \`scenes/main_arena.tscn\`: Playable 2D arena scene wired with \`ArenaController\`, \`VfxPool\`, \`Player\`, \`Camera2D\`, and \`HybridHUD\`.
- \`scripts/arena_controller.gd\`: Chamber progression, Practice Dummy, enemy AI & windup telegraphs, 5 Multi-Phase Pinnacle Bosses, loot drops, and portal transitions.
- \`scripts/player_controller.gd\`: \`CharacterBody2D\` controller with clamped \`dt\`, \`0.12s\` skill input buffering, hitstop freeze frames, trauma^2 shake, and Aspect Armour rendering.
- \`scripts/hud_controller.gd\`: 2026 Hybrid HUD \`CanvasLayer\` rendering HP/ES/Veil/MP orbs, 5-slot cooldown hotbar, Boss bar, and Room-Graph minimap.
- \`scripts/vfx_pool.gd\`: Zero-allocation pooled particles, slash arcs, ground decals, floating crit text, and horizontal anamorphic crit streaks.
- \`scripts/combat_math.gd\`: Phase 1 6-step Damage Calculation Order and incoming mitigation.
- \`scripts/domain_generator.gd\`: Phase 4 Tier 1–20+ procedural Domain & 5 Pinnacle Boss encounter scaling.
- \`shaders/anamorphic_glow.gdshader\`: Phase 3 Anamorphic Glow & Spectral Chromatic Streak shader.
- \`scripts/audio_manager.gd\` & \`scripts/save_manager.gd\`: Phase 5 audio pitch helper and versioned JSON save utility.

## Quick Start
1. Extract this archive into a new folder.
2. Open **Godot 4.3+** and click **Import** -> select \`project.godot\`.
3. Press **F5** to launch \`scenes/main_arena.tscn\` and fight immediately!
`;

  return [
    { path: 'project.godot', content: projectGodot },
    { path: 'scripts/combat_math.gd', content: combatMathGd },
    { path: 'scripts/arena_controller.gd', content: arenaControllerGd },
    { path: 'scripts/player_controller.gd', content: playerControllerGd },
    { path: 'scripts/hud_controller.gd', content: hudControllerGd },
    { path: 'shaders/anamorphic_glow.gdshader', content: anamorphicShader },
    { path: 'scripts/vfx_pool.gd', content: vfxPoolGd },
    { path: 'scripts/domain_generator.gd', content: domainGeneratorGd },
    { path: 'scripts/audio_manager.gd', content: audioManagerGd },
    { path: 'scripts/save_manager.gd', content: saveManagerGd },
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
