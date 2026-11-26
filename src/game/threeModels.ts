import * as THREE from 'three';
import { ObstacleRect } from './domainGen';
import { AspectId, DamageType } from './types';
import { ThreeMaterialLibrary } from './threeMaterials';
import { GltfModelRegistry } from './threeModelLoader';

export interface PlayerRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  swordPivot: THREE.Group;
  bladeEdgeMesh: THREE.Mesh;
  bladeGlowSprite: THREE.Sprite;
  cloakPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  aetherShell: THREE.Mesh;
  eclipseOrbit: THREE.Group;
  eclipseOrb: THREE.Mesh;
  eclipseOrbMat: THREE.MeshStandardMaterial;
  shadeRing: THREE.Mesh;
  cinderRing: THREE.Mesh;
  frostCrown: THREE.Group;
  ironPlates: THREE.Group;
  stormArcs: THREE.Group;
  bloodVeins: THREE.Group;
  bodyPlatesMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface EnemyRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  weaponPivot: THREE.Group;
  phase2Aura: THREE.Mesh | null;
  eliteCrown: THREE.Mesh | null;
  primaryMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface ArenaEnvironment {
  group: THREE.Group;
  chamberFloor: THREE.Mesh;
  chamberBorder: THREE.Mesh;
  astrolabeGroup: THREE.Group;
  obstaclesGroup: THREE.Group;
  ruinRingGroup: THREE.Group;
  portalGroup: THREE.Group;
  portalCore: THREE.Mesh;
  portalLight: THREE.PointLight;
  brazierLights: THREE.PointLight[];
  configureRoom: (
    roomWidthWorld: number,
    roomHeightWorld: number,
    obstacles: ObstacleRect[],
    simTo3d: number,
    isBossRoom: boolean,
    inSanctuary: boolean,
    propRegistry?: GltfModelRegistry
  ) => void;
  dispose: () => void;
}

function createSculptedRunebladeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.065);
  shape.lineTo(0.85, -0.055);
  shape.lineTo(1.25, -0.08);
  shape.lineTo(1.56, 0);
  shape.lineTo(1.25, 0.08);
  shape.lineTo(0.85, 0.055);
  shape.lineTo(0, 0.065);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  geo.center();
  geo.translate(0.76, 0, 0);
  return geo;
}

function createSculptedPauldronGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.02, 0.34),
    new THREE.Vector2(0.16, 0.28),
    new THREE.Vector2(0.24, 0.14),
    new THREE.Vector2(0.27, 0.0),
    new THREE.Vector2(0.22, -0.08),
  ];
  return new THREE.LatheGeometry(pts, 10, 0, Math.PI * 1.15);
}

function createTatteredCloakGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, 0.56);
  shape.lineTo(0.34, 0.56);
  shape.lineTo(0.46, -0.45);
  shape.lineTo(0.22, -0.34);
  shape.lineTo(0.06, -0.58);
  shape.lineTo(-0.14, -0.36);
  shape.lineTo(-0.36, -0.54);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.03,
    bevelEnabled: false,
  });
  // Bend cape outward slightly at bottom
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, (0.56 - y) / 1.14);
    pos.setZ(i, pos.getZ(i) - t * t * 0.32);
  }
  geo.computeVertexNormals();
  geo.rotateY(-Math.PI / 2); // face normal along -X back
  return geo;
}

function createCurvedHornGeometry(length = 0.52, radius = 0.065): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(length * 0.45, length * 0.25, 0),
    new THREE.Vector3(length * 0.85, length * 0.65, 0),
    new THREE.Vector3(length * 0.65, length * 1.0, 0),
  ]);
  const geo = new THREE.TubeGeometry(curve, 12, radius, 7, false);
  // Taper tip smoothly
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = Math.min(1, Math.max(0, v.y / length));
    curve.getPoint(t, c);
    v.sub(c).multiplyScalar(Math.max(0.12, 1 - t * 0.88)).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createWingGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.45, 0.72);
  shape.lineTo(1.25, 0.92);
  shape.lineTo(1.05, 0.44);
  shape.lineTo(1.38, 0.16);
  shape.lineTo(0.86, -0.05);
  shape.lineTo(0.95, -0.45);
  shape.lineTo(0.42, -0.18);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
}

export function buildPlayerRig(mats: ThreeMaterialLibrary): PlayerRig {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const localGeos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  // Ground contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.75, 1.75);
  shadowGeo.rotateX(-Math.PI / 2);
  localGeos.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, mats.contactShadowMat);
  shadow.position.y = 0.02;
  group.add(shadow);

  const bodyPlatesMat = mats.obsidianPlateMat.clone();
  localMats.push(bodyPlatesMat);

  // Articulated Greaves + Sabaton Boots
  const thighGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.34, 8);
  const bootGeo = new THREE.BoxGeometry(0.24, 0.16, 0.18);
  localGeos.push(thighGeo, bootGeo);

  const makeLeg = (zOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(0, 0.52, zOffset);
    const shin = new THREE.Mesh(thighGeo, bodyPlatesMat);
    shin.position.y = -0.22;
    shin.castShadow = true;
    const boot = new THREE.Mesh(bootGeo, mats.goldMat);
    boot.position.set(0.05, -0.44, 0);
    boot.castShadow = true;
    legGroup.add(shin, boot);
    return legGroup;
  };
  const leftLeg = makeLeg(-0.17);
  const rightLeg = makeLeg(0.17);
  bodyPivot.add(leftLeg, rightLeg);

  // Sculpted Lathe Armored Cuirass + Battle Skirt Tassets
  const torsoProfile = [
    new THREE.Vector2(0.0, 0.42),
    new THREE.Vector2(0.34, 0.44),
    new THREE.Vector2(0.23, 0.68),
    new THREE.Vector2(0.34, 1.08),
    new THREE.Vector2(0.24, 1.24),
    new THREE.Vector2(0.0, 1.26),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 12);
  localGeos.push(torsoGeo);
  const torso = new THREE.Mesh(torsoGeo, bodyPlatesMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Gold Waist Belt & Chest Sigil
  const beltGeo = new THREE.TorusGeometry(0.24, 0.045, 6, 14);
  beltGeo.rotateX(Math.PI / 2);
  localGeos.push(beltGeo);
  const belt = new THREE.Mesh(beltGeo, mats.goldMat);
  belt.position.y = 0.68;
  bodyPivot.add(belt);

  const chestCrestGeo = new THREE.OctahedronGeometry(0.14, 0);
  localGeos.push(chestCrestGeo);
  const chestCrest = new THREE.Mesh(chestCrestGeo, mats.goldMat);
  chestCrest.position.set(0.28, 0.96, 0);
  chestCrest.scale.set(0.45, 1.25, 0.85);
  bodyPivot.add(chestCrest);

  // Flowing Tattered Crimson Cloak (sways dynamically in loop)
  const cloakPivot = new THREE.Group();
  cloakPivot.position.set(-0.24, 1.18, 0);
  bodyPivot.add(cloakPivot);
  const cloakGeo = createTatteredCloakGeometry();
  localGeos.push(cloakGeo);
  const cloak = new THREE.Mesh(cloakGeo, mats.cloakMat);
  cloak.position.y = -0.52;
  cloak.castShadow = true;
  cloakPivot.add(cloak);

  // Sculpted Flared Pauldrons with Spikes
  const pauldronGeo = createSculptedPauldronGeometry();
  const spikeGeo = new THREE.ConeGeometry(0.055, 0.24, 5);
  localGeos.push(pauldronGeo, spikeGeo);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(pauldronGeo, mats.goldMat);
    p.position.set(0, 1.12, s * 0.34);
    p.rotation.y = s > 0 ? 0 : Math.PI;
    p.rotation.z = s * 0.2;
    p.castShadow = true;
    bodyPivot.add(p);

    const sp = new THREE.Mesh(spikeGeo, mats.bladeMetalMat);
    sp.position.set(0, 1.38, s * 0.42);
    sp.rotation.x = s * 0.35;
    bodyPivot.add(sp);
  }

  // Gothic Greathelm + Tapered Hood + Glowing Amber Visor
  const helmProfile = [
    new THREE.Vector2(0.0, 1.24),
    new THREE.Vector2(0.2, 1.26),
    new THREE.Vector2(0.21, 1.48),
    new THREE.Vector2(0.14, 1.66),
    new THREE.Vector2(0.0, 1.72),
  ];
  const helmGeo = new THREE.LatheGeometry(helmProfile, 10);
  localGeos.push(helmGeo);
  const helm = new THREE.Mesh(helmGeo, bodyPlatesMat);
  helm.position.x = 0.03;
  helm.castShadow = true;
  bodyPivot.add(helm);

  const hoodCrownGeo = new THREE.ConeGeometry(0.25, 0.38, 8);
  localGeos.push(hoodCrownGeo);
  const hoodCrown = new THREE.Mesh(hoodCrownGeo, mats.cloakMat);
  hoodCrown.position.set(-0.04, 1.62, 0);
  hoodCrown.rotation.z = 0.35;
  bodyPivot.add(hoodCrown);

  const visorGeo = new THREE.BoxGeometry(0.16, 0.055, 0.26);
  localGeos.push(visorGeo);
  const visor = new THREE.Mesh(visorGeo, mats.visorEmissiveMat);
  visor.position.set(0.18, 1.44, 0);
  bodyPivot.add(visor);

  // Runeblade Weapon Pivot (+Z right hand, extending +X)
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.2, 0.92, 0.4);
  bodyPivot.add(swordPivot);

  const gripGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.32, 6);
  gripGeo.rotateZ(Math.PI / 2);
  localGeos.push(gripGeo);
  const grip = new THREE.Mesh(gripGeo, mats.cloakMat);
  swordPivot.add(grip);

  const guardGeo = new THREE.TorusGeometry(0.18, 0.035, 6, 12, Math.PI);
  guardGeo.rotateY(Math.PI / 2);
  guardGeo.rotateX(Math.PI / 2);
  localGeos.push(guardGeo);
  const guard = new THREE.Mesh(guardGeo, mats.goldMat);
  guard.position.set(0.14, 0, 0);
  swordPivot.add(guard);

  const bladeGeo = createSculptedRunebladeGeometry();
  localGeos.push(bladeGeo);
  const bladeCore = new THREE.Mesh(bladeGeo, mats.bladeMetalMat);
  bladeCore.position.set(0.14, 0, 0);
  bladeCore.castShadow = true;
  swordPivot.add(bladeCore);

  const bladeEdgeMat = mats.bladeEdgeMat.clone();
  localMats.push(bladeEdgeMat);
  const edgeGeo = new THREE.BoxGeometry(1.26, 0.025, 0.09);
  localGeos.push(edgeGeo);
  const bladeEdgeMesh = new THREE.Mesh(edgeGeo, bladeEdgeMat);
  bladeEdgeMesh.position.set(0.84, 0, 0);
  swordPivot.add(bladeEdgeMesh);

  const bladeGlowMat = new THREE.SpriteMaterial({
    map: mats.flareTexture,
    color: 0xf97316,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  localMats.push(bladeGlowMat);
  const bladeGlowSprite = new THREE.Sprite(bladeGlowMat);
  bladeGlowSprite.position.set(1.38, 0, 0);
  bladeGlowSprite.scale.set(0.95, 0.95, 1);
  swordPivot.add(bladeGlowSprite);

  // --- Aspect Overlays (M3.4) ---
  const shellGeo = new THREE.IcosahedronGeometry(0.98, 2);
  localGeos.push(shellGeo);
  const aetherShell = new THREE.Mesh(shellGeo, mats.aetherShellMat);
  aetherShell.position.y = 0.92;
  aetherShell.visible = false;
  group.add(aetherShell);

  const eclipseOrbit = new THREE.Group();
  eclipseOrbit.position.y = 1.15;
  eclipseOrbit.visible = false;
  group.add(eclipseOrbit);
  const eclipseOrbMat = mats.eclipseGoldMat.clone();
  localMats.push(eclipseOrbMat);
  const orbGeo = new THREE.OctahedronGeometry(0.17, 0);
  localGeos.push(orbGeo);
  const eclipseOrb = new THREE.Mesh(orbGeo, eclipseOrbMat);
  eclipseOrb.position.set(1.08, 0, 0);
  eclipseOrbit.add(eclipseOrb);

  const ringGeo = new THREE.RingGeometry(0.92, 1.04, 28);
  ringGeo.rotateX(-Math.PI / 2);
  localGeos.push(ringGeo);
  const shadeRing = new THREE.Mesh(ringGeo, mats.shadeRingMat);
  shadeRing.position.y = 0.05;
  shadeRing.visible = false;
  group.add(shadeRing);

  const cinderMat = new THREE.MeshBasicMaterial({
    map: mats.slashRingTexture,
    color: 0xf97316,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  localMats.push(cinderMat);
  const cinderPlaneGeo = new THREE.PlaneGeometry(1.9, 1.9);
  cinderPlaneGeo.rotateX(-Math.PI / 2);
  localGeos.push(cinderPlaneGeo);
  const cinderRing = new THREE.Mesh(cinderPlaneGeo, cinderMat);
  cinderRing.position.y = 0.04;
  cinderRing.visible = false;
  group.add(cinderRing);

  const frostCrown = new THREE.Group();
  frostCrown.position.y = 1.12;
  frostCrown.visible = false;
  const shardGeo = new THREE.ConeGeometry(0.075, 0.3, 4);
  localGeos.push(shardGeo);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const shard = new THREE.Mesh(shardGeo, mats.frostCrystalMat);
    shard.position.set(Math.cos(a) * 0.88, 0, Math.sin(a) * 0.88);
    shard.rotation.z = Math.PI * 0.16;
    frostCrown.add(shard);
  }
  group.add(frostCrown);

  const ironPlates = new THREE.Group();
  ironPlates.position.y = 0.78;
  ironPlates.visible = false;
  const shieldGeo = new THREE.BoxGeometry(0.08, 0.48, 0.34);
  localGeos.push(shieldGeo);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const plate = new THREE.Mesh(shieldGeo, mats.ironPlateMat);
    plate.position.set(Math.cos(a) * 0.82, 0, Math.sin(a) * 0.82);
    plate.rotation.y = -a;
    ironPlates.add(plate);
  }
  group.add(ironPlates);

  const stormArcs = new THREE.Group();
  stormArcs.position.y = 1.32;
  stormArcs.visible = false;
  const boltGeo = new THREE.OctahedronGeometry(0.11, 0);
  localGeos.push(boltGeo);
  for (const s of [-1, 1]) {
    const orb = new THREE.Mesh(boltGeo, mats.stormArcMat);
    orb.position.set(0, 0.14, s * 0.56);
    orb.scale.set(1.3, 0.8, 0.8);
    stormArcs.add(orb);
  }
  bodyPivot.add(stormArcs);

  const bloodVeins = new THREE.Group();
  bloodVeins.visible = false;
  const veinGeo = new THREE.BoxGeometry(0.05, 0.45, 0.05);
  localGeos.push(veinGeo);
  for (const s of [-1, 1]) {
    const v = new THREE.Mesh(veinGeo, mats.bloodVeinMat);
    v.position.set(0.28, 0.94, s * 0.18);
    v.rotation.x = s * 0.25;
    bloodVeins.add(v);
  }
  bodyPivot.add(bloodVeins);

  return {
    group,
    bodyPivot,
    swordPivot,
    bladeEdgeMesh,
    bladeGlowSprite,
    cloakPivot,
    leftLeg,
    rightLeg,
    aetherShell,
    eclipseOrbit,
    eclipseOrb,
    eclipseOrbMat,
    shadeRing,
    cinderRing,
    frostCrown,
    ironPlates,
    stormArcs,
    bloodVeins,
    bodyPlatesMat,
    dispose: () => {
      for (const g of localGeos) g.dispose();
      for (const m of localMats) m.dispose();
    },
  };
}

export function updatePlayerAspectVisuals(
  rig: PlayerRig,
  activeAspects: AspectId[],
  primaryDamageType: DamageType,
  es: number,
  veilShield: number,
  barrierActive: boolean,
  eclipseReady: boolean,
  simTime: number
) {
  const has = (id: AspectId) => activeAspects.includes(id);
  rig.cinderRing.visible = has('cinder') || has('pyromancer');
  rig.frostCrown.visible = has('frigid') || has('frostbite');
  rig.ironPlates.visible = has('iron') || has('bastion');
  rig.stormArcs.visible = has('storm');
  rig.bloodVeins.visible = has('blood') || has('berserk');
  rig.aetherShell.visible = has('aether') || has('veil') || es > 0 || veilShield > 0 || barrierActive;
  rig.eclipseOrbit.visible = has('eclipse');

  if (rig.frostCrown.visible) rig.frostCrown.rotation.y = simTime * 0.9;
  if (rig.ironPlates.visible) rig.ironPlates.rotation.y = -simTime * 0.7;
  if (rig.eclipseOrbit.visible) {
    rig.eclipseOrbit.rotation.y = simTime * 2.1;
    rig.eclipseOrb.scale.setScalar(eclipseReady ? 1.45 : 0.75);
    rig.eclipseOrbMat.emissiveIntensity = eclipseReady ? 2.6 : 0.35;
  }

  const edgeMat = rig.bladeEdgeMesh.material as THREE.MeshStandardMaterial;
  const spriteMat = rig.bladeGlowSprite.material as THREE.SpriteMaterial;
  const colorMap: Record<DamageType, number> = {
    fire: 0xf97316,
    cold: 0x22d3ee,
    lightning: 0x7dd3fc,
    physical: 0xe2e8f0,
    chaos: 0xa855f7,
  };
  const targetHex = colorMap[primaryDamageType] ?? 0xf97316;
  edgeMat.color.setHex(targetHex);
  edgeMat.emissive.setHex(targetHex);
  spriteMat.color.setHex(targetHex);
}

export function buildEnemyRig(
  archetype: 'thrall' | 'cultist' | 'charger' | 'stalker' | 'boss',
  isElite: boolean,
  isDummy: boolean,
  mats: ThreeMaterialLibrary
): EnemyRig {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  const weaponPivot = new THREE.Group();
  group.add(bodyPivot);
  bodyPivot.add(weaponPivot);

  const localGeos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  const scale = isDummy ? 1.05 : archetype === 'boss' ? 1.85 : isElite ? 1.28 : 1.0;

  const shadowGeo = new THREE.PlaneGeometry(1.65 * scale, 1.65 * scale);
  shadowGeo.rotateX(-Math.PI / 2);
  localGeos.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, mats.contactShadowMat);
  shadow.position.y = 0.02;
  group.add(shadow);

  const baseHex = isDummy
    ? isElite
      ? 0x92400e
      : 0x334155
    : archetype === 'boss'
      ? 0x221b2c
      : archetype === 'charger'
        ? 0x4a1216
        : archetype === 'cultist'
          ? 0x5c1d10
          : archetype === 'stalker'
            ? 0x2e1065
            : 0x334155;

  const accentHex = isDummy
    ? 0xe6a83e
    : archetype === 'boss'
      ? 0xe6a83e
      : archetype === 'charger'
        ? 0xdc2626
        : archetype === 'cultist'
          ? 0xf97316
          : archetype === 'stalker'
            ? 0xa855f7
            : 0x94a3b8;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: baseHex,
    roughness: archetype === 'charger' || archetype === 'boss' ? 0.34 : 0.72,
    metalness: archetype === 'charger' || archetype === 'boss' ? 0.78 : 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: archetype === 'boss' ? 0.9 : 0.35,
    roughness: 0.3,
    metalness: 0.72,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: archetype === 'boss' || archetype === 'charger' ? 0xef4444 : 0xf97316,
    emissiveIntensity: 2.4,
    roughness: 0.18,
  });
  localMats.push(primaryMat, accentMat, eyeMat);

  let phase2Aura: THREE.Mesh | null = null;
  let eliteCrown: THREE.Mesh | null = null;

  if (isDummy) {
    // Sculpted Practice Sanctuary Target Dummy with Armoured Ward Shield & Pedestal
    const pedGeo = new THREE.CylinderGeometry(0.48, 0.68, 0.24, 12);
    localGeos.push(pedGeo);
    const ped = new THREE.Mesh(pedGeo, mats.stoneTrimMat);
    ped.position.y = 0.12;
    ped.receiveShadow = true;
    group.add(ped);

    const postGeo = new THREE.CylinderGeometry(0.09, 0.12, 1.45, 8);
    localGeos.push(postGeo);
    const post = new THREE.Mesh(postGeo, mats.stoneTrimMat);
    post.position.y = 0.85;
    bodyPivot.add(post);

    const dummyTorsoPts = [
      new THREE.Vector2(0, 0.58),
      new THREE.Vector2(0.24, 0.62),
      new THREE.Vector2(0.34, 1.15),
      new THREE.Vector2(0.2, 1.38),
      new THREE.Vector2(0, 1.4),
    ];
    const dTorsoGeo = new THREE.LatheGeometry(dummyTorsoPts, 10);
    localGeos.push(dTorsoGeo);
    const dTorso = new THREE.Mesh(dTorsoGeo, primaryMat);
    dTorso.castShadow = true;
    bodyPivot.add(dTorso);

    const armBarGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6);
    armBarGeo.rotateX(Math.PI / 2);
    localGeos.push(armBarGeo);
    const armBar = new THREE.Mesh(armBarGeo, accentMat);
    armBar.position.y = 1.24;
    bodyPivot.add(armBar);

    const helmGeo = new THREE.OctahedronGeometry(0.22, 1);
    localGeos.push(helmGeo);
    const helm = new THREE.Mesh(helmGeo, isElite ? mats.goldMat : mats.boneMat);
    helm.position.y = 1.62;
    bodyPivot.add(helm);
  } else if (archetype === 'thrall') {
    // Hunched Ashen Ghoul with jagged curved cleaver & bone skull
    const legGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.5, 6);
    localGeos.push(legGeo);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, primaryMat);
      leg.position.set(0, 0.25, s * 0.14);
      leg.castShadow = true;
      bodyPivot.add(leg);
    }

    const torsoPts = [
      new THREE.Vector2(0, 0.45),
      new THREE.Vector2(0.2, 0.5),
      new THREE.Vector2(0.29, 0.92),
      new THREE.Vector2(0.18, 1.1),
      new THREE.Vector2(0, 1.12),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPts, 8);
    localGeos.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, primaryMat);
    torso.rotation.z = -0.22;
    torso.castShadow = true;
    bodyPivot.add(torso);

    const skullGeo = new THREE.DodecahedronGeometry(0.2, 0);
    localGeos.push(skullGeo);
    const skull = new THREE.Mesh(skullGeo, mats.boneMat);
    skull.position.set(0.16, 1.18, 0);
    bodyPivot.add(skull);

    const eyeGeo = new THREE.BoxGeometry(0.08, 0.045, 0.18);
    localGeos.push(eyeGeo);
    const eyes = new THREE.Mesh(eyeGeo, eyeMat);
    eyes.position.set(0.3, 1.18, 0);
    bodyPivot.add(eyes);

    const cleaverGeo = createSculptedRunebladeGeometry();
    localGeos.push(cleaverGeo);
    const cleaver = new THREE.Mesh(cleaverGeo, accentMat);
    cleaver.scale.set(0.58, 1.6, 0.9);
    cleaver.position.set(0.24, 0.72, 0.28);
    weaponPivot.add(cleaver);
  } else if (archetype === 'cultist') {
    // Draped Cinder Occultist with Lathe robe, horned hood, & glowing staff orb + flare
    const robePts = [
      new THREE.Vector2(0.42, 0.04),
      new THREE.Vector2(0.32, 0.55),
      new THREE.Vector2(0.26, 1.08),
      new THREE.Vector2(0.18, 1.24),
      new THREE.Vector2(0, 1.25),
    ];
    const robeGeo = new THREE.LatheGeometry(robePts, 10);
    localGeos.push(robeGeo);
    const robe = new THREE.Mesh(robeGeo, primaryMat);
    robe.castShadow = true;
    bodyPivot.add(robe);

    const hoodGeo = new THREE.ConeGeometry(0.24, 0.48, 8);
    localGeos.push(hoodGeo);
    const hood = new THREE.Mesh(hoodGeo, accentMat);
    hood.position.set(0.02, 1.42, 0);
    hood.rotation.z = -0.22;
    bodyPivot.add(hood);

    const eyeGeo = new THREE.SphereGeometry(0.065, 6, 6);
    localGeos.push(eyeGeo);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.18, 1.32, 0);
    bodyPivot.add(eye);

    const staffCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.28, 0.1, 0.3),
      new THREE.Vector3(0.32, 0.85, 0.32),
      new THREE.Vector3(0.24, 1.45, 0.28),
      new THREE.Vector3(0.36, 1.72, 0.3),
    ]);
    const staffGeo = new THREE.TubeGeometry(staffCurve, 12, 0.04, 6, false);
    localGeos.push(staffGeo);
    const staff = new THREE.Mesh(staffGeo, mats.stoneTrimMat);
    weaponPivot.add(staff);

    const orbGeo = new THREE.OctahedronGeometry(0.15, 0);
    localGeos.push(orbGeo);
    const orb = new THREE.Mesh(orbGeo, eyeMat);
    orb.position.set(0.36, 1.82, 0.3);
    weaponPivot.add(orb);

    const spriteMat = new THREE.SpriteMaterial({
      map: mats.flareTexture,
      color: 0xf97316,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    localMats.push(spriteMat);
    const glow = new THREE.Sprite(spriteMat);
    glow.position.set(0.36, 1.82, 0.3);
    glow.scale.set(0.85, 0.85, 1);
    weaponPivot.add(glow);
  } else if (archetype === 'charger') {
    // Hulking Horned Blood Juggernaut (sculpted Lathe torso, flared armor plates, curved horns)
    const torsoPts = [
      new THREE.Vector2(0, 0.32),
      new THREE.Vector2(0.38, 0.38),
      new THREE.Vector2(0.56, 0.88),
      new THREE.Vector2(0.46, 1.24),
      new THREE.Vector2(0, 1.32),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPts, 10);
    localGeos.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, primaryMat);
    torso.castShadow = true;
    bodyPivot.add(torso);

    const pauldronGeo = createSculptedPauldronGeometry();
    localGeos.push(pauldronGeo);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(pauldronGeo, accentMat);
      p.scale.setScalar(1.45);
      p.position.set(0.05, 1.08, s * 0.46);
      p.rotation.y = s > 0 ? 0 : Math.PI;
      bodyPivot.add(p);
    }

    const helmGeo = new THREE.DodecahedronGeometry(0.28, 0);
    localGeos.push(helmGeo);
    const helm = new THREE.Mesh(helmGeo, primaryMat);
    helm.position.set(0.24, 1.28, 0);
    bodyPivot.add(helm);

    const hornGeo = createCurvedHornGeometry(0.58, 0.085);
    localGeos.push(hornGeo);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeo, mats.boneMat);
      horn.position.set(0.3, 1.32, s * 0.2);
      horn.rotation.y = s * -0.45;
      horn.rotation.z = -0.55;
      bodyPivot.add(horn);
    }

    const coreGeo = new THREE.OctahedronGeometry(0.18, 0);
    localGeos.push(coreGeo);
    const core = new THREE.Mesh(coreGeo, eyeMat);
    core.position.set(0.46, 0.9, 0);
    bodyPivot.add(core);
  } else if (archetype === 'stalker') {
    // Sleek Floating Void Wraith with torn Lathe shroud & twin crescent blades
    const shroudPts = [
      new THREE.Vector2(0.36, 0.25),
      new THREE.Vector2(0.2, 0.65),
      new THREE.Vector2(0.28, 1.15),
      new THREE.Vector2(0.16, 1.38),
      new THREE.Vector2(0, 1.44),
    ];
    const shroudGeo = new THREE.LatheGeometry(shroudPts, 8);
    localGeos.push(shroudGeo);
    const shroud = new THREE.Mesh(shroudGeo, primaryMat);
    shroud.castShadow = true;
    bodyPivot.add(shroud);

    const maskGeo = new THREE.OctahedronGeometry(0.2, 0);
    localGeos.push(maskGeo);
    const mask = new THREE.Mesh(maskGeo, accentMat);
    mask.position.set(0.1, 1.4, 0);
    bodyPivot.add(mask);

    const eyeGeo = new THREE.BoxGeometry(0.08, 0.05, 0.2);
    localGeos.push(eyeGeo);
    const eyes = new THREE.Mesh(eyeGeo, eyeMat);
    eyes.position.set(0.25, 1.4, 0);
    bodyPivot.add(eyes);

    const bladeGeo = createSculptedRunebladeGeometry();
    localGeos.push(bladeGeo);
    for (const s of [-1, 1]) {
      const dagger = new THREE.Mesh(bladeGeo, mats.bladeMetalMat);
      dagger.scale.set(0.55, 1.0, 0.75);
      dagger.position.set(0.26, 0.88, s * 0.34);
      weaponPivot.add(dagger);
    }
  } else {
    // Pinnacle Boss: Towering Dread Sovereign with Wing Blades, Halo Astrolabe, Crown & Greatsword
    const torsoPts = [
      new THREE.Vector2(0, 0.35),
      new THREE.Vector2(0.52, 0.42),
      new THREE.Vector2(0.42, 0.95),
      new THREE.Vector2(0.62, 1.56),
      new THREE.Vector2(0.4, 1.82),
      new THREE.Vector2(0, 1.86),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPts, 12);
    localGeos.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, primaryMat);
    torso.castShadow = true;
    bodyPivot.add(torso);

    const pauldronGeo = createSculptedPauldronGeometry();
    localGeos.push(pauldronGeo);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(pauldronGeo, mats.goldMat);
      p.scale.setScalar(1.75);
      p.position.set(0, 1.65, s * 0.58);
      p.rotation.y = s > 0 ? 0 : Math.PI;
      bodyPivot.add(p);
    }

    const wingGeo = createWingGeometry();
    localGeos.push(wingGeo);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, accentMat);
      wing.position.set(-0.36, 1.55, s * 0.25);
      wing.rotation.y = s * (Math.PI * 0.35);
      wing.rotation.z = 0.22;
      wing.castShadow = true;
      bodyPivot.add(wing);
    }

    const helmGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.54, 8);
    localGeos.push(helmGeo);
    const helm = new THREE.Mesh(helmGeo, primaryMat);
    helm.position.y = 2.12;
    bodyPivot.add(helm);

    const hornGeo = createCurvedHornGeometry(0.65, 0.065);
    localGeos.push(hornGeo);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(hornGeo, mats.goldMat);
      horn.position.set(0.05, 2.24, s * 0.2);
      horn.rotation.y = s * -0.5;
      bodyPivot.add(horn);
    }

    const visorGeo = new THREE.BoxGeometry(0.18, 0.09, 0.34);
    localGeos.push(visorGeo);
    const visor = new THREE.Mesh(visorGeo, eyeMat);
    visor.position.set(0.24, 2.1, 0);
    bodyPivot.add(visor);

    const haloGeo = new THREE.TorusGeometry(0.95, 0.06, 8, 28);
    haloGeo.rotateY(Math.PI / 2);
    localGeos.push(haloGeo);
    const halo = new THREE.Mesh(haloGeo, mats.goldMat);
    halo.position.set(-0.35, 2.05, 0);
    bodyPivot.add(halo);

    const bladeGeo = createSculptedRunebladeGeometry();
    localGeos.push(bladeGeo);
    const greatblade = new THREE.Mesh(bladeGeo, accentMat);
    greatblade.scale.set(1.65, 1.85, 1.5);
    greatblade.position.set(0.35, 1.25, 0.78);
    weaponPivot.add(greatblade);

    const auraGeo = new THREE.RingGeometry(1.25, 1.55, 36);
    auraGeo.rotateX(-Math.PI / 2);
    localGeos.push(auraGeo);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    localMats.push(auraMat);
    phase2Aura = new THREE.Mesh(auraGeo, auraMat);
    phase2Aura.position.y = 0.05;
    phase2Aura.visible = false;
    group.add(phase2Aura);
  }

  if (isElite && archetype !== 'boss' && !isDummy) {
    const crownGeo = new THREE.TorusGeometry(0.32, 0.04, 6, 12);
    crownGeo.rotateX(Math.PI / 2);
    localGeos.push(crownGeo);
    eliteCrown = new THREE.Mesh(crownGeo, mats.goldMat);
    eliteCrown.position.y = 1.72;
    bodyPivot.add(eliteCrown);
    bodyPivot.scale.setScalar(1.22);
  }

  return {
    group,
    bodyPivot,
    weaponPivot,
    phase2Aura,
    eliteCrown,
    primaryMat,
    accentMat,
    eyeMat,
    dispose: () => {
      for (const g of localGeos) g.dispose();
      for (const m of localMats) m.dispose();
    },
  };
}

export function buildArenaEnvironment(mats: ThreeMaterialLibrary): ArenaEnvironment {
  const group = new THREE.Group();
  const localGeos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  // Extended basalt ground plane blending seamlessly into horizon fog
  const outerGeo = new THREE.PlaneGeometry(180, 180);
  outerGeo.rotateX(-Math.PI / 2);
  localGeos.push(outerGeo);
  const outerPlane = new THREE.Mesh(outerGeo, mats.outerBasaltMat);
  outerPlane.position.y = -0.16;
  outerPlane.receiveShadow = true;
  group.add(outerPlane);

  // Chamber Floor
  const floorGeo = new THREE.PlaneGeometry(1, 1);
  floorGeo.rotateX(-Math.PI / 2);
  localGeos.push(floorGeo);
  const chamberFloor = new THREE.Mesh(floorGeo, mats.floorMat);
  chamberFloor.position.y = 0;
  chamberFloor.receiveShadow = true;
  group.add(chamberFloor);

  // Carved stone base slab
  const borderGeo = new THREE.BoxGeometry(1, 0.28, 1);
  localGeos.push(borderGeo);
  const chamberBorder = new THREE.Mesh(borderGeo, mats.stoneTrimMat);
  chamberBorder.position.y = -0.19;
  chamberBorder.receiveShadow = true;
  group.add(chamberBorder);

  // Astrolabe Focal Floor Inlay
  const astrolabeGroup = new THREE.Group();
  astrolabeGroup.position.y = 0.015;
  const ring1Geo = new THREE.RingGeometry(3.8, 3.98, 48);
  ring1Geo.rotateX(-Math.PI / 2);
  const ring2Geo = new THREE.RingGeometry(6.4, 6.56, 48);
  ring2Geo.rotateX(-Math.PI / 2);
  localGeos.push(ring1Geo, ring2Geo);

  const astrolabeMat = new THREE.MeshBasicMaterial({
    color: 0xd99b38,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  localMats.push(astrolabeMat);

  astrolabeGroup.add(new THREE.Mesh(ring1Geo, astrolabeMat));
  astrolabeGroup.add(new THREE.Mesh(ring2Geo, astrolabeMat));
  group.add(astrolabeGroup);

  const obstaclesGroup = new THREE.Group();
  const ruinRingGroup = new THREE.Group();
  group.add(obstaclesGroup);
  group.add(ruinRingGroup);

  // 3D Domain Portal Archway with sculpted stone columns & glowing rune core
  const portalGroup = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(1.55, 1.9, 0.28, 12);
  localGeos.push(baseGeo);
  const portalPad = new THREE.Mesh(baseGeo, mats.stoneTrimMat);
  portalPad.position.y = 0.14;
  portalPad.receiveShadow = true;
  portalGroup.add(portalPad);

  const archGeo = new THREE.TorusGeometry(1.6, 0.24, 8, 24, Math.PI);
  localGeos.push(archGeo);
  const arch = new THREE.Mesh(archGeo, mats.pillarMat);
  arch.position.y = 1.55;
  arch.rotation.y = Math.PI / 2;
  arch.castShadow = true;
  portalGroup.add(arch);

  const legGeo = new THREE.CylinderGeometry(0.24, 0.3, 1.55, 8);
  localGeos.push(legGeo);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, mats.pillarMat);
    leg.position.set(0, 0.78, s * 1.58);
    leg.castShadow = true;
    portalGroup.add(leg);
  }

  const coreGeo = new THREE.CircleGeometry(1.36, 28);
  localGeos.push(coreGeo);
  const portalCore = new THREE.Mesh(coreGeo, mats.portalInactiveMat);
  portalCore.position.y = 1.55;
  portalCore.rotation.y = Math.PI / 2;
  portalGroup.add(portalCore);

  const portalLight = new THREE.PointLight(0xd99b38, 0, 14);
  portalLight.position.set(-0.6, 1.65, 0);
  portalGroup.add(portalLight);
  group.add(portalGroup);

  const brazierLights: THREE.PointLight[] = [];
  let dynamicGeos: THREE.BufferGeometry[] = [];
  let dynamicMats: THREE.Material[] = [];

  const clearDynamicChildren = (target: THREE.Group) => {
    while (target.children.length > 0) {
      target.remove(target.children[0]);
    }
  };

  const configureRoom = (
    roomWidthWorld: number,
    roomHeightWorld: number,
    obstacles: ObstacleRect[],
    simTo3d: number,
    isBossRoom: boolean,
    inSanctuary: boolean,
    propRegistry?: GltfModelRegistry
  ) => {
    for (const g of dynamicGeos) g.dispose();
    for (const m of dynamicMats) m.dispose();
    dynamicGeos = [];
    dynamicMats = [];
    clearDynamicChildren(obstaclesGroup);
    clearDynamicChildren(ruinRingGroup);
    brazierLights.length = 0;

    chamberFloor.scale.set(roomWidthWorld, 1, roomHeightWorld);
    chamberBorder.scale.set(roomWidthWorld + 1.4, 1, roomHeightWorld + 1.4);
    const repX = Math.max(4, Math.round(roomWidthWorld / 5.2));
    const repY = Math.max(3, Math.round(roomHeightWorld / 5.2));
    mats.floorMat.map?.repeat.set(repX, repY);
    mats.floorMat.normalMap?.repeat.set(repX, repY);
    mats.floorMat.roughnessMap?.repeat.set(repX, repY);
    astrolabeMat.color.setHex(isBossRoom ? 0xdc2626 : 0xd99b38);
    astrolabeMat.opacity = inSanctuary || isBossRoom ? 0.44 : 0.22;

    // Obstacle Columns (KayKit Decorated Pillar .glb when loaded, procedural fallback otherwise)
    const bandMat = isBossRoom ? mats.bloodVeinMat : mats.goldMat;
    for (const ob of obstacles) {
      const w3 = ob.w * simTo3d;
      const d3 = ob.h * simTo3d;
      const rad = Math.min(w3, d3) * 0.46;
      const cx = (ob.x + ob.w * 0.5) * simTo3d - roomWidthWorld * 0.5;
      const cz = (ob.y + ob.h * 0.5) * simTo3d - roomHeightWorld * 0.5;

      const glbPillar = propRegistry?.instantiateProp('pillar', 3.9);
      if (glbPillar) {
        glbPillar.position.set(cx, 0, cz);
        obstaclesGroup.add(glbPillar);

        const bandGeo = new THREE.TorusGeometry(Math.max(0.65, rad * 0.88), 0.06, 6, 18);
        bandGeo.rotateX(Math.PI / 2);
        dynamicGeos.push(bandGeo);
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.set(cx, 2.25, cz);
        obstaclesGroup.add(band);
      } else {
        const plinthGeo = new THREE.CylinderGeometry(rad * 1.15, rad * 1.32, 0.42, 8);
        const shaftGeo = new THREE.CylinderGeometry(rad * 0.84, rad * 0.95, 3.2, 8);
        const capGeo = new THREE.CylinderGeometry(rad * 1.24, rad * 0.88, 0.36, 8);
        const bandGeo = new THREE.TorusGeometry(rad * 0.94, 0.08, 6, 16);
        bandGeo.rotateX(Math.PI / 2);
        dynamicGeos.push(plinthGeo, shaftGeo, capGeo, bandGeo);

        const pGroup = new THREE.Group();
        pGroup.position.set(cx, 0, cz);

        const plinth = new THREE.Mesh(plinthGeo, mats.stoneTrimMat);
        plinth.position.y = 0.21;
        plinth.receiveShadow = true;
        pGroup.add(plinth);

        const shaft = new THREE.Mesh(shaftGeo, mats.pillarMat);
        shaft.position.y = 2.0;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        pGroup.add(shaft);

        const cap = new THREE.Mesh(capGeo, mats.stoneTrimMat);
        cap.position.y = 3.68;
        pGroup.add(cap);

        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.y = 2.25;
        pGroup.add(band);

        obstaclesGroup.add(pGroup);
      }
    }

    // Perimeter Ruined Monoliths / Arched Dungeon Walls, Rubble & Lit Torches
    const halfW = roomWidthWorld * 0.5;
    const halfH = roomHeightWorld * 0.5;

    const wallSegGeo = new THREE.BoxGeometry(2.8, 1.15, 0.72);
    const ruinPillarGeo = new THREE.CylinderGeometry(0.45, 0.58, 3.8, 8);
    const brazierBowlGeo = new THREE.CylinderGeometry(0.48, 0.26, 0.72, 8);
    const flameGeo = new THREE.OctahedronGeometry(0.24, 0);
    const rockGeo = new THREE.DodecahedronGeometry(0.45, 0);
    dynamicGeos.push(wallSegGeo, ruinPillarGeo, brazierBowlGeo, flameGeo, rockGeo);

    const flameMat = new THREE.MeshBasicMaterial({ color: isBossRoom ? 0xef4444 : 0xf97316 });
    const flameSpriteMat = new THREE.SpriteMaterial({
      map: mats.flareTexture,
      color: isBossRoom ? 0xef4444 : 0xf97316,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dynamicMats.push(flameMat, flameSpriteMat);

    const hasWallProp = Boolean(propRegistry?.hasProp('wall'));
    const countX = 8;
    for (let i = 0; i <= countX; i++) {
      const t = -halfW + (i / countX) * roomWidthWorld;
      // North perimeter: full KayKit arched walls when loaded, else ruined monoliths
      const northArch = hasWallProp && i < countX ? propRegistry?.instantiateProp('wall', 3.4) : null;
      if (northArch) {
        northArch.position.set(t + roomWidthWorld / (countX * 2), 0, -halfH - 0.9);
        ruinRingGroup.add(northArch);
      } else {
        if (i % 2 === 0) {
          const p = new THREE.Mesh(ruinPillarGeo, mats.pillarMat);
          const hScale = 0.65 + ((i * 37) % 10) * 0.07;
          p.scale.y = hScale;
          p.position.set(t, 1.9 * hScale - 0.1, -halfH - 1.15);
          p.castShadow = true;
          ruinRingGroup.add(p);
        } else {
          const w = new THREE.Mesh(wallSegGeo, mats.stoneTrimMat);
          w.position.set(t, 0.45, -halfH - 1.15);
          ruinRingGroup.add(w);
        }
      }

      // South perimeter: keep low parapets so camera never gets occluded
      if (i % 2 === 0) {
        const w = new THREE.Mesh(wallSegGeo, mats.stoneTrimMat);
        w.position.set(t, 0.35, halfH + 1.15);
        ruinRingGroup.add(w);
      }
    }

    // Scattered Instanced Basalt Rubble outside chamber rim (28 rocks)
    const rockCount = 28;
    const rubble = new THREE.InstancedMesh(rockGeo, mats.stoneTrimMat, rockCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2;
      const rx = Math.cos(angle) * (halfW + 3.5 + (i % 4) * 1.4);
      const rz = Math.sin(angle) * (halfH + 3.2 + (i % 3) * 1.5);
      dummy.position.set(rx, -0.05, rz);
      dummy.rotation.set(i * 0.4, i * 0.9, i * 0.2);
      dummy.scale.set(0.8 + (i % 3) * 0.45, 0.6 + (i % 2) * 0.4, 0.8 + (i % 4) * 0.35);
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.computeBoundingSphere();
    ruinRingGroup.add(rubble);

    // 4 Corner Ember Braziers / Lit Torches with Warm Flickering Lights & Additive Flame Halos
    const corners: [number, number][] = [
      [-halfW + 1.9, -halfH + 1.9],
      [halfW - 1.9, -halfH + 1.9],
      [-halfW + 1.9, halfH - 1.9],
      [halfW - 1.9, halfH - 1.9],
    ];
    for (const [bx, bz] of corners) {
      const glbTorch = propRegistry?.instantiateProp('torch', 1.65);
      if (glbTorch) {
        glbTorch.position.set(bx, 0, bz);
        ruinRingGroup.add(glbTorch);
      } else {
        const bowl = new THREE.Mesh(brazierBowlGeo, mats.stoneTrimMat);
        bowl.position.set(bx, 0.36, bz);
        ruinRingGroup.add(bowl);

        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(bx, 0.88, bz);
        ruinRingGroup.add(flame);
      }

      const glow = new THREE.Sprite(flameSpriteMat);
      glow.position.set(bx, glbTorch ? 1.55 : 0.98, bz);
      glow.scale.set(2.2, 2.2, 1);
      ruinRingGroup.add(glow);

      const light = new THREE.PointLight(isBossRoom ? 0xef4444 : 0xf97316, 2.8, 17, 1.5);
      light.position.set(bx, 1.85, bz);
      ruinRingGroup.add(light);
      brazierLights.push(light);
    }
  };

  return {
    group,
    chamberFloor,
    chamberBorder,
    astrolabeGroup,
    obstaclesGroup,
    ruinRingGroup,
    portalGroup,
    portalCore,
    portalLight,
    brazierLights,
    configureRoom,
    dispose: () => {
      for (const g of localGeos) g.dispose();
      for (const g of dynamicGeos) g.dispose();
      for (const m of localMats) m.dispose();
      for (const m of dynamicMats) m.dispose();
    },
  };
}
