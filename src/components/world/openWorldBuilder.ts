import * as THREE from 'three';
import {
  BridgeDefinition,
  OpenWorldDistrictDefinition,
  OpenWorldDistrictId,
  QualityTier,
  WorldLandmarkDefinition,
} from '../../types/eduworld';
import {
  OPEN_WORLD_DISTRICTS,
  WORLD_BRIDGES,
  WORLD_LANDMARKS,
  WORLD_WATER_BODIES,
} from '../../data/openWorldData';
import { ProceduralTextureSet } from './proceduralMaterials';
import { SpatialWorldIndex } from './spatialGrid';

export interface OpenWorldChunk {
  id: OpenWorldDistrictId;
  centerX: number;
  centerZ: number;
  root: THREE.Group;
  farGroup: THREE.Group;
  nearGroup: THREE.Group;
  built: boolean;
}

export interface OpenWorldAnimatedItems {
  beacons: { mesh: THREE.Mesh; baseY: number; phase: number; landmarkId: string }[];
  dishes: THREE.Group[];
  roverGroup: THREE.Group | null;
  aiPrism: THREE.Mesh | null;
}

export interface OpenWorldHandle {
  chunks: OpenWorldChunk[];
  hitProxies: THREE.Mesh[];
  cameraOccluders: THREE.Object3D[];
  lods: THREE.LOD[];
  update: (
    playerPos: THREE.Vector3,
    elapsed: number,
    discoveredLandmarks: Set<string>,
    immediateHydrateAll?: boolean,
  ) => void;
  ensureChunkBuiltAt: (x: number, z: number) => void;
  dispose: () => void;
}

function createSignpostTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  renderer: THREE.WebGLRenderer,
  lowCostMode: boolean,
): THREE.CanvasTexture {
  const w = lowCostMode ? 256 : 512;
  const h = lowCostMode ? 128 : 256;
  const s = w / 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(s, s);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 124);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 12, 128);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(subtitle.slice(0, 26), 24, 42);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(title.slice(0, 21), 24, 82);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = lowCostMode ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function createTrackTexture(lowCostMode: boolean): THREE.CanvasTexture {
  const size = lowCostMode ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = Math.max(2, size / 85);
  for (let i = 1; i <= 4; i++) {
    const y = (i / 5) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

function createCourtTexture(lowCostMode: boolean): THREE.CanvasTexture {
  const size = lowCostMode ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = Math.max(3, size / 70);
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.08);
  ctx.lineTo(size * 0.5, size * 0.92);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.14, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildOpenWorldSystem(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  texSet: ProceduralTextureSet,
  spatialGrid: SpatialWorldIndex,
  sharedMaterials: {
    limestoneMat: THREE.MeshStandardMaterial;
    titaniumMat: THREE.MeshPhysicalMaterial;
    glassMat: THREE.MeshPhysicalMaterial;
    roofGlassMat: THREE.MeshPhysicalMaterial;
    doorGlassMat: THREE.MeshPhysicalMaterial;
    avenueMat: THREE.MeshStandardMaterial;
    curbMat: THREE.MeshStandardMaterial;
    waterMat: THREE.MeshPhysicalMaterial;
    trunkMat: THREE.MeshStandardMaterial;
    canopyMat: THREE.MeshStandardMaterial;
    treeShadowMat: THREE.MeshBasicMaterial;
    solarPanelMat: THREE.MeshPhysicalMaterial;
    roofGardenMat: THREE.MeshStandardMaterial;
  },
  isSoftwareGl: boolean,
  lowCostMode: boolean,
  qualityTier: QualityTier,
): OpenWorldHandle {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const hitProxies: THREE.Mesh[] = [];
  const cameraOccluders: THREE.Object3D[] = [];
  const lods: THREE.LOD[] = [];
  const animated: OpenWorldAnimatedItems = {
    beacons: [],
    dishes: [],
    roverGroup: null,
    aiPrism: null,
  };

  // Shared materials & reusable geometries across all 6 outer districts
  const benchWoodMat = track(new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.78, metalness: 0.06 }));
  const parkTurfMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x228b4e,
      map: texSet.grassMap,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.5,
    }),
  );
  const flowerWarmMat = track(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 }));
  const flowerPinkMat = track(new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.7 }));
  const stoneWarmMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe2d9c8,
      map: texSet.limestoneMap,
      roughness: 0.84,
      metalness: 0.04,
    }),
  );
  const darkPoleMat = track(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.36, metalness: 0.78 }));
  const lampHeadMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfde68a,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    }),
  );
  const camColliderMat = track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  const hitProxyMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const discoveredBeaconMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.3,
    }),
  );

  // Shared foliage & prop geometries
  const treeRootGeo = track(new THREE.CylinderGeometry(0.3, 0.54, 0.44, 6));
  const treeTrunkGeo = track(new THREE.CylinderGeometry(0.2, 0.32, 2.3, 7));
  const treeCanopyGeo = track(new THREE.IcosahedronGeometry(1.5, 1));
  const treeShadowGeo = track(new THREE.PlaneGeometry(3.8, 3.8));
  const lampPoleGeo = track(new THREE.CylinderGeometry(0.09, 0.14, 4.2, 7));
  const lampHeadGeo = track(new THREE.BoxGeometry(0.65, 0.1, 0.35));
  const benchSeatGeo = track(new THREE.BoxGeometry(1.7, 0.14, 0.52));
  const benchLegGeo = track(new THREE.BoxGeometry(0.14, 0.42, 0.46));
  const beaconCrystalGeo = track(new THREE.OctahedronGeometry(0.62, 0));
  const beaconPlinthGeo = track(new THREE.CylinderGeometry(1.05, 1.25, 0.65, 8));
  const beaconHitGeo = track(new THREE.CylinderGeometry(1.6, 1.6, 3.6, 8));

  const dummy = new THREE.Object3D();

  // Helper to spawn an instanced tree cluster cleanly in any district or park
  const addInstancedTrees = (parent: THREE.Group, coords: { x: number; z: number }[], scaleMult = 1.0) => {
    if (coords.length === 0) return;
    const roots = new THREE.InstancedMesh(treeRootGeo, sharedMaterials.trunkMat, coords.length);
    const trunks = new THREE.InstancedMesh(treeTrunkGeo, sharedMaterials.trunkMat, coords.length);
    const canopies = new THREE.InstancedMesh(treeCanopyGeo, sharedMaterials.canopyMat, coords.length);
    const canopiesTop = new THREE.InstancedMesh(treeCanopyGeo, sharedMaterials.canopyMat, coords.length);
    const shadows = new THREE.InstancedMesh(treeShadowGeo, sharedMaterials.treeShadowMat, coords.length);
    trunks.castShadow = !lowCostMode;
    canopies.castShadow = !lowCostMode;
    canopies.receiveShadow = true;
    canopiesTop.receiveShadow = true;

    const cMain = new THREE.Color();
    const cTop = new THREE.Color();

    coords.forEach((pt, idx) => {
      const s = (0.85 + (idx % 5) * 0.09) * scaleMult;
      const rot = idx * 0.9;

      dummy.position.set(pt.x, 0.22 * s, pt.z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      roots.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(pt.x, 1.15 * s, pt.z);
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(pt.x, 3.05 * s, pt.z);
      dummy.scale.set(s * 1.15, s * 1.08, s * 1.15);
      dummy.updateMatrix();
      canopies.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(pt.x + Math.cos(rot) * 0.42 * s, 4.1 * s, pt.z - Math.sin(rot) * 0.42 * s);
      dummy.scale.set(s * 0.8, s * 0.82, s * 0.8);
      dummy.updateMatrix();
      canopiesTop.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(pt.x, 0.028, pt.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      shadows.setMatrixAt(idx, dummy.matrix);

      const hue = 0.31 + (idx % 4) * 0.016;
      cMain.setHSL(hue, 0.54, 0.3 + (idx % 3) * 0.035);
      cTop.setHSL(hue + 0.015, 0.58, 0.38 + (idx % 3) * 0.04);
      canopies.setColorAt(idx, cMain);
      canopiesTop.setColorAt(idx, cTop);

      spatialGrid.addCircle({ x: pt.x, z: pt.z, radius: 0.45 * s, topY: 4.2 * s, walkableTop: false });
    });

    [roots, trunks, canopies, canopiesTop, shadows].forEach((im) => {
      im.computeBoundingSphere();
      parent.add(im);
    });
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    if (canopiesTop.instanceColor) canopiesTop.instanceColor.needsUpdate = true;
  };

  const addInstancedLamps = (parent: THREE.Group, pts: { x: number; z: number; yaw: number }[]) => {
    if (pts.length === 0) return;
    const poles = new THREE.InstancedMesh(lampPoleGeo, darkPoleMat, pts.length);
    const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, pts.length);
    poles.castShadow = !lowCostMode;
    pts.forEach((p, idx) => {
      dummy.position.set(p.x, 2.1, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x, 4.2, p.z);
      dummy.updateMatrix();
      heads.setMatrixAt(idx, dummy.matrix);

      spatialGrid.addCircle({ x: p.x, z: p.z, radius: 0.34, topY: 4.3, walkableTop: false });
    });
    poles.computeBoundingSphere();
    heads.computeBoundingSphere();
    parent.add(poles, heads);
  };

  const addInstancedBenches = (parent: THREE.Group, pts: { x: number; z: number; yaw: number }[]) => {
    if (pts.length === 0) return;
    const seats = new THREE.InstancedMesh(benchSeatGeo, benchWoodMat, pts.length);
    const legs = new THREE.InstancedMesh(benchLegGeo, darkPoleMat, pts.length * 2);
    seats.castShadow = !lowCostMode;
    seats.receiveShadow = true;

    pts.forEach((b, idx) => {
      dummy.position.set(b.x, 0.46, b.z);
      dummy.rotation.set(0, b.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      seats.setMatrixAt(idx, dummy.matrix);

      const cosY = Math.cos(b.yaw);
      const sinY = Math.sin(b.yaw);
      [-0.65, 0.65].forEach((lx, li) => {
        dummy.position.set(b.x + lx * cosY, 0.22, b.z - lx * sinY);
        dummy.rotation.set(0, b.yaw, 0);
        dummy.updateMatrix();
        legs.setMatrixAt(idx * 2 + li, dummy.matrix);
      });

      spatialGrid.addBox({
        x: b.x,
        z: b.z,
        halfW: 0.9,
        halfD: 0.32,
        topY: 0.56,
        baseY: 0,
        cosYaw: cosY,
        sinYaw: sinY,
        walkableTop: true,
      });
    });
    seats.computeBoundingSphere();
    legs.computeBoundingSphere();
    parent.add(seats, legs);
  };

  const addSignpost = (parent: THREE.Group, x: number, z: number, yaw: number, title: string, sub: string, hex: string) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;

    const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.1, 2.5, 8)), darkPoleMat);
    post.position.y = 1.25;
    const tex = track(createSignpostTexture(title, sub, hex, renderer, lowCostMode));
    const boardMat = track(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.28,
        roughness: 0.35,
      }),
    );
    const board = new THREE.Mesh(track(new THREE.BoxGeometry(2.1, 0.96, 0.1)), boardMat);
    board.position.y = 2.35;
    g.add(post, board);
    parent.add(g);

    spatialGrid.addCircle({ x, z, radius: 0.35, topY: 2.8, walkableTop: false });
  };

  // ============================================================================
  // PART A: SEAMLESS CONNECTING ROADS, RINGWAY, WALKWAYS, WATER & WALKABLE BRIDGES
  // ============================================================================
  const networkGroup = new THREE.Group();
  scene.add(networkGroup);

  // 1. Grand Academy Ringway (r = 106m around existing 98m Central Academy Plaza)
  const ringRoadMesh = new THREE.Mesh(
    track(new THREE.RingGeometry(102.5, 109.5, 96)),
    sharedMaterials.avenueMat,
  );
  ringRoadMesh.rotation.x = -Math.PI / 2;
  ringRoadMesh.position.y = 0.025;
  ringRoadMesh.receiveShadow = true;

  const ringCurbIn = new THREE.Mesh(
    track(new THREE.RingGeometry(101.2, 102.5, 96)),
    sharedMaterials.curbMat,
  );
  ringCurbIn.rotation.x = -Math.PI / 2;
  ringCurbIn.position.y = 0.034;

  const ringCurbOut = new THREE.Mesh(
    track(new THREE.RingGeometry(109.5, 111.0, 96)),
    sharedMaterials.curbMat,
  );
  ringCurbOut.rotation.x = -Math.PI / 2;
  ringCurbOut.position.y = 0.034;

  const ringCenterLine = new THREE.Mesh(
    track(new THREE.RingGeometry(105.85, 106.15, 96)),
    track(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.22 })),
  );
  ringCenterLine.rotation.x = -Math.PI / 2;
  ringCenterLine.position.y = 0.032;

  networkGroup.add(ringRoadMesh, ringCurbIn, ringCurbOut, ringCenterLine);

  // 2. Five Feeder Pedestrian Walkways connecting the 5 original inner districts cleanly out to the r=106m Ringway
  const feederPaths: { x1: number; z1: number; x2: number; z2: number }[] = [
    { x1: -8.0, z1: -56, x2: -8.0, z2: -104 }, // Science Spire West Corridor -> North Ringway
    { x1: 8.0, z1: -56, x2: 8.0, z2: -104 },  // Science Spire East Corridor -> North Ringway
    { x1: 52, z1: -20, x2: 102, z2: -22 },    // Logic Nexus -> East Ringway
    { x1: -54, z1: -20, x2: -102, z2: -24 },  // Humanities -> West Ringway
    { x1: 42, z1: 50, x2: 72, z2: 76 },       // Eco Sanctuary -> SE Ringway
    { x1: -22, z1: 52, x2: -40, z2: 96 },     // Civic Hub -> SW Ringway
  ];
  feederPaths.forEach((fp) => {
    const dx = fp.x2 - fp.x1;
    const dz = fp.z2 - fp.z1;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const pathMesh = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 0.03, len)), sharedMaterials.curbMat);
    pathMesh.position.set((fp.x1 + fp.x2) * 0.5, 0.026, (fp.z1 + fp.z2) * 0.5);
    pathMesh.rotation.y = yaw;
    pathMesh.receiveShadow = true;
    networkGroup.add(pathMesh);
  });

  // 3. Helper to lay paved road + raised sidewalks between any two points (skipping bridge river span if needed)
  const ringLampList: { x: number; z: number; yaw: number }[] = [];
  const addRoadSegment = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    roadWidth: number,
    lampStep = 26,
    skipGapCenter?: { x: number; z: number; halfGap: number },
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const totalLen = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const dirX = dx / totalLen;
    const dirZ = dz / totalLen;
    const perpX = Math.cos(yaw);
    const perpZ = -Math.sin(yaw);

    const buildSpan = (startT: number, endT: number) => {
      const spanLen = endT - startT;
      if (spanLen < 2) return;
      const midT = (startT + endT) * 0.5;
      const mx = x1 + dirX * midT;
      const mz = z1 + dirZ * midT;

      const road = new THREE.Mesh(track(new THREE.BoxGeometry(roadWidth, 0.05, spanLen)), sharedMaterials.avenueMat);
      road.position.set(mx, 0.025, mz);
      road.rotation.y = yaw;
      road.receiveShadow = true;

      const curbL = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.08, spanLen)), sharedMaterials.curbMat);
      curbL.position.set(mx + perpX * (roadWidth * 0.5 + 0.55), 0.04, mz + perpZ * (roadWidth * 0.5 + 0.55));
      curbL.rotation.y = yaw;
      curbL.receiveShadow = true;

      const curbR = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.08, spanLen)), sharedMaterials.curbMat);
      curbR.position.set(mx - perpX * (roadWidth * 0.5 + 0.55), 0.04, mz - perpZ * (roadWidth * 0.5 + 0.55));
      curbR.rotation.y = yaw;
      curbR.receiveShadow = true;

      networkGroup.add(road, curbL, curbR);
    };

    if (skipGapCenter) {
      const proj = (skipGapCenter.x - x1) * dirX + (skipGapCenter.z - z1) * dirZ;
      buildSpan(0, Math.max(0, proj - skipGapCenter.halfGap));
      buildSpan(Math.min(totalLen, proj + skipGapCenter.halfGap), totalLen);
    } else {
      buildSpan(0, totalLen);
    }

    // Place streetlights cleanly along outer road shoulders
    for (let t = lampStep * 0.6; t < totalLen - 14; t += lampStep) {
      const px = x1 + dirX * t;
      const pz = z1 + dirZ * t;
      if (skipGapCenter && Math.hypot(px - skipGapCenter.x, pz - skipGapCenter.z) < skipGapCenter.halfGap + 4) {
        continue;
      }
      const side = Math.round(t / lampStep) % 2 === 0 ? 1 : -1;
      ringLampList.push({
        x: px + perpX * side * (roadWidth * 0.5 + 0.72),
        z: pz + perpZ * side * (roadWidth * 0.5 + 0.72),
        yaw,
      });
    }
  };

  // 4. Radial Arterial Boulevards (from r=106m Ringway out to each of the 6 Outer Districts at r=196m)
  OPEN_WORLD_DISTRICTS.forEach((d) => {
    const dirX = Math.sin(d.angleRad);
    const dirZ = -Math.cos(d.angleRad);
    const sx = dirX * 106;
    const sz = dirZ * 106;
    const ex = d.plazaCoords.x - dirX * 17;
    const ez = d.plazaCoords.z - dirZ * 17;

    const bridge = d.id === 'eco-sanctuary-preserve' ? WORLD_BRIDGES[0] : undefined;
    addRoadSegment(sx, sz, ex, ez, 6.2, 24, bridge ? { x: bridge.x, z: bridge.z, halfGap: bridge.length * 0.5 - 1 } : undefined);

    // Ringway Gateway Signpost pointing into the Outer District
    const perpX = Math.cos(d.angleRad);
    const perpZ = Math.sin(d.angleRad);
    addSignpost(
      networkGroup,
      dirX * 114 + perpX * 5.2,
      dirZ * 114 + perpZ * 5.2,
      d.angleRad,
      d.name,
      `District ${d.number} · Open World`,
      d.accentHex,
    );
  });

  // 5. Perimeter Outer Loop Road connecting all 6 Outer Districts directly around the hexagon
  for (let i = 0; i < OPEN_WORLD_DISTRICTS.length; i++) {
    const a = OPEN_WORLD_DISTRICTS[i];
    const b = OPEN_WORLD_DISTRICTS[(i + 1) % OPEN_WORLD_DISTRICTS.length];
    const dx = b.plazaCoords.x - a.plazaCoords.x;
    const dz = b.plazaCoords.z - a.plazaCoords.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;

    const sx = a.plazaCoords.x + ux * 17.5;
    const sz = a.plazaCoords.z + uz * 17.5;
    const ex = b.plazaCoords.x - ux * 17.5;
    const ez = b.plazaCoords.z - uz * 17.5;

    let bridgeGap: { x: number; z: number; halfGap: number } | undefined;
    if (a.id === 'innovation-district' && b.id === 'eco-sanctuary-preserve') {
      bridgeGap = { x: WORLD_BRIDGES[1].x, z: WORLD_BRIDGES[1].z, halfGap: WORLD_BRIDGES[1].length * 0.5 - 1 };
    } else if (a.id === 'eco-sanctuary-preserve' && b.id === 'recreation-district') {
      bridgeGap = { x: WORLD_BRIDGES[2].x, z: WORLD_BRIDGES[2].z, halfGap: WORLD_BRIDGES[2].length * 0.5 - 1 };
    }
    addRoadSegment(sx, sz, ex, ez, 5.4, 30, bridgeGap);
  }
  addInstancedLamps(networkGroup, ringLampList);

  // 6. Solarpunk Valley River, Crystal Lake, Recreation Lagoon & Walkable Arched Bridges
  WORLD_WATER_BODIES.forEach((wb) => {
    spatialGrid.addWaterBody(wb);
    if (wb.kind === 'lake') {
      const p = wb.points[0];
      const lakeMesh = new THREE.Mesh(
        track(new THREE.CircleGeometry(wb.widthOrRadius, 40)),
        sharedMaterials.waterMat,
      );
      lakeMesh.rotation.x = -Math.PI / 2;
      lakeMesh.position.set(p.x, 0.004, p.z);
      lakeMesh.receiveShadow = true;

      const bankRim = new THREE.Mesh(
        track(new THREE.RingGeometry(wb.widthOrRadius - 0.3, wb.widthOrRadius + 1.4, 40)),
        stoneWarmMat,
      );
      bankRim.rotation.x = -Math.PI / 2;
      bankRim.position.set(p.x, 0.012, p.z);
      networkGroup.add(lakeMesh, bankRim);
    } else {
      for (let i = 0; i < wb.points.length - 1; i++) {
        const a = wb.points[i];
        const b = wb.points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const segLen = Math.hypot(dx, dz) + 4;
        const yaw = Math.atan2(dx, dz);
        const seg = new THREE.Mesh(
          track(new THREE.PlaneGeometry(wb.widthOrRadius, segLen)),
          sharedMaterials.waterMat,
        );
        seg.rotation.x = -Math.PI / 2;
        seg.rotation.z = -yaw;
        seg.position.set((a.x + b.x) * 0.5, 0.002, (a.z + b.z) * 0.5);
        seg.receiveShadow = true;

        const bank = new THREE.Mesh(
          track(new THREE.PlaneGeometry(wb.widthOrRadius + 2.6, segLen)),
          stoneWarmMat,
        );
        bank.rotation.x = -Math.PI / 2;
        bank.rotation.z = -yaw;
        bank.position.set((a.x + b.x) * 0.5, -0.006, (a.z + b.z) * 0.5);
        networkGroup.add(seg, bank);
      }
    }
  });

  // Walkable Arched Pedestrian & Road Bridges
  const buildBridgeMesh = (b: BridgeDefinition) => {
    spatialGrid.addBridge(b);
    const bg = new THREE.Group();
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = b.yaw;

    const deckMat = benchWoodMat;
    const accentMat = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(b.accentHex),
        roughness: 0.34,
        metalness: 0.5,
      }),
    );

    // Arched plank segments matching spatialGrid.getBridgeHeightAt parabola seamlessly
    const segments = 14;
    const segLen = b.length / segments;
    const segGeo = track(new THREE.BoxGeometry(b.width, 0.28, segLen + 0.14));
    const railPostGeo = track(new THREE.BoxGeometry(0.18, 1.05, 0.2));

    for (let i = 0; i < segments; i++) {
      const zCenter = -b.length * 0.5 + (i + 0.5) * segLen;
      const u = Math.min(1, Math.abs(zCenter) / (b.length * 0.5));
      const yDeck = 0.08 + b.archHeight * (1 - u * u);
      const slopeAngle = Math.atan((2 * b.archHeight * zCenter) / ((b.length * 0.5) * (b.length * 0.5)));

      const plank = new THREE.Mesh(segGeo, deckMat);
      plank.position.set(0, yDeck - 0.12, zCenter);
      plank.rotation.x = slopeAngle;
      plank.castShadow = !lowCostMode;
      plank.receiveShadow = true;
      bg.add(plank);

      if (i % 2 === 0) {
        [-1, 1].forEach((side) => {
          const post = new THREE.Mesh(railPostGeo, sharedMaterials.titaniumMat);
          post.position.set(side * (b.width * 0.5 + 0.12), yDeck + 0.45, zCenter);
          bg.add(post);
        });
      }
    }

    // Twin arched steel side trusses + solar deck lamps
    const archCurvePts: THREE.Vector3[] = [];
    for (let s = -6; s <= 6; s++) {
      const u = s / 6;
      const z = u * (b.length * 0.48);
      const y = 0.25 + (b.archHeight + 1.05) * (1 - u * u);
      archCurvePts.push(new THREE.Vector3(0, y, z));
    }
    const archCurve = new THREE.CatmullRomCurve3(archCurvePts);
    const archTubeGeo = track(new THREE.TubeGeometry(archCurve, 18, 0.14, 6, false));
    [-1, 1].forEach((side) => {
      const archMesh = new THREE.Mesh(archTubeGeo, accentMat);
      archMesh.position.x = side * (b.width * 0.5 + 0.16);
      archMesh.castShadow = !lowCostMode;
      bg.add(archMesh);
    });

    networkGroup.add(bg);
  };
  WORLD_BRIDGES.forEach(buildBridgeMesh);

  // ============================================================================
  // PART B: CHUNK-BASED PROGRESSIVE BUILDERS FOR ALL 6 OUTER WORLD DISTRICTS
  // ============================================================================
  const buildFacilityCluster = (
    d: OpenWorldDistrictDefinition,
    farGroup: THREE.Group,
    nearGroup: THREE.Group,
  ) => {
    const accentMat = track(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(d.accentHex),
        roughness: 0.28,
        metalness: 0.54,
        clearcoat: 0.4,
        envMapIntensity: 1.3,
      }),
    );

    // District Central Travertine Plaza Pad
    const pad = new THREE.Mesh(
      track(new THREE.CylinderGeometry(18.5, 19.2, 0.16, 36)),
      sharedMaterials.limestoneMat,
    );
    pad.position.set(d.plazaCoords.x, 0.08, d.plazaCoords.z);
    pad.receiveShadow = true;
    farGroup.add(pad);

    const padRing = new THREE.Mesh(
      track(new THREE.RingGeometry(17.5, 18.4, 40)),
      accentMat,
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(d.plazaCoords.x, 0.17, d.plazaCoords.z);
    farGroup.add(padRing);

    spatialGrid.addCircle({ x: d.plazaCoords.x, z: d.plazaCoords.z, radius: 18.8, topY: 0.16, walkableTop: true });

    // Build all District Facilities with THREE.LOD + Spatial OBB Colliders + Camera Anti-Clip
    d.facilities.forEach((fac) => {
      const fx = d.plazaCoords.x + fac.offsetX;
      const fz = d.plazaCoords.z + fac.offsetZ;
      const yaw = Math.atan2(d.plazaCoords.x - fx, d.plazaCoords.z - fz);

      const group = new THREE.Group();
      group.position.set(fx, 0, fz);
      group.rotation.y = yaw;

      const podiumW = fac.width + 2.2;
      const podiumD = fac.depth + 2.2;

      const hi = new THREE.Group();
      const lo = new THREE.Group();

      const podiumGeo = track(new THREE.BoxGeometry(podiumW, 0.9, podiumD));
      const bodyGeo = track(new THREE.BoxGeometry(fac.width, fac.height, fac.depth));
      const glassGeo = track(new THREE.BoxGeometry(fac.width + 0.28, fac.height * 0.72, fac.depth * 0.72));
      const glassCrossGeo = track(new THREE.BoxGeometry(fac.width * 0.72, fac.height * 0.72, fac.depth + 0.28));

      const podiumHi = new THREE.Mesh(podiumGeo, sharedMaterials.limestoneMat);
      podiumHi.position.y = 0.45;
      podiumHi.receiveShadow = true;
      podiumHi.castShadow = !lowCostMode;

      const bodyHi = new THREE.Mesh(bodyGeo, sharedMaterials.limestoneMat);
      bodyHi.position.y = 0.9 + fac.height * 0.5;
      bodyHi.castShadow = !lowCostMode;
      bodyHi.receiveShadow = true;

      const glassA = new THREE.Mesh(glassGeo, sharedMaterials.glassMat);
      glassA.position.y = 1.1 + fac.height * 0.48;
      const glassB = new THREE.Mesh(glassCrossGeo, sharedMaterials.glassMat);
      glassB.position.y = 1.1 + fac.height * 0.48;

      const portal = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 3.0, 0.9)), accentMat);
      portal.position.set(0, 2.2, fac.depth * 0.5 + 0.25);

      const door = new THREE.Mesh(track(new THREE.BoxGeometry(2.8, 2.3, 0.96)), sharedMaterials.doorGlassMat);
      door.position.set(0, 1.95, fac.depth * 0.5 + 0.28);

      const canopy = new THREE.Mesh(track(new THREE.BoxGeometry(5.2, 0.2, 1.8)), sharedMaterials.titaniumMat);
      canopy.position.set(0, 3.8, fac.depth * 0.5 + 0.75);

      const roofParapet = new THREE.Mesh(
        track(new THREE.BoxGeometry(fac.width + 0.6, 0.45, fac.depth + 0.6)),
        sharedMaterials.titaniumMat,
      );
      roofParapet.position.y = 0.9 + fac.height;

      const signTex = track(createSignpostTexture(fac.name, d.name, d.accentHex, renderer, lowCostMode));
      const signMat = track(
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: 0xffffff,
          emissiveMap: signTex,
          emissiveIntensity: 0.3,
          roughness: 0.35,
        }),
      );
      const signBoard = new THREE.Mesh(track(new THREE.PlaneGeometry(4.6, 1.35)), signMat);
      signBoard.position.set(0, 4.75, fac.depth * 0.5 + 0.28);

      hi.add(podiumHi, bodyHi, glassA, glassB, portal, door, canopy, roofParapet, signBoard);

      // Architectural Roof Crown
      const crownRadius = Math.min(fac.width, fac.depth) * 0.4;
      if (fac.roofType === 'dome') {
        const dome = new THREE.Mesh(
          track(new THREE.SphereGeometry(crownRadius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
          sharedMaterials.roofGlassMat,
        );
        dome.position.y = 0.9 + fac.height;
        const collar = new THREE.Mesh(
          track(new THREE.CylinderGeometry(crownRadius + 0.25, crownRadius + 0.45, 0.55, 20)),
          accentMat,
        );
        collar.position.y = 0.9 + fac.height + 0.22;
        hi.add(dome, collar);

        // Science Observatory telescope aperture slit + ring
        if (fac.kind === 'observatory') {
          const scope = new THREE.Mesh(track(new THREE.CylinderGeometry(0.65, 0.9, 4.2, 12)), sharedMaterials.titaniumMat);
          scope.position.set(0, 0.9 + fac.height + crownRadius * 0.75, 1.4);
          scope.rotation.x = Math.PI / 3;
          hi.add(scope);
        }
      } else if (fac.roofType === 'spire') {
        const spire = new THREE.Mesh(track(new THREE.ConeGeometry(crownRadius * 0.9, 5.2, 6)), sharedMaterials.titaniumMat);
        spire.position.y = 0.9 + fac.height + 2.6;
        const beacon = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.7, 0)), accentMat);
        beacon.position.y = 0.9 + fac.height + 5.6;
        hi.add(spire, beacon);
      } else if (fac.roofType === 'prism') {
        const prism = new THREE.Mesh(track(new THREE.OctahedronGeometry(crownRadius * 0.85, 0)), sharedMaterials.roofGlassMat);
        prism.position.y = 0.9 + fac.height + 2.2;
        const ring = new THREE.Mesh(track(new THREE.TorusGeometry(crownRadius * 0.95, 0.14, 8, 24)), accentMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.9 + fac.height + 0.45;
        hi.add(prism, ring);
      } else if (fac.roofType === 'arch') {
        const vault = new THREE.Mesh(
          track(new THREE.CylinderGeometry(fac.depth * 0.46, fac.depth * 0.46, fac.width * 0.92, 16, 1, false, 0, Math.PI)),
          sharedMaterials.roofGlassMat,
        );
        vault.rotation.z = Math.PI / 2;
        vault.position.y = 0.9 + fac.height;
        hi.add(vault);
      } else {
        const rg = new THREE.Mesh(
          track(new THREE.BoxGeometry(fac.width * 0.88, 0.45, fac.depth * 0.88)),
          sharedMaterials.roofGardenMat,
        );
        rg.position.y = 0.9 + fac.height + 0.2;
        const solar = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 0.14, 2.2)), sharedMaterials.solarPanelMat);
        solar.position.set(0, 0.9 + fac.height + 0.65, -fac.depth * 0.18);
        solar.rotation.x = 0.2;
        hi.add(rg, solar);
      }

      // Low-detail LOD level (visible beyond 72m)
      const loBody = new THREE.Mesh(bodyGeo, sharedMaterials.limestoneMat);
      loBody.position.y = 0.9 + fac.height * 0.5;
      const loGlass = new THREE.Mesh(glassGeo, sharedMaterials.glassMat);
      loGlass.position.y = 1.1 + fac.height * 0.48;
      const loCap = new THREE.Mesh(track(new THREE.BoxGeometry(fac.width * 0.7, 1.4, fac.depth * 0.7)), accentMat);
      loCap.position.y = 0.9 + fac.height + 0.7;
      lo.add(loBody, loGlass, loCap);

      const lod = new THREE.LOD();
      lod.addLevel(hi, 0);
      lod.addLevel(lo, lowCostMode ? 48 : 74);
      lods.push(lod);

      // Camera anti-clipping collider (layer 2)
      const camCol = new THREE.Mesh(
        track(new THREE.BoxGeometry(fac.width + 0.4, fac.height + 1.4, fac.depth + 0.4)),
        camColliderMat,
      );
      camCol.position.y = (fac.height + 1.4) * 0.5;
      camCol.layers.set(2);
      cameraOccluders.push(camCol);

      group.add(lod, camCol);
      farGroup.add(group);

      // Register both walkable podium & solid core tower in SpatialWorldIndex
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      spatialGrid.addBox({
        x: fx,
        z: fz,
        halfW: podiumW * 0.5 + 0.1,
        halfD: podiumD * 0.5 + 0.1,
        topY: 0.9,
        baseY: 0,
        cosYaw,
        sinYaw,
        walkableTop: true,
      });
      spatialGrid.addBox({
        x: fx,
        z: fz,
        halfW: fac.width * 0.5 + 0.15,
        halfD: fac.depth * 0.5 + 0.15,
        topY: 0.9 + fac.height,
        baseY: 0.8,
        cosYaw,
        sinYaw,
        walkableTop: false,
      });
    });

    // District Plaza Benches, Flower Planters & Central Signpost
    const benches: { x: number; z: number; yaw: number }[] = [];
    for (let b = 0; b < 4; b++) {
      const ang = (b * Math.PI) / 2 + Math.PI / 4;
      benches.push({
        x: d.plazaCoords.x + Math.cos(ang) * 14.5,
        z: d.plazaCoords.z + Math.sin(ang) * 14.5,
        yaw: -ang + Math.PI / 2,
      });
    }
    addInstancedBenches(nearGroup, benches);

    addSignpost(
      nearGroup,
      d.plazaCoords.x - Math.sin(d.angleRad) * 12,
      d.plazaCoords.z + Math.cos(d.angleRad) * 12,
      d.angleRad,
      d.name,
      d.tagline.slice(0, 26),
      d.accentHex,
    );

    // Trees & Gardens flanking district plaza
    const treeRing: { x: number; z: number }[] = [];
    const treeCount = lowCostMode ? 12 : 20;
    for (let t = 0; t < treeCount; t++) {
      const ang = (t / treeCount) * Math.PI * 2;
      const rad = t % 2 === 0 ? 34 : 44;
      const tx = d.plazaCoords.x + Math.cos(ang) * rad;
      const tz = d.plazaCoords.z + Math.sin(ang) * rad;
      // Avoid blocking roads directly at radial angle or lake water
      if (Math.hypot(tx - 46, tz - 168) < 25 || Math.hypot(tx + 124, tz - 144) < 18) continue;
      if (Math.abs(tz - 148) < 12 && Math.abs(tx) < 140) continue;
      treeRing.push({ x: tx, z: tz });
    }
    addInstancedTrees(nearGroup, treeRing, d.id === 'eco-sanctuary-preserve' ? 1.15 : 0.98);
  };

  // District-Specific Signature Landmarks (Observatory Ring, Satellite Dishes, AI Prism + Rover, Botanical Park, Sports Stadium + Courts, History Obelisk)
  const populateDistrictSignature = (
    d: OpenWorldDistrictDefinition,
    farGroup: THREE.Group,
    nearGroup: THREE.Group,
  ) => {
    const cx = d.plazaCoords.x;
    const cz = d.plazaCoords.z;

    if (d.id === 'science-district') {
      // Giant outdoor glowing Particle Accelerator Ring Arch on plaza
      const ringArch = new THREE.Mesh(
        track(new THREE.TorusGeometry(4.2, 0.26, 10, 32)),
        sharedMaterials.titaniumMat,
      );
      ringArch.position.set(cx, 3.6, cz);
      farGroup.add(ringArch);
    } else if (d.id === 'technology-district') {
      // Twin animated telemetry satellite dishes atop Networking Lab
      const dishBaseCoords = [
        { x: cx - 12, y: 14.5, z: cz - 26 },
        { x: cx + 24, y: 22.5, z: cz - 14 },
      ];
      dishBaseCoords.forEach((dc) => {
        const dg = new THREE.Group();
        dg.position.set(dc.x, dc.y, dc.z);
        const bowl = new THREE.Mesh(
          track(new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)),
          sharedMaterials.titaniumMat,
        );
        bowl.rotation.x = Math.PI * 0.72;
        const spire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.1, 1.5, 6)), sharedMaterials.titaniumMat);
        spire.position.set(0, 0.7, 0.6);
        dg.add(bowl, spire);
        farGroup.add(dg);
        animated.dishes.push(dg);
      });
    } else if (d.id === 'innovation-district') {
      // Floating Neural Prism Monument & Outdoor Autonomous Rover Proving Track
      const prism = new THREE.Mesh(
        track(new THREE.OctahedronGeometry(1.9, 0)),
        track(
          new THREE.MeshPhysicalMaterial({
            color: 0xa78bfa,
            emissive: 0x7c3aed,
            emissiveIntensity: 0.45,
            roughness: 0.1,
            clearcoat: 1.0,
          }),
        ),
      );
      prism.position.set(cx, 5.2, cz);
      farGroup.add(prism);
      animated.aiPrism = prism;

      const trackRing = new THREE.Mesh(
        track(new THREE.RingGeometry(8.5, 11.2, 36)),
        sharedMaterials.avenueMat,
      );
      trackRing.rotation.x = -Math.PI / 2;
      trackRing.position.set(cx - 18, 0.04, cz + 24);
      nearGroup.add(trackRing);

      const rover = new THREE.Group();
      const chassis = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 0.45, 1.6)), sharedMaterials.titaniumMat);
      chassis.position.y = 0.4;
      const dome = new THREE.Mesh(track(new THREE.SphereGeometry(0.42, 10, 8)), sharedMaterials.roofGlassMat);
      dome.position.set(0, 0.7, 0.1);
      rover.add(chassis, dome);
      rover.position.set(cx - 18, 0.04, cz + 14.2);
      nearGroup.add(rover);
      animated.roverGroup = rover;
    } else if (d.id === 'eco-sanctuary-preserve') {
      // Dense Botanical Forest Groves & Colorful Flower Beds around Crystal Lake
      const forestPts: { x: number; z: number }[] = [];
      const count = lowCostMode ? 28 : 48;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const rad = 52 + (i % 4) * 9;
        const tx = cx + Math.cos(ang) * rad;
        const tz = cz + Math.sin(ang) * rad;
        if (Math.hypot(tx - 46, tz - 168) < 26 || Math.abs(tz - 148) < 14 || Math.abs(tx) < 9) continue;
        forestPts.push({ x: tx, z: tz });
      }
      addInstancedTrees(nearGroup, forestPts, 1.25);

      // Decorative Garden Flower Beds
      const bedGeo = track(new THREE.CylinderGeometry(2.4, 2.6, 0.35, 12));
      const bloomGeo = track(new THREE.IcosahedronGeometry(0.45, 0));
      [
        { x: cx - 10, z: cz + 10 },
        { x: cx + 10, z: cz + 10 },
        { x: cx - 10, z: cz - 10 },
        { x: cx + 10, z: cz - 10 },
      ].forEach((bp, idx) => {
        const bed = new THREE.Mesh(bedGeo, stoneWarmMat);
        bed.position.set(bp.x, 0.25, bp.z);
        nearGroup.add(bed);
        for (let f = 0; f < 5; f++) {
          const fa = (f / 5) * Math.PI * 2;
          const bloom = new THREE.Mesh(bloomGeo, (idx + f) % 2 === 0 ? flowerWarmMat : flowerPinkMat);
          bloom.position.set(bp.x + Math.cos(fa) * 1.1, 0.58, bp.z + Math.sin(fa) * 1.1);
          nearGroup.add(bloom);
        }
        spatialGrid.addCircle({ x: bp.x, z: bp.z, radius: 2.5, topY: 0.6, walkableTop: true });
      });
    } else if (d.id === 'recreation-district') {
      // Running Track Oval + Sports Court + Parkland Sunset Amphitheater Tiers
      const trackTex = track(createTrackTexture(lowCostMode));
      const trackMat = track(new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.78 }));
      const trackOval = new THREE.Mesh(track(new THREE.RingGeometry(11.5, 16.5, 36)), trackMat);
      trackOval.rotation.x = -Math.PI / 2;
      trackOval.scale.set(1.35, 1.0, 0.9);
      trackOval.position.set(cx - 24, 0.03, cz + 22);
      farGroup.add(trackOval);

      const turfInfield = new THREE.Mesh(track(new THREE.CircleGeometry(11.5, 32)), parkTurfMat);
      turfInfield.rotation.x = -Math.PI / 2;
      turfInfield.scale.set(1.35, 1.0, 0.9);
      turfInfield.position.set(cx - 24, 0.025, cz + 22);
      farGroup.add(turfInfield);

      // Multi-Sport Court
      const courtTex = track(createCourtTexture(lowCostMode));
      const courtMat = track(new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.72 }));
      const court = new THREE.Mesh(track(new THREE.BoxGeometry(14, 0.08, 8.5)), courtMat);
      court.position.set(cx + 22, 0.04, cz + 4);
      court.receiveShadow = true;
      nearGroup.add(court);

      // Stepped Stone Amphitheater Semicircle on Recreation Plaza
      for (let tier = 0; tier < 3; tier++) {
        const arc = new THREE.Mesh(
          track(new THREE.CylinderGeometry(8 + tier * 2.2, 8 + tier * 2.2, 0.42, 18, 1, false, 0, Math.PI)),
          stoneWarmMat,
        );
        arc.position.set(cx, 0.21 + tier * 0.42, cz - 14);
        arc.rotation.y = Math.PI;
        arc.receiveShadow = true;
        nearGroup.add(arc);
      }
    } else if (d.id === 'humanities-district') {
      // Scholar Heritage Obelisk Monument & Classical Colonnade Arches
      const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 0.8, 4.2)), stoneWarmMat);
      plinth.position.set(cx, 0.4, cz);
      const obelisk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.95, 7.6, 4)), stoneWarmMat);
      obelisk.position.set(cx, 4.4, cz);
      obelisk.rotation.y = Math.PI / 4;
      const tip = new THREE.Mesh(
        track(new THREE.ConeGeometry(0.46, 1.1, 4)),
        track(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.8 })),
      );
      tip.position.set(cx, 8.75, cz);
      tip.rotation.y = Math.PI / 4;
      farGroup.add(plinth, obelisk, tip);
      spatialGrid.addCircle({ x: cx, z: cz, radius: 2.4, topY: 1.0, walkableTop: false });
    }
  };

  // Discoverable Landmark Pedestals & Holographic Beacons (2 per district = 12 total)
  const addDistrictLandmarks = (d: OpenWorldDistrictDefinition, farGroup: THREE.Group) => {
    const list: WorldLandmarkDefinition[] = WORLD_LANDMARKS.filter((lm) => lm.districtId === d.id);
    list.forEach((lm, idx) => {
      const g = new THREE.Group();
      // Place beacon right in front of the landmark plaza side so it never sits inside building massing
      const bx = lm.coords.x;
      const bz = lm.coords.z + (lm.coords.z < 0 ? 10.5 : -10.5);
      g.position.set(bx, 0, bz);

      const plinth = new THREE.Mesh(beaconPlinthGeo, sharedMaterials.limestoneMat);
      plinth.position.y = 0.32;
      plinth.receiveShadow = true;

      const beaconMat = track(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(lm.accentHex),
          emissive: new THREE.Color(lm.accentHex),
          emissiveIntensity: 0.72,
          roughness: 0.16,
          metalness: 0.35,
        }),
      );
      const crystal = new THREE.Mesh(beaconCrystalGeo, beaconMat);
      crystal.position.y = 1.65;

      const hit = new THREE.Mesh(beaconHitGeo, hitProxyMat);
      hit.position.y = 1.6;
      hit.layers.set(1);
      hit.userData = { kind: 'landmark', landmarkId: lm.id, gameId: lm.linkedGameId };
      hitProxies.push(hit);

      g.add(plinth, crystal, hit);
      farGroup.add(g);

      spatialGrid.addCircle({ x: bx, z: bz, radius: 1.25, topY: 1.0, walkableTop: true });
      animated.beacons.push({ mesh: crystal, baseY: 1.65, phase: idx * 1.4, landmarkId: lm.id });
    });
  };

  // Prepare the 6 Chunk Containers + Lazy/Progressive Builders
  const chunks: OpenWorldChunk[] = [];
  const pendingChunkBuilders: (() => void)[] = [];

  const hydrateChunk = (chunk: OpenWorldChunk, distDef: OpenWorldDistrictDefinition) => {
    if (chunk.built) return;
    chunk.built = true;
    buildFacilityCluster(distDef, chunk.farGroup, chunk.nearGroup);
    populateDistrictSignature(distDef, chunk.farGroup, chunk.nearGroup);
    addDistrictLandmarks(distDef, chunk.farGroup);
  };

  OPEN_WORLD_DISTRICTS.forEach((d, idx) => {
    const root = new THREE.Group();
    const farGroup = new THREE.Group();
    const nearGroup = new THREE.Group();
    root.add(farGroup, nearGroup);
    scene.add(root);

    const chunk: OpenWorldChunk = {
      id: d.id,
      centerX: d.plazaCoords.x,
      centerZ: d.plazaCoords.z,
      root,
      farGroup,
      nearGroup,
      built: false,
    };
    chunks.push(chunk);

    // Build Science (North) and Eco (South) immediately; progressively hydrate the remaining 4 chunks over the first few frames
    if (idx === 0 || idx === 3 || qualityTier === 'high') {
      hydrateChunk(chunk, d);
    } else {
      pendingChunkBuilders.push(() => hydrateChunk(chunk, d));
    }
  });

  const ensureChunkBuiltAt = (x: number, z: number) => {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (!c.built && Math.hypot(x - c.centerX, z - c.centerZ) < 110) {
        const def = OPEN_WORLD_DISTRICTS[i];
        hydrateChunk(c, def);
      }
    }
  };

  let lastVisCheck = -10;
  const nearCutoff = lowCostMode ? 128 : 172;
  const farCutoff = isSoftwareGl ? 320 : 420;

  const update = (
    playerPos: THREE.Vector3,
    elapsed: number,
    discoveredLandmarks: Set<string>,
    immediateHydrateAll = false,
  ) => {
    // Progressive chunk hydration (max 1 chunk per frame unless fast-traveling/forced)
    while (pendingChunkBuilders.length > 0) {
      const nextBuilder = pendingChunkBuilders.shift();
      nextBuilder?.();
      if (!immediateHydrateAll) break;
    }

    // Throttle chunk distance LOD visibility checks to ~6 Hz
    if (elapsed - lastVisCheck > 0.16) {
      lastVisCheck = elapsed;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        if (!c.built) continue;
        const d = Math.hypot(playerPos.x - c.centerX, playerPos.z - c.centerZ);
        c.farGroup.visible = d <= farCutoff;
        c.nearGroup.visible = d <= nearCutoff;
      }
    }

    // Animate landmark beacons, dishes, AI prism & autonomous proving-ground rover
    for (let i = 0; i < animated.beacons.length; i++) {
      const b = animated.beacons[i];
      b.mesh.rotation.y = elapsed * 1.4 + b.phase;
      b.mesh.position.y = b.baseY + Math.sin(elapsed * 2.2 + b.phase) * 0.14;
      if (discoveredLandmarks.has(b.landmarkId) && b.mesh.material !== discoveredBeaconMat) {
        b.mesh.material = discoveredBeaconMat;
      }
    }

    for (let i = 0; i < animated.dishes.length; i++) {
      animated.dishes[i].rotation.y = Math.sin(elapsed * 0.4 + i) * 0.55;
    }

    if (animated.aiPrism) {
      animated.aiPrism.rotation.y = elapsed * 0.8;
      animated.aiPrism.rotation.x = Math.sin(elapsed * 0.6) * 0.25;
      animated.aiPrism.position.y = 5.2 + Math.sin(elapsed * 1.8) * 0.3;
    }

    if (animated.roverGroup) {
      const a = elapsed * 0.45;
      const cx = 170 - 18;
      const cz = 98 + 24;
      animated.roverGroup.position.set(cx + Math.cos(a) * 9.8, 0.04, cz + Math.sin(a) * 9.8);
      animated.roverGroup.rotation.y = -a;
    }
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    chunks,
    hitProxies,
    cameraOccluders,
    lods,
    update,
    ensureChunkBuiltAt,
    dispose,
  };
}
