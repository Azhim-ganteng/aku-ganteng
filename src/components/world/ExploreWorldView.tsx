import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  Gamepad2,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DISTRICTS } from '../../data/districts';
import { GAMES_CATALOG } from '../../data/gamesCatalog';
import { OPEN_WORLD_DISTRICTS, WORLD_LANDMARKS } from '../../data/openWorldData';
import { useEduWorld } from '../../context/EduWorldContext';
import { DistrictId, GameDefinition, NPCDefinition, WorldLandmarkDefinition } from '../../types/eduworld';
import { playJumpTone, playLandTone } from '../../utils/audio';
import { CityWorldHandle, buildSolarpunkCity } from './cityBuilder';
import { SpatialBoxObstacle } from './spatialGrid';
import { WorldMapModal } from './WorldMapModal';

// Module-scope reusable math helpers (Zero GC in render loop)
const _camTarget = new THREE.Vector3();
const _camRayDir = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();

type ProximityTarget =
  | { kind: 'building'; game: GameDefinition }
  | { kind: 'npc'; npc: NPCDefinition }
  | { kind: 'landmark'; landmark: WorldLandmarkDefinition }
  | null;

const PLAYER_RADIUS = 0.48;
const GRAVITY = -34;
const JUMP_SPEED = 13.8;
const STEP_TOLERANCE = 0.3;

function detectSoftwareGl(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) || '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function createOutdoorEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const envScene = new THREE.Scene();

  // Unobstructed outdoor sky dome with rich azure zenith, sky-blue horizon, and emerald-slate ground bounce
  const skyGeo = new THREE.SphereGeometry(24, 32, 20);
  const posAttr = skyGeo.attributes.position;
  const cols = new Float32Array(posAttr.count * 3);
  const zenith = new THREE.Color(0x2563eb);
  const horizon = new THREE.Color(0xdbeafe);
  const ground = new THREE.Color(0x4b6852);
  const tmp = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    if (y >= 0) {
      tmp.copy(horizon).lerp(zenith, Math.min(1, y / 18));
    } else {
      tmp.copy(horizon).lerp(ground, Math.min(1, -y / 10));
    }
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);

  // Crisp solar specular disc + controlled sky reflection cards (high contrast without whitewashing surfaces)
  const sunCardGeo = new THREE.CircleGeometry(3.2, 24);
  const sunCardMat = new THREE.MeshBasicMaterial({ color: 0xfff3d1, side: THREE.DoubleSide });
  sunCardMat.color.multiplyScalar(2.8);
  const sunCard = new THREE.Mesh(sunCardGeo, sunCardMat);
  sunCard.position.set(12, 16, 9);
  sunCard.lookAt(0, 0, 0);

  const fillCardGeo = new THREE.PlaneGeometry(16, 8);
  const fillCardMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, side: THREE.DoubleSide });
  fillCardMat.color.multiplyScalar(0.9);
  const fillCard = new THREE.Mesh(fillCardGeo, fillCardMat);
  fillCard.position.set(-14, 9, -12);
  fillCard.lookAt(0, 0, 0);

  const cloudCardGeo = new THREE.CircleGeometry(4.5, 16);
  const cloudCardMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
  cloudCardMat.color.multiplyScalar(1.15);
  const cloudCard = new THREE.Mesh(cloudCardGeo, cloudCardMat);
  cloudCard.position.set(-8, 16, 12);
  cloudCard.lookAt(0, 0, 0);

  envScene.add(skyMesh, sunCard, fillCard, cloudCard);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRT = pmremGenerator.fromScene(envScene, 0.028);
  pmremGenerator.dispose();
  skyGeo.dispose();
  skyMat.dispose();
  sunCardGeo.dispose();
  sunCardMat.dispose();
  fillCardGeo.dispose();
  fillCardMat.dispose();
  cloudCardGeo.dispose();
  cloudCardMat.dispose();
  return envRT;
}

function getSupportHeightAt(x: number, z: number, feetY: number, world: CityWorldHandle): number {
  let supportY = Math.hypot(x, z) <= 98 ? 0.01 : 0;

  // 1. Walkable arched bridges over Solarpunk Valley River
  const bridgeHit = world.spatialGrid.getBridgeHeightAt(x, z);
  if (bridgeHit && feetY >= bridgeHit.height - 0.55 && bridgeHit.height > supportY) {
    supportY = bridgeHit.height;
  }

  // 2. Circular platforms queried in O(1) via SpatialWorldIndex (district pads, fountain rim, pedestal, NPC pads)
  const nearCircles = world.spatialGrid.queryCircles(x, z, 22);
  for (let i = 0; i < nearCircles.length; i++) {
    const obs = nearCircles[i];
    if (!obs.walkableTop) continue;
    const d = Math.hypot(x - obs.x, z - obs.z);
    if (d <= obs.radius + PLAYER_RADIUS * 0.55 && feetY >= obs.topY - STEP_TOLERANCE) {
      if (obs.topY > supportY) supportY = obs.topY;
    }
  }

  // 3. Oriented box podiums/platforms (inner building podiums + outer facility bases/terraces)
  const nearBoxes = world.spatialGrid.queryBoxes(x, z, 24);
  for (let i = 0; i < nearBoxes.length; i++) {
    const b = nearBoxes[i];
    if (!b.walkableTop) continue;
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * b.cosYaw - dz * b.sinYaw;
    const lz = dx * b.sinYaw + dz * b.cosYaw;

    if (
      Math.abs(lx) <= b.halfW + PLAYER_RADIUS * 0.45 &&
      Math.abs(lz) <= b.halfD + PLAYER_RADIUS * 0.45 &&
      feetY >= b.topY - STEP_TOLERANCE
    ) {
      if (b.topY > supportY) supportY = b.topY;
    }
  }

  return supportY;
}

function pushOutSpatialBox(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  b: SpatialBoxObstacle,
  halfExtentW: number,
  halfExtentD: number,
) {
  const dx = pos.x - b.x;
  const dz = pos.z - b.z;
  const lx = dx * b.cosYaw - dz * b.sinYaw;
  const lz = dx * b.sinYaw + dz * b.cosYaw;

  if (Math.abs(lx) < halfExtentW && Math.abs(lz) < halfExtentD) {
    const penX = halfExtentW - Math.abs(lx);
    const penZ = halfExtentD - Math.abs(lz);

    let newLx = lx;
    let newLz = lz;
    let normX = 0;
    let normZ = 0;

    if (penX < penZ) {
      const sign = lx >= 0 ? 1 : -1;
      newLx = sign * halfExtentW;
      normX = sign * b.cosYaw;
      normZ = -sign * b.sinYaw;
    } else {
      const sign = lz >= 0 ? 1 : -1;
      newLz = sign * halfExtentD;
      normX = sign * b.sinYaw;
      normZ = sign * b.cosYaw;
    }

    pos.x = b.x + newLx * b.cosYaw + newLz * b.sinYaw;
    pos.z = b.z - newLx * b.sinYaw + newLz * b.cosYaw;

    const vn = vel.x * normX + vel.z * normZ;
    if (vn < 0) {
      vel.x -= vn * normX;
      vel.z -= vn * normZ;
    }
  }
}

function resolveHorizontalCollisions(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  world: CityWorldHandle,
) {
  // 1. O(1) Building Podiums, Towers, Outer District Facilities & Bridge Guardrails
  const nearBoxes = world.spatialGrid.queryBoxes(pos.x, pos.z, 24);
  for (let i = 0; i < nearBoxes.length; i++) {
    const b = nearBoxes[i];
    if (pos.y < b.topY - STEP_TOLERANCE && pos.y >= b.baseY - 0.65) {
      pushOutSpatialBox(pos, vel, b, b.halfW + PLAYER_RADIUS, b.halfD + PLAYER_RADIUS);
    }
  }

  // 2. O(1) Trees, Lampposts, NPCs, Fountain Rim, Pedestal & Landmarks
  const nearCircles = world.spatialGrid.queryCircles(pos.x, pos.z, 22);
  for (let i = 0; i < nearCircles.length; i++) {
    const obs = nearCircles[i];
    if (pos.y >= obs.topY - STEP_TOLERANCE) continue;

    const minDist = obs.radius + PLAYER_RADIUS;
    const dx = pos.x - obs.x;
    const dz = pos.z - obs.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      pos.x = obs.x + nx * minDist;
      pos.z = obs.z + nz * minDist;

      const vn = vel.x * nx + vel.z * nz;
      if (vn < 0) {
        vel.x -= vn * nx;
        vel.z -= vn * nz;
      }
    }
  }

  // 3. River & Lake Shorelines (allowed cleanly while on bridges)
  if (pos.y < 1.2) {
    const waterPush = world.spatialGrid.resolveWaterBoundary(pos.x, pos.z, PLAYER_RADIUS);
    if (waterPush) {
      pos.x = waterPush.pushX;
      pos.z = waterPush.pushZ;
      const vn = vel.x * waterPush.nx + vel.z * waterPush.nz;
      if (vn < 0) {
        vel.x -= vn * waterPush.nx;
        vel.z -= vn * waterPush.nz;
      }
    }
  }

  // 4. Expanded 600m x 600m Island Coastal Boundary (r = 286m)
  const distFromCenter = Math.hypot(pos.x, pos.z);
  if (distFromCenter > 286) {
    const nx = pos.x / distFromCenter;
    const nz = pos.z / distFromCenter;
    pos.x = nx * 286;
    pos.z = nz * 286;
    const vn = vel.x * nx + vel.z * nz;
    if (vn > 0) {
      vel.x -= vn * nx;
      vel.z -= vn * nz;
    }
  }
}

export const ExploreWorldView: React.FC = () => {
  const {
    player,
    openGame,
    openNpc,
    visitDistrict,
    openWorldProgress,
    visitOuterDistrict,
    discoverLandmark,
    recordBridgeCrossed,
    teleportTarget,
    notify,
  } = useEduWorld();

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<CityWorldHandle | null>(null);
  const playerPosRef = useRef(new THREE.Vector3(0, 0.01, 14));
  const playerVelRef = useRef(new THREE.Vector3(0, 0, 0));
  const playerYawRef = useRef(Math.PI);
  const camYawRef = useRef(0);
  const camPitchRef = useRef(0.36);
  const camDistanceRef = useRef(13);
  const keysRef = useRef<Record<string, boolean>>({});
  const joystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const jumpBufferRef = useRef(0);
  const playerSettingsRef = useRef(player.settings);
  const avatarConfigRef = useRef(player.avatar);
  const visitedDistrictsRef = useRef(new Set(player.visitedDistricts));
  const visitedOuterRef = useRef(new Set(openWorldProgress.visitedOuterDistricts));
  const discoveredLandmarksRef = useRef(new Set(openWorldProgress.discoveredLandmarks));
  const crossedBridgesRef = useRef(new Set(openWorldProgress.crossedBridges));

  const [hudHidden, setHudHidden] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [outerMenuOpen, setOuterMenuOpen] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState({ x: 0, z: 14, yaw: Math.PI });
  const [contextLost, setContextLost] = useState(false);
  const [proximity, setProximity] = useState<ProximityTarget>(null);
  const [currentDistrictName, setCurrentDistrictName] = useState('Central Academy Plaza');
  const [joyVisual, setJoyVisual] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const proximityRef = useRef<ProximityTarget>(null);

  useEffect(() => {
    playerSettingsRef.current = player.settings;
  }, [player.settings]);

  useEffect(() => {
    avatarConfigRef.current = player.avatar;
    worldRef.current?.updateAvatarAppearance(player.avatar);
  }, [player.avatar]);

  useEffect(() => {
    visitedDistrictsRef.current = new Set(player.visitedDistricts);
  }, [player.visitedDistricts]);

  useEffect(() => {
    visitedOuterRef.current = new Set(openWorldProgress.visitedOuterDistricts);
    discoveredLandmarksRef.current = new Set(openWorldProgress.discoveredLandmarks);
    crossedBridgesRef.current = new Set(openWorldProgress.crossedBridges);
  }, [openWorldProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    setIsTouchDevice(coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const teleportImmediately = useCallback((x: number, z: number) => {
    const w = worldRef.current;
    w?.openWorld.ensureChunkBuiltAt(x, z);
    const landY = w ? getSupportHeightAt(x, z, 2.0, w) : 0.16;
    playerPosRef.current.set(x, landY, z);
    playerVelRef.current.set(0, 0, 0);
    if (w) {
      w.avatar.root.position.copy(playerPosRef.current);
    }
  }, []);

  // Handle fast-travel teleportation from Catalog / Districts / World Map
  useEffect(() => {
    if (!teleportTarget) return;
    teleportImmediately(teleportTarget.x, teleportTarget.z);
  }, [teleportTarget, teleportImmediately]);

  // Keyboard toggle for HUD (`H`), World Map (`M`), and Interact (`E`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyH') {
        setHudHidden((v) => !v);
      } else if (e.code === 'KeyM') {
        setMapSnapshot({
          x: playerPosRef.current.x,
          z: playerPosRef.current.z,
          yaw: playerYawRef.current,
        });
        setMapOpen((v) => !v);
      } else if (e.code === 'Escape') {
        setMapOpen(false);
        setOuterMenuOpen(false);
      } else if (e.code === 'KeyE') {
        const target = proximityRef.current;
        if (target?.kind === 'building') {
          openGame(target.game);
        } else if (target?.kind === 'npc') {
          openNpc(target.npc);
        } else if (target?.kind === 'landmark') {
          discoverLandmark(target.landmark.id);
          const linkedGame = GAMES_CATALOG.find((g) => g.id === target.landmark.linkedGameId);
          if (linkedGame) openGame(linkedGame);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [discoverLandmark, openGame, openNpc]);

  // Initialize Three.js World once (or when qualityTier setting changes)
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareGl();
    const quality = player.settings.qualityTier;
    const lowCostMode = isSoftwareGl || quality === 'low';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !lowCostMode,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setPixelRatio(
      lowCostMode ? 1 : quality === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.75),
    );
    renderer.shadowMap.enabled = !lowCostMode;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mount.clientWidth || 1280, mount.clientHeight || 720);

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc5ddf5);
    scene.fog = new THREE.FogExp2(0xc5ddf5, 0.0019);

    const envRT = createOutdoorEnvironment(renderer);
    scene.environment = envRT.texture;

    // Warm Sunlight Key + Cool Sky/Forest Hemisphere + Rim Backlight + Subtle Ground Bounce
    const hemiLight = new THREE.HemisphereLight(0x8ec5fc, 0x3b5944, 0.56);
    scene.add(hemiLight);

    const shadowBounds = quality === 'high' ? 56 : 46;
    const shadowRes = quality === 'high' ? 2048 : 1024;
    const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    sunLight.position.set(52, 68, 40);
    sunLight.castShadow = !lowCostMode;
    sunLight.shadow.mapSize.width = shadowRes;
    sunLight.shadow.mapSize.height = shadowRes;
    sunLight.shadow.camera.left = -shadowBounds;
    sunLight.shadow.camera.right = shadowBounds;
    sunLight.shadow.camera.top = shadowBounds;
    sunLight.shadow.camera.bottom = -shadowBounds;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 175;
    sunLight.shadow.radius = 2.4;
    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.022;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.36);
    rimLight.position.set(-50, 35, -55);
    scene.add(rimLight);

    const bounceLight = new THREE.DirectionalLight(0xd6d3c9, 0.16);
    bounceLight.position.set(-36, -24, -32);
    scene.add(bounceLight);

    const camera = new THREE.PerspectiveCamera(
      55,
      (mount.clientWidth || 1280) / (mount.clientHeight || 720),
      0.4,
      640,
    );

    const world = buildSolarpunkCity(
      scene,
      renderer,
      GAMES_CATALOG,
      DISTRICTS,
      avatarConfigRef.current,
      isSoftwareGl,
      lowCostMode,
      quality,
    );
    world.avatar.root.position.copy(playerPosRef.current);
    world.avatar.root.rotation.y = playerYawRef.current;
    worldRef.current = world;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster for building / NPC / landmark clicking (layer 1)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    const baseHitProxies = [
      ...world.buildings.map((b) => b.hitProxy),
      ...world.npcs.map((n) => n.hitProxy),
      ...world.livingNpcs.hitProxies,
    ];

    // Raycaster for Camera Anti-Clipping against building volumes (layer 2)
    const camRaycaster = new THREE.Raycaster();
    camRaycaster.layers.set(2);

    let activeCamPointerId: number | null = null;
    let dragDistance = 0;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (activeCamPointerId !== null) return;
      activeCamPointerId = e.pointerId;
      dragDistance = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activeCamPointerId !== e.pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX;
      lastY = e.clientY;
      const sens = 0.0055 * (playerSettingsRef.current.cameraSensitivity || 1);
      camYawRef.current -= dx * sens;
      camPitchRef.current = THREE.MathUtils.clamp(camPitchRef.current + dy * sens * 0.7, 0.1, 1.12);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activeCamPointerId !== e.pointerId) return;
      activeCamPointerId = null;
      if (dragDistance < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects([...baseHitProxies, ...world.openWorld.hitProxies], false);
        if (hits.length > 0) {
          const data = hits[0].object.userData as {
            kind?: string;
            gameId?: string;
            npcId?: string;
            landmarkId?: string;
          };
          if (data.kind === 'building') {
            const found = GAMES_CATALOG.find((g) => g.id === data.gameId);
            if (found) openGame(found);
          } else if (data.kind === 'npc') {
            const dist = DISTRICTS.find((d) => d.npc.id === data.npcId);
            if (dist) openNpc(dist.npc);
          } else if (data.kind === 'ambient-npc' && data.npcId) {
            const agent = world.livingNpcs.interactiveMap.get(data.npcId);
            if (agent) openNpc(agent.spec.npcInfo);
          } else if (data.kind === 'landmark' && data.landmarkId) {
            const lm = WORLD_LANDMARKS.find((l) => l.id === data.landmarkId);
            if (lm) {
              const distToLm = Math.hypot(playerPosRef.current.x - lm.coords.x, playerPosRef.current.z - lm.coords.z);
              if (distToLm <= lm.discoveryRadius + 6) {
                discoverLandmark(lm.id);
              } else {
                notify(lm.name, `${lm.description} Walk closer or use World Map (M) to fast travel.`);
              }
              const linked = GAMES_CATALOG.find((g) => g.id === lm.linkedGameId);
              if (linked && distToLm <= lm.discoveryRadius + 6) openGame(linked);
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camDistanceRef.current = THREE.MathUtils.clamp(camDistanceRef.current + e.deltaY * 0.01, 6.5, 24);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          jumpBufferRef.current = 0.14;
        }
      }
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let walkCycle = 0;
    let lastDistrictCheck = 0;
    let grounded = true;
    let coyoteTimer = 0.1;
    let airTime = 0;
    let landSquash = 0;
    let takeoffStretch = 0;
    let currentCamDist = camDistanceRef.current;
    let camFollowY = playerPosRef.current.y;
    const camPivot = new THREE.Vector3(playerPosRef.current.x, playerPosRef.current.y + 1.8, playerPosRef.current.z);
    const sunTexelWorld = (shadowBounds * 2) / shadowRes;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      const k = keysRef.current;
      const pos = playerPosRef.current;
      const vel = playerVelRef.current;

      // 1. Unified Camera-Relative Movement Input (Keyboard + Virtual Joystick)
      let inputX = joystickRef.current.x;
      let inputZ = joystickRef.current.y;
      if (k['KeyA'] || k['ArrowLeft']) inputX -= 1;
      if (k['KeyD'] || k['ArrowRight']) inputX += 1;
      if (k['KeyW'] || k['ArrowUp']) inputZ -= 1;
      if (k['KeyS'] || k['ArrowDown']) inputZ += 1;

      const rawMag = Math.hypot(inputX, inputZ);
      const hasInput = rawMag > 0.06;
      const isSprinting = !!(k['ShiftLeft'] || k['ShiftRight']);
      const maxSpeed = isSprinting ? 18.5 : 12.5;

      let targetVx = 0;
      let targetVz = 0;

      if (hasInput) {
        const clampedMag = Math.min(1, rawMag);
        const nx = inputX / rawMag;
        const nz = inputZ / rawMag;
        const yaw = camYawRef.current;
        const sinY = Math.sin(yaw);
        const cosY = Math.cos(yaw);

        _moveDir.set(nx * cosY + nz * sinY, 0, -nx * sinY + nz * cosY).normalize();
        const targetSpeed = maxSpeed * clampedMag;
        targetVx = _moveDir.x * targetSpeed;
        targetVz = _moveDir.z * targetSpeed;
      }

      // Smooth Acceleration & Crisp Deceleration (Zero sliding when stopped)
      const accelLambda = hasInput ? (grounded ? 15 : 7.5) : grounded ? 20 : 2.2;
      vel.x = THREE.MathUtils.damp(vel.x, targetVx, accelLambda, delta);
      vel.z = THREE.MathUtils.damp(vel.z, targetVz, accelLambda, delta);

      if (!hasInput && grounded && Math.hypot(vel.x, vel.z) < 0.08) {
        vel.x = 0;
        vel.z = 0;
      }

      // 2. Jump Physics (Single Grounded Jump + Coyote Time + Input Buffer)
      if (grounded) {
        coyoteTimer = 0.11;
      } else {
        coyoteTimer = Math.max(0, coyoteTimer - delta);
      }
      if (jumpBufferRef.current > 0) {
        jumpBufferRef.current = Math.max(0, jumpBufferRef.current - delta);
      }

      if (jumpBufferRef.current > 0 && coyoteTimer > 0) {
        vel.y = JUMP_SPEED;
        grounded = false;
        coyoteTimer = 0;
        jumpBufferRef.current = 0;
        takeoffStretch = 1;
        airTime = 0;
        playJumpTone(playerSettingsRef.current.soundEnabled);
      }

      // Apply horizontal movement & solve OBB / Obstacle collisions
      pos.x += vel.x * delta;
      pos.z += vel.z * delta;
      resolveHorizontalCollisions(pos, vel, world);

      // Apply gravity & vertical landing on terrain / platforms
      if (!grounded) {
        vel.y += GRAVITY * delta;
        airTime += delta;
      }
      pos.y += vel.y * delta;

      const supportY = getSupportHeightAt(pos.x, pos.z, pos.y, world);
      if (pos.y <= supportY) {
        if (!grounded && vel.y < -3.5 && airTime > 0.12) {
          landSquash = THREE.MathUtils.clamp(-vel.y / 18, 0.25, 1.0);
          playLandTone(playerSettingsRef.current.soundEnabled);
        }
        pos.y = supportY;
        vel.y = 0;
        grounded = true;
        airTime = 0;
      } else if (pos.y > supportY + 0.14) {
        grounded = false;
      }

      // 3. Smooth Natural Turning System
      const horizSpeed = Math.hypot(vel.x, vel.z);
      let yawDeltaSigned = 0;
      if (hasInput || horizSpeed > 0.6) {
        const dirX = hasInput ? _moveDir.x : vel.x;
        const dirZ = hasInput ? _moveDir.z : vel.z;
        const targetYaw = Math.atan2(dirX, dirZ);
        let diff = targetYaw - playerYawRef.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // Slightly gentler rate on 180-degree reversals so turning feels weighty and natural
        const absDiff = Math.abs(diff);
        const turnRate = grounded ? (absDiff > 2.2 ? 9.5 : 13.5) : 5.5;
        const step = diff * (1 - Math.exp(-turnRate * delta));
        playerYawRef.current += step;
        yawDeltaSigned = delta > 0.0001 ? step / delta : 0;
      }

      // 4. Procedural Character Animations (Idle, Walk, Run, Turn Bank, Jump, Land)
      const av = world.avatar;
      av.root.position.copy(pos);
      av.root.rotation.y = playerYawRef.current;

      // Ground contact shadow stays flush on support surface directly beneath player
      const heightAboveGround = Math.max(0, pos.y - supportY);
      av.shadowDisc.position.y = supportY - pos.y + 0.035;
      const shadowScale = Math.max(0.45, 1.0 - heightAboveGround * 0.16);
      av.shadowDisc.scale.set(shadowScale, shadowScale, 1);
      (av.shadowDisc.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.18,
        0.92 - heightAboveGround * 0.24,
      );

      takeoffStretch = THREE.MathUtils.damp(takeoffStretch, 0, 12, delta);
      landSquash = THREE.MathUtils.damp(landSquash, 0, 11, delta);

      const scaleY = 1 + takeoffStretch * 0.09 - landSquash * 0.14;
      const scaleXZ = 1 / Math.sqrt(Math.max(0.7, scaleY));
      av.bodyGroup.scale.set(scaleXZ, scaleY, scaleXZ);

      if (!grounded) {
        // Mid-air Jump / Fall animation
        const climbBlend = THREE.MathUtils.clamp(vel.y / 11, -1, 1);
        const targetLegL = climbBlend > 0 ? -0.45 * climbBlend : 0.28 * -climbBlend;
        const targetLegR = climbBlend > 0 ? 0.35 * climbBlend : -0.18 * -climbBlend;
        const targetArmRaise = climbBlend > 0 ? -0.55 * climbBlend : -0.35;
        const targetArmSplay = 0.22;

        av.leftLeg.rotation.x = THREE.MathUtils.damp(av.leftLeg.rotation.x, targetLegL, 12, delta);
        av.rightLeg.rotation.x = THREE.MathUtils.damp(av.rightLeg.rotation.x, targetLegR, 12, delta);
        av.leftArm.rotation.x = THREE.MathUtils.damp(av.leftArm.rotation.x, targetArmRaise, 10, delta);
        av.rightArm.rotation.x = THREE.MathUtils.damp(av.rightArm.rotation.x, targetArmRaise * 0.85, 10, delta);
        av.leftArm.rotation.z = THREE.MathUtils.damp(av.leftArm.rotation.z, -targetArmSplay, 10, delta);
        av.rightArm.rotation.z = THREE.MathUtils.damp(av.rightArm.rotation.z, targetArmSplay, 10, delta);
        av.bodyGroup.position.y = THREE.MathUtils.damp(av.bodyGroup.position.y, 0, 14, delta);
        av.bodyGroup.rotation.x = THREE.MathUtils.damp(av.bodyGroup.rotation.x, horizSpeed * 0.008, 8, delta);
        av.bodyGroup.rotation.z = THREE.MathUtils.damp(
          av.bodyGroup.rotation.z,
          THREE.MathUtils.clamp(-yawDeltaSigned * 0.025, -0.14, 0.14),
          8,
          delta,
        );
        av.bodyGroup.rotation.y = THREE.MathUtils.damp(av.bodyGroup.rotation.y, 0, 10, delta);
      } else if (horizSpeed > 0.35) {
        // Walk / Run cycle scaled naturally with horizontal velocity
        const speedNorm = THREE.MathUtils.clamp(horizSpeed / 12.5, 0, 1.5);
        walkCycle += delta * (6.5 + speedNorm * 6.8);
        const swingAmp = Math.min(0.75, 0.32 + speedNorm * 0.36);
        const swing = Math.sin(walkCycle) * swingAmp;
        const strideBob = Math.abs(Math.sin(walkCycle)) * (0.045 + speedNorm * 0.045);

        av.leftLeg.rotation.x = THREE.MathUtils.damp(av.leftLeg.rotation.x, swing, 18, delta);
        av.rightLeg.rotation.x = THREE.MathUtils.damp(av.rightLeg.rotation.x, -swing, 18, delta);
        av.leftArm.rotation.x = THREE.MathUtils.damp(av.leftArm.rotation.x, -swing * 0.85, 18, delta);
        av.rightArm.rotation.x = THREE.MathUtils.damp(av.rightArm.rotation.x, swing * 0.85, 18, delta);
        av.leftArm.rotation.z = THREE.MathUtils.damp(av.leftArm.rotation.z, -0.05 * speedNorm, 12, delta);
        av.rightArm.rotation.z = THREE.MathUtils.damp(av.rightArm.rotation.z, 0.05 * speedNorm, 12, delta);

        av.bodyGroup.position.y = THREE.MathUtils.damp(av.bodyGroup.position.y, strideBob, 18, delta);
        av.bodyGroup.rotation.x = THREE.MathUtils.damp(av.bodyGroup.rotation.x, speedNorm * 0.11, 10, delta);
        av.bodyGroup.rotation.y = THREE.MathUtils.damp(
          av.bodyGroup.rotation.y,
          Math.sin(walkCycle) * 0.07 * speedNorm,
          14,
          delta,
        );
        av.bodyGroup.rotation.z = THREE.MathUtils.damp(
          av.bodyGroup.rotation.z,
          THREE.MathUtils.clamp(-yawDeltaSigned * 0.03, -0.18, 0.18),
          10,
          delta,
        );
        av.headGroup.rotation.y = THREE.MathUtils.damp(av.headGroup.rotation.y, 0, 10, delta);
      } else {
        // Calm Idle breathing animation
        const breath = Math.sin(elapsed * 2.1);
        av.leftLeg.rotation.x = THREE.MathUtils.damp(av.leftLeg.rotation.x, 0, 14, delta);
        av.rightLeg.rotation.x = THREE.MathUtils.damp(av.rightLeg.rotation.x, 0, 14, delta);
        av.leftArm.rotation.x = THREE.MathUtils.damp(av.leftArm.rotation.x, breath * 0.035, 12, delta);
        av.rightArm.rotation.x = THREE.MathUtils.damp(av.rightArm.rotation.x, -breath * 0.035, 12, delta);
        av.leftArm.rotation.z = THREE.MathUtils.damp(av.leftArm.rotation.z, -0.03, 10, delta);
        av.rightArm.rotation.z = THREE.MathUtils.damp(av.rightArm.rotation.z, 0.03, 10, delta);
        av.bodyGroup.position.y = THREE.MathUtils.damp(av.bodyGroup.position.y, (breath + 1) * 0.012, 10, delta);
        av.bodyGroup.rotation.x = THREE.MathUtils.damp(av.bodyGroup.rotation.x, 0, 12, delta);
        av.bodyGroup.rotation.y = THREE.MathUtils.damp(av.bodyGroup.rotation.y, 0, 12, delta);
        av.bodyGroup.rotation.z = THREE.MathUtils.damp(av.bodyGroup.rotation.z, 0, 12, delta);
        av.headGroup.rotation.y = THREE.MathUtils.damp(av.headGroup.rotation.y, Math.sin(elapsed * 0.9) * 0.06, 6, delta);
      }

      // 5. Smooth Third-Person Chase Camera + Anti-Clipping Occlusion Solver
      const targetDist = camDistanceRef.current;
      const pitch = camPitchRef.current;
      const cy = camYawRef.current;

      camFollowY = THREE.MathUtils.damp(camFollowY, pos.y, grounded ? 14 : 9, delta);
      camPivot.x = THREE.MathUtils.damp(camPivot.x, pos.x, 18, delta);
      camPivot.z = THREE.MathUtils.damp(camPivot.z, pos.z, 18, delta);
      camPivot.y = camFollowY + 1.85;

      const cosPitch = Math.cos(pitch);
      _camRayDir.set(
        Math.sin(cy) * cosPitch,
        Math.sin(pitch),
        Math.cos(cy) * cosPitch,
      ).normalize();

      // Raycast from player shoulder pivot toward camera against inner & outer building occluders
      let clippedDist = targetDist;
      camRaycaster.set(camPivot, _camRayDir);
      camRaycaster.far = targetDist;
      const camHitsInner = camRaycaster.intersectObjects(world.cameraOccluders, false);
      if (camHitsInner.length > 0 && camHitsInner[0].distance < clippedDist) {
        clippedDist = Math.max(2.6, camHitsInner[0].distance - 0.55);
      }
      if (world.openWorld.cameraOccluders.length > 0) {
        const camHitsOuter = camRaycaster.intersectObjects(world.openWorld.cameraOccluders, false);
        if (camHitsOuter.length > 0 && camHitsOuter[0].distance < clippedDist) {
          clippedDist = Math.max(2.6, camHitsOuter[0].distance - 0.55);
        }
      }

      // Pull camera in rapidly if obstructed, ease out smoothly when clear
      const distLambda = clippedDist < currentCamDist ? 24 : 9;
      currentCamDist = THREE.MathUtils.damp(currentCamDist, clippedDist, distLambda, delta);

      _desiredCamPos.copy(camPivot).addScaledVector(_camRayDir, currentCamDist);
      const minCamGround = getSupportHeightAt(_desiredCamPos.x, _desiredCamPos.z, _desiredCamPos.y, world) + 0.55;
      if (_desiredCamPos.y < minCamGround) {
        _desiredCamPos.y = minCamGround;
      }

      camera.position.copy(_desiredCamPos);
      _camTarget.set(camPivot.x, camFollowY + 1.65, camPivot.z);
      camera.lookAt(_camTarget);

      // Update Building LODs (inner + outer open-world) & Texel-Snapped Player-Following Sun Shadows
      for (let i = 0; i < world.lods.length; i++) {
        world.lods[i].update(camera);
      }
      for (let i = 0; i < world.openWorld.lods.length; i++) {
        world.openWorld.lods[i].update(camera);
      }

      if (!lowCostMode) {
        const snapX = Math.round(pos.x / sunTexelWorld) * sunTexelWorld;
        const snapZ = Math.round(pos.z / sunTexelWorld) * sunTexelWorld;
        sunLight.target.position.set(snapX, 0, snapZ);
        sunLight.position.set(snapX + 52, 68, snapZ + 40);
      }

      // 6. Animate Central Astrolabe, Water Ripples, Clouds, Drones, Open World & NPCs
      world.waterNormal.offset.x = (elapsed * 0.018) % 1;
      world.waterNormal.offset.y = (elapsed * 0.012) % 1;

      world.centralRings[0].rotation.y = elapsed * 0.35;
      world.centralRings[1].rotation.z = elapsed * 0.25;
      world.centralRings[2].rotation.y = -elapsed * 0.5;
      world.centralRings[2].position.y = 4.2 + Math.sin(elapsed * 1.8) * 0.25;

      for (let i = 0; i < world.clouds.length; i++) {
        const c = world.clouds[i];
        const a = elapsed * c.speed + c.phase;
        c.group.position.set(Math.cos(a) * c.radius, c.height, Math.sin(a) * c.radius);
        c.group.rotation.y = -a;
      }

      for (let i = 0; i < world.drones.length; i++) {
        const d = world.drones[i];
        const a = elapsed * d.speed + d.phase;
        d.group.position.set(Math.cos(a) * d.radius, d.height + Math.sin(elapsed + i) * 0.6, Math.sin(a) * d.radius);
        d.group.rotation.y = -a;
      }

      for (let i = 0; i < world.npcs.length; i++) {
        const n = world.npcs[i];
        n.group.position.y = Math.sin(elapsed * 2 + i) * 0.12;
      }

      // Update Open-World chunk streaming, distance culling & landmark/rover/dish animations
      world.openWorld.update(pos, elapsed, discoveredLandmarksRef.current);

      // Update Living World NPC animations, AI pathing, O(1) spatial avoidance & LOD
      world.livingNpcs.update(
        delta,
        elapsed,
        pos,
        world.buildingObstacleBoxes,
        world.circleObstacles,
        world.spatialGrid,
      );

      // 7. Periodic Proximity, Landmark, Bridge & District Check (~6 times/sec)
      if (elapsed - lastDistrictCheck > 0.16) {
        lastDistrictCheck = elapsed;

        let closestTarget: ProximityTarget = null;
        let closestDist = 8.4;

        for (let i = 0; i < world.npcs.length; i++) {
          const n = world.npcs[i];
          const d = Math.hypot(pos.x - n.coords.x, pos.z - n.coords.z);
          if (d < 5.5 && d < closestDist) {
            closestDist = d;
            closestTarget = { kind: 'npc', npc: n.npc };
          }
        }

        const nearestAmbient = world.livingNpcs.getNearestInteractive(pos, Math.min(5.0, closestDist));
        if (nearestAmbient) {
          closestDist = nearestAmbient.dist;
          closestTarget = { kind: 'npc', npc: nearestAmbient.npc };
        }

        for (let i = 0; i < world.buildings.length; i++) {
          const b = world.buildings[i];
          const d = Math.hypot(pos.x - b.coords.x, pos.z - b.coords.z);
          if (d < 8.4 && d < closestDist) {
            closestDist = d;
            closestTarget = { kind: 'building', game: b.game };
          }
        }

        // Auto-discover Open-World Landmarks on approach & offer [E] prompt near beacon
        for (let i = 0; i < WORLD_LANDMARKS.length; i++) {
          const lm = WORLD_LANDMARKS[i];
          const d = Math.hypot(pos.x - lm.coords.x, pos.z - lm.coords.z);
          if (d <= lm.discoveryRadius && !discoveredLandmarksRef.current.has(lm.id)) {
            discoveredLandmarksRef.current.add(lm.id);
            discoverLandmark(lm.id);
          }
          if (d < 9.2 && d < closestDist) {
            closestDist = d;
            closestTarget = { kind: 'landmark', landmark: lm };
          }
        }

        // Track river bridge crossings
        const bridgeHit = world.spatialGrid.getBridgeHeightAt(pos.x, pos.z);
        if (bridgeHit && !crossedBridgesRef.current.has(bridgeHit.bridgeId)) {
          crossedBridgesRef.current.add(bridgeHit.bridgeId);
          recordBridgeCrossed(bridgeHit.bridgeId);
        }

        const prev = proximityRef.current;
        const changed =
          (prev === null) !== (closestTarget === null) ||
          (prev?.kind === 'building' && closestTarget?.kind === 'building' && prev.game.id !== closestTarget.game.id) ||
          (prev?.kind === 'npc' && closestTarget?.kind === 'npc' && prev.npc.id !== closestTarget.npc.id) ||
          (prev?.kind === 'landmark' &&
            closestTarget?.kind === 'landmark' &&
            prev.landmark.id !== closestTarget.landmark.id) ||
          prev?.kind !== closestTarget?.kind;

        if (changed) {
          proximityRef.current = closestTarget;
          setProximity(closestTarget);
        }

        const rCenter = Math.hypot(pos.x, pos.z);
        let activeDistLabel = rCenter > 116 ? 'Solarpunk Open Valley' : 'Central Academy Plaza';

        for (let i = 0; i < DISTRICTS.length; i++) {
          const distDef = DISTRICTS[i];
          const dd = Math.hypot(pos.x - distDef.plazaCoords.x, pos.z - distDef.plazaCoords.z);
          if (dd < 26) {
            activeDistLabel = distDef.name;
            if (!visitedDistrictsRef.current.has(distDef.id)) {
              visitedDistrictsRef.current.add(distDef.id);
              visitDistrict(distDef.id);
            }
            break;
          }
        }

        if (rCenter >= 98 && rCenter <= 116) {
          activeDistLabel = 'Grand Academy Ringway';
        } else if (rCenter > 116) {
          for (let i = 0; i < OPEN_WORLD_DISTRICTS.length; i++) {
            const ow = OPEN_WORLD_DISTRICTS[i];
            const dd = Math.hypot(pos.x - ow.plazaCoords.x, pos.z - ow.plazaCoords.z);
            if (dd < 54) {
              activeDistLabel = ow.name;
              if (dd < 46 && !visitedOuterRef.current.has(ow.id)) {
                visitedOuterRef.current.add(ow.id);
                visitOuterDistrict(ow.id);
              }
              break;
            }
          }
        }
        setCurrentDistrictName((curr) => (curr === activeDistLabel ? curr : activeDistLabel));
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      world.dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, [
    discoverLandmark,
    notify,
    openGame,
    openNpc,
    player.settings.qualityTier,
    recordBridgeCrossed,
    visitDistrict,
    visitOuterDistrict,
  ]);

  const handleDistrictJump = (districtId: DistrictId) => {
    const dist = DISTRICTS.find((d) => d.id === districtId);
    if (!dist) return;
    teleportImmediately(dist.plazaCoords.x, dist.plazaCoords.z + 8);
    visitDistrict(dist.id);
  };

  const handleFastTravelCoords = (x: number, z: number, label: string) => {
    teleportImmediately(x, z);
    for (const d of DISTRICTS) {
      if (Math.hypot(x - d.plazaCoords.x, z - d.plazaCoords.z) < 26) {
        visitDistrict(d.id);
      }
    }
    for (const ow of OPEN_WORLD_DISTRICTS) {
      if (Math.hypot(x - ow.plazaCoords.x, z - ow.plazaCoords.z) < 46) {
        visitOuterDistrict(ow.id);
      }
    }
    notify('Fast Travel Complete', `Arrived at ${label}.`);
  };

  const resetCamera = () => {
    camYawRef.current = 0;
    camPitchRef.current = 0.36;
    camDistanceRef.current = 13;
  };

  const handleMobileJump = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    jumpBufferRef.current = 0.14;
  };

  // Virtual Joystick Handlers
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
  const handleJoyStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joyOriginRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joyOriginRef.current) return;
    const maxR = 34;
    const dx = THREE.MathUtils.clamp(e.clientX - joyOriginRef.current.x, -maxR, maxR);
    const dy = THREE.MathUtils.clamp(e.clientY - joyOriginRef.current.y, -maxR, maxR);
    joystickRef.current = { x: dx / maxR, y: dy / maxR };
    setJoyVisual({ x: dx, y: dy });
  };
  const handleJoyEnd = () => {
    joyOriginRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    setJoyVisual({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 select-none">
      {/* Isolated WebGL Viewport */}
      <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />

      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/95 p-6 text-center z-20">
          <p className="text-lg font-semibold text-slate-900">3D Graphics Context Paused</p>
          <p className="mt-1 text-sm text-slate-600 max-w-md">
            Your browser temporarily suspended WebGL rendering. Switch graphics quality to Eco in Settings or reload the viewport.
          </p>
        </div>
      )}

      {/* Minimal Top-Left Location & Controls Hint */}
      {!hudHidden && (
        <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col gap-1.5">
          <div className="pointer-events-auto inline-flex items-center gap-2.5 rounded-xl bg-white/92 border border-slate-200 px-3.5 py-2 shadow-sm">
            <Compass className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">{currentDistrictName}</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">
              WASD Move · Shift Run · Space Jump · M Map · Drag Orbit
            </span>
          </div>
        </div>
      )}

      {/* Proximity Action Prompt */}
      {!hudHidden && proximity && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => {
              if (proximity.kind === 'building') {
                openGame(proximity.game);
              } else if (proximity.kind === 'npc') {
                openNpc(proximity.npc);
              } else {
                discoverLandmark(proximity.landmark.id);
                const linked = GAMES_CATALOG.find((g) => g.id === proximity.landmark.linkedGameId);
                if (linked) openGame(linked);
              }
            }}
            className="flex items-center gap-3 rounded-xl bg-slate-900 text-white px-5 py-2.5 shadow-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {proximity.kind === 'building' ? (
              <>
                <Gamepad2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold">
                  Enter {proximity.game.buildingName} ({proximity.game.title})
                </span>
                <span className="font-mono-tabular text-xs bg-white/15 px-1.5 py-0.5 rounded">E</span>
              </>
            ) : proximity.kind === 'npc' ? (
              <>
                <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm font-semibold">
                  Talk to {proximity.npc.name}
                  <span className="hidden sm:inline font-normal text-slate-300"> · {proximity.npc.role}</span>
                </span>
                <span className="font-mono-tabular text-xs bg-white/15 px-1.5 py-0.5 rounded">E</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold">
                  Explore {proximity.landmark.name}
                </span>
                <span className="font-mono-tabular text-xs bg-white/15 px-1.5 py-0.5 rounded">E</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Responsive Mobile / Tablet Virtual Touch Joystick & Jump Button */}
      {!hudHidden && (
        <>
          <div
            onPointerDown={handleJoyStart}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyEnd}
            onPointerCancel={handleJoyEnd}
            className={`${isTouchDevice ? 'flex' : 'md:hidden flex'} absolute bottom-24 left-5 z-10 w-24 h-24 rounded-full bg-white/85 border border-slate-300 shadow-sm items-center justify-center touch-none`}
            aria-label="Movement joystick"
          >
            <div
              style={{ transform: `translate(${joyVisual.x}px, ${joyVisual.y}px)` }}
              className="w-10 h-10 rounded-full bg-sky-600 shadow-sm"
            />
          </div>

          <button
            type="button"
            onPointerDown={handleMobileJump}
            className={`${isTouchDevice ? 'flex' : 'md:hidden flex'} absolute bottom-24 right-5 z-10 w-16 h-16 rounded-full bg-white/90 border border-slate-300 shadow-sm items-center justify-center text-slate-800 active:bg-sky-600 active:text-white active:border-sky-600 transition-colors touch-none`}
            aria-label="Jump"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 max-w-[95vw]">
        {/* Expandable 6 Outer Open-World Districts Fast-Travel Tray */}
        {!hudHidden && outerMenuOpen && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-white/95 border border-slate-200 px-3 py-2 shadow-lg">
            <span className="text-xs font-semibold text-slate-500 px-1 whitespace-nowrap">Outer Districts:</span>
            {OPEN_WORLD_DISTRICTS.map((ow) => (
              <button
                key={ow.id}
                type="button"
                onClick={() => {
                  handleFastTravelCoords(ow.plazaCoords.x, ow.plazaCoords.z + 8, ow.name);
                  setOuterMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ow.accentHex }} />
                <span>{ow.name}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setHudHidden((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          {hudHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{hudHidden ? 'Show City Controls (H)' : 'Hide Controls (H)'}</span>
        </button>

        {!hudHidden && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-white/95 border border-slate-200 px-3 py-2 shadow-md">
            <span className="text-xs font-medium text-slate-500 px-1.5 hidden sm:inline whitespace-nowrap">
              Fast Travel:
            </span>
            {DISTRICTS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDistrictJump(d.id)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors whitespace-nowrap shrink-0"
              >
                {d.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOuterMenuOpen((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                outerMenuOpen ? 'bg-sky-100 text-sky-800' : 'text-sky-700 hover:bg-sky-50'
              }`}
            >
              <span>Outer Districts</span>
              {outerMenuOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <span className="h-4 w-px bg-slate-200 mx-0.5" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                setMapSnapshot({
                  x: playerPosRef.current.x,
                  z: playerPosRef.current.z,
                  yaw: playerYawRef.current,
                });
                setMapOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 transition-colors whitespace-nowrap shrink-0"
              title="Open Interactive World Map (M)"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>World Map (M)</span>
            </button>
            <button
              type="button"
              onClick={resetCamera}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              title="Reset camera angle"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Cam</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const outerMatch = OPEN_WORLD_DISTRICTS.find((d) => d.name === currentDistrictName);
                if (outerMatch && worldRef.current) {
                  const guideAgent = worldRef.current.livingNpcs.interactiveMap.get(outerMatch.guideNpc.id);
                  if (guideAgent) {
                    openNpc(guideAgent.spec.npcInfo);
                    return;
                  }
                }
                const nearestDist = DISTRICTS.find((d) => d.name === currentDistrictName) ?? DISTRICTS[0];
                openNpc(nearestDist.npc);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>District Mentor</span>
            </button>
          </div>
        )}
      </div>

      <WorldMapModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        playerPos={{ x: mapSnapshot.x, z: mapSnapshot.z }}
        playerYaw={mapSnapshot.yaw}
        onFastTravel={handleFastTravelCoords}
      />
    </div>
  );
};
