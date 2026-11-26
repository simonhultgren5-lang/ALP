import * as THREE from 'three';

export interface ThreeMaterialLibrary {
  floorMat: THREE.MeshStandardMaterial;
  outerBasaltMat: THREE.MeshStandardMaterial;
  stoneTrimMat: THREE.MeshStandardMaterial;
  pillarMat: THREE.MeshStandardMaterial;
  goldMat: THREE.MeshStandardMaterial;
  obsidianPlateMat: THREE.MeshStandardMaterial;
  cloakMat: THREE.MeshStandardMaterial;
  boneMat: THREE.MeshStandardMaterial;
  bladeMetalMat: THREE.MeshStandardMaterial;
  bladeEdgeMat: THREE.MeshStandardMaterial;
  visorEmissiveMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  flareTexture: THREE.CanvasTexture;
  slashRingTexture: THREE.CanvasTexture;
  slashCrescentTexture: THREE.CanvasTexture;
  portalCoreMat: THREE.MeshStandardMaterial;
  portalInactiveMat: THREE.MeshStandardMaterial;
  aetherShellMat: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  eclipseGoldMat: THREE.MeshStandardMaterial;
  bloodVeinMat: THREE.MeshStandardMaterial;
  frostCrystalMat: THREE.MeshStandardMaterial;
  stormArcMat: THREE.MeshStandardMaterial;
  ironPlateMat: THREE.MeshStandardMaterial;
  shadeRingMat: THREE.MeshBasicMaterial;
  textures: THREE.Texture[];
  materials: THREE.Material[];
}

function createFloorTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  normal: THREE.DataTexture;
  roughness: THREE.CanvasTexture;
} {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Deep obsidian grout base
  ctx.fillStyle = '#07070b';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#181818';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#f0f0f0';
  rCtx.fillRect(0, 0, size, size);

  // Carved basalt ashlar slabs (4x4 staggered)
  const rows = 4;
  const cols = 4;
  const tileH = size / rows;
  const tileW = size / cols;

  for (let row = 0; row < rows; row++) {
    const xOffset = (row % 2) * (tileW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * tileW + xOffset;
      const y = row * tileH;
      const tone = ((row * 11 + (col + 3) * 19) % 24) - 12;
      const r = 42 + tone;
      const g = 44 + tone;
      const b = 58 + tone;

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + 5, y + 5, tileW - 10, tileH - 10);

      // Crisp upper-left stone chamfer highlight
      ctx.strokeStyle = 'rgba(175, 190, 220, 0.24)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 7, y + 7, tileW - 14, tileH - 14);

      const bVal = 175 + tone * 3;
      bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      bCtx.fillRect(x + 5, y + 5, tileW - 10, tileH - 10);

      // Beveled rim in heightfield for sharp normal edges
      bCtx.strokeStyle = '#606060';
      bCtx.lineWidth = 5;
      bCtx.strokeRect(x + 5, y + 5, tileW - 10, tileH - 10);

      const rVal = 148 + tone * 2;
      rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
      rCtx.fillRect(x + 10, y + 10, tileW - 20, tileH - 20);
    }
  }

  // Deep chiseled grout seams
  ctx.strokeStyle = '#040407';
  ctx.lineWidth = 7;
  bCtx.strokeStyle = '#080808';
  bCtx.lineWidth = 8;
  for (let row = 0; row <= rows; row++) {
    const y = row * tileH;
    for (const c of [ctx, bCtx]) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(size, y);
      c.stroke();
    }
    const xOffset = (row % 2) * (tileW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * tileW + xOffset;
      for (const c of [ctx, bCtx]) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + tileH);
        c.stroke();
      }
    }
  }

  // Stone pitting, chisel marks & weathered cracks
  for (let i = 0; i < 3200; i++) {
    const px = (i * 79 + (i % 17) * 23) % size;
    const py = (i * 149 + (i % 13) * 19) % size;
    const w = 2 + (i % 5);
    const v = i % 2 === 0 ? 18 : 68;
    ctx.fillStyle = `rgba(${v}, ${v + 2}, ${v + 10}, 0.52)`;
    ctx.fillRect(px, py, w, w);

    const bv = i % 2 === 0 ? 95 : 225;
    bCtx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.55)`;
    bCtx.fillRect(px, py, w, w);
  }

  // Inlaid bronze sigils on center of slabs
  ctx.strokeStyle = 'rgba(230, 168, 62, 0.36)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const cx = (i + 0.5) * tileW;
    const cy = (i + 0.5) * tileH;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    bCtx.strokeStyle = '#404040';
    bCtx.lineWidth = 3;
    bCtx.beginPath();
    bCtx.arc(cx, cy, 14, 0, Math.PI * 2);
    bCtx.stroke();
  }

  // Convert heightfield (bumpCanvas) to tangent-space NormalMap via Sobel operator
  const hData = bCtx.getImageData(0, 0, size, size).data;
  const nData = new Uint8Array(size * size * 4);
  const strength = 3.2;
  const sampleH = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return hData[(wy * size + wx) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sampleH(x + 1, y) - sampleH(x - 1, y)) * strength;
      const dy = (sampleH(x, y + 1) - sampleH(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const idx = (y * size + x) * 4;
      nData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nData[idx + 3] = 255;
    }
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = Math.min(8, maxAnisotropy);
  albedo.needsUpdate = true;

  const normal = new THREE.DataTexture(nData, size, size, THREE.RGBAFormat);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = Math.min(8, maxAnisotropy);
  normal.needsUpdate = true;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.anisotropy = Math.min(8, maxAnisotropy);
  roughness.needsUpdate = true;

  return { albedo, normal, roughness };
}

function createBasaltOuterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#09090d';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    const x = (i * 53) % size;
    const y = (i * 97) % size;
    const v = 8 + (i % 10);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v + 5})`;
    ctx.fillRect(x, y, 4, 4);
  }

  ctx.strokeStyle = 'rgba(28, 30, 44, 0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const y = (i * 37) % size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, (y + 43) % size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createFlareTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.22, 'rgba(255, 255, 255, 0.72)');
  grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSlashRingTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, cx * 0.56, cx, cx, cx * 0.99);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(0.82, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.92, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSlashCrescentTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;

  ctx.save();
  ctx.translate(cx, cx);
  // Draw tapered crescent facing +X (angle 0)
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const width = 3 + t * 24;
    const alpha = Math.pow(t, 1.5) * 0.16;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, cx * (0.76 + t * 0.14), -1.05 * (0.5 + t * 0.5), 1.05 * (0.5 + t * 0.5));
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createThreeMaterialLibrary(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): ThreeMaterialLibrary {
  const floorTex = createFloorTextures(maxAnisotropy);
  const basaltTex = createBasaltOuterTexture(maxAnisotropy);
  const shadowTex = createContactShadowTexture();
  const flareTexture = createFlareTexture();
  const slashRingTexture = createSlashRingTexture();
  const slashCrescentTexture = createSlashCrescentTexture();

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex.albedo,
    normalMap: floorTex.normal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: floorTex.roughness,
    color: 0xd8dced,
    roughness: 0.84,
    metalness: 0.08,
  });

  const outerBasaltMat = new THREE.MeshStandardMaterial({
    map: basaltTex,
    color: 0x7b8098,
    roughness: 0.94,
    metalness: 0.04,
  });

  const stoneTrimMat = new THREE.MeshStandardMaterial({
    color: 0x22232f,
    roughness: 0.78,
    metalness: 0.22,
  });

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x202230,
    normalMap: floorTex.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.68,
    metalness: 0.28,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe6a83e,
    roughness: 0.24,
    metalness: 0.92,
    emissive: 0x3b2204,
    emissiveIntensity: 0.5,
  });

  const obsidianPlateMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f3f,
    roughness: 0.3,
    metalness: 0.82,
  });

  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x7f161f,
    roughness: 0.88,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xd6d1c4,
    roughness: 0.72,
    metalness: 0.06,
  });

  const bladeMetalMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.95,
  });

  const bladeEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xf97316,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.3,
  });

  const visorEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.5,
    roughness: 0.2,
    metalness: 0.1,
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const portalCoreMat = new THREE.MeshStandardMaterial({
    color: 0xd99b38,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.5,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const portalInactiveMat = new THREE.MeshStandardMaterial({
    color: 0x2e2e40,
    emissive: 0x161624,
    emissiveIntensity: 0.4,
    roughness: 0.65,
    metalness: 0.4,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });

  const aetherShellMat = isSoftwareGl
    ? new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x2563eb,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.2,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0x60a5fa,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.6,
        roughness: 0.12,
        metalness: 0.05,
        transmission: 0.78,
        ior: 1.4,
        thickness: 0.4,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      });

  const eclipseGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd99b38,
    emissiveIntensity: 2.0,
    roughness: 0.22,
    metalness: 0.88,
  });

  const bloodVeinMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
    roughness: 0.28,
    metalness: 0.4,
  });

  const frostCrystalMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.4,
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  });

  const stormArcMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.18,
    metalness: 0.2,
  });

  const ironPlateMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.9,
  });

  const shadeRingMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  return {
    floorMat,
    outerBasaltMat,
    stoneTrimMat,
    pillarMat,
    goldMat,
    obsidianPlateMat,
    cloakMat,
    boneMat,
    bladeMetalMat,
    bladeEdgeMat,
    visorEmissiveMat,
    contactShadowMat,
    flareTexture,
    slashRingTexture,
    slashCrescentTexture,
    portalCoreMat,
    portalInactiveMat,
    aetherShellMat,
    eclipseGoldMat,
    bloodVeinMat,
    frostCrystalMat,
    stormArcMat,
    ironPlateMat,
    shadeRingMat,
    textures: [
      floorTex.albedo,
      floorTex.normal,
      floorTex.roughness,
      basaltTex,
      shadowTex,
      flareTexture,
      slashRingTexture,
      slashCrescentTexture,
    ],
    materials: [
      floorMat,
      outerBasaltMat,
      stoneTrimMat,
      pillarMat,
      goldMat,
      obsidianPlateMat,
      cloakMat,
      boneMat,
      bladeMetalMat,
      bladeEdgeMat,
      visorEmissiveMat,
      contactShadowMat,
      portalCoreMat,
      portalInactiveMat,
      aetherShellMat,
      eclipseGoldMat,
      bloodVeinMat,
      frostCrystalMat,
      stormArcMat,
      ironPlateMat,
      shadeRingMat,
    ],
  };
}

export function disposeThreeMaterialLibrary(lib: ThreeMaterialLibrary): void {
  for (const tex of lib.textures) tex.dispose();
  for (const mat of lib.materials) mat.dispose();
}
