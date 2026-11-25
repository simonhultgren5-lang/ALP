# Ashen Eclipse — Master Game Planning Document

> Consolidated from the full 31-turn design session ([grok_chat_history.md](file:///C:/Users/Andre/.gemini/antigravity/brain/0ba560c4-cda1-48f0-be66-43d71e78f82e/grok_chat_history.md)).

---

## 1. High-Level Vision & Design Philosophy

- **Genre**: Top-down Dark Fantasy Action RPG (start-to-endgame grinding loop).
- **Core Fantasy**: Start weak and grounded in a dying world; claim power from fallen enemies and forbidden knowledge until your character visually radiates build identity.
- **Design Mantra**: *"Power should feel earned and readable, not just bigger numbers."*
  - **Early Game (Lv 1–20)**: Tight, fair, readable, low variance.
  - **Mid Game (Lv 20–45)**: Multiplicative layers unlock; builds diverge.
  - **Endgame (Lv 45+)**: High ceiling, deep specialization, purposeful grinding.
- **Classless Architecture**: No fixed starting classes. Identity emerges dynamically from combining **Skills + Aspects + Marks** (optional light starter skill/Aspect packages can be offered without locking the player).
- **Intentional Scope Cuts (Clean Slate)**:
  - No sprawling passive tree or complex gem-linking/socket-color systems.
  - No multi-currency crafting bloat, hideout decoration, or battle pass.
  - Only **three core systems** exist; everything else supports them.

---

## 2. The Three Core Pillars

| Pillar | What It Is | Role in Progression |
| --- | --- | --- |
| **Skills** | Active abilities (max **5** equipped) | Moment-to-moment combat identity |
| **Aspects** | Passive power packages (starts at **2** slots, scales to **6–7**) | Primary source of *More* multipliers, drawbacks, and build direction |
| **Marks** | Rare, high-impact modifiers on gear & pinnacle boss drops | Endgame specialization and build-defining synergy |

### 2.1 Skills (Starting Set of 10 → Target ~18–20)
- Skills level up through use (max level 20).
- Every 5 levels (**5 / 10 / 15**), the player chooses **1 of 3 upgrade paths**.

| Skill | Type | Base Effect | Upgrade Paths (Lv 5 / 10 / 15) |
| --- | --- | --- | --- |
| **Cinder Slash** | Melee | Wide arc slash, fire damage | A: Bleed + damage · B: Wider arc + fire conversion · C: Lower CD + dash |
| **Ember Bolt** | Projectile | Fast fire projectile | A: Pierce · B: Explodes on hit · C: Extra projectiles |
| **Frost Lance** | Projectile | Piercing cold bolt | A: Chill + slow · B: High crit · C: Fork |
| **Ashen Nova** | Area | Nova around player | A: Bigger radius · B: Stronger burn · C: Lower mana cost |
| **Shadow Step** | Movement | Short teleport + brief invuln | A: Longer range · B: Damages on arrival · C: Leaves a decoy |
| **Storm Spike** | Spell | Lightning hit + chain | A: More chains · B: Higher damage · C: Shock effect |
| **Bone Spear** | Projectile | Physical spear that returns | A: More damage on return · B: Splits · C: Life leech |
| **Seismic Slam** | Melee / Area | Ground slam | A: Bigger area · B: Stun · C: Aftershock |
| **Void Tendrils** | DoT / Area | Tentacles that hold and damage | A: Longer duration · B: More damage · C: Pull enemies |
| **Radiant Barrier** | Defensive | Temporary shield + reflect | A: Stronger shield · B: Reflects more · C: Heals over time |

### 2.2 Aspects (Starting Pool of 15 → Target ~25–30)
Unlocked via bosses and milestones. Every Aspect pairs a strong identity bonus with a meaningful drawback or condition.

- **Offense**:
  1. **Blood Aspect**: +35% more Melee Damage · *Drawback*: Attacks cost Life instead of Mana.
  2. **Cinder Aspect**: Fire skills gain +40% more damage · *Drawback*: Take 12% increased Fire damage.
  3. **Storm Aspect**: Lightning skills chain +2 times · *Drawback*: 15% less Critical Strike Chance.
  4. **Precision Aspect**: +50% Critical Strike Multiplier · *Drawback*: Non-critical hits deal 20% less damage.
  5. **Overload Aspect**: Skills have 25% chance to repeat · *Drawback*: Repeating costs 50% more resources.
- **Defense / Hybrid**:
  6. **Iron Aspect**: +60% more Armour · *Drawback*: Cannot Evade.
  7. **Aether Aspect**: +45% more Energy Shield · *Drawback*: 20% less Maximum Life.
  8. **Veil Aspect**: Gain a damage absorb shield every 7s · *Drawback*: −15% Movement Speed while active.
  9. **Regrowth Aspect**: 3% of damage taken regenerated over 4s · *Drawback*: −20% Recovery Rate from flasks.
- **Utility / Style**:
  10. **Hunter Aspect**: +25% more Projectile Damage, +15% more Damage to Distant enemies.
  11. **Earthquake Aspect**: Area skills have 30% increased Area · *Drawback*: 15% less Attack/Cast Speed on Area skills.
  12. **Shade Aspect**: After using a Movement skill, next skill deals 40% more damage.
  13. **Siphon Aspect**: 15% of damage dealt leeched as Life · *Drawback*: Life Leech halved while on Full Life.
  14. **Eclipse Aspect**: Every 8s your next skill is Empowered (+60% more damage) · *Drawback*: Empowered skills cost double.
  15. **Frigid Aspect**: Cold skills have +30% more effect of Chill · *Drawback*: Move 8% slower.

### 2.3 Marks (Endgame Chase Modifiers)
Appear on high-ilvl Rare items, Legendaries, and Pinnacle Boss drops:
- **Repeating Echoes**: Area skills have 20% chance to repeat.
- **Critical Momentum**: On Critical Strike, gain 15% increased Action Speed for 3s.
- **Withering Touch**: DoTs you apply also reduce enemy damage by 12%.
- **Flowing Shadow**: Movement skills reset the cooldown of your lowest-cooldown skill.
- **Low Life Covenant**: You count as always being on Low Life for Aspects.
- **Fortress Heart**: Extra damage reduction while at full Iron Aspect benefit.
- **Aether Overflow**: Excess Energy Shield recharge converts into damage.
- **Chain Lightning Soul / Eclipse Core**: Specialized synergy enhancers for lightning and empower loops.

---

## 3. Core Math, Stat Interactions & Balance Rules

### 3.1 Damage Calculation Order
```text
1. Base skill damage
2. + Flat added damage (gear, early skill upgrades)
3. × (1 + sum of all Increased Damage %)       [Additive]
4. × each More Damage multiplier sequentially  [Multiplicative]
5. × Critical Strike Multiplier (if hit crits)
6. → Enemy resistances & armour mitigation applied last
```

- **Early-Game Balance Rule (Lv 1–20)**: Players have almost no *More* multipliers. Power comes from flat stats, skill levels, and early upgrade choices so builds stay close in power and combat stays readable.
- **Mid-to-Late Power Curve**: Multiplicative *More* layers from Aspects and Marks scale damage **8–12×** from early to late game.

### 3.2 Defensive & Resource Synergies
- **Life vs Energy Shield vs Armour**: Armour and Evasion are mutually exclusive under **Iron Aspect** (*Cannot Evade*). **Aether Aspect** trades Max Life for a large Energy Shield pool.
- **Life-Cost Loop**: **Blood Aspect** (skills cost Life) + **Siphon Aspect** (15% Life Leech, halved on Full Life) creates a high-risk, high-sustain berserker loop.
- **Movement Empowerment Loop**: **Shade Aspect** (+40% more damage after Movement skill) + **Flowing Shadow Mark** (Movement skill resets lowest cooldown).

### 3.3 Target Power Benchmarks (Lv 10 → Lv 25 → Lv 50)

| Build | Lv 10 Hit | Lv 25 Hit | Lv 50 Hit | Lv 50 Survivability Profile |
| --- | --- | --- | --- | --- |
| **Blood Reaver** | ~81 | ~280 | ~810 | ~4,200 Life, 55–65% Phys DR (Iron), 15% Leech |
| **Storm Conduit** | ~51 | ~190–230 | ~650–900 (+chains) | ~2,800 Life + 1,800 ES, relies on speed & Shadow Step |
| **Frost Controller** | ~42 (+18/s DoT) | ~130 (+55/s DoT) | ~380 (+160/s DoT) | ~2,200 Life + ~5,200 ES, Veil absorb, Chill slow |

---

## 4. Six Concrete Build Archetypes

| Build | Core Skills | Core Aspects | Key Marks | Playstyle & Trade-off |
| --- | --- | --- | --- | --- |
| **Blood Reaver** | Cinder Slash, Seismic Slam, Shadow Step | Blood, Iron, Siphon, Eclipse | Low Life Covenant, Fortress Heart | High single-target & leech sustain; dies fast if not hitting |
| **Storm Conduit** | Storm Spike, Ember Bolt, Shadow Step | Storm, Overload, Shade, Hunter | Chain Lightning Soul, Flowing Shadow, Repeating Echoes | Fastest screen-wide clear; lower raw tankiness |
| **Frost Controller** | Frost Lance, Void Tendrils, Radiant Barrier | Frigid, Aether, Veil, Regrowth | Withering Touch, Aether Overflow | Safest tanky caster; slower clear speed |
| **Ashen Bomber** | Ashen Nova, Seismic Slam, Ember Bolt | Cinder, Earthquake, Eclipse, Overload | Repeating Echoes, Eclipse Core | Massive area burst; mana-hungry |
| **Shadow Hunter** | Bone Spear, Frost Lance, Shadow Step | Hunter, Shade, Precision, Siphon | Critical Momentum, Flowing Shadow | Mobile crit skirmisher; requires high crit chance |
| **Iron Colossus** | Seismic Slam, Cinder Slash, Radiant Barrier | Iron, Regrowth, Veil | Fortress Heart, Withering Touch | Unkillable pure armour wall; lower DPS |

---

## 5. Itemization & Endgame Loop

### 5.1 Equipment & Rarities
- **9 Slots**: Weapon, Body Armour, Helmet, Gloves, Boots, Amulet, Rings (×2), Belt.
- **4 Rarities**: Normal (0 mods), Magic (1–2 mods), Rare (3–6 mods, low Mark chance at high ilvl), Legendary (fixed identity + build-enabling effects).
- **Balance Rule**: Gear provides **Flat** stats, **Increased %**, **Skill Levels**, and **Resistances**—almost never raw *More* multipliers (reserved for Aspects/Marks).

### 5.2 Example Build-Enabling Legendaries
- **Heart of the Berserker** *(Amulet)*: Blood Aspect grants +12% Life Leech; permanently count as Low Life.
- **Chain of the Stormlord** *(Belt)*: Storm Aspect chains +2 additional times; Lightning skills have 15% repeat chance.
- **Crown of Endless Winter** *(Helmet)*: Removes Frigid Aspect's movement penalty; +20% stronger Chill.
- **Ashen Core** *(Body Armour)*: Area Fire skills have 25% chance to trigger a secondary nova.
- **Veilwalker's Step** *(Boots)*: Shade Aspect bonus lasts +2s; Movement skills grant brief phasing.
- **Iron Vow Plate** *(Body Armour)*: Iron Aspect grants 8% of Armour as Life.

### 5.3 Endgame Loop
1. **Run Procedural Domains**: Scale **Tier (1 → 20+)**, add **Domain Modifiers** (target 15–20) for risk/reward, and optional **Corruption** layers.
2. **Loot & Craft**: Collect Rare/Legendary gear, Marks, and Aspect upgrades; use a **Simple Crafting Bench** to fix resistances, add Life, or bump mod tiers.
3. **Pinnacle Bosses**: Fight **5–6 Pinnacle Bosses** for exclusive Marks and Aspects.
4. **Refine & Push**: Optimize Skill + Aspect + Mark synergies and push higher Domain tiers.

---

## 6. 2D HUD & UI Architecture (2026 Hybrid Standard)

Follows a **Small Persistent Core + Contextual Layer** model so the center of the screen remains unobstructed:

- **Visual System**:
  - **Palette**: Obsidian `#0B0B0F`, Basalt `#17171F`, 1px Hairline Border `#272733`, Ember Gold `#D99B38`, Crimson `#DC2626`, Sapphire `#3B82F6`.
  - **Typography**: *Cinzel* (headers/wordmark), *Plus Jakarta Sans* (UI), *JetBrains Mono* (numbers/cooldowns/tiers).
- **Persistent Core**:
  - **Bottom-Left**: Large circular crimson HP orb + sapphire MP/ES orb + thin ember-gold XP bar.
  - **Bottom-Center**: 5-slot skill hotbar with clear keybinds (`1–4`, `Space`), mana cost, and **radial `conic-gradient` cooldown sweeps** with live countdown text.
  - **Top / Corners**: Compact room-graph minimap + Tier indicator; minimal single-row top bar.
- **Contextual & Accessibility**:
  - Objective tracker, boss bar, and buffs fade or appear only when relevant.
  - Plan for font scaling, high-contrast options, and a one-button **Minimal HUD** toggle.

---

## 7. Visual Direction, VFX & Post-Processing Pipeline

### 7.1 Emissive & Readability Hierarchy
Dark charcoal/obsidian environments paired with high-contrast emissive accents so power is immediately visible:
1. **Player skills & impacts** *(highest brightness/priority)*
2. **Player character** (glowing weapon + Aspect aura)
3. **Elites & Bosses**
4. **Ground Loot** (Blue → Yellow → Orange/Gold glow)
5. **Environment accents**

**Strict Damage-Type Color Language**:
- **Fire**: Warm orange / ember
- **Cold**: Icy cyan
- **Lightning**: Electric blue-white
- **Physical**: Sharp white / silver
- **Chaos**: Deep violet + black

### 7.2 Gear & Aspect Visual Identity
- **Weapons**: Persistent emissive glow colored by damage type; Rare+ gets ribbon swing trails; Legendaries get unique persistent particle systems.
- **Armour & Aspects**:
  - *Blood*: Pulsing red veins + blood-mist trails.
  - *Iron*: Heavy silhouette + molten orange cracks.
  - *Aether*: Soft blue energy seams + floating particles + Energy Shield shell.
  - *Storm*: Tiny lightning arcs across shoulders.
  - *Eclipse*: Orbiting eclipse sigil that flares when Empower is ready.
  - *Shade*: Purple/dark after-images on movement.

### 7.3 Particle & Post-Processing Stack
- **5-Layer Particle Architecture** *(with object pooling from day one)*:
  1. **Core** (bright, sharp, readable)
  2. **Mid** (colored energy/fire/lightning)
  3. **Outer** (soft glow / bloom driver)
  4. **Detail** (sparks, embers, debris)
  5. **Ground / Decal** (burn marks, frost, cracks)
- **3-Layer Post-Processing Stack** *(run at half/quarter resolution)*:
  1. **Base Bloom**: Dual Kawase or Mip-chain bloom with a **high threshold + soft knee** and tight radius so only real emissives glow.
  2. **Anamorphic Streaks**: Separable horizontal blur pass at higher threshold for cinematic weapon/spell flares.
  3. **Spectral Chromatic Streaks**: Subtle wavelength dispersion (chromatic offset blur or spectral gradient ramp) reserved for Legendaries, Empowered skills, and Crits.

---

## 8. Engine Decision & Implementation Roadmap

### 8.1 Engine Recommendation
- **Current Prototype**: Phaser (HTML5/WebGL) — good for fast early iteration, limited for advanced multi-pass post-processing.
- **Recommended Production Engine**: **Godot 4** (best indie 2D fit: native 2D nodes, `GPUParticles2D`, built-in 2D Lights + Glow/Environment, `VisualShader`/custom shaders, `AnimationPlayer`, zero royalties).
- **Alternative**: **Unity** (URP + VFX Graph has the highest raw VFX/post-processing ceiling, at the cost of heavier boilerplate and licensing).

### 8.2 Phased Production Roadmap
- **Phase 1 — Foundation & Core Engine**:
  - Set up **Godot 4** project (or keep Phaser briefly for pure combat-math validation).
  - Implement pure calculation pipeline (`Skills` + `Aspects` + `Marks` + strict damage/mitigation order) and verify Lv 1–20 early-game balance.
- **Phase 2 — Vertical Slice Combat & HUD**:
  - Build 5-skill hotbar, WASD + mouse aiming, radial cooldowns, HP/MP orbs, and compact room-graph minimap.
  - Implement the first 10 Skills (with Lv 5/10/15 upgrade paths) and 15 Aspects.
- **Phase 3 — Visuals, VFX & Glow Pipeline**:
  - Implement weapon ribbon trails, 5-layer pooled `GPUParticles2D` skill effects, and Aspect armour/aura visuals.
  - Tune Dual Kawase/Environment Glow + anamorphic/spectral streak shaders for crits and Empowered hits.
- **Phase 4 — Content & Endgame Grind**:
  - Expand to **18–20 Skills** and **25–30 Aspects**.
  - Build **15–20 Domain Modifiers**, **Corruption** scaling, **5–6 Pinnacle Bosses** with exclusive Marks/Legendaries, and the **Simple Crafting Bench**.
