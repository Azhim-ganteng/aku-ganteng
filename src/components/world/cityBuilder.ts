import * as THREE from 'three';
import { AvatarConfig, DistrictDefinition, GameDefinition, NPCDefinition, QualityTier } from '../../types/eduworld';
import { OPEN_WORLD_NPCS } from '../../data/openWorldData';
import { ProceduralTextureSet, createCityTextureSet } from './proceduralMaterials';
import { BuildingObstacleBox, LivingNpcSystemHandle, buildLivingNpcSystem } from './npcPopulation';
import { OpenWorldHandle, buildOpenWorldSystem } from './openWorldBuilder';
import { SpatialWorldIndex } from './spatialGrid';

export interface BuildingInteractable {
  game: GameDefinition;
  group: THREE.Group;
  lod: THREE.LOD;
  ringMesh: THREE.Mesh;
  hitProxy: THREE.Mesh;
  cameraCollider: THREE.Mesh;
  collisionRadius: number;
  podiumHalfW: number;
  podiumTopY: number;
  towerHalfW: number;
  towerTopY: number;
  cosYaw: number;
  sinYaw: number;
  coords: { x: number; z: number };
}

export interface NpcInteractable {
  npc: NPCDefinition;
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  coords: { x: number; z: number };
  baseY: number;
}

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
  topY: number;
  walkableTop: boolean;
}

export interface AvatarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shadowDisc: THREE.Mesh;
  suitMaterial: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  visorMaterial: THREE.MeshPhysicalMaterial;
  packGroup: THREE.Group;
  currentPackStyle: AvatarConfig['packStyle'];
  setPackStyle: (style: AvatarConfig['packStyle']) => void;
}

export interface SkyDrone {
  group: THREE.Group;
  radius: number;
  speed: number;
  height: number;
  phase: number;
}

export interface SkyCloud {
  group: THREE.Group;
  radius: number;
  speed: number;
  height: number;
  phase: number;
}

export interface CityWorldHandle {
  buildings: BuildingInteractable[];
  buildingObstacleBoxes: BuildingObstacleBox[];
  npcs: NpcInteractable[];
  livingNpcs: LivingNpcSystemHandle;
  circleObstacles: CircleObstacle[];
  cameraOccluders: THREE.Object3D[];
  lods: THREE.LOD[];
  avatar: AvatarRig;
  centralRings: THREE.Mesh[];
  drones: SkyDrone[];
  clouds: SkyCloud[];
  waterNormal: THREE.CanvasTexture;
  openWorld: OpenWorldHandle;
  spatialGrid: SpatialWorldIndex;
  triggerMotionPuff: (x: number, y: number, z: number, intensity?: number) => void;
  updateMotionPuffs: (delta: number) => void;
  updateAvatarAppearance: (config: AvatarConfig) => void;
  dispose: () => void;
}

function attachUv2(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geo.attributes.uv) {
    if (!geo.attributes.uv1) geo.setAttribute('uv1', geo.attributes.uv);
    if (!geo.attributes.uv2) geo.setAttribute('uv2', geo.attributes.uv);
  }
  return geo;
}

function createBuildingSignTexture(
  title: string,
  number: number,
  accentHex: string,
  renderer: THREE.WebGLRenderer,
  lowCostMode: boolean,
): THREE.CanvasTexture {
  const w = lowCostMode ? 512 : 1024;
  const h = lowCostMode ? 128 : 256;
  const scale = w / 512;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Deep slate backing with subtle top highlight
  const bg = ctx.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, '#1e293b');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);

  // Crisp subtle metallic border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 508, 124);

  // District accent bar
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 16, 128);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 21px system-ui, -apple-system, sans-serif';
  ctx.fillText(`MODULE ${String(number).padStart(2, '0')}`, 36, 46);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 32px system-ui, -apple-system, sans-serif';
  const clipped = title.length > 24 ? `${title.slice(0, 22)}...` : title;
  ctx.fillText(clipped, 36, 92);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = lowCostMode ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function getVisorHex(style: AvatarConfig['visorStyle']): { color: number; emissive: number } {
  switch (style) {
    case 'amber':
      return { color: 0xf59e0b, emissive: 0xb45309 };
    case 'emerald':
      return { color: 0x10b981, emissive: 0x047857 };
    case 'obsidian':
      return { color: 0x1e293b, emissive: 0x0f172a };
    case 'sky':
    default:
      return { color: 0x38bdf8, emissive: 0x0284c7 };
  }
}

export function buildAvatarRig(
  config: AvatarConfig,
  shadowMapTex?: THREE.Texture,
): AvatarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const suitMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.suitColor),
    roughness: 0.4,
    metalness: 0.16,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.accentColor),
    roughness: 0.28,
    metalness: 0.58,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.62,
    metalness: 0.28,
  });

  const visorColors = getVisorHex(config.visorStyle);
  const visorMaterial = new THREE.MeshPhysicalMaterial({
    color: visorColors.color,
    emissive: visorColors.emissive,
    emissiveIntensity: 0.35,
    roughness: 0.1,
    metalness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  // Legs (pivoted at hip)
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.45, 6, 10);
  const bootGeo = new THREE.BoxGeometry(0.28, 0.16, 0.38);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.72, 0);
  const lLegMesh = new THREE.Mesh(legGeo, darkTrimMat);
  lLegMesh.position.y = -0.3;
  lLegMesh.castShadow = true;
  const lBoot = new THREE.Mesh(bootGeo, accentMaterial);
  lBoot.position.set(0, -0.62, 0.05);
  lBoot.castShadow = true;
  leftLeg.add(lLegMesh, lBoot);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.72, 0);
  const rLegMesh = new THREE.Mesh(legGeo, darkTrimMat);
  rLegMesh.position.y = -0.3;
  rLegMesh.castShadow = true;
  const rBoot = new THREE.Mesh(bootGeo, accentMaterial);
  rBoot.position.set(0, -0.62, 0.05);
  rBoot.castShadow = true;
  rightLeg.add(rLegMesh, rBoot);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 0.4), suitMaterial);
  torso.position.y = 1.14;
  torso.castShadow = true;
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.43), accentMaterial);
  chestPlate.position.set(0, 1.24, 0.01);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.42), darkTrimMat);
  belt.position.set(0, 0.8, 0);

  // Arms (pivoted at shoulders)
  const armGeo = new THREE.CapsuleGeometry(0.11, 0.42, 6, 10);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.46, 1.45, 0);
  const lArmMesh = new THREE.Mesh(armGeo, suitMaterial);
  lArmMesh.position.y = -0.26;
  lArmMesh.castShadow = true;
  const lCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), accentMaterial);
  lCuff.position.y = -0.48;
  leftArm.add(lArmMesh, lCuff);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.46, 1.45, 0);
  const rArmMesh = new THREE.Mesh(armGeo, suitMaterial);
  rArmMesh.position.y = -0.26;
  rArmMesh.castShadow = true;
  const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), accentMaterial);
  rCuff.position.y = -0.48;
  rightArm.add(rArmMesh, rCuff);

  // Head + Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.82, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), suitMaterial);
  helmet.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.24), visorMaterial);
  visor.position.set(0, 0.02, 0.2);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42), accentMaterial);
  crest.position.set(0, 0.3, -0.02);
  headGroup.add(helmet, visor, crest);

  // Backpack / Wing Pack
  const packGroup = new THREE.Group();
  packGroup.position.set(0, 1.2, -0.26);

  const populatePack = (style: AvatarConfig['packStyle']) => {
    while (packGroup.children.length > 0) {
      const child = packGroup.children[0] as THREE.Mesh;
      packGroup.remove(child);
      child.geometry?.dispose();
    }
    if (style === 'none') return;

    if (style === 'wings') {
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.16), darkTrimMat);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.06), accentMaterial);
      wingL.position.set(-0.42, 0.08, -0.04);
      wingL.rotation.z = 0.25;
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.06), accentMaterial);
      wingR.position.set(0.42, 0.08, -0.04);
      wingR.rotation.z = -0.25;
      packGroup.add(core, wingL, wingR);
    } else if (style === 'thruster') {
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.2), darkTrimMat);
      const podL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 10), accentMaterial);
      podL.position.set(-0.14, -0.04, -0.08);
      const podR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 10), accentMaterial);
      podR.position.set(0.14, -0.04, -0.08);
      packGroup.add(core, podL, podR);
    } else {
      const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.22), accentMaterial);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.24), darkTrimMat);
      strap.position.y = 0.14;
      packGroup.add(satchel, strap);
    }
  };

  populatePack(config.packStyle);

  // Soft ground contact shadow disc beneath player (scales with jump height)
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    new THREE.MeshBasicMaterial({
      map: shadowMapTex ?? null,
      color: shadowMapTex ? 0xffffff : 0x0f172a,
      transparent: true,
      opacity: shadowMapTex ? 0.92 : 0.24,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.035;
  root.add(shadowDisc);

  bodyGroup.add(leftLeg, rightLeg, torso, chestPlate, belt, leftArm, rightArm, headGroup, packGroup);

  const rig: AvatarRig = {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shadowDisc,
    suitMaterial,
    accentMaterial,
    visorMaterial,
    packGroup,
    currentPackStyle: config.packStyle,
    setPackStyle: (style: AvatarConfig['packStyle']) => {
      if (rig.currentPackStyle === style) return;
      rig.currentPackStyle = style;
      populatePack(style);
    },
  };

  return rig;
}

function createSkyDome(): { mesh: THREE.Mesh; dispose: () => void } {
  const geo = new THREE.SphereGeometry(520, 40, 24);
  const sunDir = new THREE.Vector3(52, 68, 40).normalize();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir },
      uZenithColor: { value: new THREE.Color(0x2563eb) },
      uMidSkyColor: { value: new THREE.Color(0x7db9f5) },
      uHorizonColor: { value: new THREE.Color(0xcbe2f6) },
      uSunHaloColor: { value: new THREE.Color(0xfff5db) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform vec3 uSunDir;
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunHaloColor;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float elev = clamp(dir.y, 0.0, 1.0);
        vec3 sky = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.34, elev));
        sky = mix(sky, uZenithColor, smoothstep(0.28, 0.95, elev));

        float sunDot = max(dot(dir, uSunDir), 0.0);
        float mieGlow = pow(sunDot, 10.0) * 0.24 + pow(sunDot, 160.0) * 0.65;
        float horizonScatter = pow(1.0 - elev, 4.0) * pow(sunDot, 2.0) * 0.14;
        sky = mix(sky, uSunHaloColor, clamp(mieGlow + horizonScatter, 0.0, 0.85));

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function buildSolarpunkCity(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  games: GameDefinition[],
  districts: DistrictDefinition[],
  avatarConfig: AvatarConfig,
  isSoftwareGl: boolean,
  lowCostMode: boolean,
  qualityTier: QualityTier = 'auto',
): CityWorldHandle {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const texSet: ProceduralTextureSet = track(createCityTextureSet(renderer, lowCostMode, qualityTier));
  const circleObstacles: CircleObstacle[] = [];
  const cameraOccluders: THREE.Object3D[] = [];
  const lods: THREE.LOD[] = [];

  // 0. Atmospheric Sky Dome & Drifting Stylized Clouds
  const skyDome = track(createSkyDome());
  scene.add(skyDome.mesh);

  const clouds: SkyCloud[] = [];
  const cloudMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.12,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
      fog: true,
    }),
  );
  const cloudPuffGeo = track(new THREE.DodecahedronGeometry(3.4, 1));
  const cloudCount = lowCostMode ? 6 : 12;
  for (let i = 0; i < cloudCount; i++) {
    const cg = new THREE.Group();
    const p1 = new THREE.Mesh(cloudPuffGeo, cloudMat);
    const p2 = new THREE.Mesh(cloudPuffGeo, cloudMat);
    p2.position.set(2.8, -0.4, 0.6);
    p2.scale.setScalar(0.78);
    const p3 = new THREE.Mesh(cloudPuffGeo, cloudMat);
    p3.position.set(-2.6, -0.3, -0.5);
    p3.scale.setScalar(0.72);
    cg.add(p1, p2, p3);
    if (!lowCostMode) {
      const p4 = new THREE.Mesh(cloudPuffGeo, cloudMat);
      p4.position.set(0.6, 0.85, -0.8);
      p4.scale.setScalar(0.64);
      cg.add(p4);
    }
    cg.scale.set(1.3, 0.6, 1.0);
    scene.add(cg);
    clouds.push({
      group: cg,
      radius: 90 + (i % 4) * 38,
      speed: 0.012 + (i % 3) * 0.004,
      height: 56 + (i % 4) * 6,
      phase: (i / cloudCount) * Math.PI * 2,
    });
  }

  // 1. Extended Landscape & Coastal Horizon (600m x 600m Open-World Meadow + Outer Coastal Sea)
  const campusGroundMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.grassMap,
      normalMap: lowCostMode ? null : texSet.grassNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: texSet.grassRoughness,
      roughness: 0.94,
      metalness: 0.01,
      envMapIntensity: 0.55,
    }),
  );
  const outerGround = new THREE.Mesh(track(new THREE.CircleGeometry(520, 72)), campusGroundMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.02;
  outerGround.receiveShadow = true;
  scene.add(outerGround);

  // Glossy Reflective Coastal Water Perimeter wrapping the expanded island (r = 305..520)
  const waterMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      normalMap: texSet.waterNormal,
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughness: 0.1,
      metalness: 0.14,
      ior: 1.333,
      reflectivity: 0.92,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.55,
    }),
  );
  const waterRing = new THREE.Mesh(track(new THREE.RingGeometry(305, 520, 72)), waterMat);
  waterRing.rotation.x = -Math.PI / 2;
  waterRing.position.y = -0.005;
  waterRing.receiveShadow = true;
  scene.add(waterRing);

  // Textured Shoreline Travertine Promenade Ring at outer island coast (r = 303..305.5)
  const shoreMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdbe3eb,
      map: texSet.plazaMap,
      normalMap: lowCostMode ? null : texSet.plazaNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.8,
      metalness: 0.04,
      envMapIntensity: 0.65,
    }),
  );
  const shoreRing = new THREE.Mesh(track(new THREE.RingGeometry(303, 305.5, 72)), shoreMat);
  shoreRing.rotation.x = -Math.PI / 2;
  shoreRing.position.y = 0.005;
  shoreRing.receiveShadow = true;
  scene.add(shoreRing);

  // Low-poly distant terraced hills beyond the outer coastal water horizon
  const hillMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x7cb088,
      map: texSet.grassMap,
      normalMap: lowCostMode ? null : texSet.grassNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.5,
    }),
  );
  const hillGeo = track(new THREE.ConeGeometry(18, 16, 7));
  const hillCount = 22;
  const hillInstanced = new THREE.InstancedMesh(hillGeo, hillMat, hillCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < hillCount; i++) {
    const angle = (i / hillCount) * Math.PI * 2;
    const dist = 316 + (i % 3) * 18;
    const s = (0.85 + (i % 4) * 0.25) * 2.1;
    dummy.position.set(Math.cos(angle) * dist, 14, Math.sin(angle) * dist);
    dummy.rotation.y = angle + i;
    dummy.scale.set(s * 1.4, s, s * 1.2);
    dummy.updateMatrix();
    hillInstanced.setMatrixAt(i, dummy.matrix);
  }
  hillInstanced.computeBoundingSphere();
  scene.add(hillInstanced);

  // Main Travertine Plaza Deck with Normal + AO maps & inlaid stone compass ring
  const plazaGeo = attachUv2(track(new THREE.CircleGeometry(98, 64)));
  const plazaMat = track(
    new THREE.MeshStandardMaterial({
      map: texSet.plazaMap,
      normalMap: lowCostMode ? null : texSet.plazaNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      aoMap: texSet.plazaAo,
      aoMapIntensity: 0.78,
      roughness: 0.8,
      metalness: 0.04,
      envMapIntensity: 0.65,
    }),
  );
  const mainPlaza = new THREE.Mesh(plazaGeo, plazaMat);
  mainPlaza.rotation.x = -Math.PI / 2;
  mainPlaza.position.y = 0.01;
  mainPlaza.receiveShadow = true;
  scene.add(mainPlaza);

  const plazaBorderMat = track(
    new THREE.MeshBasicMaterial({
      map: texSet.plazaEdgeMap,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const plazaTransitionRing = new THREE.Mesh(track(new THREE.RingGeometry(96.8, 100.8, 64)), plazaBorderMat);
  plazaTransitionRing.rotation.x = -Math.PI / 2;
  plazaTransitionRing.position.y = 0.013;
  scene.add(plazaTransitionRing);

  // Subtle inlaid dark-slate compass ring around Central Astrolabe (flush with deck, zero collision)
  const plazaInlayMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.62,
      metalness: 0.16,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const centralCompassRing = new THREE.Mesh(track(new THREE.RingGeometry(10.6, 11.15, 48)), plazaInlayMat);
  centralCompassRing.rotation.x = -Math.PI / 2;
  centralCompassRing.position.y = 0.016;
  centralCompassRing.receiveShadow = true;
  scene.add(centralCompassRing);

  // 2. Radial Slate-Asphalt Boulevards + Concrete Sidewalks + Crosswalks + 5-Part Solar Lampposts
  const avenueMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.roadMap,
      normalMap: lowCostMode ? null : texSet.roadNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: texSet.roadRoughness,
      roughness: 0.82,
      aoMap: texSet.roadAo,
      aoMapIntensity: 0.85,
      metalness: 0.04,
      envMapIntensity: 0.6,
    }),
  );
  const curbMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.sidewalkMap,
      normalMap: lowCostMode ? null : texSet.sidewalkNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: texSet.sidewalkRoughness,
      roughness: 0.8,
      metalness: 0.04,
      envMapIntensity: 0.65,
    }),
  );
  const trimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.34,
      metalness: 0.54,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18,
    }),
  );
  const solarPanelMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texSet.solarPanelMap,
      normalMap: lowCostMode ? null : texSet.solarPanelNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.18,
      metalness: 0.52,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.5,
    }),
  );

  const lampPositions: { x: number; z: number; yaw: number; sideSign: number }[] = [];
  const crosswalkTransforms: { x: number; z: number; yaw: number }[] = [];

  districts.forEach((dist) => {
    const dx = dist.plazaCoords.x;
    const dz = dist.plazaCoords.z;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    const roadGroup = new THREE.Group();
    const roadGeo = attachUv2(track(new THREE.BoxGeometry(5.8, 0.04, len)));
    const roadMesh = new THREE.Mesh(roadGeo, avenueMat);
    roadMesh.position.set(dx * 0.5, 0.03, dz * 0.5);
    roadMesh.rotation.y = angle;
    roadMesh.receiveShadow = true;

    // Raised Concrete Sidewalks along left & right edges of each boulevard
    const perpX = Math.cos(angle);
    const perpZ = -Math.sin(angle);
    const dirX = dx / len;
    const dirZ = dz / len;

    const curbGeo = attachUv2(track(new THREE.BoxGeometry(0.98, 0.08, Math.max(4, len - 18))));
    const curbLeft = new THREE.Mesh(curbGeo, curbMat);
    curbLeft.position.set(dx * 0.5 + perpX * 3.38, 0.04, dz * 0.5 + perpZ * 3.38);
    curbLeft.rotation.y = angle;
    curbLeft.receiveShadow = true;

    const curbRight = new THREE.Mesh(curbGeo, curbMat);
    curbRight.position.set(dx * 0.5 - perpX * 3.38, 0.04, dz * 0.5 - perpZ * 3.38);
    curbRight.rotation.y = angle;
    curbRight.receiveShadow = true;

    const centerStrip = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 0.05, len)), trimMat);
    centerStrip.position.set(dx * 0.5, 0.035, dz * 0.5);
    centerStrip.rotation.y = angle;

    // Flush accent spoke marker on central plaza compass ring pointing toward this district
    const spokeTick = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.012, 1.35)), plazaInlayMat);
    spokeTick.position.set(dirX * 12.15, 0.017, dirZ * 12.15);
    spokeTick.rotation.y = angle;
    spokeTick.receiveShadow = true;

    // Crosswalk zebra bars near plaza entrance (r = 16.5) and district pad entry (len - 18.2)
    [16.5, len - 18.2].forEach((cwDist) => {
      for (let s = -2; s <= 2; s++) {
        if (s === 0) continue;
        const offset = s * 0.92;
        crosswalkTransforms.push({
          x: dirX * cwDist + perpX * offset,
          z: dirZ * cwDist + perpZ * offset,
          yaw: angle,
        });
      }
    });

    // District Plaza Pad (walkable/jumpable elevated stone terrace)
    const padGeo = attachUv2(track(new THREE.CylinderGeometry(16, 16.5, 0.14, 32)));
    const pad = new THREE.Mesh(
      padGeo,
      track(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: texSet.plazaMap,
          normalMap: lowCostMode ? null : texSet.plazaNormal,
          normalScale: new THREE.Vector2(0.38, 0.38),
          aoMap: texSet.plazaAo,
          aoMapIntensity: 0.62,
          roughness: 0.78,
          metalness: 0.04,
          envMapIntensity: 0.65,
        }),
      ),
    );
    pad.position.set(dx, 0.07, dz);
    pad.receiveShadow = true;

    const ring = new THREE.Mesh(
      track(new THREE.RingGeometry(15.2, 16.0, 40)),
      track(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(dist.accentHex),
          roughness: 0.35,
          metalness: 0.38,
        }),
      ),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(dx, 0.15, dz);

    roadGroup.add(roadMesh, curbLeft, curbRight, centerStrip, spokeTick, pad, ring);
    scene.add(roadGroup);

    circleObstacles.push({ x: dx, z: dz, radius: 16.2, topY: 0.14, walkableTop: true });

    // Collect solar lamp positions along the sidewalks
    for (let t = 18; t < len - 18; t += 18) {
      const sideSign = Math.round(t / 18) % 2 === 0 ? 1 : -1;
      const side = sideSign * 3.45;
      const lx = dirX * t + perpX * side;
      const lz = dirZ * t + perpZ * side;
      lampPositions.push({ x: lx, z: lz, yaw: angle, sideSign });
      circleObstacles.push({ x: lx, z: lz, radius: 0.38, topY: 4.5, walkableTop: false });
    }
  });

  // Instanced Painted Crosswalk Stripes
  if (crosswalkTransforms.length > 0) {
    const cwGeo = track(new THREE.PlaneGeometry(0.46, 2.2));
    cwGeo.rotateX(-Math.PI / 2);
    const cwMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.72,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    const cwMesh = new THREE.InstancedMesh(cwGeo, cwMat, crosswalkTransforms.length);
    cwMesh.receiveShadow = true;
    crosswalkTransforms.forEach((cw, idx) => {
      dummy.position.set(cw.x, 0.056, cw.z);
      dummy.rotation.set(0, cw.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cwMesh.setMatrixAt(idx, dummy.matrix);
    });
    cwMesh.computeBoundingSphere();
    scene.add(cwMesh);
  }

  // Instanced 5-Part Cantilevered Solar Lampposts along Boulevards
  if (lampPositions.length > 0) {
    const baseGeo = track(new THREE.CylinderGeometry(0.2, 0.28, 0.46, 8));
    const poleGeo = track(new THREE.CylinderGeometry(0.085, 0.135, 4.1, 8));
    const armGeo = track(new THREE.BoxGeometry(0.82, 0.09, 0.12));
    const capGeo = track(new THREE.BoxGeometry(0.68, 0.05, 0.44));
    const ledGeo = track(new THREE.BoxGeometry(0.56, 0.07, 0.3));

    const darkPoleMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.36,
        metalness: 0.8,
        envMapIntensity: 1.2,
      }),
    );
    const headMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        emissive: 0xfde68a,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      }),
    );

    const bases = new THREE.InstancedMesh(baseGeo, darkPoleMat, lampPositions.length);
    const poles = new THREE.InstancedMesh(poleGeo, darkPoleMat, lampPositions.length);
    const arms = new THREE.InstancedMesh(armGeo, darkPoleMat, lampPositions.length);
    const caps = new THREE.InstancedMesh(capGeo, solarPanelMat, lampPositions.length);
    const heads = new THREE.InstancedMesh(ledGeo, headMat, lampPositions.length);
    poles.castShadow = !lowCostMode;
    bases.receiveShadow = true;

    lampPositions.forEach((lp, idx) => {
      const inwardX = -Math.cos(lp.yaw) * lp.sideSign;
      const inwardZ = Math.sin(lp.yaw) * lp.sideSign;

      dummy.position.set(lp.x, 0.24, lp.z);
      dummy.rotation.set(0, lp.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bases.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(lp.x, 2.25, lp.z);
      dummy.updateMatrix();
      poles.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(lp.x + inwardX * 0.36, 4.28, lp.z + inwardZ * 0.36);
      dummy.updateMatrix();
      arms.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(lp.x + inwardX * 0.65, 4.35, lp.z + inwardZ * 0.65);
      dummy.updateMatrix();
      caps.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(lp.x + inwardX * 0.65, 4.24, lp.z + inwardZ * 0.65);
      dummy.updateMatrix();
      heads.setMatrixAt(idx, dummy.matrix);
    });
    bases.computeBoundingSphere();
    poles.computeBoundingSphere();
    arms.computeBoundingSphere();
    caps.computeBoundingSphere();
    heads.computeBoundingSphere();
    scene.add(bases, poles, arms, caps, heads);
  }

  // 3. Central Academy Astrolabe & Water Plaza
  const centralGroup = new THREE.Group();
  const stoneMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.limestoneMap,
      normalMap: lowCostMode ? null : texSet.limestoneNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: texSet.limestoneRoughness,
      aoMap: texSet.limestoneAo,
      aoMapIntensity: 0.78,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.7,
    }),
  );
  const brassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      roughness: 0.2,
      metalness: 0.88,
      clearcoat: 0.3,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.4,
    }),
  );
  const crystalMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.08,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.72,
      transparent: true,
      opacity: isSoftwareGl ? 0.58 : 0.92,
      ior: 1.5,
      clearcoat: 1.0,
      envMapIntensity: 1.4,
    }),
  );

  const basinOuter = new THREE.Mesh(attachUv2(track(new THREE.CylinderGeometry(8.5, 9.2, 0.4, 36))), stoneMat);
  basinOuter.position.y = 0.2;
  basinOuter.receiveShadow = true;
  basinOuter.castShadow = !lowCostMode;
  const basinWater = new THREE.Mesh(track(new THREE.CylinderGeometry(7.6, 7.6, 0.26, 36)), waterMat);
  basinWater.position.y = 0.28;
  basinWater.receiveShadow = true;
  const pedestal = new THREE.Mesh(attachUv2(track(new THREE.CylinderGeometry(2.1, 2.8, 2.2, 8))), stoneMat);
  pedestal.position.y = 1.1;
  pedestal.castShadow = !lowCostMode;
  pedestal.receiveShadow = true;

  // Walkable/jumpable collision circles for central plaza fountain rim & pedestal
  circleObstacles.push({ x: 0, z: 0, radius: 9.0, topY: 0.42, walkableTop: true });
  circleObstacles.push({ x: 0, z: 0, radius: 2.55, topY: 2.2, walkableTop: true });

  const orbCore = new THREE.Mesh(track(new THREE.OctahedronGeometry(1.15, 0)), crystalMat);
  orbCore.position.y = 4.2;

  const ringA = new THREE.Mesh(track(new THREE.TorusGeometry(2.3, 0.1, 12, 44)), brassMat);
  ringA.position.y = 4.2;
  const ringB = new THREE.Mesh(track(new THREE.TorusGeometry(3.0, 0.08, 12, 52)), brassMat);
  ringB.position.y = 4.2;
  ringB.rotation.x = Math.PI / 3;

  centralGroup.add(basinOuter, basinWater, pedestal, orbCore, ringA, ringB);
  scene.add(centralGroup);
  const centralRings = [ringA, ringB, orbCore];

  // Non-blocking Plaza Planter/Bench Islands strictly in the 4 inter-boulevard wedges (clearing South spawn)
  const benchWoodMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  const planterBushMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      map: texSet.foliageMap,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  const planterGeo = track(new THREE.CylinderGeometry(1.15, 1.25, 0.48, 12));
  const bushGeo = track(new THREE.IcosahedronGeometry(0.75, 1));
  const benchGeo = track(new THREE.BoxGeometry(1.3, 0.14, 0.45));
  const safePlazaAngles = [1.23, 2.48, -2.48, -1.23];
  safePlazaAngles.forEach((ang, idx) => {
    const px = Math.sin(ang) * 14.2;
    const pz = Math.cos(ang) * 14.2;
    const island = new THREE.Group();
    island.position.set(px, 0, pz);
    island.rotation.y = ang;

    const planter = new THREE.Mesh(planterGeo, stoneMat);
    planter.position.y = 0.24;
    planter.castShadow = !lowCostMode;
    planter.receiveShadow = true;

    const bushMain = new THREE.Mesh(bushGeo, planterBushMat);
    bushMain.position.set(0, 0.75, 0);
    bushMain.scale.set(1.0, 0.85, 1.0);
    bushMain.castShadow = !lowCostMode;

    const bushAccent = new THREE.Mesh(bushGeo, planterBushMat);
    bushAccent.position.set((idx % 2 === 0 ? 1 : -1) * 0.35, 0.65, 0.2);
    bushAccent.scale.set(0.62, 0.62, 0.62);

    const benchA = new THREE.Mesh(benchGeo, benchWoodMat);
    benchA.position.set(0, 0.46, 1.32);
    benchA.castShadow = !lowCostMode;
    const benchB = new THREE.Mesh(benchGeo, benchWoodMat);
    benchB.position.set(0, 0.46, -1.32);
    benchB.castShadow = !lowCostMode;

    island.add(planter, bushMain, bushAccent, benchA, benchB);
    scene.add(island);
    circleObstacles.push({ x: px, z: pz, radius: 1.55, topY: 0.56, walkableTop: true });
  });

  // 4. High-Definition Composite 20 Architectural Buildings (with LOD & exact original positions/dimensions)
  const limestoneMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.limestoneMap,
      normalMap: lowCostMode ? null : texSet.limestoneNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: texSet.limestoneRoughness,
      roughness: 0.86,
      aoMap: texSet.limestoneAo,
      aoMapIntensity: 0.9,
      metalness: 0.04,
      envMapIntensity: 0.72,
    }),
  );

  const titaniumMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x64748b,
      normalMap: lowCostMode ? null : texSet.titaniumNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughnessMap: texSet.titaniumRoughness,
      roughness: 0.3,
      metalness: 0.84,
      anisotropy: lowCostMode ? 0 : 0.72,
      clearcoat: 0.32,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.4,
    }),
  );

  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texSet.glassMap,
      normalMap: lowCostMode ? null : texSet.glassNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: texSet.glassRoughness,
      roughness: 0.14,
      metalness: 0.28,
      ior: 1.52,
      reflectivity: 0.98,
      specularIntensity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 2.2,
      emissive: 0xffffff,
      emissiveMap: texSet.glassEmissive,
      emissiveIntensity: 0.48,
    }),
  );

  const roofGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      normalMap: lowCostMode ? null : texSet.glassNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.08,
      metalness: 0.18,
      ior: 1.52,
      reflectivity: 0.96,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.85,
      transparent: true,
      opacity: 0.88,
    }),
  );

  const doorGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.06,
      metalness: 0.28,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.8,
    }),
  );

  const lobbyLightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfcd34d,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    }),
  );

  const sconceLensMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfde68a,
      emissiveIntensity: 1.1,
      roughness: 0.18,
    }),
  );

  const roofGardenMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.roofGardenMap,
      normalMap: lowCostMode ? null : texSet.roofGardenNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.86,
      envMapIntensity: 0.6,
    }),
  );

  const aoSkirtMat = track(
    new THREE.MeshBasicMaterial({
      map: texSet.buildingAoSkirtMap,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  // Shared Geometries across buildings (high memory efficiency!)
  const aoSkirtGeo = track(new THREE.PlaneGeometry(10.6, 10.6));
  const podiumGeo = attachUv2(track(new THREE.BoxGeometry(8.4, 1.0, 8.4)));
  const plinthStepGeo = attachUv2(track(new THREE.BoxGeometry(8.9, 0.28, 8.9)));
  const podiumCorniceGeo = attachUv2(track(new THREE.BoxGeometry(8.56, 0.16, 8.56)));
  const pilasterCapGeo = track(new THREE.BoxGeometry(0.68, 0.34, 0.68));
  const sconceBodyGeo = track(new THREE.BoxGeometry(0.24, 0.48, 0.24));
  const sconceLensGeo = track(new THREE.BoxGeometry(0.18, 0.36, 0.18));
  const solarSkidGeo = track(new THREE.BoxGeometry(1.7, 0.12, 1.25));
  const hitProxyGeo = track(new THREE.BoxGeometry(8.6, 16, 8.6));
  const hitProxyMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const bollardGeo = track(new THREE.CylinderGeometry(0.14, 0.16, 0.72, 8));

  const buildings: BuildingInteractable[] = [];

  games.forEach((game) => {
    const group = new THREE.Group();
    group.position.set(game.buildingCoords.x, 0, game.buildingCoords.z);

    // Preserve exact facing toward city center
    const yaw = Math.atan2(-game.buildingCoords.x, -game.buildingCoords.z);
    group.rotation.y = yaw;

    const accentMat = track(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(game.accentHex),
        normalMap: lowCostMode ? null : texSet.titaniumNormal,
        normalScale: new THREE.Vector2(0.25, 0.25),
        roughness: 0.3,
        metalness: 0.54,
        clearcoat: 0.42,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.35,
      }),
    );

    const h = game.buildingHeight;

    // Shared building geometries scoped per building height (footprints strictly unchanged)
    const towerGeo = attachUv2(track(new THREE.BoxGeometry(6.4, h, 6.4)));
    const glassCurtainZGeo = attachUv2(track(new THREE.BoxGeometry(6.6, h * 0.76, 4.2)));
    const glassCurtainXGeo = attachUv2(track(new THREE.BoxGeometry(4.2, h * 0.76, 6.6)));
    const finGeo = track(new THREE.BoxGeometry(0.45, h + 0.6, 6.8));
    const midFinGeo = track(new THREE.BoxGeometry(0.24, h * 0.82, 6.72));
    const pilasterGeo = track(new THREE.BoxGeometry(0.56, h + 0.15, 0.56));
    const roofParapetGeo = attachUv2(track(new THREE.BoxGeometry(6.78, 0.38, 6.78)));
    const atticTrimGeo = attachUv2(track(new THREE.BoxGeometry(6.94, 0.18, 6.94)));
    const spandrelGeo = attachUv2(track(new THREE.BoxGeometry(6.62, 0.24, 6.62)));
    const sunshadeZGeo = track(new THREE.BoxGeometry(4.3, 0.09, 6.96));
    const sunshadeXGeo = track(new THREE.BoxGeometry(6.96, 0.09, 4.3));

    // --- HIGH DETAIL LOD GROUP (Distance < 58m) ---
    const hiDetail = new THREE.Group();

    // Grounded Podium Ambient Occlusion Skirt
    const aoSkirt = new THREE.Mesh(aoSkirtGeo, aoSkirtMat);
    aoSkirt.rotation.x = -Math.PI / 2;
    aoSkirt.position.y = 0.025;

    // Stepped Limestone Podium + Lower Step Plinth + Podium Trim
    const plinthStep = new THREE.Mesh(plinthStepGeo, titaniumMat);
    plinthStep.position.y = 0.14;
    plinthStep.receiveShadow = true;

    const podium = new THREE.Mesh(podiumGeo, limestoneMat);
    podium.position.y = 0.5;
    podium.castShadow = !lowCostMode;
    podium.receiveShadow = true;

    const podiumCornice = new THREE.Mesh(podiumCorniceGeo, titaniumMat);
    podiumCornice.position.y = 0.96;

    // Main Architectural Core
    const tower = new THREE.Mesh(towerGeo, limestoneMat);
    tower.position.y = 1.0 + h / 2;
    tower.castShadow = !lowCostMode;
    tower.receiveShadow = true;

    // 4 Corner Pilasters with Base Plinth & Capital Trim for deep 3D architectural relief
    const cornerCoords = [
      [-2.96, -2.96],
      [2.96, -2.96],
      [-2.96, 2.96],
      [2.96, 2.96],
    ];
    cornerCoords.forEach(([cx, cz]) => {
      const pilaster = new THREE.Mesh(pilasterGeo, limestoneMat);
      pilaster.position.set(cx, 1.0 + h / 2, cz);
      pilaster.castShadow = !lowCostMode;
      pilaster.receiveShadow = true;
      const baseCap = new THREE.Mesh(pilasterCapGeo, titaniumMat);
      baseCap.position.set(cx, 1.18, cz);
      const topCap = new THREE.Mesh(pilasterCapGeo, titaniumMat);
      topCap.position.set(cx, 1.0 + h - 0.24, cz);
      hiDetail.add(pilaster, baseCap, topCap);
    });

    // Crossed Recessed Glass Curtain Columns (4-sided glazed facade with high-res mullions & selective emissive)
    const glassCurtainZ = new THREE.Mesh(glassCurtainZGeo, glassMat);
    glassCurtainZ.position.y = 1.2 + h * 0.46;
    glassCurtainZ.receiveShadow = true;
    const glassCurtainX = new THREE.Mesh(glassCurtainXGeo, glassMat);
    glassCurtainX.position.y = 1.2 + h * 0.46;
    glassCurtainX.receiveShadow = true;

    // Horizontal Architectural Spandrel Bands + Protruding 3D Brise-Soleil Sunshade Ledges
    const bandCount = Math.max(2, Math.floor(h / 3.8));
    for (let b = 1; b <= bandCount; b++) {
      const bandY = 1.0 + (b * h) / (bandCount + 1);
      const spandrel = new THREE.Mesh(spandrelGeo, titaniumMat);
      spandrel.position.y = bandY;
      hiDetail.add(spandrel);

      if (bandY > 4.2) {
        const shadeZ = new THREE.Mesh(sunshadeZGeo, titaniumMat);
        shadeZ.position.y = bandY + 0.14;
        shadeZ.castShadow = !lowCostMode;
        const shadeX = new THREE.Mesh(sunshadeXGeo, titaniumMat);
        shadeX.position.y = bandY + 0.14;
        shadeX.castShadow = !lowCostMode;
        hiDetail.add(shadeZ, shadeX);
      }
    }

    const roofParapet = new THREE.Mesh(roofParapetGeo, titaniumMat);
    roofParapet.position.y = 1.0 + h - 0.08;
    roofParapet.castShadow = !lowCostMode;
    roofParapet.receiveShadow = true;

    const atticTrim = new THREE.Mesh(atticTrimGeo, accentMat);
    atticTrim.position.y = 1.0 + h + 0.1;

    // Vertical Brushed-Titanium Louver Fins + Secondary Mid-Mullion Fins
    const finLeft = new THREE.Mesh(finGeo, titaniumMat);
    finLeft.position.set(-2.6, 1.0 + h / 2, 0);
    finLeft.castShadow = !lowCostMode;
    const finRight = new THREE.Mesh(finGeo, titaniumMat);
    finRight.position.set(2.6, 1.0 + h / 2, 0);
    finRight.castShadow = !lowCostMode;

    const midFinL = new THREE.Mesh(midFinGeo, titaniumMat);
    midFinL.position.set(-1.35, 1.0 + h * 0.46, 0);
    const midFinR = new THREE.Mesh(midFinGeo, titaniumMat);
    midFinR.position.set(1.35, 1.0 + h * 0.46, 0);

    // Entrance Portal Frame, Illuminated Lobby Doors, Canopy Downlight, Exterior Sconces & Signboard
    const portalFrame = new THREE.Mesh(track(new THREE.BoxGeometry(3.5, 2.85, 0.84)), accentMat);
    portalFrame.position.set(0, 2.22, 3.35);
    portalFrame.castShadow = !lowCostMode;

    const entryDoors = new THREE.Mesh(track(new THREE.BoxGeometry(2.5, 2.2, 0.9)), doorGlassMat);
    entryDoors.position.set(0, 2.0, 3.38);

    const lobbyGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(2.15, 1.9)), lobbyLightMat);
    lobbyGlow.position.set(0, 1.98, 3.84);

    const doorDivider = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 2.2, 0.95)), titaniumMat);
    doorDivider.position.set(0, 2.0, 3.38);

    const canopy = new THREE.Mesh(track(new THREE.BoxGeometry(4.5, 0.18, 1.48)), titaniumMat);
    canopy.position.set(0, 3.65, 3.85);
    canopy.castShadow = !lowCostMode;

    const canopyTrim = new THREE.Mesh(track(new THREE.BoxGeometry(4.56, 0.06, 1.54)), accentMat);
    canopyTrim.position.set(0, 3.74, 3.85);

    const canopyLight = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 0.04, 0.25)), sconceLensMat);
    canopyLight.position.set(0, 3.55, 4.1);

    // Twin Exterior Wall Sconce Lighting Fixtures flanking entrance
    const sconceBodyL = new THREE.Mesh(sconceBodyGeo, titaniumMat);
    sconceBodyL.position.set(-2.05, 2.65, 3.32);
    const sconceLensL = new THREE.Mesh(sconceLensGeo, sconceLensMat);
    sconceLensL.position.set(-2.05, 2.65, 3.4);

    const sconceBodyR = new THREE.Mesh(sconceBodyGeo, titaniumMat);
    sconceBodyR.position.set(2.05, 2.65, 3.32);
    const sconceLensR = new THREE.Mesh(sconceLensGeo, sconceLensMat);
    sconceLensR.position.set(2.05, 2.65, 3.4);

    const bollardL = new THREE.Mesh(bollardGeo, accentMat);
    bollardL.position.set(-2.0, 1.36, 3.85);
    const bollardR = new THREE.Mesh(bollardGeo, accentMat);
    bollardR.position.set(2.0, 1.36, 3.85);

    const signTex = track(createBuildingSignTexture(game.title, game.number, game.accentHex, renderer, lowCostMode));
    const signMat = track(
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 0.34,
        roughness: 0.32,
        metalness: 0.14,
      }),
    );
    const signBoard = new THREE.Mesh(track(new THREE.PlaneGeometry(4.2, 1.05)), signMat);
    signBoard.position.set(0, 4.38, 3.42);

    hiDetail.add(
      aoSkirt,
      plinthStep,
      podium,
      podiumCornice,
      tower,
      glassCurtainZ,
      glassCurtainX,
      roofParapet,
      atticTrim,
      finLeft,
      finRight,
      midFinL,
      midFinR,
      portalFrame,
      entryDoors,
      lobbyGlow,
      doorDivider,
      canopy,
      canopyTrim,
      canopyLight,
      sconceBodyL,
      sconceLensL,
      sconceBodyR,
      sconceLensR,
      bollardL,
      bollardR,
      signBoard,
    );

    // District-Specific Roof Crowns (High Detail — preserving exact original types & scales)
    if (game.roofType === 'dome') {
      const dome = new THREE.Mesh(
        track(new THREE.SphereGeometry(2.9, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2)),
        roofGlassMat,
      );
      dome.position.y = 1.0 + h;
      const collar = new THREE.Mesh(track(new THREE.CylinderGeometry(3.1, 3.25, 0.55, 24)), accentMat);
      collar.position.y = 1.0 + h + 0.15;
      collar.castShadow = !lowCostMode;
      const ribGeo = track(new THREE.TorusGeometry(2.92, 0.06, 6, 28, Math.PI));
      const ribA = new THREE.Mesh(ribGeo, titaniumMat);
      ribA.position.y = 1.0 + h;
      const ribB = new THREE.Mesh(ribGeo, titaniumMat);
      ribB.position.y = 1.0 + h;
      ribB.rotation.y = Math.PI / 2;
      const finial = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.12, 1.4, 8)), titaniumMat);
      finial.position.y = 1.0 + h + 3.4;

      const solarL = new THREE.Mesh(solarSkidGeo, solarPanelMat);
      solarL.position.set(-2.2, 1.0 + h + 0.25, -2.2);
      solarL.rotation.x = 0.22;
      const solarR = new THREE.Mesh(solarSkidGeo, solarPanelMat);
      solarR.position.set(2.2, 1.0 + h + 0.25, -2.2);
      solarR.rotation.x = 0.22;

      hiDetail.add(dome, collar, ribA, ribB, finial, solarL, solarR);
    } else if (game.roofType === 'spire') {
      const crown = new THREE.Mesh(track(new THREE.ConeGeometry(2.6, 4.4, 6)), titaniumMat);
      crown.position.y = 1.0 + h + 2.2;
      crown.castShadow = !lowCostMode;
      const spireCollar = new THREE.Mesh(track(new THREE.CylinderGeometry(2.85, 3.0, 0.45, 6)), accentMat);
      spireCollar.position.y = 1.0 + h + 0.22;
      const midCollar = new THREE.Mesh(track(new THREE.CylinderGeometry(1.45, 1.55, 0.25, 6)), accentMat);
      midCollar.position.y = 1.0 + h + 2.2;
      const beacon = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.65, 0)), accentMat);
      beacon.position.y = 1.0 + h + 4.8;

      const buttressGeo = track(new THREE.BoxGeometry(0.22, 1.6, 0.85));
      for (let f = 0; f < 4; f++) {
        const ang = (f * Math.PI) / 2;
        const fin = new THREE.Mesh(buttressGeo, titaniumMat);
        fin.position.set(Math.sin(ang) * 2.55, 1.0 + h + 0.85, Math.cos(ang) * 2.55);
        fin.rotation.y = ang;
        hiDetail.add(fin);
      }

      hiDetail.add(crown, spireCollar, midCollar, beacon);
    } else if (game.roofType === 'prism') {
      const prism = new THREE.Mesh(track(new THREE.OctahedronGeometry(2.4, 0)), roofGlassMat);
      prism.position.y = 1.0 + h + 1.8;
      const prismFrame = new THREE.Mesh(track(new THREE.TorusGeometry(2.4, 0.1, 8, 4)), titaniumMat);
      prismFrame.position.y = 1.0 + h + 1.8;
      prismFrame.rotation.x = Math.PI / 2;
      const prismFrameV = new THREE.Mesh(track(new THREE.TorusGeometry(2.42, 0.07, 8, 4)), titaniumMat);
      prismFrameV.position.y = 1.0 + h + 1.8;
      const baseRing = new THREE.Mesh(track(new THREE.CylinderGeometry(2.8, 3.0, 0.45, 8)), accentMat);
      baseRing.position.y = 1.0 + h + 0.22;

      const solarL = new THREE.Mesh(solarSkidGeo, solarPanelMat);
      solarL.position.set(-2.2, 1.0 + h + 0.25, -2.2);
      solarL.rotation.x = 0.22;
      const solarR = new THREE.Mesh(solarSkidGeo, solarPanelMat);
      solarR.position.set(2.2, 1.0 + h + 0.25, -2.2);
      solarR.rotation.x = 0.22;

      hiDetail.add(prism, prismFrame, prismFrameV, baseRing, solarL, solarR);
    } else {
      const roofCoping = new THREE.Mesh(attachUv2(track(new THREE.BoxGeometry(7.04, 0.22, 7.04))), limestoneMat);
      roofCoping.position.y = 1.0 + h + 0.1;
      const roofGarden = new THREE.Mesh(track(new THREE.BoxGeometry(6.8, 0.45, 6.8)), roofGardenMat);
      roofGarden.position.y = 1.0 + h + 0.22;
      roofGarden.receiveShadow = true;

      // Open 4-post slatted pergola structure so sunlight filters cleanly onto the terrace
      const postGeo = track(new THREE.BoxGeometry(0.24, 1.35, 0.24));
      [
        [-2.2, -2.2],
        [2.2, -2.2],
        [-2.2, 2.2],
        [2.2, 2.2],
      ].forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeo, titaniumMat);
        post.position.set(px, 1.0 + h + 1.05, pz);
        post.castShadow = !lowCostMode;
        hiDetail.add(post);
      });
      const slatGeo = track(new THREE.BoxGeometry(5.1, 0.12, 0.22));
      for (let s = -2; s <= 2; s++) {
        const slat = new THREE.Mesh(slatGeo, titaniumMat);
        slat.position.set(0, 1.0 + h + 1.72, s * 0.95);
        slat.castShadow = !lowCostMode;
        hiDetail.add(slat);
      }
      const pergolaRim = new THREE.Mesh(track(new THREE.BoxGeometry(5.2, 0.14, 5.2)), accentMat);
      pergolaRim.position.y = 1.0 + h + 1.82;
      pergolaRim.castShadow = !lowCostMode;
      hiDetail.add(roofCoping, roofGarden, pergolaRim);
    }

    // --- LOW DETAIL LOD GROUP (Distance >= 58m, lean geometry for performance) ---
    const loDetail = new THREE.Group();
    const loPodium = new THREE.Mesh(podiumGeo, limestoneMat);
    loPodium.position.y = 0.5;
    const loTower = new THREE.Mesh(towerGeo, limestoneMat);
    loTower.position.y = 1.0 + h / 2;
    const loCurtain = new THREE.Mesh(glassCurtainZGeo, glassMat);
    loCurtain.position.y = 1.2 + h * 0.46;
    const loPortal = new THREE.Mesh(track(new THREE.BoxGeometry(3.5, 2.85, 0.84)), accentMat);
    loPortal.position.set(0, 2.22, 3.35);
    loDetail.add(loPodium, loTower, loCurtain, loPortal);

    if (game.roofType === 'dome') {
      const d = new THREE.Mesh(track(new THREE.SphereGeometry(2.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), roofGlassMat);
      d.position.y = 1.0 + h;
      loDetail.add(d);
    } else if (game.roofType === 'spire') {
      const c = new THREE.Mesh(track(new THREE.ConeGeometry(2.6, 4.4, 6)), titaniumMat);
      c.position.y = 1.0 + h + 2.2;
      loDetail.add(c);
    } else if (game.roofType === 'prism') {
      const p = new THREE.Mesh(track(new THREE.OctahedronGeometry(2.4, 0)), roofGlassMat);
      p.position.y = 1.0 + h + 1.8;
      loDetail.add(p);
    } else {
      const rg = new THREE.Mesh(track(new THREE.BoxGeometry(6.8, 0.45, 6.8)), roofGardenMat);
      rg.position.y = 1.0 + h + 0.22;
      loDetail.add(rg);
    }

    const lod = new THREE.LOD();
    lod.addLevel(hiDetail, 0);
    lod.addLevel(loDetail, lowCostMode ? 38 : 58);
    lods.push(lod);

    // Interactive Ground Ring (always visible)
    const ringMat = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(game.accentHex),
        emissive: new THREE.Color(game.accentHex),
        emissiveIntensity: 0.25,
        roughness: 0.3,
      }),
    );
    const ringMesh = new THREE.Mesh(track(new THREE.RingGeometry(4.9, 5.4, 36)), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.06;

    // Invisible simplified raycast target on layer 1
    const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxy.position.y = 8.0;
    hitProxy.layers.set(1);
    hitProxy.userData = { kind: 'building', gameId: game.id };

    // Invisible simplified OBB mesh for camera anti-clipping raycast (layer 0, visible=false skipped by raycaster unless specifically queried via cameraOccluders, wait: Three.js Raycaster still hits visible:false? NO! Three.js Raycaster ignores visible=false meshes unless invisible or transparent! So cameraOccluders must point to tower mesh or transparent material with opacity:0! Let's use an invisible material with colorWrite:false, depthWrite:false OR point cameraOccluders at the actual `tower` & `loTower` meshes? Better yet: `MeshBasicMaterial({ colorWrite: false, depthWrite: false })` stays `visible = true` so Raycaster hits it cleanly and it draws zero pixels! Wait - even simpler: put `cameraCollider` on layer 2 with `visible: true` and `MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })`? Even better: `cameraRaycaster.layers.set(2)`!)
    const camColliderMat = track(
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
      }),
    );
    const cameraCollider = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.6, h + 1.0, 6.6)),
      camColliderMat,
    );
    cameraCollider.position.y = (h + 1.0) / 2;
    cameraCollider.layers.set(2);
    cameraOccluders.push(cameraCollider);

    group.add(lod, ringMesh, hitProxy, cameraCollider);
    scene.add(group);

    buildings.push({
      game,
      group,
      lod,
      ringMesh,
      hitProxy,
      cameraCollider,
      collisionRadius: 5.2,
      podiumHalfW: 4.35,
      podiumTopY: 1.0,
      towerHalfW: 3.35,
      towerTopY: 1.0 + h,
      cosYaw: Math.cos(yaw),
      sinYaw: Math.sin(yaw),
      coords: game.buildingCoords,
    });
  });

  // 5. Interactive AI NPCs (5 Mentors)
  const npcs: NpcInteractable[] = [];
  const npcHitGeo = track(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 10));

  districts.forEach((dist) => {
    const npc = dist.npc;
    const group = new THREE.Group();
    group.position.set(npc.coords.x, 0, npc.coords.z);
    group.rotation.y = Math.atan2(-npc.coords.x, -npc.coords.z);

    const npcAccent = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(npc.colorHex),
        roughness: 0.28,
        metalness: 0.58,
      }),
    );

    const basePad = new THREE.Mesh(attachUv2(track(new THREE.CylinderGeometry(1.15, 1.3, 0.22, 18))), stoneMat);
    basePad.position.y = 0.11;
    basePad.receiveShadow = true;
    const haloRing = new THREE.Mesh(track(new THREE.RingGeometry(1.3, 1.5, 28)), npcAccent);
    haloRing.rotation.x = -Math.PI / 2;
    haloRing.position.y = 0.14;

    const body = new THREE.Group();
    const chassis = new THREE.Mesh(track(new THREE.CylinderGeometry(0.42, 0.3, 1.0, 12)), limestoneMat);
    chassis.position.y = 1.05;
    chassis.castShadow = !lowCostMode;
    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.34, 14, 10)), limestoneMat);
    head.position.y = 1.82;
    const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.16, 0.24)), npcAccent);
    visor.position.set(0, 1.84, 0.22);
    const badge = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.2, 0)), npcAccent);
    badge.position.set(0, 2.45, 0);
    body.add(chassis, head, visor, badge);

    const hitProxy = new THREE.Mesh(npcHitGeo, hitProxyMat);
    hitProxy.position.y = 1.5;
    hitProxy.layers.set(1);
    hitProxy.userData = { kind: 'npc', npcId: npc.id };

    group.add(basePad, haloRing, body, hitProxy);
    scene.add(group);

    // NPC solid collision + walkable base pad
    circleObstacles.push({ x: npc.coords.x, z: npc.coords.z, radius: 1.25, topY: 0.22, walkableTop: true });
    circleObstacles.push({ x: npc.coords.x, z: npc.coords.z, radius: 0.55, topY: 2.3, walkableTop: false });

    npcs.push({
      npc,
      group: body,
      hitProxy,
      coords: npc.coords,
      baseY: 0,
    });
  });

  // 6. Instanced 5-Part Botanical Trees (exact positions & collision preserved) + Outer Meadow Grass Tufts
  const treePositions: { x: number; z: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const radius = i % 2 === 0 ? 22 + (i % 5) * 4 : 78 + (i % 4) * 5;
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    if (Math.abs(tx) > 5 && Math.abs(tz) > 5) {
      treePositions.push({ x: tx, z: tz });
    }
  }

  const rootCollarGeo = track(new THREE.CylinderGeometry(0.3, 0.54, 0.44, 7));
  const trunkGeo = track(new THREE.CylinderGeometry(0.2, 0.32, 2.25, 8));
  const branchGeo = track(new THREE.CylinderGeometry(0.07, 0.13, 1.35, 6));
  const trunkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.barkMap,
      normalMap: lowCostMode ? null : texSet.barkNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: texSet.barkRoughness,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.55,
    }),
  );
  const canopyGeo = track(new THREE.IcosahedronGeometry(1.48, 1));
  const canopyMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.foliageMap,
      normalMap: lowCostMode ? null : texSet.foliageNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: texSet.foliageRoughness,
      roughness: 0.82,
      metalness: 0.01,
      envMapIntensity: 0.6,
    }),
  );
  const treeShadowGeo = track(new THREE.PlaneGeometry(3.8, 3.8));
  const treeShadowMat = track(
    new THREE.MeshBasicMaterial({
      map: texSet.contactShadowMap,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const rootCollars = new THREE.InstancedMesh(rootCollarGeo, trunkMat, treePositions.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  const branchesA = new THREE.InstancedMesh(branchGeo, trunkMat, treePositions.length);
  const branchesB = new THREE.InstancedMesh(branchGeo, trunkMat, treePositions.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
  const canopiesUpper = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
  const canopiesSide = new THREE.InstancedMesh(canopyGeo, canopyMat, treePositions.length);
  const treeShadows = new THREE.InstancedMesh(treeShadowGeo, treeShadowMat, treePositions.length);
  trunks.castShadow = !lowCostMode;
  canopies.castShadow = !lowCostMode;
  canopies.receiveShadow = true;
  canopiesUpper.castShadow = !lowCostMode;
  canopiesUpper.receiveShadow = true;
  canopiesSide.castShadow = !lowCostMode;
  canopiesSide.receiveShadow = true;
  const treeColor = new THREE.Color();
  const treeUpperColor = new THREE.Color();
  const treeSideColor = new THREE.Color();

  treePositions.forEach((pos, idx) => {
    const scale = 0.85 + (idx % 5) * 0.08;
    const rotY = idx * 0.7;

    dummy.position.set(pos.x, 0.22 * scale, pos.z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    rootCollars.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x, 1.12 * scale, pos.z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);

    const sideX = Math.cos(rotY);
    const sideZ = -Math.sin(rotY);

    dummy.position.set(pos.x + sideX * 0.42 * scale, 2.35 * scale, pos.z + sideZ * 0.42 * scale);
    dummy.rotation.set(0, rotY, -0.58);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    branchesA.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x - sideX * 0.38 * scale, 2.25 * scale, pos.z - sideZ * 0.38 * scale);
    dummy.rotation.set(0, rotY, 0.56);
    dummy.scale.set(scale * 0.9, scale * 0.9, scale * 0.9);
    dummy.updateMatrix();
    branchesB.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x, 3.05 * scale, pos.z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(scale * 1.12, scale * 1.1, scale * 1.12);
    dummy.updateMatrix();
    canopies.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x + sideX * 0.45 * scale, 4.18 * scale, pos.z + sideZ * 0.45 * scale);
    dummy.rotation.set(0, idx * 1.15, 0);
    dummy.scale.set(scale * 0.82, scale * 0.84, scale * 0.82);
    dummy.updateMatrix();
    canopiesUpper.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x - sideX * 0.72 * scale, 3.32 * scale, pos.z - sideZ * 0.72 * scale);
    dummy.rotation.set(0, idx * 1.8, 0);
    dummy.scale.set(scale * 0.74, scale * 0.72, scale * 0.74);
    dummy.updateMatrix();
    canopiesSide.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x, 0.028, pos.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(scale, scale, 1);
    dummy.updateMatrix();
    treeShadows.setMatrixAt(idx, dummy.matrix);

    const h = 0.31 + (idx % 5) * 0.018;
    const s = 0.52 + (idx % 3) * 0.05;
    const l = 0.28 + (idx % 3) * 0.04;
    treeColor.setHSL(h, s, l);
    treeUpperColor.setHSL(h + 0.015, s + 0.04, l + 0.07);
    treeSideColor.setHSL(h - 0.01, s - 0.02, l + 0.03);
    canopies.setColorAt(idx, treeColor);
    canopiesUpper.setColorAt(idx, treeUpperColor);
    canopiesSide.setColorAt(idx, treeSideColor);

    circleObstacles.push({
      x: pos.x,
      z: pos.z,
      radius: 0.42 * scale,
      topY: 4.0 * scale,
      walkableTop: false,
    });
  });
  rootCollars.computeBoundingSphere();
  trunks.computeBoundingSphere();
  branchesA.computeBoundingSphere();
  branchesB.computeBoundingSphere();
  canopies.computeBoundingSphere();
  canopiesUpper.computeBoundingSphere();
  canopiesSide.computeBoundingSphere();
  treeShadows.computeBoundingSphere();
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  if (canopiesUpper.instanceColor) canopiesUpper.instanceColor.needsUpdate = true;
  if (canopiesSide.instanceColor) canopiesSide.instanceColor.needsUpdate = true;
  scene.add(rootCollars, trunks, branchesA, branchesB, canopies, canopiesUpper, canopiesSide, treeShadows);

  // Non-blocking 3D Meadow Grass Tufts strictly in the outer open-world coastal meadow (r = 236..294)
  const tuftPositions: { x: number; z: number; angle: number }[] = [];
  const tuftTarget = lowCostMode ? 110 : 240;
  for (let i = 0; i < tuftTarget * 2 && tuftPositions.length < tuftTarget; i++) {
    const a = (i * 2.39996) % (Math.PI * 2);
    const r = 238 + ((i * 37) % 54);
    const tx = Math.cos(a) * r;
    const tz = Math.sin(a) * r;
    // Skip river corridor
    if (tz > 130 && tz < 176) continue;
    tuftPositions.push({ x: tx, z: tz, angle: a });
  }
  const tuftBladeGeo = track(new THREE.ConeGeometry(0.18, 0.52, 4));
  const tuftMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b7a44,
      roughness: 0.88,
      metalness: 0.0,
    }),
  );
  const tufts = new THREE.InstancedMesh(tuftBladeGeo, tuftMat, tuftPositions.length);
  tufts.receiveShadow = true;
  const tuftColor = new THREE.Color();
  tuftPositions.forEach((tp, i) => {
    const s = 0.78 + (i % 4) * 0.22;
    dummy.position.set(tp.x, 0.22 * s, tp.z);
    dummy.rotation.set(0, tp.angle + i, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    tuftColor.setHSL(0.32 + (i % 4) * 0.015, 0.52, 0.34 + (i % 3) * 0.06);
    tufts.setColorAt(i, tuftColor);
  });
  tufts.computeBoundingSphere();
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  scene.add(tufts);

  // 7. Gentle Sky Observation Drones
  const drones: SkyDrone[] = [];
  const droneWingMat = track(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.65 }));
  const droneGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
    }),
  );
  for (let i = 0; i < 4; i++) {
    const dg = new THREE.Group();
    const hull = new THREE.Mesh(track(new THREE.BoxGeometry(1.6, 0.45, 0.9)), droneWingMat);
    const wing = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.1, 2.8)), titaniumMat);
    const core = new THREE.Mesh(track(new THREE.SphereGeometry(0.25, 10, 8)), droneGlowMat);
    core.position.y = -0.2;
    dg.add(hull, wing, core);
    scene.add(dg);
    drones.push({
      group: dg,
      radius: 28 + i * 13,
      speed: 0.14 + i * 0.03,
      height: 19 + i * 3.5,
      phase: i * 1.6,
    });
  }

  // 8. Unified Spatial World Hash Index + Seamless Open World Expansion (6 Connected Districts, Bridges, River & Landmarks)
  const spatialGrid = new SpatialWorldIndex();
  buildings.forEach((b) => {
    spatialGrid.addBox({
      x: b.coords.x,
      z: b.coords.z,
      halfW: b.podiumHalfW,
      halfD: b.podiumHalfW,
      topY: b.podiumTopY,
      baseY: 0,
      cosYaw: b.cosYaw,
      sinYaw: b.sinYaw,
      walkableTop: true,
    });
    spatialGrid.addBox({
      x: b.coords.x,
      z: b.coords.z,
      halfW: b.towerHalfW,
      halfD: b.towerHalfW,
      topY: b.towerTopY,
      baseY: b.podiumTopY,
      cosYaw: b.cosYaw,
      sinYaw: b.sinYaw,
      walkableTop: true,
    });
  });
  circleObstacles.forEach((c) => spatialGrid.addCircle(c));

  const openWorld = track(
    buildOpenWorldSystem(
      scene,
      renderer,
      texSet,
      spatialGrid,
      {
        limestoneMat,
        titaniumMat,
        glassMat,
        roofGlassMat,
        doorGlassMat,
        avenueMat,
        curbMat,
        waterMat,
        trunkMat,
        canopyMat,
        treeShadowMat,
        solarPanelMat,
        roofGardenMat,
      },
      isSoftwareGl,
      lowCostMode,
      qualityTier,
    ),
  );

  // 9. Living World Ambient & Interactive NPC Population (Inner Campus + Open-World District Guides & Citizens)
  const buildingObstacleBoxes: BuildingObstacleBox[] = buildings.map((b) => ({
    x: b.coords.x,
    z: b.coords.z,
    halfW: b.podiumHalfW,
    cosYaw: b.cosYaw,
    sinYaw: b.sinYaw,
  }));
  const livingNpcs = track(
    buildLivingNpcSystem(scene, texSet.contactShadowMap, lowCostMode, qualityTier, OPEN_WORLD_NPCS),
  );

  // 10. Player Avatar + Pooled Zero-GC Jump/Landing Motion Puff FX
  const avatar = buildAvatarRig(avatarConfig, texSet.contactShadowMap);
  avatar.root.position.set(0, 0, 14);
  scene.add(avatar.root);

  const puffGeo = track(new THREE.RingGeometry(0.18, 0.36, 16));
  puffGeo.rotateX(-Math.PI / 2);
  const puffMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const PUFF_POOL_SIZE = 10;
  const puffPool: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    life: number;
    maxLife: number;
    baseScale: number;
  }[] = [];
  for (let i = 0; i < PUFF_POOL_SIZE; i++) {
    const mat = track(puffMat.clone());
    const mesh = new THREE.Mesh(puffGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    puffPool.push({ mesh, mat, life: 0, maxLife: 0.35, baseScale: 1 });
  }
  let puffCursor = 0;

  const triggerMotionPuff = (x: number, y: number, z: number, intensity = 1) => {
    const slot = puffPool[puffCursor];
    puffCursor = (puffCursor + 1) % PUFF_POOL_SIZE;
    slot.mesh.position.set(x, y + 0.04, z);
    slot.mesh.scale.setScalar(0.55);
    slot.life = 0.001;
    slot.maxLife = 0.28 + intensity * 0.14;
    slot.baseScale = 0.8 + intensity * 0.9;
    slot.mat.opacity = Math.min(0.65, 0.32 + intensity * 0.24);
    slot.mesh.visible = true;
  };

  const updateMotionPuffs = (delta: number) => {
    for (let i = 0; i < puffPool.length; i++) {
      const p = puffPool[i];
      if (!p.mesh.visible) continue;
      p.life += delta;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.mesh.visible = false;
        continue;
      }
      const easeOut = 1 - (1 - t) * (1 - t);
      p.mesh.scale.setScalar(0.55 + easeOut * p.baseScale * 1.45);
      p.mat.opacity = (1 - t) * 0.45;
    }
  };

  const updateAvatarAppearance = (cfg: AvatarConfig) => {
    avatar.suitMaterial.color.set(cfg.suitColor);
    avatar.accentMaterial.color.set(cfg.accentColor);
    const vc = getVisorHex(cfg.visorStyle);
    avatar.visorMaterial.color.setHex(vc.color);
    avatar.visorMaterial.emissive.setHex(vc.emissive);
    avatar.setPackStyle(cfg.packStyle);
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    buildings,
    buildingObstacleBoxes,
    npcs,
    livingNpcs,
    circleObstacles,
    cameraOccluders,
    lods,
    avatar,
    centralRings,
    drones,
    clouds,
    waterNormal: texSet.waterNormal,
    openWorld,
    spatialGrid,
    triggerMotionPuff,
    updateMotionPuffs,
    updateAvatarAppearance,
    dispose,
  };
}
