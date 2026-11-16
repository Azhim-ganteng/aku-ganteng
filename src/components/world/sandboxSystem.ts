import * as THREE from 'three';
import {
  PlacedSandboxObject,
  SandboxCatalogItem,
  SandboxTool,
} from '../../types/eduworld';
import {
  BUILD_ZONES,
  MAX_SANDBOX_ITEMS,
  SANDBOX_GRID_STEP,
  SANDBOX_ITEM_MAP,
  SANDBOX_ITEMS,
  SANDBOX_MATERIAL_VARIANTS,
  findBuildZoneAt,
} from '../../data/sandboxCatalog';
import { SpatialWorldIndex } from './spatialGrid';

export interface SandboxPlacementCandidate {
  x: number;
  y: number;
  z: number;
  rotY: number;
  valid: boolean;
  reason?: string;
  zoneId?: string;
  targetObjectId?: string;
}

export interface SandboxSystemHandle {
  syncItems: (items: PlacedSandboxObject[]) => void;
  updatePreview: (
    buildMode: boolean,
    tool: SandboxTool,
    raycaster: THREE.Raycaster,
    items: PlacedSandboxObject[],
    selectedItemId: string,
    rotY: number,
    gridSnap: boolean,
    spatialGrid: SpatialWorldIndex,
    movingObjectId?: string | null,
  ) => SandboxPlacementCandidate | null;
  pickPlacedObject: (raycaster: THREE.Raycaster) => string | null;
  getCameraOccluders: () => THREE.Object3D[];
  hidePreview: () => void;
  setZonesHighlighted: (active: boolean) => void;
  dispose: () => void;
}

const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _groundHit = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _normalMat = new THREE.Matrix3();
const _dummy = new THREE.Object3D();
const _colorTmp = new THREE.Color();

function createBlockTexture(item: SandboxCatalogItem): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = item.colorHex;
  ctx.fillRect(0, 0, 128, 128);

  if (item.id === 'block-brick') {
    ctx.strokeStyle = item.accentHex ?? '#7C2D12';
    ctx.lineWidth = 4;
    for (let y = 0; y < 128; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
      const off = (y / 32) % 2 === 0 ? 0 : 32;
      for (let x = off; x < 128; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 32);
        ctx.stroke();
      }
    }
  } else if (item.id === 'block-wood') {
    ctx.strokeStyle = item.accentHex ?? '#78350F';
    ctx.lineWidth = 3;
    for (let y = 12; y < 128; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
  } else if (item.id === 'block-grass') {
    ctx.fillStyle = '#34D399';
    ctx.fillRect(14, 14, 18, 14);
    ctx.fillRect(72, 46, 22, 16);
    ctx.fillRect(36, 86, 18, 14);
  } else if (item.id === 'block-stone' || item.id === 'block-concrete') {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 120, 120);
  } else if (item.id === 'block-deco') {
    ctx.strokeStyle = item.accentHex ?? '#0284C7';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 108, 108);
    ctx.strokeRect(32, 32, 64, 64);
  } else if (item.id === 'block-water') {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 36);
    ctx.quadraticCurveTo(40, 22, 72, 36);
    ctx.quadraticCurveTo(100, 48, 122, 36);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(10, 10, 24, 24);
    ctx.fillRect(82, 74, 20, 20);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getHalfExtents(item: SandboxCatalogItem, rotY: number): { hw: number; hh: number; hd: number } {
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  const hw = (item.size.w * c + item.size.d * s) * 0.5;
  const hd = (item.size.w * s + item.size.d * c) * 0.5;
  const hh = item.size.h * 0.5;
  return { hw, hh, hd };
}

function boxesOverlap3D(
  ax: number,
  ay: number,
  az: number,
  ahw: number,
  ahh: number,
  ahd: number,
  bx: number,
  by: number,
  bz: number,
  bhw: number,
  bhh: number,
  bhd: number,
): boolean {
  const eps = 0.08;
  return (
    Math.abs(ax - bx) < ahw + bhw - eps &&
    Math.abs(ay - by) < ahh + bhh - eps &&
    Math.abs(az - bz) < ahd + bhd - eps
  );
}

export function getSandboxSupportHeight(
  x: number,
  z: number,
  feetY: number,
  items: PlacedSandboxObject[],
): number {
  let best = 0;
  for (let i = 0; i < items.length; i++) {
    const obj = items[i];
    const def = SANDBOX_ITEM_MAP.get(obj.itemId);
    if (!def || !def.walkableTop) continue;
    const dx = x - obj.x;
    const dz = z - obj.z;
    const cosY = Math.cos(obj.rotY);
    const sinY = Math.sin(obj.rotY);
    const lx = dx * cosY - dz * sinY;
    const lz = dx * sinY + dz * cosY;
    if (Math.abs(lx) <= def.size.w * 0.5 + 0.25 && Math.abs(lz) <= def.size.d * 0.5 + 0.25) {
      let topY = obj.y + def.size.h * 0.5;
      if (obj.itemId === 'obj-stairs') {
        const u = THREE.MathUtils.clamp((lz + def.size.d * 0.5) / def.size.d, 0, 1);
        topY = obj.y - def.size.h * 0.5 + Math.max(0.45, Math.ceil(u * 4) * (def.size.h / 4));
      }
      if (feetY >= topY - 0.55 && topY > best) {
        best = topY;
      }
    }
  }
  return best;
}

export function resolveSandboxCollisions(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  playerRadius: number,
  items: PlacedSandboxObject[],
): void {
  for (let i = 0; i < items.length; i++) {
    const obj = items[i];
    const def = SANDBOX_ITEM_MAP.get(obj.itemId);
    if (!def) continue;
    // Allow walking smoothly up stairs or through decorative flowers
    if (obj.itemId === 'obj-stairs' || obj.itemId === 'obj-flower') continue;

    const baseY = obj.y - def.size.h * 0.5;
    const topY = obj.y + def.size.h * 0.5;
    if (pos.y >= topY - 0.35 || pos.y + 1.8 <= baseY) continue;

    const dx = pos.x - obj.x;
    const dz = pos.z - obj.z;
    const cosY = Math.cos(obj.rotY);
    const sinY = Math.sin(obj.rotY);
    const lx = dx * cosY - dz * sinY;
    const lz = dx * sinY + dz * cosY;
    const extW = def.size.w * 0.5 + playerRadius;
    const extD = def.size.d * 0.5 + playerRadius;

    if (Math.abs(lx) < extW && Math.abs(lz) < extD) {
      const penX = extW - Math.abs(lx);
      const penZ = extD - Math.abs(lz);
      let newLx = lx;
      let newLz = lz;
      let nx = 0;
      let nz = 0;
      if (penX < penZ) {
        const s = lx >= 0 ? 1 : -1;
        newLx = s * extW;
        nx = s * cosY;
        nz = -s * sinY;
      } else {
        const s = lz >= 0 ? 1 : -1;
        newLz = s * extD;
        nx = s * sinY;
        nz = s * cosY;
      }
      pos.x = obj.x + newLx * cosY + newLz * sinY;
      pos.z = obj.z - newLx * sinY + newLz * cosY;
      const vn = vel.x * nx + vel.z * nz;
      if (vn < 0) {
        vel.x -= vn * nx;
        vel.z -= vn * nz;
      }
    }
  }
}

export function buildSandboxSystem(
  scene: THREE.Scene,
  lowCostMode: boolean,
): SandboxSystemHandle {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  // 1. Render 6 Designated Build Zone Plots with subtle border & corner pylons
  const zoneLines: THREE.LineLoop[] = [];
  const zonePylons: THREE.Mesh[] = [];
  const zonePadMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.9,
      metalness: 0.04,
      transparent: true,
      opacity: 0.28,
    }),
  );

  BUILD_ZONES.forEach((zone) => {
    const pad = new THREE.Mesh(
      track(new THREE.PlaneGeometry(zone.halfW * 2, zone.halfD * 2)),
      zonePadMat,
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(zone.centerX, 0.015, zone.centerZ);
    pad.receiveShadow = true;
    rootGroup.add(pad);

    const pts = [
      new THREE.Vector3(-zone.halfW, 0.06, -zone.halfD),
      new THREE.Vector3(zone.halfW, 0.06, -zone.halfD),
      new THREE.Vector3(zone.halfW, 0.06, zone.halfD),
      new THREE.Vector3(-zone.halfW, 0.06, zone.halfD),
    ];
    const lineGeo = track(new THREE.BufferGeometry().setFromPoints(pts));
    const lineMat = track(
      new THREE.LineBasicMaterial({
        color: new THREE.Color(zone.accentHex),
        transparent: true,
        opacity: 0.45,
      }),
    );
    const loop = new THREE.LineLoop(lineGeo, lineMat);
    loop.position.set(zone.centerX, 0, zone.centerZ);
    rootGroup.add(loop);
    zoneLines.push(loop);

    const pylonGeo = track(new THREE.CylinderGeometry(0.24, 0.34, 1.4, 8));
    const pylonMat = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(zone.accentHex),
        emissive: new THREE.Color(zone.accentHex),
        emissiveIntensity: 0.35,
        roughness: 0.3,
      }),
    );
    [
      [-zone.halfW, -zone.halfD],
      [zone.halfW, -zone.halfD],
      [zone.halfW, zone.halfD],
      [-zone.halfW, zone.halfD],
    ].forEach(([ox, oz]) => {
      const p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(zone.centerX + ox, 0.7, zone.centerZ + oz);
      rootGroup.add(p);
      zonePylons.push(p);
    });
  });

  // 2. InstancedMesh Pools for all 9 Block Types (high performance batched draw calls)
  const blockGeo = track(new THREE.BoxGeometry(2, 2, 2));
  const blockPools = new Map<string, THREE.InstancedMesh>();
  SANDBOX_ITEMS.filter((it) => it.kind === 'block').forEach((item) => {
    const tex = track(createBlockTexture(item));
    const mat = track(
      new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        roughness: item.id === 'block-glass' || item.id === 'block-water' ? 0.14 : 0.72,
        metalness: item.id === 'block-glass' ? 0.12 : 0.05,
        transparent: Boolean(item.transparent),
        opacity: item.id === 'block-glass' ? 0.52 : item.id === 'block-water' ? 0.74 : 1.0,
      }),
    );
    const im = new THREE.InstancedMesh(blockGeo, mat, MAX_SANDBOX_ITEMS);
    im.count = 0;
    im.castShadow = !lowCostMode && !item.transparent;
    im.receiveShadow = true;
    im.frustumCulled = false;
    rootGroup.add(im);
    blockPools.set(item.id, im);
  });

  // 3. Detailed Composite Mesh Group for Non-Block Objects & Unlockables + Hit Proxies
  const objectsGroup = new THREE.Group();
  const hitProxiesGroup = new THREE.Group();
  rootGroup.add(objectsGroup, hitProxiesGroup);

  const sharedHitMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const hitBoxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const placedHitMeshes: THREE.Mesh[] = [];

  const createCompositeObject = (obj: PlacedSandboxObject, def: SandboxCatalogItem): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(obj.x, obj.y, obj.z);
    g.rotation.y = obj.rotY;

    const variant = SANDBOX_MATERIAL_VARIANTS.find((v) => v.id === obj.materialVariant);
    const mainColor = variant?.tintHex ?? def.colorHex;
    const mainMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(mainColor),
      roughness: def.transparent ? 0.18 : 0.68,
      metalness: 0.12,
      transparent: Boolean(def.transparent),
      opacity: def.transparent ? 0.62 : 1.0,
    });
    const accMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.accentHex ?? '#38BDF8'),
      roughness: 0.35,
      metalness: 0.4,
    });

    if (def.id === 'obj-door') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 0.55), accMat);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.38), mainMat);
      panel.position.y = -0.1;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), accMat);
      knob.position.set(0.5, -0.1, 0.25);
      g.add(frame, panel, knob);
    } else if (def.id === 'obj-window') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 0.42), mainMat);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.65, 0.48), accMat);
      pane.material = new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
      });
      g.add(frame, pane);
    } else if (def.id === 'obj-stairs') {
      for (let s = 0; s < 4; s++) {
        const stepH = 0.5 * (s + 1);
        const step = new THREE.Mesh(new THREE.BoxGeometry(2.0, stepH, 0.5), mainMat);
        step.position.set(0, -1.0 + stepH * 0.5, -0.75 + s * 0.5);
        step.castShadow = !lowCostMode;
        step.receiveShadow = true;
        g.add(step);
      }
    } else if (def.id === 'obj-roof') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.4, 4), mainMat);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = !lowCostMode;
      g.add(roof);
    } else if (def.id === 'obj-tree') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 2.0, 8), accMat);
      trunk.position.y = -1.1;
      const crown1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), mainMat);
      crown1.position.y = 0.55;
      const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), mainMat);
      crown2.position.y = 1.45;
      g.add(trunk, crown1, crown2);
    } else if (def.id === 'obj-lamp') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 3.8, 8), mainMat);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfde047, emissiveIntensity: 0.9 }),
      );
      glow.position.y = 1.9;
      g.add(pole, glow);
    } else if (def.id === 'obj-bench') {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.68), mainMat);
      seat.position.y = -0.05;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.12), mainMat);
      back.position.set(0, 0.25, -0.28);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.6), accMat);
      legL.position.set(-0.7, -0.25, 0);
      const legR = legL.clone();
      legR.position.x = 0.7;
      g.add(seat, back, legL, legR);
    } else if (def.id === 'obj-fence') {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), accMat);
      p1.position.x = -0.8;
      const p2 = p1.clone();
      p2.position.x = 0.8;
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.14), mainMat);
      r1.position.y = 0.28;
      const r2 = r1.clone();
      r2.position.y = -0.15;
      g.add(p1, p2, r1, r2);
    } else if (def.id === 'obj-flower') {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 0.45, 10), accMat);
      pot.position.y = -0.15;
      g.add(pot);
      for (let f = 0; f < 4; f++) {
        const a = (f / 4) * Math.PI * 2;
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), mainMat);
        fl.position.set(Math.cos(a) * 0.34, 0.22, Math.sin(a) * 0.34);
        g.add(fl);
      }
    } else if (def.id === 'obj-furniture') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.1), mainMat);
      top.position.y = 0.2;
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 0.08), accMat);
      screen.position.set(0, 0.48, -0.2);
      const legA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.9), accMat);
      legA.position.set(-0.8, -0.18, 0);
      const legB = legA.clone();
      legB.position.x = 0.8;
      g.add(top, screen, legA, legB);
    } else if (def.id === 'unlock-trophy-pedestal') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.4, 10), accMat);
      base.position.y = -0.5;
      const cup = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mainMat);
      cup.position.y = 0.65;
      g.add(base, cup);
    } else if (def.id === 'unlock-treasure-chest') {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 1.0), mainMat);
      chest.position.y = -0.15;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 10, 1, false, 0, Math.PI), accMat);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.22;
      g.add(chest, lid);
    } else if (def.id === 'unlock-holo-quiz-kiosk') {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.1), mainMat);
      plinth.position.y = -0.5;
      const holo = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.85, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 }),
      );
      holo.position.y = 0.65;
      g.add(plinth, holo);
    } else if (def.id === 'unlock-plasma-coil') {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 2.2, 12), mainMat);
      col.position.y = -0.4;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.16, 10, 20), accMat);
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 0.9;
      g.add(col, torus);
    } else if (def.id === 'unlock-server-rack') {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1.2), mainMat);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.22, 1.24),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.85 }),
      );
      stripe.position.y = 0.6;
      const stripe2 = stripe.clone();
      stripe2.position.y = -0.2;
      g.add(rack, stripe, stripe2);
    } else if (def.id === 'unlock-solar-chevron') {
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.6), mainMat);
      pL.position.set(-1.3, -0.1, 0);
      const pR = pL.clone();
      pR.position.x = 1.3;
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.65, 0.8), accMat);
      top.position.y = 1.15;
      g.add(pL, pR, top);
    } else if (def.id === 'unlock-golden-greenhouse') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), accMat);
      base.position.y = -0.85;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.08, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mainMat);
      dome.position.y = -0.6;
      g.add(base, dome);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(def.size.w, def.size.h, def.size.d), mainMat);
      g.add(box);
    }

    return g;
  };

  // 4. Translucent Green / Red Ghost Preview Mesh
  const previewMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  const previewWireMat = track(new THREE.LineBasicMaterial({ color: 0x059669 }));
  const previewGroup = new THREE.Group();
  const previewFill = new THREE.Mesh(track(new THREE.BoxGeometry(1, 1, 1)), previewMat);
  const previewEdges = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))),
    previewWireMat,
  );
  previewGroup.add(previewFill, previewEdges);
  previewGroup.visible = false;
  rootGroup.add(previewGroup);

  const syncItems = (items: PlacedSandboxObject[]) => {
    // Reset all block pool counts
    blockPools.forEach((im) => {
      im.count = 0;
    });

    // Clear previous composite meshes & hit proxies cleanly
    while (objectsGroup.children.length > 0) {
      const ch = objectsGroup.children[0];
      objectsGroup.remove(ch);
      ch.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
          else node.material.dispose();
        }
      });
    }
    while (hitProxiesGroup.children.length > 0) {
      hitProxiesGroup.remove(hitProxiesGroup.children[0]);
    }
    placedHitMeshes.length = 0;

    for (let i = 0; i < items.length && i < MAX_SANDBOX_ITEMS; i++) {
      const obj = items[i];
      const def = SANDBOX_ITEM_MAP.get(obj.itemId);
      if (!def) continue;

      if (def.kind === 'block') {
        const im = blockPools.get(def.id);
        if (im && im.count < MAX_SANDBOX_ITEMS) {
          const idx = im.count++;
          _dummy.position.set(obj.x, obj.y, obj.z);
          _dummy.rotation.set(0, obj.rotY, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          im.setMatrixAt(idx, _dummy.matrix);
          const variant = SANDBOX_MATERIAL_VARIANTS.find((v) => v.id === obj.materialVariant);
          _colorTmp.set(variant?.tintHex ?? '#FFFFFF');
          im.setColorAt(idx, _colorTmp);
        }
      } else {
        const composite = createCompositeObject(obj, def);
        objectsGroup.add(composite);
      }

      // Hit proxy for raycast stacking, moving, duplicating, removing & camera anti-clipping
      const hit = new THREE.Mesh(hitBoxGeo, sharedHitMat);
      hit.position.set(obj.x, obj.y, obj.z);
      hit.rotation.y = obj.rotY;
      hit.scale.set(def.size.w, def.size.h, def.size.d);
      hit.userData = { sandboxId: obj.id };
      if (obj.itemId !== 'obj-flower' && obj.itemId !== 'block-water') {
        hit.layers.enable(2);
      }
      hit.updateMatrixWorld();
      hitProxiesGroup.add(hit);
      placedHitMeshes.push(hit);
    }

    blockPools.forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    });
  };

  const pickPlacedObject = (raycaster: THREE.Raycaster): string | null => {
    if (placedHitMeshes.length === 0) return null;
    const hits = raycaster.intersectObjects(placedHitMeshes, false);
    if (hits.length === 0) return null;
    const sid = hits[0].object.userData?.sandboxId;
    return typeof sid === 'string' ? sid : null;
  };

  const updatePreview = (
    buildMode: boolean,
    tool: SandboxTool,
    raycaster: THREE.Raycaster,
    items: PlacedSandboxObject[],
    selectedItemId: string,
    rotY: number,
    gridSnap: boolean,
    spatialGrid: SpatialWorldIndex,
    movingObjectId: string | null = null,
  ): SandboxPlacementCandidate | null => {
    if (!buildMode) {
      previewGroup.visible = false;
      return null;
    }

    const def = SANDBOX_ITEM_MAP.get(selectedItemId);
    if (!def) {
      previewGroup.visible = false;
      return null;
    }

    // Highlight targeted object in Remove or Move(select) mode
    if (tool === 'remove' || (tool === 'move' && !movingObjectId)) {
      const targetId = pickPlacedObject(raycaster);
      const target = targetId ? items.find((it) => it.id === targetId) : null;
      const targetDef = target ? SANDBOX_ITEM_MAP.get(target.itemId) : null;
      if (target && targetDef) {
        previewGroup.visible = true;
        previewGroup.position.set(target.x, target.y, target.z);
        previewGroup.rotation.set(0, target.rotY, 0);
        previewGroup.scale.set(targetDef.size.w + 0.08, targetDef.size.h + 0.08, targetDef.size.d + 0.08);
        previewMat.color.setHex(tool === 'remove' ? 0xef4444 : 0x0284c7);
        previewWireMat.color.setHex(tool === 'remove' ? 0xdc2626 : 0x0369a1);
        return {
          x: target.x,
          y: target.y,
          z: target.z,
          rotY: target.rotY,
          valid: true,
          targetObjectId: target.id,
        };
      }
      previewGroup.visible = false;
      return null;
    }

    // Raycast against existing sandbox items first for Minecraft-style face stacking, else ground plane
    let rawX = 0;
    let rawY = def.size.h * 0.5;
    let rawZ = 0;
    let hasHit = false;

    const candidateHits =
      placedHitMeshes.length > 0
        ? raycaster
            .intersectObjects(placedHitMeshes, false)
            .filter((h) => h.object.userData?.sandboxId !== movingObjectId)
        : [];

    if (candidateHits.length > 0 && candidateHits[0].face) {
      const hit = candidateHits[0];
      const face = hit.face;
      const hitId = hit.object.userData?.sandboxId as string;
      const hitObj = items.find((it) => it.id === hitId);
      const hitDef = hitObj ? SANDBOX_ITEM_MAP.get(hitObj.itemId) : null;
      if (hitObj && hitDef && face) {
        _normalMat.getNormalMatrix(hit.object.matrixWorld);
        _worldNormal.copy(face.normal).applyMatrix3(_normalMat).normalize();
        const { hw, hh, hd } = getHalfExtents(def, rotY);
        const { hw: hhw, hh: hhh, hd: hhd } = getHalfExtents(hitDef, hitObj.rotY);

        if (Math.abs(_worldNormal.y) > 0.6) {
          rawX = hitObj.x;
          rawZ = hitObj.z;
          rawY = hitObj.y + Math.sign(_worldNormal.y) * (hhh + hh);
        } else if (Math.abs(_worldNormal.x) > Math.abs(_worldNormal.z)) {
          rawX = hitObj.x + Math.sign(_worldNormal.x) * (hhw + hw);
          rawY = hitObj.y - hhh + hh;
          rawZ = hitObj.z;
        } else {
          rawX = hitObj.x;
          rawY = hitObj.y - hhh + hh;
          rawZ = hitObj.z + Math.sign(_worldNormal.z) * (hhd + hd);
        }
        hasHit = true;
      }
    }

    if (!hasHit && raycaster.ray.intersectPlane(_groundPlane, _groundHit)) {
      rawX = _groundHit.x;
      rawZ = _groundHit.z;
      rawY = def.size.h * 0.5;
      hasHit = true;
    }

    if (!hasHit) {
      previewGroup.visible = false;
      return null;
    }

    const snapStep = gridSnap ? SANDBOX_GRID_STEP : 0.25;
    const x = Math.round(rawX / snapStep) * snapStep;
    const z = Math.round(rawZ / snapStep) * snapStep;
    const y = Math.max(def.size.h * 0.5, Math.round(rawY * 4) / 4);

    // Validate Build Zone + Item Limit + Non-overlap
    const zone = findBuildZoneAt(x, z);
    let valid = true;
    let reason: string | undefined;

    if (!zone) {
      valid = false;
      reason = 'Move cursor inside one of the 6 designated Build Zones';
    } else if (!movingObjectId && items.length >= MAX_SANDBOX_ITEMS) {
      valid = false;
      reason = `Build limit reached (${MAX_SANDBOX_ITEMS} objects max)`;
    }

    const { hw, hh, hd } = getHalfExtents(def, rotY);
    if (valid) {
      for (let i = 0; i < items.length; i++) {
        const other = items[i];
        if (other.id === movingObjectId) continue;
        const oDef = SANDBOX_ITEM_MAP.get(other.itemId);
        if (!oDef) continue;
        const oExt = getHalfExtents(oDef, other.rotY);
        if (boxesOverlap3D(x, y, z, hw, hh, hd, other.x, other.y, other.z, oExt.hw, oExt.hh, oExt.hd)) {
          valid = false;
          reason = 'Overlaps an existing placed object';
          break;
        }
      }
    }

    if (valid) {
      const nearCircles = spatialGrid.queryCircles(x, z, 4);
      for (let i = 0; i < nearCircles.length; i++) {
        const c = nearCircles[i];
        if (Math.hypot(x - c.x, z - c.z) < c.radius + Math.max(hw, hd) * 0.6) {
          valid = false;
          reason = 'Protected world landmark/tree nearby';
          break;
        }
      }
    }

    previewGroup.visible = true;
    previewGroup.position.set(x, y, z);
    previewGroup.rotation.set(0, rotY, 0);
    previewGroup.scale.set(def.size.w, def.size.h, def.size.d);
    previewMat.color.setHex(valid ? 0x10b981 : 0xef4444);
    previewWireMat.color.setHex(valid ? 0x059669 : 0xdc2626);

    return {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      z: Math.round(z * 100) / 100,
      rotY,
      valid,
      reason,
      zoneId: zone?.id,
    };
  };

  const hidePreview = () => {
    previewGroup.visible = false;
  };

  const setZonesHighlighted = (active: boolean) => {
    zonePadMat.opacity = active ? 0.55 : 0.24;
    zoneLines.forEach((loop) => {
      (loop.material as THREE.LineBasicMaterial).opacity = active ? 0.92 : 0.4;
    });
  };

  const dispose = () => {
    scene.remove(rootGroup);
    disposables.forEach((d) => d.dispose());
    blockPools.clear();
  };

  return {
    syncItems,
    updatePreview,
    pickPlacedObject,
    getCameraOccluders: () => placedHitMeshes,
    hidePreview,
    setZonesHighlighted,
    dispose,
  };
}
