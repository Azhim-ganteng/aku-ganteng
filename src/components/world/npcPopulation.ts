import * as THREE from 'three';
import { DISTRICTS } from '../../data/districts';
import { AMBIENT_NPCS, AmbientNpcSpec } from '../../data/livingNpcs';
import { OPEN_WORLD_DISTRICTS } from '../../data/openWorldData';
import { NPCDefinition, QualityTier } from '../../types/eduworld';
import { SpatialWorldIndex } from './spatialGrid';

function getNpcGroundY(x: number, z: number): number {
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i].plazaCoords;
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz <= 16.2 * 16.2) {
      return 0.14;
    }
  }
  for (let i = 0; i < OPEN_WORLD_DISTRICTS.length; i++) {
    const d = OPEN_WORLD_DISTRICTS[i].plazaCoords;
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz <= 18.8 * 18.8) {
      return 0.16;
    }
  }
  return 0.01;
}

export interface BuildingObstacleBox {
  x: number;
  z: number;
  halfW: number;
  cosYaw: number;
  sinYaw: number;
}

export interface StaticCircleObstacle {
  x: number;
  z: number;
  radius: number;
  walkableTop: boolean;
}

export type NpcAnimState =
  | 'idle'
  | 'walking'
  | 'turning'
  | 'talking'
  | 'sitting'
  | 'standing'
  | 'greeting'
  | 'looking_around';

export interface LivingNpcAgent {
  spec: AmbientNpcSpec;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  badgeMesh: THREE.Mesh | null;
  hitProxy: THREE.Mesh | null;
  x: number;
  z: number;
  y: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  animState: NpcAnimState;
  walkCycle: number;
  stateTimer: number;
  greetCooldown: number;
  waypointIndex: number;
  phaseOffset: number;
  isMobile: boolean;
  shadowIndex: number;
}

export interface LivingNpcSystemHandle {
  agents: LivingNpcAgent[];
  hitProxies: THREE.Mesh[];
  interactiveMap: Map<string, LivingNpcAgent>;
  update: (
    delta: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    buildings: BuildingObstacleBox[],
    circles: StaticCircleObstacle[],
    spatialGrid?: SpatialWorldIndex,
  ) => void;
  getNearestInteractive: (playerPos: THREE.Vector3, maxDist: number) => { npc: NPCDefinition; dist: number } | null;
  dispose: () => void;
}

export function buildLivingNpcSystem(
  scene: THREE.Scene,
  contactShadowMap: THREE.Texture,
  lowCostMode: boolean,
  qualityTier: QualityTier,
  extraSpecs: AmbientNpcSpec[] = [],
): LivingNpcSystemHandle {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Scale active NPC count by device capability while keeping all 7 inner categories + all 6 outer guides represented
  const maxInner = lowCostMode ? 16 : qualityTier === 'high' ? AMBIENT_NPCS.length : 26;
  const maxOuter = lowCostMode ? 6 : qualityTier === 'high' ? extraSpecs.length : 12;
  const activeSpecs = [...AMBIENT_NPCS.slice(0, maxInner), ...extraSpecs.slice(0, maxOuter)];

  // Shared Geometries across all living NPCs (zero per-NPC geometry duplication)
  const legGeo = track(new THREE.CapsuleGeometry(0.125, 0.42, 5, 8));
  const bootGeo = track(new THREE.BoxGeometry(0.24, 0.14, 0.34));
  const armGeo = track(new THREE.CapsuleGeometry(0.095, 0.38, 5, 8));
  const cuffGeo = track(new THREE.CylinderGeometry(0.105, 0.105, 0.1, 8));
  const torsoGeo = track(new THREE.BoxGeometry(0.6, 0.72, 0.36));
  const chestTrimGeo = track(new THREE.BoxGeometry(0.44, 0.3, 0.39));
  const beltGeo = track(new THREE.BoxGeometry(0.62, 0.1, 0.38));
  const headGeo = track(new THREE.SphereGeometry(0.29, 14, 10));
  const visorGeo = track(new THREE.BoxGeometry(0.42, 0.15, 0.22));
  const hairShortGeo = track(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const hairBobGeo = track(new THREE.SphereGeometry(0.32, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.74));
  const capBrimGeo = track(new THREE.BoxGeometry(0.56, 0.04, 0.56));
  const capCrownGeo = track(new THREE.CylinderGeometry(0.23, 0.26, 0.14, 12));
  const glassesGeo = track(new THREE.BoxGeometry(0.42, 0.1, 0.12));
  const backpackGeo = track(new THREE.BoxGeometry(0.42, 0.46, 0.2));
  const satchelGeo = track(new THREE.BoxGeometry(0.38, 0.32, 0.16));
  const tabletGeo = track(new THREE.BoxGeometry(0.24, 0.32, 0.04));
  const badgeGeo = track(new THREE.OctahedronGeometry(0.16, 0));
  const hitProxyGeo = track(new THREE.CylinderGeometry(1.1, 1.1, 2.7, 8));
  const hitProxyMat = track(new THREE.MeshBasicMaterial({ visible: false }));

  // Material Pool (deduplicates GPU shader materials by hex color & finish)
  const matPool = new Map<string, THREE.MeshStandardMaterial>();
  const getMat = (hex: string, roughness = 0.46, metalness = 0.14, emissiveHex?: string): THREE.MeshStandardMaterial => {
    const key = `${hex}|${roughness}|${metalness}|${emissiveHex ?? ''}`;
    let m = matPool.get(key);
    if (!m) {
      m = track(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(hex),
          roughness,
          metalness,
          emissive: emissiveHex ? new THREE.Color(emissiveHex) : new THREE.Color(0x000000),
          emissiveIntensity: emissiveHex ? 0.32 : 0,
        }),
      );
      matPool.set(key, m);
    }
    return m;
  };

  const darkTrimMat = getMat('#1E293B', 0.62, 0.25);
  const hairMatDark = getMat('#1E293B', 0.78, 0.05);
  const hairMatWarm = getMat('#5C3D28', 0.78, 0.05);
  const tabletScreenMat = getMat('#38BDF8', 0.2, 0.15, '#0284C7');
  const shadowGeo = track(new THREE.PlaneGeometry(1.3, 1.3));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: contactShadowMap,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const shadowInstanced = new THREE.InstancedMesh(shadowGeo, shadowMat, activeSpecs.length);
  shadowInstanced.frustumCulled = false;
  const shadowDummy = new THREE.Object3D();

  const agents: LivingNpcAgent[] = [];
  const hitProxies: THREE.Mesh[] = [];
  const interactiveMap = new Map<string, LivingNpcAgent>();

  activeSpecs.forEach((spec, idx) => {
    const app = spec.appearance;
    const suitMat = getMat(app.suitColor, 0.42, 0.16);
    const accentMat = getMat(app.accentColor, 0.3, 0.52);
    const pantsMat = getMat(app.pantsColor, 0.64, 0.18);
    const visorMat = getMat(app.skinOrVisorColor, 0.14, 0.25, app.skinOrVisorColor);

    const root = new THREE.Group();
    const spawnY = getNpcGroundY(spec.spawn.x, spec.spawn.z);
    root.position.set(spec.spawn.x, spawnY, spec.spawn.z);
    root.rotation.y = spec.spawn.yaw;
    root.scale.setScalar(app.scale);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // Legs (pivoted at hip y=0.72)
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.17, 0.72, 0);
    const lLegMesh = new THREE.Mesh(legGeo, pantsMat);
    lLegMesh.position.y = -0.28;
    lLegMesh.castShadow = !lowCostMode;
    const lBoot = new THREE.Mesh(bootGeo, accentMat);
    lBoot.position.set(0, -0.58, 0.04);
    leftLeg.add(lLegMesh, lBoot);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.17, 0.72, 0);
    const rLegMesh = new THREE.Mesh(legGeo, pantsMat);
    rLegMesh.position.y = -0.28;
    rLegMesh.castShadow = !lowCostMode;
    const rBoot = new THREE.Mesh(bootGeo, accentMat);
    rBoot.position.set(0, -0.58, 0.04);
    rightLeg.add(rLegMesh, rBoot);

    // Torso & Jacket
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 1.1;
    torso.castShadow = !lowCostMode;
    const chestPlate = new THREE.Mesh(chestTrimGeo, accentMat);
    chestPlate.position.set(0, 1.2, 0.01);
    const belt = new THREE.Mesh(beltGeo, darkTrimMat);
    belt.position.set(0, 0.78, 0);

    // Arms (pivoted at shoulders y=1.42)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.4, 1.42, 0);
    const lArmMesh = new THREE.Mesh(armGeo, suitMat);
    lArmMesh.position.y = -0.24;
    const lCuff = new THREE.Mesh(cuffGeo, accentMat);
    lCuff.position.y = -0.44;
    leftArm.add(lArmMesh, lCuff);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.4, 1.42, 0);
    const rArmMesh = new THREE.Mesh(armGeo, suitMat);
    rArmMesh.position.y = -0.24;
    const rCuff = new THREE.Mesh(cuffGeo, accentMat);
    rCuff.position.y = -0.44;
    rightArm.add(rArmMesh, rCuff);

    // Head + Visor/Hair/Cap/Glasses
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.76, 0);
    const headMesh = new THREE.Mesh(headGeo, suitMat);
    headMesh.castShadow = !lowCostMode;
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.01, 0.18);
    headGroup.add(headMesh, visor);

    const hairChoice = idx % 2 === 0 ? hairMatDark : hairMatWarm;
    if (app.headStyle === 'scholar-cap') {
      const crown = new THREE.Mesh(capCrownGeo, darkTrimMat);
      crown.position.set(0, 0.24, 0);
      const brim = new THREE.Mesh(capBrimGeo, accentMat);
      brim.position.set(0, 0.32, 0);
      headGroup.add(crown, brim);
    } else if (app.headStyle === 'hair-short') {
      const hair = new THREE.Mesh(hairShortGeo, hairChoice);
      hair.position.set(0, 0.06, -0.02);
      headGroup.add(hair);
    } else if (app.headStyle === 'hair-bob') {
      const hair = new THREE.Mesh(hairBobGeo, hairChoice);
      hair.position.set(0, 0.03, -0.04);
      headGroup.add(hair);
    }

    if (app.accessory === 'glasses') {
      const glasses = new THREE.Mesh(glassesGeo, darkTrimMat);
      glasses.position.set(0, 0.03, 0.26);
      headGroup.add(glasses);
    } else if (app.accessory === 'backpack') {
      const pack = new THREE.Mesh(backpackGeo, accentMat);
      pack.position.set(0, 1.15, -0.24);
      bodyGroup.add(pack);
    } else if (app.accessory === 'satchel') {
      const satchel = new THREE.Mesh(satchelGeo, accentMat);
      satchel.position.set(0.28, 0.88, -0.08);
      bodyGroup.add(satchel);
    } else if (app.accessory === 'tablet') {
      const tab = new THREE.Mesh(tabletGeo, tabletScreenMat);
      tab.position.set(0, -0.48, 0.12);
      tab.rotation.x = -0.5;
      leftArm.add(tab);
    }

    bodyGroup.add(leftLeg, rightLeg, torso, chestPlate, belt, leftArm, rightArm, headGroup);

    // Interactive indicator diamond + clickable hitProxy
    let badgeMesh: THREE.Mesh | null = null;
    let hitProxy: THREE.Mesh | null = null;
    if (spec.interactive) {
      badgeMesh = new THREE.Mesh(badgeGeo, accentMat);
      badgeMesh.position.set(0, 2.38, 0);
      bodyGroup.add(badgeMesh);

      hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
      hitProxy.position.y = 1.25;
      hitProxy.layers.set(1);
      hitProxy.userData = { kind: 'ambient-npc', npcId: spec.id };
      root.add(hitProxy);
      hitProxies.push(hitProxy);
    }

    // Apply initial seated pose immediately if bench-sitting
    const isSitting = spec.behavior === 'sit';
    if (isSitting) {
      bodyGroup.position.y = -0.08;
      leftLeg.rotation.x = -Math.PI / 2;
      rightLeg.rotation.x = -Math.PI / 2;
      leftArm.rotation.x = -0.35;
      rightArm.rotation.x = -0.35;
    }

    scene.add(root);

    shadowDummy.position.set(spec.spawn.x, spawnY + 0.022, spec.spawn.z);
    shadowDummy.rotation.set(0, 0, 0);
    shadowDummy.scale.setScalar(app.scale);
    shadowDummy.updateMatrix();
    shadowInstanced.setMatrixAt(idx, shadowDummy.matrix);

    const agent: LivingNpcAgent = {
      spec,
      root,
      bodyGroup,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      badgeMesh,
      hitProxy,
      x: spec.spawn.x,
      z: spec.spawn.z,
      y: spawnY,
      yaw: spec.spawn.yaw,
      vx: 0,
      vz: 0,
      speed: 0,
      animState: isSitting ? 'sitting' : spec.behavior === 'converse' ? 'talking' : spec.behavior === 'patrol' ? 'walking' : 'idle',
      walkCycle: idx * 0.9,
      stateTimer: 1.5 + (idx % 5) * 0.9,
      greetCooldown: 0,
      waypointIndex: spec.waypoints && spec.waypoints.length > 1 ? 1 : 0,
      phaseOffset: idx * 1.17,
      isMobile: spec.behavior === 'patrol',
      shadowIndex: idx,
    };

    agents.push(agent);
    if (spec.interactive) {
      interactiveMap.set(spec.id, agent);
    }
  });

  shadowInstanced.instanceMatrix.needsUpdate = true;
  shadowInstanced.computeBoundingSphere();
  scene.add(shadowInstanced);

  let frameCounter = 0;

  const update = (
    delta: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    buildings: BuildingObstacleBox[],
    circles: StaticCircleObstacle[],
    spatialGrid?: SpatialWorldIndex,
  ) => {
    frameCounter++;
    let shadowDirty = false;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const dxPlayer = playerPos.x - a.x;
      const dzPlayer = playerPos.z - a.z;
      const distSq = dxPlayer * dxPlayer + dzPlayer * dzPlayer;

      // Distance-based Animation & AI LOD throttling
      let dt = delta;
      let isFar = false;
      if (distSq > 4225) {
        // > 65m: update every 4th frame
        if ((frameCounter + i) % 4 !== 0) continue;
        dt = Math.min(0.16, delta * 4);
        isFar = true;
      } else if (distSq > 900) {
        // 30m - 65m: update every 2nd frame
        if ((frameCounter + i) % 2 !== 0) continue;
        dt = Math.min(0.09, delta * 2);
      }

      if (a.greetCooldown > 0) a.greetCooldown = Math.max(0, a.greetCooldown - dt);
      a.stateTimer -= dt;

      // Interactive float diamond gentle spin
      if (a.badgeMesh && !isFar) {
        a.badgeMesh.rotation.y = elapsed * 1.6 + a.phaseOffset;
        a.badgeMesh.position.y = 2.38 + Math.sin(elapsed * 2.4 + a.phaseOffset) * 0.06;
      }

      // 1. AI State & Autonomous Movement
      const nearPlayer = distSq < 25; // < 5m
      let desiredVx = 0;
      let desiredVz = 0;
      let targetYaw = a.yaw;

      if (a.spec.behavior === 'sit') {
        a.animState = nearPlayer && a.spec.interactive ? 'greeting' : 'sitting';
        targetYaw = a.spec.spawn.yaw;
      } else if (a.spec.behavior === 'converse') {
        if (nearPlayer && a.greetCooldown <= 0 && a.spec.interactive) {
          a.animState = 'greeting';
          a.stateTimer = 2.4;
          a.greetCooldown = 11;
        }
        if (a.animState === 'greeting') {
          targetYaw = Math.atan2(dxPlayer, dzPlayer);
          if (a.stateTimer <= 0) {
            a.animState = 'talking';
            a.stateTimer = 3.0 + (i % 3);
          }
        } else {
          targetYaw = a.spec.spawn.yaw;
          if (a.stateTimer <= 0) {
            a.animState = a.animState === 'talking' ? 'idle' : 'talking';
            a.stateTimer = 2.6 + ((i * 7) % 3);
          }
        }
      } else if (a.spec.behavior === 'guard') {
        if (nearPlayer && a.greetCooldown <= 0) {
          a.animState = 'greeting';
          a.stateTimer = 2.8;
          a.greetCooldown = 10;
        }
        if (a.animState === 'greeting') {
          targetYaw = Math.atan2(dxPlayer, dzPlayer);
          if (a.stateTimer <= 0) {
            a.animState = 'idle';
            a.stateTimer = 3.2;
          }
        } else {
          targetYaw = nearPlayer ? Math.atan2(dxPlayer, dzPlayer) : a.spec.spawn.yaw;
          if (a.stateTimer <= 0) {
            const roll = (Math.floor(elapsed) + i) % 4;
            a.animState =
              roll === 0 ? 'looking_around' : roll === 1 ? 'talking' : roll === 2 ? 'standing' : 'idle';
            a.stateTimer = 3.2 + (i % 3);
          }
        }
      } else if (a.spec.behavior === 'patrol' && a.spec.waypoints && a.spec.waypoints.length > 0) {
        // Trigger polite greeting pause when player steps close
        if (nearPlayer && a.greetCooldown <= 0 && distSq < 18) {
          a.animState = 'greeting';
          a.stateTimer = 2.3;
          a.greetCooldown = 12;
        }

        if (a.animState === 'greeting') {
          targetYaw = Math.atan2(dxPlayer, dzPlayer);
          if (a.stateTimer <= 0) {
            a.animState = 'walking';
          }
        } else if (a.animState === 'looking_around' || a.animState === 'talking') {
          if (a.stateTimer <= 0) {
            a.animState = 'walking';
          }
        } else {
          // Walking toward current waypoint
          const wp = a.spec.waypoints[a.waypointIndex];
          const toX = wp.x - a.x;
          const toZ = wp.z - a.z;
          const wpDist = Math.hypot(toX, toZ);

          if (wpDist < 1.15) {
            a.waypointIndex = (a.waypointIndex + 1) % a.spec.waypoints.length;
            // Occasionally pause to look around or chat before continuing
            if ((a.waypointIndex + i) % 3 === 0) {
              a.animState = (i + a.waypointIndex) % 2 === 0 ? 'looking_around' : 'idle';
              a.stateTimer = 2.4 + (i % 3) * 0.8;
            }
          } else {
            const baseSpeed = a.spec.walkSpeed ?? 2.0;
            let dirX = toX / wpDist;
            let dirZ = toZ / wpDist;

            // Lightweight Obstacle & Crowd Avoidance Steering
            let steerX = 0;
            let steerZ = 0;

            // Avoid buildings & open-world facilities (O(1) spatial hash when provided)
            if (spatialGrid) {
              const nearBoxes = spatialGrid.queryBoxes(a.x, a.z, 10);
              for (let bIdx = 0; bIdx < nearBoxes.length; bIdx++) {
                const b = nearBoxes[bIdx];
                if (b.topY < 0.35) continue;
                const bdx = a.x - b.x;
                const bdz = a.z - b.z;
                const lx = bdx * b.cosYaw - bdz * b.sinYaw;
                const lz = bdx * b.sinYaw + bdz * b.cosYaw;
                const avoidW = b.halfW + 1.15;
                const avoidD = b.halfD + 1.15;
                if (Math.abs(lx) < avoidW && Math.abs(lz) < avoidD) {
                  const pushLocalX = Math.abs(lx) / avoidW > Math.abs(lz) / avoidD ? Math.sign(lx || 1) : 0;
                  const pushLocalZ = pushLocalX === 0 ? Math.sign(lz || 1) : 0;
                  steerX += (pushLocalX * b.cosYaw + pushLocalZ * b.sinYaw) * 2.4;
                  steerZ += (-pushLocalX * b.sinYaw + pushLocalZ * b.cosYaw) * 2.4;
                }
              }

              const nearCircles = spatialGrid.queryCircles(a.x, a.z, 6);
              for (let cIdx = 0; cIdx < nearCircles.length; cIdx++) {
                const obs = nearCircles[cIdx];
                if (obs.walkableTop && obs.radius > 10) continue;
                const cdx = a.x - obs.x;
                const cdz = a.z - obs.z;
                const minR = obs.radius + 0.9;
                const cDistSq = cdx * cdx + cdz * cdz;
                if (cDistSq < minR * minR && cDistSq > 1e-4) {
                  const cDist = Math.sqrt(cDistSq);
                  const strength = ((minR - cDist) / minR) * 2.2;
                  steerX += (cdx / cDist) * strength;
                  steerZ += (cdz / cDist) * strength;
                }
              }

              const waterPush = spatialGrid.resolveWaterBoundary(a.x, a.z, 0.8);
              if (waterPush) {
                steerX += waterPush.nx * 2.8;
                steerZ += waterPush.nz * 2.8;
              }
            } else {
              for (let bIdx = 0; bIdx < buildings.length; bIdx++) {
                const b = buildings[bIdx];
                const bdx = a.x - b.x;
                const bdz = a.z - b.z;
                if (bdx * bdx + bdz * bdz > 60) continue;
                const lx = bdx * b.cosYaw - bdz * b.sinYaw;
                const lz = bdx * b.sinYaw + bdz * b.cosYaw;
                const avoidHalf = b.halfW + 1.15;
                if (Math.abs(lx) < avoidHalf && Math.abs(lz) < avoidHalf) {
                  const pushLocalX = Math.abs(lx) > Math.abs(lz) ? Math.sign(lx || 1) : 0;
                  const pushLocalZ = Math.abs(lz) >= Math.abs(lx) ? Math.sign(lz || 1) : 0;
                  steerX += (pushLocalX * b.cosYaw + pushLocalZ * b.sinYaw) * 2.4;
                  steerZ += (-pushLocalX * b.sinYaw + pushLocalZ * b.cosYaw) * 2.4;
                }
              }

              for (let cIdx = 0; cIdx < circles.length; cIdx++) {
                const obs = circles[cIdx];
                if (obs.walkableTop && obs.radius > 10) continue;
                const cdx = a.x - obs.x;
                const cdz = a.z - obs.z;
                const minR = obs.radius + 0.9;
                const cDistSq = cdx * cdx + cdz * cdz;
                if (cDistSq < minR * minR && cDistSq > 1e-4) {
                  const cDist = Math.sqrt(cDistSq);
                  const strength = ((minR - cDist) / minR) * 2.2;
                  steerX += (cdx / cDist) * strength;
                  steerZ += (cdz / cDist) * strength;
                }
              }
            }

            // Avoid walking through other NPCs
            for (let nIdx = 0; nIdx < agents.length; nIdx++) {
              if (nIdx === i) continue;
              const other = agents[nIdx];
              const ndx = a.x - other.x;
              const ndz = a.z - other.z;
              const nDistSq = ndx * ndx + ndz * ndz;
              if (nDistSq < 1.35 * 1.35 && nDistSq > 1e-4) {
                const nDist = Math.sqrt(nDistSq);
                const push = ((1.35 - nDist) / 1.35) * 1.8;
                steerX += (ndx / nDist) * push;
                steerZ += (ndz / nDist) * push;
              }
            }

            // Yield gently to player so NPC never collides with or blocks player path
            if (distSq < 2.25 && distSq > 1e-4) {
              const pDist = Math.sqrt(distSq);
              steerX -= (dxPlayer / pDist) * 2.6;
              steerZ -= (dzPlayer / pDist) * 2.6;
            }

            dirX += steerX;
            dirZ += steerZ;
            const norm = Math.hypot(dirX, dirZ) || 1;
            dirX /= norm;
            dirZ /= norm;

            desiredVx = dirX * baseSpeed;
            desiredVz = dirZ * baseSpeed;
            targetYaw = Math.atan2(dirX, dirZ);

            // Check turning angle to trigger smooth 'turning' state blend
            let yawDiff = targetYaw - a.yaw;
            while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
            while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
            a.animState = Math.abs(yawDiff) > 0.75 ? 'turning' : 'walking';
          }
        }
      }

      // Smooth velocity & position integration
      a.vx = THREE.MathUtils.damp(a.vx, desiredVx, 8, dt);
      a.vz = THREE.MathUtils.damp(a.vz, desiredVz, 8, dt);
      a.speed = Math.hypot(a.vx, a.vz);

      if (a.speed > 0.04) {
        a.x += a.vx * dt;
        a.z += a.vz * dt;
        const targetGroundY = getNpcGroundY(a.x, a.z);
        a.y = THREE.MathUtils.damp(a.y, targetGroundY, 12, dt);
        a.root.position.set(a.x, a.y, a.z);

        a.spec.npcInfo.coords.x = a.x;
        a.spec.npcInfo.coords.z = a.z;

        shadowDummy.position.set(a.x, a.y + 0.022, a.z);
        shadowDummy.rotation.set(0, 0, 0);
        shadowDummy.scale.setScalar(a.spec.appearance.scale);
        shadowDummy.updateMatrix();
        shadowInstanced.setMatrixAt(a.shadowIndex, shadowDummy.matrix);
        shadowDirty = true;
      }

      // Smooth shortest-angle turning
      let diff = targetYaw - a.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.yaw += diff * (1 - Math.exp(-7.5 * dt));
      a.root.rotation.y = a.yaw;

      // 2. Smooth Procedural Skeletal Animations (skipped to neutral on far > 65m tier)
      if (isFar) {
        if (a.spec.behavior === 'sit') {
          a.bodyGroup.position.y = -0.08;
          a.leftLeg.rotation.x = -Math.PI / 2;
          a.rightLeg.rotation.x = -Math.PI / 2;
          a.leftArm.rotation.x = -0.35;
          a.rightArm.rotation.x = -0.35;
        } else {
          a.bodyGroup.position.y = 0;
          a.leftLeg.rotation.x = 0;
          a.rightLeg.rotation.x = 0;
          a.leftArm.rotation.x = 0;
          a.rightArm.rotation.x = 0;
        }
        a.leftArm.rotation.z = -0.03;
        a.rightArm.rotation.z = 0.03;
        continue;
      }

      const breath = Math.sin(elapsed * 2.1 + a.phaseOffset);

      if (a.animState === 'sitting') {
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, -0.08, 10, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, -0.06, 10, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, -Math.PI / 2, 12, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, -Math.PI / 2, 12, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, -0.35 + breath * 0.03, 10, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -0.35 - breath * 0.03, 10, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.08, 10, dt);
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 0.08, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(
          a.headGroup.rotation.y,
          Math.sin(elapsed * 0.7 + a.phaseOffset) * 0.22,
          5,
          dt,
        );
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, 0.08, 6, dt);
      } else if (a.animState === 'walking' || a.animState === 'turning') {
        a.walkCycle += dt * (4.2 + a.speed * 2.2);
        const amp = Math.min(0.55, a.speed * 0.24);
        const swing = Math.sin(a.walkCycle) * amp;
        const bob = Math.abs(Math.sin(a.walkCycle)) * 0.04;

        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, bob, 14, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, 0.05, 10, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, swing, 14, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, -swing, 14, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, -swing * 0.78, 14, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, swing * 0.78, 14, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.04, 10, dt);
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 0.04, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(
          a.headGroup.rotation.y,
          a.animState === 'turning' ? THREE.MathUtils.clamp(diff * 0.45, -0.4, 0.4) : 0,
          8,
          dt,
        );
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, 0, 10, dt);
      } else if (a.animState === 'greeting') {
        const isSeatedGreet = a.spec.behavior === 'sit';
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, isSeatedGreet ? -0.08 : 0.01, 10, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, 0, 10, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, isSeatedGreet ? -Math.PI / 2 : 0, 12, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, isSeatedGreet ? -Math.PI / 2 : 0, 12, dt);
        const wave = Math.sin(elapsed * 7.5 + a.phaseOffset) * 0.28;
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 2.25 + wave, 14, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -0.35, 12, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, breath * 0.04, 10, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.05, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(a.headGroup.rotation.y, 0, 8, dt);
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, Math.sin(elapsed * 4) * 0.06, 8, dt);
      } else if (a.animState === 'talking') {
        const g1 = Math.sin(elapsed * 3.8 + a.phaseOffset);
        const g2 = Math.cos(elapsed * 2.9 + a.phaseOffset);
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, (breath + 1) * 0.012, 10, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, 0.03 * g2, 8, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, 0, 12, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, 0, 12, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, -0.45 + g1 * 0.25, 10, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -0.42 - g2 * 0.28, 10, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.14 - g1 * 0.08, 10, dt);
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 0.14 + g2 * 0.08, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(a.headGroup.rotation.y, g2 * 0.18, 6, dt);
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, g1 * 0.09, 6, dt);
      } else if (a.animState === 'looking_around') {
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, (breath + 1) * 0.01, 10, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, 0, 10, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, 0, 12, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, 0, 12, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, breath * 0.03, 10, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -breath * 0.03, 10, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.04, 10, dt);
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 0.04, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(
          a.headGroup.rotation.y,
          Math.sin(elapsed * 1.15 + a.phaseOffset) * 0.45,
          5,
          dt,
        );
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, -0.05, 6, dt);
      } else if (a.animState === 'standing') {
        // Attentive upright standing posture (e.g. teachers / entrance guides)
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, (breath + 1) * 0.008, 10, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, -0.02, 10, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, 0, 12, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, 0, 12, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, -0.14 + breath * 0.02, 10, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -0.06 - breath * 0.02, 10, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.05, 10, dt);
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 0.05, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(
          a.headGroup.rotation.y,
          Math.sin(elapsed * 0.65 + a.phaseOffset) * 0.14,
          6,
          dt,
        );
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, 0, 6, dt);
      } else {
        // idle
        a.bodyGroup.position.y = THREE.MathUtils.damp(a.bodyGroup.position.y, (breath + 1) * 0.012, 10, dt);
        a.bodyGroup.rotation.x = THREE.MathUtils.damp(a.bodyGroup.rotation.x, 0, 10, dt);
        a.leftLeg.rotation.x = THREE.MathUtils.damp(a.leftLeg.rotation.x, 0, 12, dt);
        a.rightLeg.rotation.x = THREE.MathUtils.damp(a.rightLeg.rotation.x, 0, 12, dt);
        a.leftArm.rotation.x = THREE.MathUtils.damp(a.leftArm.rotation.x, breath * 0.04, 10, dt);
        a.rightArm.rotation.x = THREE.MathUtils.damp(a.rightArm.rotation.x, -breath * 0.04, 10, dt);
        a.leftArm.rotation.z = THREE.MathUtils.damp(a.leftArm.rotation.z, -0.03, 10, dt);
        a.rightArm.rotation.z = THREE.MathUtils.damp(a.rightArm.rotation.z, 0.03, 10, dt);
        a.headGroup.rotation.y = THREE.MathUtils.damp(
          a.headGroup.rotation.y,
          Math.sin(elapsed * 0.8 + a.phaseOffset) * 0.08,
          6,
          dt,
        );
        a.headGroup.rotation.x = THREE.MathUtils.damp(a.headGroup.rotation.x, 0, 6, dt);
      }
    }

    if (shadowDirty) {
      shadowInstanced.instanceMatrix.needsUpdate = true;
    }
  };

  const getNearestInteractive = (
    playerPos: THREE.Vector3,
    maxDist: number,
  ): { npc: NPCDefinition; dist: number } | null => {
    let best: { npc: NPCDefinition; dist: number } | null = null;
    let bestDist = maxDist;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (!a.spec.interactive) continue;
      const d = Math.hypot(playerPos.x - a.x, playerPos.z - a.z);
      if (d < bestDist) {
        bestDist = d;
        best = { npc: a.spec.npcInfo, dist: d };
      }
    }
    return best;
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    agents,
    hitProxies,
    interactiveMap,
    update,
    getNearestInteractive,
    dispose,
  };
}
