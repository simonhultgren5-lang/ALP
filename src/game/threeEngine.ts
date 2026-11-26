import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DAMAGE_COLORS, RARITY_COLORS } from './data';
import { AshenEngine, EngineCallbacks } from './engine';
import {
  createThreeMaterialLibrary,
  disposeThreeMaterialLibrary,
  ThreeMaterialLibrary,
} from './threeMaterials';
import {
  ArenaEnvironment,
  buildArenaEnvironment,
  buildEnemyRig,
  buildPlayerRig,
  EnemyRig,
  PlayerRig,
  updatePlayerAspectVisuals,
} from './threeModels';
import {
  AnimIntent,
  CustomModelStatus,
  CustomRigInstance,
  GltfModelRegistry,
  ModelSlotId,
} from './threeModelLoader';
import {
  AspectId,
  DomainModifier,
  EquipSlot,
  GamePhase,
  GearItem,
  Rarity,
  SanctuaryConfig,
  SkillId,
  SkillProgress,
  UpgradeBranch,
  UpgradeTier,
} from './types';

const SIM_TO_3D = 0.03; // 100 sim px = 3.0 meters
const PARTICLE_CAP = 480;
const PROJECTILE_POOL = 96;
const DECAL_POOL = 48;
const SLASH_POOL = 32;
const STREAK_POOL = 24;
const LIGHTNING_POOL = 12;
const AFTERIMAGE_POOL = 16;
const FLOATING_DOM_POOL = 44;
const ENEMY_BAR_DOM_POOL = 24;

interface EnemyVisualEntry {
  rig: EnemyRig;
  customSlot: ModelSlotId;
  customPivot: THREE.Group;
  customRig: CustomRigInstance | null;
  modelRevision: number;
  telegraphRing: THREE.Mesh;
  telegraphCone: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  coneMat: THREE.MeshBasicMaterial;
  archetype: string;
  isElite: boolean;
  isDummy: boolean;
}

interface LootVisualEntry {
  group: THREE.Group;
  core: THREE.Mesh;
  beam: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  beamMat: THREE.MeshBasicMaterial;
  geos: THREE.BufferGeometry[];
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
  } catch {
    return true;
  }
}

export class AshenThreeEngine {
  private mountEl: HTMLElement;
  private sim: AshenEngine;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mats: ThreeMaterialLibrary;
  private envMapTex: THREE.Texture;
  private arena: ArenaEnvironment;
  private playerRig: PlayerRig;
  private playerCustomPivot: THREE.Group;
  private playerCustomRig: CustomRigInstance | null = null;
  private lastPlayerModelRev = -1;
  private modelRegistry: GltfModelRegistry;
  private playerPointLight: THREE.PointLight;
  private moveMarkerGeo: THREE.BufferGeometry;
  private moveMarkerMat: THREE.MeshBasicMaterial;
  private moveMarkerMesh: THREE.Mesh;

  // Room tracking for rebuilds
  private lastRoomKey = '';
  private currentRoomWidth = 1380;
  private currentRoomHeight = 940;
  private currentRoomW3 = 1380 * SIM_TO_3D;
  private currentRoomH3 = 940 * SIM_TO_3D;

  // Camera damping
  private camTargetX = 0;
  private camTargetZ = 0;
  private lastPointerClientX = 0;
  private lastPointerClientY = 0;
  private hasPointer = false;
  private swingVisualTimer = 0;

  // Pre-allocated math objects (zero GC)
  private _vec3 = new THREE.Vector3();
  private _vec3B = new THREE.Vector3();
  private _mat4 = new THREE.Matrix4();
  private _quat = new THREE.Quaternion();
  private _scale = new THREE.Vector3();
  private _color = new THREE.Color();
  private _raycaster = new THREE.Raycaster();
  private _mouseNdc = new THREE.Vector2();
  private _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Pools
  private enemyMap = new Map<number, EnemyVisualEntry>();
  private lootMap = new Map<string, LootVisualEntry>();

  private particleInstanced: THREE.InstancedMesh;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.MeshBasicMaterial;

  private projPool: Array<{
    group: THREE.Group;
    core: THREE.Mesh;
    halo: THREE.Sprite;
    haloMat: THREE.SpriteMaterial;
  }> = [];
  private projCoreGeo: THREE.BufferGeometry;
  private projCoreMat: THREE.MeshBasicMaterial;

  private decalPool: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }> = [];
  private decalGeo: THREE.BufferGeometry;

  private slashPool: Array<{
    ringMesh: THREE.Mesh;
    crescentMesh: THREE.Mesh;
    ringMat: THREE.MeshBasicMaterial;
    crescentMat: THREE.MeshBasicMaterial;
  }> = [];
  private slashQuadGeo: THREE.BufferGeometry;

  private streakPool: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }> = [];
  private streakGeo: THREE.BufferGeometry;

  private lightningPool: Array<{
    line: THREE.Line;
    positions: Float32Array;
    mat: THREE.LineBasicMaterial;
  }> = [];

  private afterImagePool: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }> = [];
  private afterImageGeo: THREE.BufferGeometry;

  // Shared enemy telegraph geos
  private teleRingGeo: THREE.BufferGeometry;
  private teleConeGeo: THREE.BufferGeometry;

  // DOM overlay for crisp damage numbers & dummy/enemy bars
  private overlayEl: HTMLDivElement;
  private floatTextEls: HTMLDivElement[] = [];
  private enemyBarEls: Array<{
    root: HTMLDivElement;
    fill: HTMLDivElement;
    label: HTMLDivElement;
  }> = [];

  // Loop & context handling
  private destroyed = false;
  private contextLost = false;
  private rafId: number | null = null;
  private timerId: number | null = null;
  private lastTime = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    mountEl: HTMLElement,
    initialSkillProgress: Record<SkillId, SkillProgress>,
    callbacks: EngineCallbacks
  ) {
    this.mountEl = mountEl;
    this.isSoftwareGl = detectSoftwareWebGL();

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.mountEl.appendChild(this.renderer.domElement);

    // 2. Scene, Fog & IBL RoomEnvironment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0b0f);
    this.scene.fog = new THREE.FogExp2(0x0b0b0f, 0.0145);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envMapTex = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envMapTex;
    roomEnv.dispose();
    pmrem.dispose();

    // 3. Camera (Isometric ARPG Chase Angle)
    const width = Math.max(320, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(240, this.mountEl.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height, false);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 160);
    this.camera.position.set(0, 19.5, 16.5);
    this.camera.lookAt(0, 0.75, 0);

    // 4. Three-point dramatic lighting rig + player lantern
    const hemi = new THREE.HemisphereLight(0x94a3b8, 0x090910, 0.36);
    this.scene.add(hemi);

    const keyDir = new THREE.DirectionalLight(0xfef3c7, 2.2);
    keyDir.position.set(16, 28, 14);
    if (!this.isSoftwareGl) {
      keyDir.castShadow = true;
      keyDir.shadow.mapSize.set(1024, 1024);
      keyDir.shadow.camera.near = 4;
      keyDir.shadow.camera.far = 75;
      keyDir.shadow.camera.left = -26;
      keyDir.shadow.camera.right = 26;
      keyDir.shadow.camera.top = 26;
      keyDir.shadow.camera.bottom = -26;
      keyDir.shadow.bias = -0.0005;
    }
    this.scene.add(keyDir);

    const rimDir = new THREE.DirectionalLight(0x7dd3fc, 0.95);
    rimDir.position.set(-18, 14, -18);
    this.scene.add(rimDir);

    this.playerPointLight = new THREE.PointLight(0xf97316, 3.8, 14, 1.5);
    this.playerPointLight.position.set(0, 2.7, 0);
    this.scene.add(this.playerPointLight);

    // GPU-only Post-Processing Bloom (skipped on software WebGL per skill guideline)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.52,
        0.42,
        0.74
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    // 5. Materials, Environment & Player Rig
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.mats = createThreeMaterialLibrary(maxAniso, this.isSoftwareGl);
    this.arena = buildArenaEnvironment(this.mats);
    this.scene.add(this.arena.group);

    this.modelRegistry = new GltfModelRegistry();
    this.playerRig = buildPlayerRig(this.mats);
    this.playerCustomPivot = new THREE.Group();
    this.playerRig.group.add(this.playerCustomPivot);
    this.scene.add(this.playerRig.group);
    void this.modelRegistry.loadManifest('/models/manifest.json');

    this.moveMarkerGeo = new THREE.PlaneGeometry(1.5, 1.5);
    this.moveMarkerGeo.rotateX(-Math.PI / 2);
    this.moveMarkerMat = new THREE.MeshBasicMaterial({
      map: this.mats.slashRingTexture,
      color: 0xd99b38,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.moveMarkerMesh = new THREE.Mesh(this.moveMarkerGeo, this.moveMarkerMat);
    this.moveMarkerMesh.visible = false;
    this.scene.add(this.moveMarkerMesh);

    // 6. Initialize GPU-friendly VFX Pools
    this.particleGeo = new THREE.OctahedronGeometry(0.14, 0);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particleInstanced = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      PARTICLE_CAP
    );
    this.particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInstanced.frustumCulled = false;
    this.particleInstanced.count = 0;
    // Initialize instanceColor buffer
    for (let i = 0; i < PARTICLE_CAP; i++) {
      this.particleInstanced.setColorAt(i, this._color.setHex(0xffffff));
    }
    if (this.particleInstanced.instanceColor) {
      this.particleInstanced.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.particleInstanced);

    this.projCoreGeo = new THREE.OctahedronGeometry(0.85, 1);
    this.projCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(this.projCoreGeo, this.projCoreMat);
      const haloMat = new THREE.SpriteMaterial({
        map: this.mats.flareTexture,
        color: 0xf97316,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(4.5, 4.5, 1);
      group.add(core, halo);
      group.visible = false;
      this.scene.add(group);
      this.projPool.push({ group, core, halo, haloMat });
    }

    this.decalGeo = new THREE.CircleGeometry(1, 24);
    this.decalGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < DECAL_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(this.decalGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.decalPool.push({ mesh, mat });
    }

    this.slashQuadGeo = new THREE.PlaneGeometry(2, 2);
    this.slashQuadGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < SLASH_POOL; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        map: this.mats.slashRingTexture,
        color: 0xf97316,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const crescentMat = new THREE.MeshBasicMaterial({
        map: this.mats.slashCrescentTexture,
        color: 0xf97316,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(this.slashQuadGeo, ringMat);
      const crescentMesh = new THREE.Mesh(this.slashQuadGeo, crescentMat);
      ringMesh.visible = false;
      crescentMesh.visible = false;
      this.scene.add(ringMesh, crescentMesh);
      this.slashPool.push({ ringMesh, crescentMesh, ringMat, crescentMat });
    }

    this.streakGeo = new THREE.PlaneGeometry(1, 0.36);
    for (let i = 0; i < STREAK_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.mats.flareTexture,
        color: 0xd99b38,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.streakGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.streakPool.push({ mesh, mat });
    }

    for (let i = 0; i < LIGHTNING_POOL; i++) {
      const positions = new Float32Array(24 * 3);
      const geo = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(positions, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', attr);
      const mat = new THREE.LineBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      this.scene.add(line);
      this.lightningPool.push({ line, positions, mat });
    }

    this.afterImageGeo = new THREE.CylinderGeometry(0.32, 0.42, 1.45, 8);
    for (let i = 0; i < AFTERIMAGE_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.afterImageGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.afterImagePool.push({ mesh, mat });
    }

    this.teleRingGeo = new THREE.RingGeometry(0.88, 1.04, 24);
    this.teleRingGeo.rotateX(-Math.PI / 2);
    this.teleConeGeo = new THREE.PlaneGeometry(1, 0.42);
    this.teleConeGeo.rotateX(-Math.PI / 2);
    this.teleConeGeo.translate(0.5, 0, 0);

    // 7. DOM Overlay for crisp floating damage numbers & enemy HP bars
    this.overlayEl = document.createElement('div');
    this.overlayEl.style.position = 'absolute';
    this.overlayEl.style.inset = '0';
    this.overlayEl.style.pointerEvents = 'none';
    this.overlayEl.style.overflow = 'hidden';
    this.mountEl.appendChild(this.overlayEl);

    for (let i = 0; i < FLOATING_DOM_POOL; i++) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.fontFamily = '"JetBrains Mono", monospace';
      el.style.fontWeight = '700';
      el.style.whiteSpace = 'nowrap';
      el.style.textShadow = '0 1px 3px #000, 0 0 6px rgba(0,0,0,0.9)';
      el.style.display = 'none';
      this.overlayEl.appendChild(el);
      this.floatTextEls.push(el);
    }

    for (let i = 0; i < ENEMY_BAR_DOM_POOL; i++) {
      const root = document.createElement('div');
      root.style.position = 'absolute';
      root.style.left = '0';
      root.style.top = '0';
      root.style.display = 'none';
      root.style.flexDirection = 'column';
      root.style.alignItems = 'center';
      root.style.gap = '2px';

      const track = document.createElement('div');
      track.style.width = '48px';
      track.style.height = '4px';
      track.style.background = '#0B0B0F';
      track.style.border = '1px solid #2A2A35';
      track.style.overflow = 'hidden';

      const fill = document.createElement('div');
      fill.style.height = '100%';
      fill.style.width = '100%';
      fill.style.background = '#DC2626';
      track.appendChild(fill);

      const label = document.createElement('div');
      label.style.fontFamily = '"JetBrains Mono", monospace';
      label.style.fontSize = '10px';
      label.style.fontWeight = '600';
      label.style.color = '#94A3B8';
      label.style.textShadow = '0 1px 2px #000';
      label.style.whiteSpace = 'nowrap';

      root.appendChild(track);
      root.appendChild(label);
      this.overlayEl.appendChild(root);
      this.enemyBarEls.push({ root, fill, label });
    }

    // 8. Instantiate Headless Simulation with 3D raycast override
    this.sim = new AshenEngine(null, initialSkillProgress, callbacks, {
      headless: true,
      screenToWorldOverride: (clientX, clientY) => this.raycastToSimGround(clientX, clientY),
    });

    // 9. Events (pointer + contextmenu + resize + context loss)
    this.mountEl.addEventListener('pointerdown', this.handlePointerDown);
    this.mountEl.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.mountEl);
    }
    window.addEventListener('resize', this.handleResize);

    // Sync initial room immediately so title screen shows the 3D citadel behind it
    this.syncSceneFromSimulation(0.016);
    this.renderer.render(this.scene, this.camera);
  }

  private simToWorldX(sx: number): number {
    return sx * SIM_TO_3D - this.currentRoomW3 * 0.5;
  }

  private simToWorldZ(sy: number): number {
    return sy * SIM_TO_3D - this.currentRoomH3 * 0.5;
  }

  private raycastToSimGround(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: this.currentRoomWidth * 0.5, y: this.currentRoomHeight * 0.5 };
    }
    this._mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouseNdc, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._vec3);
    if (!hit) {
      return { x: this.currentRoomWidth * 0.5, y: this.currentRoomHeight * 0.5 };
    }
    return {
      x: (hit.x + this.currentRoomW3 * 0.5) / SIM_TO_3D,
      y: (hit.z + this.currentRoomH3 * 0.5) / SIM_TO_3D,
    };
  }

  private handlePointerMove = (e: PointerEvent) => {
    this.lastPointerClientX = e.clientX;
    this.lastPointerClientY = e.clientY;
    this.hasPointer = true;
    this.sim.setExternalPointerMove(e.clientX, e.clientY);
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.lastPointerClientX = e.clientX;
    this.lastPointerClientY = e.clientY;
    this.hasPointer = true;
    this.sim.handleExternalPointerDown(e.clientX, e.clientY, e.button);
  };

  private handlePointerUp = (e: PointerEvent) => {
    this.sim.handleExternalPointerUp(e.button);
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleResize = () => {
    if (this.destroyed) return;
    const width = Math.max(320, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(240, this.mountEl.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.bloomPass?.resolution.set(width, height);
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = () => {
    this.contextLost = false;
  };

  // --- Public API Parity with AshenEngine ---
  public setAccessibility(opts: {
    highContrastTelegraphs?: boolean;
    hitstopEnabled?: boolean;
    screenShakeEnabled?: boolean;
  }) {
    this.sim.setAccessibility(opts);
  }

  public setPhase(phase: GamePhase) {
    this.sim.setPhase(phase);
  }

  public syncBuild(
    hotbar: [SkillId, SkillId, SkillId, SkillId, SkillId],
    activeAspects: AspectId[],
    equipment: Partial<Record<EquipSlot, GearItem>>,
    skillProgress: Record<SkillId, SkillProgress>,
    shards: number
  ) {
    this.sim.syncBuild(hotbar, activeAspects, equipment, skillProgress, shards);
  }

  public startNewRun(
    tier: number,
    corrupted: boolean,
    modifiers: DomainModifier[],
    resetProgression: boolean
  ) {
    this.sim.startNewRun(tier, corrupted, modifiers, resetProgression);
    this.lastRoomKey = '';
  }

  public startSanctuary() {
    this.sim.startSanctuary();
    this.lastRoomKey = '';
  }

  public setSanctuaryConfig(partial: Partial<SanctuaryConfig>) {
    this.sim.setSanctuaryConfig(partial);
  }

  public resetSanctuaryTelemetry() {
    this.sim.resetSanctuaryTelemetry();
  }

  public resolveSkillUpgrade(skillId: SkillId, tier: UpgradeTier, branch: UpgradeBranch) {
    this.sim.resolveSkillUpgrade(skillId, tier, branch);
  }

  public useFlask() {
    this.sim.useFlask();
  }

  public tryCastSlot(slotIndex: number) {
    this.sim.tryCastSlot(slotIndex);
    this.swingVisualTimer = 0.22;
  }

  public async loadCustomModelFile(slot: ModelSlotId, file: File): Promise<void> {
    await this.modelRegistry.loadFromFile(slot, file);
  }

  public async loadCustomModelUrl(slot: ModelSlotId, url: string): Promise<void> {
    await this.modelRegistry.loadFromUrl(slot, url);
  }

  public clearCustomModel(slot: ModelSlotId): void {
    this.modelRegistry.clearSlot(slot);
  }

  public getCustomModelStatuses(): CustomModelStatus[] {
    return this.modelRegistry.getStatusList();
  }

  public subscribeCustomModels(cb: () => void): () => void {
    return this.modelRegistry.subscribe(cb);
  }

  public async exportStarterKnightGlb(): Promise<void> {
    await this.modelRegistry.exportSceneAsGlb(
      this.playerRig.bodyPivot,
      'ashen_knight_starter.glb'
    );
  }

  // --- Software WebGL Safe Pacing ---
  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.destroyed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.clientWaitSync(sync, 0, 0) : gl.ALREADY_SIGNALED;
        if (status === gl.TIMEOUT_EXPIRED) {
          this.timerId = window.setTimeout(poll, 4);
        } else {
          if (sync) gl.deleteSync(sync);
          this.timerId = window.setTimeout(cb, 80);
        }
      };
      this.timerId = window.setTimeout(poll, 0);
    } else {
      this.timerId = window.setTimeout(cb, 80);
    }
  }

  public startLoop() {
    if (this.rafId !== null || this.timerId !== null) return;
    this.lastTime = performance.now();

    const tick = () => {
      if (this.destroyed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (this.hasPointer) {
        this.sim.setExternalPointerMove(this.lastPointerClientX, this.lastPointerClientY);
      }

      this.sim.stepSimulation(dt);
      if (!this.contextLost) {
        this.syncSceneFromSimulation(dt);
        if (this.composer && !this.isSoftwareGl) {
          this.composer.render();
        } else {
          this.renderer.render(this.scene, this.camera);
        }
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.rafId = requestAnimationFrame(tick);
    }
  }

  private syncSceneFromSimulation(dt: number) {
    const s = this.sim.getThreeRenderState();
    this.currentRoomWidth = s.roomWidth;
    this.currentRoomHeight = s.roomHeight;
    this.currentRoomW3 = s.roomWidth * SIM_TO_3D;
    this.currentRoomH3 = s.roomHeight * SIM_TO_3D;

    // 1. Rebuild room architecture when chamber or loaded prop assets change
    const propMask = `${Number(this.modelRegistry.hasProp('pillar'))}${Number(this.modelRegistry.hasProp('torch'))}${Number(this.modelRegistry.hasProp('wall'))}`;
    const roomKey = `${s.inSanctuary ? 'S' : 'D'}_${s.roomIndex}_${s.roomWidth}_${s.roomHeight}_${s.obstacles.length}_${propMask}`;
    if (roomKey !== this.lastRoomKey) {
      this.lastRoomKey = roomKey;
      this.arena.configureRoom(
        this.currentRoomW3,
        this.currentRoomH3,
        s.obstacles,
        SIM_TO_3D,
        s.isBossRoom,
        s.inSanctuary,
        this.modelRegistry
      );
      this.camTargetX = this.simToWorldX(s.player.x);
      this.camTargetZ = this.simToWorldZ(s.player.y);
    }

    // Flicker corner braziers subtly
    for (let i = 0; i < this.arena.brazierLights.length; i++) {
      this.arena.brazierLights[i].intensity = 2.0 + Math.sin(s.simTime * 7.5 + i * 1.7) * 0.35;
    }

    // Portal state
    this.arena.portalGroup.visible = !s.inSanctuary && !s.isBossRoom;
    if (this.arena.portalGroup.visible) {
      this.arena.portalGroup.position.set(
        this.simToWorldX(s.portalX),
        0,
        this.simToWorldZ(s.portalY)
      );
      this.arena.portalCore.material = s.roomCleared
        ? this.mats.portalCoreMat
        : this.mats.portalInactiveMat;
      this.arena.portalLight.intensity = s.roomCleared
        ? 3.4 + Math.sin(s.simTime * 5) * 0.6
        : 0;
    }

    // 2. Player Transform, Walk Cycle, Hit Flash, Aspects & Optional .GLB Rig
    const px3 = this.simToWorldX(s.player.x);
    const pz3 = this.simToWorldZ(s.player.y);
    this.playerRig.group.position.set(px3, 0, pz3);

    const modelRev = this.modelRegistry.getRevision();
    if (modelRev !== this.lastPlayerModelRev) {
      this.lastPlayerModelRev = modelRev;
      if (this.playerCustomRig) {
        this.playerCustomPivot.remove(this.playerCustomRig.root);
        this.playerCustomRig.dispose();
        this.playerCustomRig = null;
      }
      if (this.modelRegistry.hasModel('player')) {
        this.playerCustomRig = this.modelRegistry.instantiate('player');
        if (this.playerCustomRig) {
          this.playerCustomPivot.add(this.playerCustomRig.root);
        }
      }
      this.playerRig.bodyPivot.visible = !this.playerCustomRig;
    }

    const speed = Math.hypot(s.player.vx, s.player.vy);
    if (s.slashEffects.length > 0 && s.slashEffects[0].life > s.slashEffects[0].maxLife * 0.45) {
      this.swingVisualTimer = Math.max(this.swingVisualTimer, 0.16);
    }

    if (this.playerCustomRig) {
      this.playerCustomPivot.rotation.y = -s.player.aimAngle;
      this.playerCustomPivot.scale.set(
        s.player.scaleX,
        s.player.scaleY,
        s.player.scaleX
      );
      const intent: AnimIntent =
        this.swingVisualTimer > 0.05
          ? 'attack'
          : speed > 10
            ? 'move'
            : 'idle';
      this.playerCustomRig.setAnimationState(
        intent,
        intent === 'move' ? Math.max(0.85, speed / 210) : 1
      );
      this.playerCustomRig.update(dt);
      if (this.swingVisualTimer > 0) {
        this.swingVisualTimer = Math.max(0, this.swingVisualTimer - dt);
      }
      if (s.player.hitFlash > 0) {
        this.playerCustomRig.setTint(0xffffff, 1.4);
      } else {
        this.playerCustomRig.setTint(0x000000, 0);
      }
    } else {
      this.playerRig.bodyPivot.rotation.y = -s.player.aimAngle;
      this.playerRig.bodyPivot.scale.set(
        s.player.scaleX,
        s.player.scaleY,
        s.player.scaleX
      );

      const legSwing = speed > 10 ? Math.sin(s.player.walkPhase * 1.2) * 0.45 : 0;
      this.playerRig.leftLeg.rotation.z = legSwing;
      this.playerRig.rightLeg.rotation.z = -legSwing;
      this.playerRig.bodyPivot.position.y =
        speed > 10 ? Math.abs(Math.sin(s.player.walkPhase * 1.2)) * 0.08 : 0;
      this.playerRig.cloakPivot.rotation.z =
        -0.08 -
        Math.min(0.42, speed * 0.0014) -
        Math.sin(s.simTime * 11) * (speed > 10 ? 0.14 : 0.03);

      if (this.swingVisualTimer > 0) {
        this.swingVisualTimer = Math.max(0, this.swingVisualTimer - dt);
        const t = this.swingVisualTimer / 0.22;
        this.playerRig.swordPivot.rotation.y = Math.sin(t * Math.PI * 2) * 1.15;
      } else {
        this.playerRig.swordPivot.rotation.y *= 0.78;
      }

      if (s.player.hitFlash > 0) {
        this.playerRig.bodyPlatesMat.emissive.setHex(0xffffff);
        this.playerRig.bodyPlatesMat.emissiveIntensity = 1.6;
      } else {
        this.playerRig.bodyPlatesMat.emissive.setHex(0x000000);
        this.playerRig.bodyPlatesMat.emissiveIntensity = 0;
      }
    }

    updatePlayerAspectVisuals(
      this.playerRig,
      s.player.activeAspects,
      s.player.primaryDamageType,
      s.player.es,
      s.player.veilShield,
      s.player.barrierActive,
      s.player.eclipseReady,
      s.simTime
    );
    this.playerRig.shadeRing.visible = s.player.invuln;
    this.playerPointLight.position.set(px3, 2.7, pz3);

    if (s.player.moveTarget.active) {
      const mt = s.player.moveTarget;
      this.moveMarkerMesh.visible = true;
      this.moveMarkerMesh.position.set(
        this.simToWorldX(mt.x),
        0.04,
        this.simToWorldZ(mt.y)
      );
      const pulse = 0.72 + Math.sin(s.simTime * 11) * 0.14;
      this.moveMarkerMesh.scale.setScalar(pulse);
      this.moveMarkerMesh.rotation.y = s.simTime * 2.2;
      this.moveMarkerMat.color.setHex(
        mt.kind === 'attack' ? 0xef4444 : mt.kind === 'interact' ? 0x10b981 : 0xd99b38
      );
      this.moveMarkerMat.opacity = 0.72 + Math.sin(s.simTime * 11) * 0.16;
    } else {
      this.moveMarkerMesh.visible = false;
    }

    // 3. Smooth Chase Camera + Trauma Shake
    this.camTargetX = THREE.MathUtils.damp(this.camTargetX, px3, 10, dt);
    this.camTargetZ = THREE.MathUtils.damp(this.camTargetZ, pz3, 10, dt);
    const shakeSq = s.trauma * s.trauma;
    const shakeX = shakeSq * 0.85 * Math.sin(s.simTime * 53);
    const shakeY = shakeSq * 0.65 * Math.cos(s.simTime * 61);
    const camHeight = s.phase === 'title' ? 16.5 : 19.5;
    const camBack = s.phase === 'title' ? 13.5 : 16.5;

    this.camera.position.set(
      this.camTargetX + shakeX,
      camHeight + shakeY,
      this.camTargetZ + camBack
    );
    this.camera.lookAt(this.camTargetX, 0.75, this.camTargetZ);

    // 4. Sync Enemies & Telegraphs + Floating Enemy Bars
    const seenEnemyIds = new Set<number>();
    let barCursor = 0;
    const canvasW = this.mountEl.clientWidth || window.innerWidth;
    const canvasH = this.mountEl.clientHeight || window.innerHeight;

    for (const e of s.enemies) {
      seenEnemyIds.add(e.id);
      let entry = this.enemyMap.get(e.id);
      if (
        !entry ||
        entry.archetype !== e.archetype ||
        entry.isElite !== e.isElite ||
        entry.isDummy !== Boolean(e.isDummy)
      ) {
        if (entry) {
          this.scene.remove(entry.rig.group, entry.telegraphRing, entry.telegraphCone);
          entry.customRig?.dispose();
          entry.rig.dispose();
          entry.ringMat.dispose();
          entry.coneMat.dispose();
        }
        const rig = buildEnemyRig(e.archetype, e.isElite, Boolean(e.isDummy), this.mats);
        const customSlot: ModelSlotId = e.isDummy ? 'dummy' : e.archetype;
        const customPivot = new THREE.Group();
        rig.group.add(customPivot);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const telegraphRing = new THREE.Mesh(this.teleRingGeo, ringMat);
        const telegraphCone = new THREE.Mesh(this.teleConeGeo, coneMat);
        telegraphRing.visible = false;
        telegraphCone.visible = false;
        this.scene.add(rig.group, telegraphRing, telegraphCone);

        entry = {
          rig,
          customSlot,
          customPivot,
          customRig: null,
          modelRevision: -1,
          telegraphRing,
          telegraphCone,
          ringMat,
          coneMat,
          archetype: e.archetype,
          isElite: e.isElite,
          isDummy: Boolean(e.isDummy),
        };
        this.enemyMap.set(e.id, entry);
      }

      if (entry.modelRevision !== modelRev) {
        entry.modelRevision = modelRev;
        if (entry.customRig) {
          entry.customPivot.remove(entry.customRig.root);
          entry.customRig.dispose();
          entry.customRig = null;
        }
        if (this.modelRegistry.hasModel(entry.customSlot)) {
          entry.customRig = this.modelRegistry.instantiate(entry.customSlot);
          if (entry.customRig) {
            entry.customPivot.add(entry.customRig.root);
          }
        }
        entry.rig.bodyPivot.visible = !entry.customRig;
      }

      const ex3 = this.simToWorldX(e.x);
      const ez3 = this.simToWorldZ(e.y);
      entry.rig.group.position.set(ex3, 0, ez3);

      const koScale = e.koTimer > 0 ? Math.max(0.05, e.koTimer / 0.3) : 1;
      if (entry.customRig) {
        const eliteBoost = entry.isElite && entry.archetype !== 'boss' && !entry.isDummy ? 1.22 : 1;
        entry.customPivot.rotation.y = -e.aimAngle;
        entry.customPivot.scale.set(
          e.scaleX * koScale * eliteBoost,
          e.scaleY * koScale * eliteBoost,
          e.scaleX * koScale * eliteBoost
        );
        const enemyIntent: AnimIntent =
          e.koTimer > 0
            ? 'death'
            : e.state === 'windup'
              ? 'windup'
              : e.state === 'attack'
                ? 'attack'
                : e.isDummy
                  ? 'idle'
                  : 'move';
        entry.customRig.setAnimationState(enemyIntent, 1);
        entry.customRig.update(dt);

        if (e.hitFlash > 0) {
          entry.customRig.setTint(0xffffff, 1.4);
        } else if (e.chillTimer > 0) {
          entry.customRig.setTint(0x22d3ee, 0.55);
        } else {
          entry.customRig.setTint(0x000000, 0);
        }
      } else {
        entry.rig.bodyPivot.rotation.y = -e.aimAngle;
        entry.rig.bodyPivot.scale.set(
          e.scaleX * koScale,
          e.scaleY * koScale,
          e.scaleX * koScale
        );

        // Hit flash / chill tint / boss Phase II aura
        if (e.hitFlash > 0) {
          entry.rig.primaryMat.emissive.setHex(0xffffff);
          entry.rig.primaryMat.emissiveIntensity = 1.6;
        } else if (e.chillTimer > 0) {
          entry.rig.primaryMat.emissive.setHex(0x22d3ee);
          entry.rig.primaryMat.emissiveIntensity = 0.65;
        } else {
          entry.rig.primaryMat.emissive.setHex(0x000000);
          entry.rig.primaryMat.emissiveIntensity = 0;
        }
      }
      if (entry.rig.phase2Aura) {
        entry.rig.phase2Aura.visible = e.bossPhase === 2;
        if (entry.rig.phase2Aura.visible) {
          entry.rig.phase2Aura.rotation.z = s.simTime * 2.5;
        }
      }

      // Windup attack weapon raise + ground telegraph
      if (e.state === 'windup' && e.koTimer === 0) {
        const prog = 1 - Math.max(0, e.stateTimer) / Math.max(0.1, e.windupDuration);
        entry.rig.weaponPivot.rotation.z = prog * 0.7;

        const hc = s.highContrastTelegraphs;
        const ringRad =
          e.archetype === 'boss' && e.bossAttackIndex === 0
            ? (e.bossPhase === 2 ? 195 : 170) * SIM_TO_3D * prog
            : e.radius * SIM_TO_3D * 1.45;
        entry.telegraphRing.visible = true;
        entry.telegraphRing.position.set(ex3, 0.04, ez3);
        entry.telegraphRing.scale.setScalar(ringRad);
        entry.ringMat.color.setHex(hc ? 0xff2e4c : 0xfacc15);
        entry.ringMat.opacity = hc ? 0.85 : 0.65;

        const reach =
          e.archetype === 'charger'
            ? 340 * SIM_TO_3D
            : e.archetype === 'cultist'
              ? 360 * SIM_TO_3D
              : e.archetype === 'boss'
                ? 280 * SIM_TO_3D
                : (e.radius + 42) * SIM_TO_3D;
        entry.telegraphCone.visible = e.archetype !== 'boss' || e.bossAttackIndex !== 0;
        entry.telegraphCone.position.set(ex3, 0.045, ez3);
        entry.telegraphCone.rotation.y = -e.aimAngle;
        entry.telegraphCone.scale.set(reach * prog, 1, e.archetype === 'charger' ? 1.8 : 0.9);
        entry.coneMat.color.setHex(hc ? 0xfde047 : 0xf97316);
        entry.coneMat.opacity = hc ? 0.65 : 0.42;
      } else {
        entry.rig.weaponPivot.rotation.z *= 0.8;
        entry.telegraphRing.visible = false;
        entry.telegraphCone.visible = false;
      }

      // World-anchored HP bar & Dummy readout
      if (
        barCursor < ENEMY_BAR_DOM_POOL &&
        e.koTimer === 0 &&
        (e.isDummy || (e.archetype !== 'boss' && e.hp < e.maxHp))
      ) {
        const yOff = e.isDummy ? 2.2 : e.isElite ? 2.15 : 1.7;
        this._vec3.set(ex3, yOff, ez3).project(this.camera);
        if (this._vec3.z < 1) {
          const sx = (this._vec3.x * 0.5 + 0.5) * canvasW;
          const sy = (-this._vec3.y * 0.5 + 0.5) * canvasH;
          const bar = this.enemyBarEls[barCursor++];
          bar.root.style.display = 'flex';
          bar.root.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          bar.fill.style.width = `${Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100)).toFixed(1)}%`;
          bar.fill.style.background = e.isDummy ? '#D99B38' : '#DC2626';
          bar.label.textContent = e.isDummy
            ? e.isElite
              ? `WARD (${e.armour} ARM / ${e.resistPct}% RES)`
              : 'ASH DUMMY (0 MIT)'
            : '';
          bar.label.style.display = e.isDummy ? 'block' : 'none';
        }
      }
    }

    for (let i = barCursor; i < ENEMY_BAR_DOM_POOL; i++) {
      this.enemyBarEls[i].root.style.display = 'none';
    }

    // Remove dead/despawned enemy rigs cleanly
    for (const [id, entry] of this.enemyMap.entries()) {
      if (!seenEnemyIds.has(id)) {
        this.scene.remove(entry.rig.group, entry.telegraphRing, entry.telegraphCone);
        entry.customRig?.dispose();
        entry.rig.dispose();
        entry.ringMat.dispose();
        entry.coneMat.dispose();
        this.enemyMap.delete(id);
      }
    }

    // 5. Sync Projectiles
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      const slot = this.projPool[i];
      if (i < s.projectiles.length) {
        const pr = s.projectiles[i];
        slot.group.visible = true;
        slot.group.position.set(
          this.simToWorldX(pr.x),
          0.92,
          this.simToWorldZ(pr.y)
        );
        const rad3 = Math.max(0.18, pr.radius * SIM_TO_3D * 1.15);
        slot.group.scale.setScalar(rad3);
        const hexStr = pr.fromPlayer ? DAMAGE_COLORS[pr.damageType] : '#EF4444';
        slot.haloMat.color.set(hexStr);
      } else {
        slot.group.visible = false;
      }
    }

    // 6. Sync Ground Decals
    let decalCursor = 0;
    for (const d of s.decals) {
      if (!d.active || decalCursor >= DECAL_POOL) continue;
      const slot = this.decalPool[decalCursor++];
      slot.mesh.visible = true;
      slot.mesh.position.set(this.simToWorldX(d.x), 0.025, this.simToWorldZ(d.y));
      slot.mesh.scale.setScalar(d.radius * SIM_TO_3D);
      slot.mat.color.set(d.color);
      const fade = Math.min(1, d.life / Math.max(0.2, d.maxLife));
      slot.mat.opacity = (d.kind === 'crack' ? 0.55 : 0.34) * fade;
    }
    for (let i = decalCursor; i < DECAL_POOL; i++) {
      this.decalPool[i].mesh.visible = false;
    }

    // 7. Sync Feathered Slash Crescents & Nova Rings
    for (let i = 0; i < SLASH_POOL; i++) {
      const slot = this.slashPool[i];
      if (i < s.slashEffects.length) {
        const se = s.slashEffects[i];
        const t = Math.max(0, se.life / Math.max(0.01, se.maxLife));
        const rad3 = se.radius * SIM_TO_3D * (1.12 - t * 0.18);
        const isPartialArc = se.arc < Math.PI * 1.85;
        const activeMesh = isPartialArc ? slot.crescentMesh : slot.ringMesh;
        const inactiveMesh = isPartialArc ? slot.ringMesh : slot.crescentMesh;
        const activeMat = isPartialArc ? slot.crescentMat : slot.ringMat;
        inactiveMesh.visible = false;
        activeMesh.visible = true;
        activeMesh.position.set(this.simToWorldX(se.x), 0.78, this.simToWorldZ(se.y));
        activeMesh.scale.setScalar(rad3);
        activeMesh.rotation.y = -se.angle;
        activeMat.color.set(se.color);
        activeMat.opacity = Math.min(1, t * 1.15);
      } else {
        slot.ringMesh.visible = false;
        slot.crescentMesh.visible = false;
      }
    }

    // 8. Sync Lightning Chains
    for (let i = 0; i < LIGHTNING_POOL; i++) {
      const slot = this.lightningPool[i];
      if (i < s.lightningEffects.length && s.lightningEffects[i].points.length >= 2) {
        const le = s.lightningEffects[i];
        let vIdx = 0;
        for (let p = 0; p < le.points.length && vIdx < 23; p++) {
          const pt = le.points[p];
          if (p > 0) {
            const prev = le.points[p - 1];
            const mx = (prev.x + pt.x) * 0.5 + (Math.random() - 0.5) * 20;
            const mz = (prev.y + pt.y) * 0.5 + (Math.random() - 0.5) * 20;
            slot.positions[vIdx * 3] = this.simToWorldX(mx);
            slot.positions[vIdx * 3 + 1] = 1.05 + Math.random() * 0.25;
            slot.positions[vIdx * 3 + 2] = this.simToWorldZ(mz);
            vIdx++;
          }
          slot.positions[vIdx * 3] = this.simToWorldX(pt.x);
          slot.positions[vIdx * 3 + 1] = 1.05;
          slot.positions[vIdx * 3 + 2] = this.simToWorldZ(pt.y);
          vIdx++;
        }
        const attr = slot.line.geometry.getAttribute('position') as THREE.BufferAttribute;
        attr.needsUpdate = true;
        slot.line.geometry.setDrawRange(0, vIdx);
        slot.mat.color.set(le.color);
        slot.mat.opacity = Math.max(0, le.life / Math.max(0.01, le.maxLife));
        slot.line.visible = true;
      } else {
        slot.line.visible = false;
      }
    }

    // 9. Sync AfterImages
    for (let i = 0; i < AFTERIMAGE_POOL; i++) {
      const slot = this.afterImagePool[i];
      if (i < s.afterImages.length) {
        const img = s.afterImages[i];
        slot.mesh.visible = true;
        slot.mesh.position.set(this.simToWorldX(img.x), 0.72, this.simToWorldZ(img.y));
        slot.mat.color.set(img.color);
        slot.mat.opacity = Math.max(0, img.life / 0.35) * 0.45;
      } else {
        slot.mesh.visible = false;
      }
    }

    // 10. Sync Instanced Additive Particles
    let pCount = 0;
    for (let i = 0; i < s.particles.length && pCount < PARTICLE_CAP; i++) {
      const p = s.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0.05, p.life / Math.max(0.01, p.maxLife));
      const sz = (p.layer === 'outer' ? p.size * 0.08 : p.size * 0.05) * (0.4 + alpha * 0.8);
      this._vec3B.set(
        this.simToWorldX(p.x),
        0.55 + (1 - alpha) * 0.9,
        this.simToWorldZ(p.y)
      );
      this._scale.set(sz, sz, sz);
      this._mat4.compose(this._vec3B, this._quat, this._scale);
      this.particleInstanced.setMatrixAt(pCount, this._mat4);
      this._color.set(p.color).multiplyScalar(alpha);
      this.particleInstanced.setColorAt(pCount, this._color);
      pCount++;
    }
    this.particleInstanced.count = pCount;
    if (pCount > 0) {
      this.particleInstanced.instanceMatrix.needsUpdate = true;
      if (this.particleInstanced.instanceColor) {
        this.particleInstanced.instanceColor.needsUpdate = true;
      }
    }

    // 11. Sync Anamorphic Crit Streaks (M3.3)
    let streakCursor = 0;
    for (const cs of s.critStreaks) {
      if (!cs.active || streakCursor >= STREAK_POOL) continue;
      const slot = this.streakPool[streakCursor++];
      const t = Math.max(0, cs.life / Math.max(0.01, cs.maxLife));
      slot.mesh.visible = true;
      slot.mesh.position.set(this.simToWorldX(cs.x), 1.05, this.simToWorldZ(cs.y));
      slot.mesh.quaternion.copy(this.camera.quaternion);
      slot.mesh.scale.set(cs.width * SIM_TO_3D * (1.2 - t * 0.35), 1, 1);
      slot.mat.color.set(cs.color);
      slot.mat.opacity = t * 0.95;
    }
    for (let i = streakCursor; i < STREAK_POOL; i++) {
      this.streakPool[i].mesh.visible = false;
    }

    // 12. Sync Ground Loot Relics + Beams (M5.1 Shape-Coded)
    const seenLootIds = new Set<string>();
    for (const g of s.groundLoot) {
      seenLootIds.add(g.id);
      let entry = this.lootMap.get(g.id);
      if (!entry) {
        const group = new THREE.Group();
        const hexStr = RARITY_COLORS[g.item.rarity as Rarity] ?? '#E2E8F0';
        const geos: THREE.BufferGeometry[] = [];
        let coreGeo: THREE.BufferGeometry;
        if (g.item.slot === 'weapon') {
          coreGeo = new THREE.OctahedronGeometry(0.32, 0);
        } else if (g.item.slot === 'ring1' || g.item.slot === 'ring2' || g.item.slot === 'amulet') {
          coreGeo = new THREE.TorusGeometry(0.24, 0.08, 8, 16);
        } else {
          coreGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
        }
        const beamGeo = new THREE.CylinderGeometry(0.06, 0.24, 3.8, 8, 1, true);
        geos.push(coreGeo, beamGeo);

        const coreMat = new THREE.MeshStandardMaterial({
          color: hexStr,
          emissive: hexStr,
          emissiveIntensity: 1.5,
          roughness: 0.25,
          metalness: 0.85,
        });
        const beamMat = new THREE.MeshBasicMaterial({
          color: hexStr,
          transparent: true,
          opacity: g.item.rarity === 'legendary' || g.item.rarity === 'rare' ? 0.38 : 0.18,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.55;
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 1.9;
        group.add(core, beam);
        this.scene.add(group);
        entry = { group, core, beam, coreMat, beamMat, geos };
        this.lootMap.set(g.id, entry);
      }
      entry.group.position.set(this.simToWorldX(g.x), 0, this.simToWorldZ(g.y));
      entry.core.position.y = 0.55 + Math.sin(g.pulsePhase) * 0.14;
      entry.core.rotation.y = g.pulsePhase * 0.8;
    }
    for (const [id, entry] of this.lootMap.entries()) {
      if (!seenLootIds.has(id)) {
        this.scene.remove(entry.group);
        for (const geo of entry.geos) geo.dispose();
        entry.coreMat.dispose();
        entry.beamMat.dispose();
        this.lootMap.delete(id);
      }
    }

    // 13. Sync Floating Damage Numbers in DOM Overlay
    let textCursor = 0;
    for (const f of s.floatingTexts) {
      if (!f.active || textCursor >= FLOATING_DOM_POOL) continue;
      this._vec3
        .set(this.simToWorldX(f.x), 1.65 + (1 - f.life / Math.max(0.01, f.maxLife)) * 1.1, this.simToWorldZ(f.y))
        .project(this.camera);
      if (this._vec3.z >= 1) continue;
      const sx = (this._vec3.x * 0.5 + 0.5) * canvasW;
      const sy = (-this._vec3.y * 0.5 + 0.5) * canvasH;
      const el = this.floatTextEls[textCursor++];
      el.style.display = 'block';
      el.textContent = f.text;
      el.style.color = f.color;
      el.style.fontSize = f.isCrit ? '16px' : '12px';
      el.style.opacity = String(Math.min(1, (f.life / Math.max(0.01, f.maxLife)) * 1.4));
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
    for (let i = textCursor; i < FLOATING_DOM_POOL; i++) {
      this.floatTextEls[i].style.display = 'none';
    }
  }

  public destroy() {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.timerId !== null) clearTimeout(this.timerId);

    this.mountEl.removeEventListener('pointerdown', this.handlePointerDown);
    this.mountEl.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    this.sim.destroy();

    for (const entry of this.enemyMap.values()) {
      entry.customRig?.dispose();
      entry.rig.dispose();
      entry.ringMat.dispose();
      entry.coneMat.dispose();
    }
    this.enemyMap.clear();

    for (const entry of this.lootMap.values()) {
      for (const geo of entry.geos) geo.dispose();
      entry.coreMat.dispose();
      entry.beamMat.dispose();
    }
    this.lootMap.clear();

    this.playerCustomRig?.dispose();
    this.playerRig.dispose();
    this.modelRegistry.dispose();
    this.arena.dispose();
    disposeThreeMaterialLibrary(this.mats);
    this.envMapTex.dispose();

    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.projCoreGeo.dispose();
    this.projCoreMat.dispose();
    for (const p of this.projPool) p.haloMat.dispose();
    this.decalGeo.dispose();
    for (const d of this.decalPool) d.mat.dispose();
    this.slashQuadGeo.dispose();
    for (const sl of this.slashPool) {
      sl.ringMat.dispose();
      sl.crescentMat.dispose();
    }
    this.streakGeo.dispose();
    for (const st of this.streakPool) st.mat.dispose();
    for (const l of this.lightningPool) {
      l.line.geometry.dispose();
      l.mat.dispose();
    }
    this.afterImageGeo.dispose();
    for (const a of this.afterImagePool) a.mat.dispose();
    this.teleRingGeo.dispose();
    this.teleConeGeo.dispose();
    this.moveMarkerGeo.dispose();
    this.moveMarkerMat.dispose();

    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlayEl.remove();
  }
}
