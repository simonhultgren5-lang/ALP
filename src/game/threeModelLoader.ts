import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export type ModelSlotId =
  | 'player'
  | 'boss'
  | 'thrall'
  | 'cultist'
  | 'charger'
  | 'stalker'
  | 'dummy';

export type PropSlotId = 'pillar' | 'torch' | 'wall';

export type AnimIntent = 'idle' | 'move' | 'attack' | 'windup' | 'death';

export interface CustomModelStatus {
  slot: ModelSlotId;
  label: string;
  active: boolean;
  sourceName: string | null;
  clipNames: string[];
  triangleCount: number;
  error: string | null;
}

interface StoredModelAsset {
  slot: ModelSlotId;
  sourceName: string;
  template: THREE.Group;
  clips: THREE.AnimationClip[];
  triangleCount: number;
  clipMap: Partial<Record<AnimIntent, THREE.AnimationClip>>;
}

interface StoredPropAsset {
  template: THREE.Group;
  size: THREE.Vector3;
}

export interface CustomRigInstance {
  root: THREE.Group;
  hasClips: boolean;
  setAnimationState: (intent: AnimIntent, speedScale?: number) => void;
  setTint: (emissiveHex: number, emissiveIntensity: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export const MODEL_SLOT_META: Record<
  ModelSlotId,
  { label: string; targetHeight: number; description: string }
> = {
  player: {
    label: 'Ashen Knight (Player)',
    targetHeight: 1.85,
    description: 'Replaces player armor & sword with your rigged .glb hero.',
  },
  boss: {
    label: 'Dread Sovereign (Boss)',
    targetHeight: 3.1,
    description: 'Replaces the pinnacle chamber boss with a custom .glb monster.',
  },
  thrall: {
    label: 'Ashen Thrall',
    targetHeight: 1.45,
    description: 'Replaces melee swarm ghouls.',
  },
  cultist: {
    label: 'Cinder Cultist',
    targetHeight: 1.75,
    description: 'Replaces ranged fireball casters.',
  },
  charger: {
    label: 'Blood Charger',
    targetHeight: 1.85,
    description: 'Replaces horned charge juggernauts.',
  },
  stalker: {
    label: 'Void Stalker',
    targetHeight: 1.65,
    description: 'Replaces blink-strike wraiths.',
  },
  dummy: {
    label: 'Sanctuary Target Dummy',
    targetHeight: 1.85,
    description: 'Replaces practice target mannequins in the Sanctuary.',
  },
};

export const ALL_MODEL_SLOTS: ModelSlotId[] = [
  'player',
  'boss',
  'thrall',
  'cultist',
  'charger',
  'stalker',
  'dummy',
];

function matchClipForIntent(
  clips: THREE.AnimationClip[],
  patterns: RegExp[]
): THREE.AnimationClip | undefined {
  for (const pat of patterns) {
    const found = clips.find((c) => pat.test(c.name));
    if (found) return found;
  }
  return undefined;
}

function buildClipMap(
  slot: ModelSlotId,
  clips: THREE.AnimationClip[]
): Partial<Record<AnimIntent, THREE.AnimationClip>> {
  if (clips.length === 0) return {};

  const idle =
    matchClipForIntent(clips, [
      /^Idle$/i,
      /^Idle_Combat$/i,
      /^2H_Melee_Idle$/i,
      /idle/i,
      /stand/i,
      /breath/i,
    ]) ?? clips[0];

  const move =
    matchClipForIntent(clips, [
      /^Running_A$/i,
      /^Running_B$/i,
      /^Walking_A$/i,
      /run/i,
      /walk/i,
      /move/i,
      /sprint/i,
      /locomotion/i,
    ]) ?? idle;

  let attackPatterns: RegExp[];
  if (slot === 'charger' || slot === 'boss') {
    attackPatterns = [
      /^2H_Melee_Attack_Chop$/i,
      /^2H_Melee_Attack_Slice$/i,
      /^1H_Melee_Attack_Chop$/i,
      /attack/i,
      /slash/i,
      /swing/i,
    ];
  } else if (slot === 'cultist') {
    attackPatterns = [
      /^Spellcast_Shoot$/i,
      /^Spellcasting$/i,
      /^1H_Ranged_Shoot$/i,
      /spellcast/i,
      /cast/i,
      /attack/i,
    ];
  } else {
    attackPatterns = [
      /^1H_Melee_Attack_Slice_Diagonal$/i,
      /^1H_Melee_Attack_Chop$/i,
      /^Dualwield_Melee_Attack_Slice$/i,
      /attack/i,
      /slash/i,
      /swing/i,
      /strike/i,
      /cast/i,
      /punch/i,
    ];
  }

  const attack = matchClipForIntent(clips, attackPatterns);

  const windup =
    matchClipForIntent(clips, [
      /^Spellcast_Raise$/i,
      /^Taunt$/i,
      /^Block$/i,
      /windup/i,
      /charge/i,
      /prepare/i,
      /roar/i,
    ]) ?? attack;

  const death = matchClipForIntent(clips, [
    /^Death_A$/i,
    /^Death_B$/i,
    /death/i,
    /die/i,
    /ko/i,
    /fall/i,
  ]);

  return { idle, move, attack, windup, death };
}

function countTriangles(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const geo = mesh.geometry;
      if (geo.index) {
        tris += Math.round(geo.index.count / 3);
      } else {
        const pos = geo.getAttribute('position');
        if (pos) tris += Math.round(pos.count / 3);
      }
    }
  });
  return tris;
}

/**
 * KayKit character GLBs store multiple optional weapon/shield variants under
 * handslot.r and handslot.l. Hide redundant stacked props so the Knight wields
 * 1H_Sword + Spike_Shield and the Barbarian wields the 2H_Axe cleanly.
 */
function configureKayKitEquipment(scene: THREE.Group, slot: ModelSlotId) {
  const hiddenKnightParts = new Set([
    '1H_Sword_Offhand',
    'Badge_Shield',
    'Rectangle_Shield',
    'Round_Shield',
    '2H_Sword',
  ]);
  const hiddenBarbarianParts = new Set([
    '1H_Axe_Offhand',
    'Barbarian_Round_Shield',
    '1H_Axe',
    'Mug',
  ]);

  let hasKnightParts = false;
  let hasBarbarianParts = false;

  scene.traverse((obj) => {
    if (hiddenKnightParts.has(obj.name)) {
      obj.visible = false;
      hasKnightParts = true;
    } else if (hiddenBarbarianParts.has(obj.name)) {
      obj.visible = false;
      hasBarbarianParts = true;
    }
  });

  // Skeleton packs leave handslot.r / handslot.l empty; equip sculpted dark-fantasy weapons
  if (!hasKnightParts && !hasBarbarianParts) {
    const rightHand = scene.getObjectByName('handslot.r');
    const leftHand = scene.getObjectByName('handslot.l');

    if (rightHand && rightHand.children.length === 0) {
      if (slot === 'cultist') {
        const staffGroup = new THREE.Group();
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.042, 1.55, 6),
          new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.8 })
        );
        shaft.position.y = 0.35;
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xf97316,
            emissiveIntensity: 1.9,
            roughness: 0.2,
          })
        );
        orb.position.y = 1.18;
        staffGroup.add(shaft, orb);
        staffGroup.rotation.x = Math.PI / 2;
        rightHand.add(staffGroup);
      } else if (slot === 'thrall' || slot === 'stalker' || slot === 'boss') {
        const isBoss = slot === 'boss';
        const scale = isBoss ? 1.45 : slot === 'stalker' ? 0.72 : 0.82;
        const bladeColor = isBoss ? 0xe6a83e : slot === 'stalker' ? 0xa855f7 : 0x94a3b8;
        const weapon = new THREE.Group();
        const hilt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03 * scale, 0.035 * scale, 0.28 * scale, 6),
          new THREE.MeshStandardMaterial({ color: 0x272733, roughness: 0.6, metalness: 0.5 })
        );
        hilt.position.y = 0.08 * scale;
        const guard = new THREE.Mesh(
          new THREE.BoxGeometry(0.28 * scale, 0.05 * scale, 0.07 * scale),
          new THREE.MeshStandardMaterial({ color: 0xd99b38, roughness: 0.3, metalness: 0.85 })
        );
        guard.position.y = 0.22 * scale;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.09 * scale, 1.05 * scale, 0.025 * scale),
          new THREE.MeshStandardMaterial({
            color: bladeColor,
            emissive: bladeColor,
            emissiveIntensity: isBoss ? 0.85 : 0.4,
            roughness: 0.25,
            metalness: 0.85,
          })
        );
        blade.position.y = 0.76 * scale;
        weapon.add(hilt, guard, blade);
        weapon.rotation.x = Math.PI / 2;
        rightHand.add(weapon);

        if (slot === 'stalker' && leftHand && leftHand.children.length === 0) {
          const offhand = weapon.clone();
          leftHand.add(offhand);
        }
      }
    }
  }
}

function normalizeModelRoot(
  scene: THREE.Group,
  targetHeight: number,
  slot?: ModelSlotId
): THREE.Group {
  if (slot) {
    configureKayKitEquipment(scene, slot);
  }

  const wrapper = new THREE.Group();
  wrapper.add(scene);

  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);

  const height = Math.max(0.001, size.y);
  const scale = targetHeight / height;
  scene.scale.multiplyScalar(scale);

  // Recompute bounds after scaling and seat bottom-center flush at (0, 0, 0)
  scene.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(scene);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  scene.position.x -= scaledCenter.x;
  scene.position.z -= scaledCenter.z;
  scene.position.y -= scaledBox.min.y;

  // Engine forward is +X while standard glTF characters face +Z; rotate +PI/2 around Y
  wrapper.rotation.y = Math.PI / 2;

  wrapper.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && 'envMapIntensity' in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 0.85;
        }
      }
    }
  });

  return wrapper;
}

export class GltfModelRegistry {
  private loader: GLTFLoader;
  private draco: DRACOLoader;
  private assets = new Map<ModelSlotId, StoredModelAsset>();
  private propAssets = new Map<PropSlotId, StoredPropAsset>();
  private errors = new Map<ModelSlotId, string>();
  private listeners = new Set<() => void>();
  private revision = 0;

  constructor() {
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
    );
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.draco);
  }

  public getRevision(): number {
    return this.revision;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emitChange() {
    this.revision++;
    for (const cb of this.listeners) cb();
  }

  public hasModel(slot: ModelSlotId): boolean {
    return this.assets.has(slot);
  }

  public hasProp(slot: PropSlotId): boolean {
    return this.propAssets.has(slot);
  }

  public getStatusList(): CustomModelStatus[] {
    return ALL_MODEL_SLOTS.map((slot) => {
      const meta = MODEL_SLOT_META[slot];
      const asset = this.assets.get(slot);
      return {
        slot,
        label: meta.label,
        active: Boolean(asset),
        sourceName: asset?.sourceName ?? null,
        clipNames: asset ? asset.clips.map((c) => c.name || 'Unnamed') : [],
        triangleCount: asset?.triangleCount ?? 0,
        error: this.errors.get(slot) ?? null,
      };
    });
  }

  private registerGltf(slot: ModelSlotId, gltf: GLTF, sourceName: string) {
    const previous = this.assets.get(slot);
    if (previous) {
      this.disposeTemplate(previous.template);
    }
    const meta = MODEL_SLOT_META[slot];
    const template = normalizeModelRoot(gltf.scene, meta.targetHeight, slot);
    const clips = gltf.animations ?? [];
    for (const clip of clips) clip.optimize();

    this.assets.set(slot, {
      slot,
      sourceName,
      template,
      clips,
      triangleCount: countTriangles(template),
      clipMap: buildClipMap(slot, clips),
    });
    this.errors.delete(slot);
    this.emitChange();
  }

  public async loadPropFromUrl(slot: PropSlotId, url: string): Promise<void> {
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
    const prev = this.propAssets.get(slot);
    if (prev) this.disposeTemplate(prev.template);

    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const wrapper = new THREE.Group();
    wrapper.add(root);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;

    wrapper.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m && 'envMapIntensity' in m) {
            (m as THREE.MeshStandardMaterial).envMapIntensity = 0.85;
          }
        }
      }
    });

    this.propAssets.set(slot, { template: wrapper, size });
    this.emitChange();
  }

  public instantiateProp(
    slot: PropSlotId,
    targetHeight: number
  ): THREE.Group | null {
    const asset = this.propAssets.get(slot);
    if (!asset) return null;
    const clone = asset.template.clone();
    const s = targetHeight / Math.max(0.001, asset.size.y);
    clone.scale.setScalar(s);
    return clone;
  }

  public async loadFromUrl(
    slot: ModelSlotId,
    url: string,
    label?: string
  ): Promise<void> {
    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });
      this.registerGltf(slot, gltf, label ?? url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load .glb URL';
      this.errors.set(slot, msg);
      this.emitChange();
      throw err;
    }
  }

  public async loadFromFile(slot: ModelSlotId, file: File): Promise<void> {
    try {
      const buffer = await file.arrayBuffer();
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.loader.parse(buffer, '', resolve, reject);
      });
      this.registerGltf(slot, gltf, file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid .glb / .gltf file';
      this.errors.set(slot, msg);
      this.emitChange();
      throw err;
    }
  }

  public async loadManifest(manifestUrl = '/models/manifest.json'): Promise<void> {
    try {
      const res = await fetch(manifestUrl, { cache: 'no-cache' });
      if (!res.ok) return;
      const json = (await res.json()) as {
        models?: Partial<Record<ModelSlotId, string>>;
        props?: Partial<Record<PropSlotId, string>>;
      };
      const tasks: Promise<unknown>[] = [];
      if (json?.models) {
        const entries = Object.entries(json.models) as Array<[ModelSlotId, string]>;
        for (const [slot, url] of entries) {
          if (ALL_MODEL_SLOTS.includes(slot) && Boolean(url)) {
            tasks.push(
              this.loadFromUrl(slot, url, url).catch(() => {
                // Individual model error stored in this.errors
              })
            );
          }
        }
      }
      if (json?.props) {
        const propEntries = Object.entries(json.props) as Array<[PropSlotId, string]>;
        for (const [slot, url] of propEntries) {
          if ((slot === 'pillar' || slot === 'torch' || slot === 'wall') && Boolean(url)) {
            tasks.push(this.loadPropFromUrl(slot, url).catch(() => {}));
          }
        }
      }
      await Promise.all(tasks);
    } catch {
      // Optional manifest failure never breaks gameplay
    }
  }

  public clearSlot(slot: ModelSlotId) {
    const asset = this.assets.get(slot);
    if (asset) {
      this.disposeTemplate(asset.template);
      this.assets.delete(slot);
    }
    this.errors.delete(slot);
    this.emitChange();
  }

  public instantiate(slot: ModelSlotId): CustomRigInstance | null {
    const asset = this.assets.get(slot);
    if (!asset) return null;

    const root = SkeletonUtils.clone(asset.template) as THREE.Group;
    const clonedMaterials: THREE.Material[] = [];
    const tintableMaterials: THREE.MeshStandardMaterial[] = [];

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => {
            const c = m.clone();
            clonedMaterials.push(c);
            if ('emissive' in c) {
              tintableMaterials.push(c as THREE.MeshStandardMaterial);
            }
            return c;
          });
        } else {
          const c = mesh.material.clone();
          mesh.material = c;
          clonedMaterials.push(c);
          if ('emissive' in c) {
            tintableMaterials.push(c as THREE.MeshStandardMaterial);
          }
        }
      }
    });

    const mixer =
      asset.clips.length > 0 ? new THREE.AnimationMixer(root) : null;
    const actions: Partial<Record<AnimIntent, THREE.AnimationAction>> = {};
    if (mixer) {
      for (const intent of ['idle', 'move', 'attack', 'windup', 'death'] as const) {
        const clip = asset.clipMap[intent];
        if (clip) {
          const action = mixer.clipAction(clip);
          if (intent === 'attack' || intent === 'death') {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = intent === 'death';
          } else {
            action.loop = THREE.LoopRepeat;
          }
          actions[intent] = action;
        }
      }
    }

    let currentIntent: AnimIntent | null = null;
    let currentAction: THREE.AnimationAction | null = null;
    if (actions.idle) {
      actions.idle.play();
      currentIntent = 'idle';
      currentAction = actions.idle;
    }

    const setAnimationState = (intent: AnimIntent, speedScale = 1) => {
      if (!mixer) return;
      const target = actions[intent] ?? actions.idle;
      if (!target) return;
      target.timeScale = speedScale;
      if (currentIntent === intent && currentAction === target) {
        if (intent === 'attack' && !target.isRunning()) {
          target.reset().play();
        }
        return;
      }
      target.enabled = true;
      target.reset();
      target.play();
      if (currentAction && currentAction !== target) {
        currentAction.crossFadeTo(target, 0.14, true);
      }
      currentIntent = intent;
      currentAction = target;
    };

    const setTint = (emissiveHex: number, emissiveIntensity: number) => {
      for (const m of tintableMaterials) {
        m.emissive.setHex(emissiveHex);
        m.emissiveIntensity = emissiveIntensity;
      }
    };

    return {
      root,
      hasClips: asset.clips.length > 0,
      setAnimationState,
      setTint,
      update: (dt: number) => {
        mixer?.update(dt);
      },
      dispose: () => {
        mixer?.stopAllAction();
        mixer?.uncacheRoot(root);
        for (const m of clonedMaterials) m.dispose();
      },
    };
  }

  public async exportSceneAsGlb(object: THREE.Object3D, filename: string): Promise<void> {
    const exporter = new GLTFExporter();
    const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        object,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const text = JSON.stringify(result);
            resolve(new TextEncoder().encode(text).buffer);
          }
        },
        reject,
        { binary: true }
      );
    });
    const blob = new Blob([glb], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private disposeTemplate(template: THREE.Group) {
    template.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m?.dispose();
      }
    });
  }

  public dispose() {
    for (const asset of this.assets.values()) {
      this.disposeTemplate(asset.template);
    }
    this.assets.clear();
    for (const prop of this.propAssets.values()) {
      this.disposeTemplate(prop.template);
    }
    this.propAssets.clear();
    this.errors.clear();
    this.listeners.clear();
    this.draco.dispose();
  }
}
