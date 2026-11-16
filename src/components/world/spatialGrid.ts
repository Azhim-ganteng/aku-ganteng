import { BridgeDefinition, WaterBodyDefinition } from '../../types/eduworld';

export interface SpatialCircleObstacle {
  x: number;
  z: number;
  radius: number;
  topY: number;
  walkableTop: boolean;
}

export interface SpatialBoxObstacle {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  topY: number;
  baseY: number;
  cosYaw: number;
  sinYaw: number;
  walkableTop: boolean;
}

export interface WalkableBridgeSurface {
  id: string;
  name: string;
  x: number;
  z: number;
  halfW: number;
  halfL: number;
  archHeight: number;
  cosYaw: number;
  sinYaw: number;
}

export interface SpatialWaterZone {
  kind: 'lake' | 'river';
  points: { x: number; z: number }[];
  halfWidthOrRadius: number;
}

const CELL_SIZE = 28;

export class SpatialWorldIndex {
  private readonly circleCells = new Map<number, SpatialCircleObstacle[]>();
  private readonly boxCells = new Map<number, SpatialBoxObstacle[]>();
  private readonly bridges: WalkableBridgeSurface[] = [];
  private readonly waterZones: SpatialWaterZone[] = [];

  // Reusable scratch buffers to avoid allocations in the frame loop
  private readonly queriedCircles: SpatialCircleObstacle[] = [];
  private readonly queriedBoxes: SpatialBoxObstacle[] = [];
  private readonly seenCircleIds = new Set<SpatialCircleObstacle>();
  private readonly seenBoxIds = new Set<SpatialBoxObstacle>();

  private key(cx: number, cz: number): number {
    // Pack signed cell coords cleanly into integer key (supports +/- 10,000 cells)
    return (cx + 1024) * 2048 + (cz + 1024);
  }

  addCircle(obs: SpatialCircleObstacle): void {
    const r = obs.radius + 1.5;
    const minCx = Math.floor((obs.x - r) / CELL_SIZE);
    const maxCx = Math.floor((obs.x + r) / CELL_SIZE);
    const minCz = Math.floor((obs.z - r) / CELL_SIZE);
    const maxCz = Math.floor((obs.z + r) / CELL_SIZE);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const k = this.key(cx, cz);
        let bucket = this.circleCells.get(k);
        if (!bucket) {
          bucket = [];
          this.circleCells.set(k, bucket);
        }
        bucket.push(obs);
      }
    }
  }

  addBox(obs: SpatialBoxObstacle): void {
    const boundR = Math.hypot(obs.halfW, obs.halfD) + 1.5;
    const minCx = Math.floor((obs.x - boundR) / CELL_SIZE);
    const maxCx = Math.floor((obs.x + boundR) / CELL_SIZE);
    const minCz = Math.floor((obs.z - boundR) / CELL_SIZE);
    const maxCz = Math.floor((obs.z + boundR) / CELL_SIZE);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const k = this.key(cx, cz);
        let bucket = this.boxCells.get(k);
        if (!bucket) {
          bucket = [];
          this.boxCells.set(k, bucket);
        }
        bucket.push(obs);
      }
    }
  }

  addBridge(b: BridgeDefinition): void {
    const cosYaw = Math.cos(b.yaw);
    const sinYaw = Math.sin(b.yaw);
    const halfW = b.width * 0.5;
    const halfL = b.length * 0.5;
    this.bridges.push({
      id: b.id,
      name: b.name,
      x: b.x,
      z: b.z,
      halfW,
      halfL,
      archHeight: b.archHeight,
      cosYaw,
      sinYaw,
    });

    // Add side safety parapet railings as boxes so player walks safely across bridge span
    const railOffset = halfW + 0.28;
    [-1, 1].forEach((sideSign) => {
      const rx = b.x + sideSign * railOffset * cosYaw;
      const rz = b.z - sideSign * railOffset * sinYaw;
      this.addBox({
        x: rx,
        z: rz,
        halfW: 0.3,
        halfD: halfL,
        topY: b.archHeight + 1.25,
        baseY: 0,
        cosYaw,
        sinYaw,
        walkableTop: false,
      });
    });
  }

  addWaterBody(wb: WaterBodyDefinition): void {
    this.waterZones.push({
      kind: wb.kind,
      points: wb.points,
      halfWidthOrRadius: wb.kind === 'lake' ? wb.widthOrRadius : wb.widthOrRadius * 0.5,
    });
  }

  queryCircles(x: number, z: number, queryRadius = 6): readonly SpatialCircleObstacle[] {
    this.queriedCircles.length = 0;
    this.seenCircleIds.clear();
    const minCx = Math.floor((x - queryRadius) / CELL_SIZE);
    const maxCx = Math.floor((x + queryRadius) / CELL_SIZE);
    const minCz = Math.floor((z - queryRadius) / CELL_SIZE);
    const maxCz = Math.floor((z + queryRadius) / CELL_SIZE);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.circleCells.get(this.key(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (!this.seenCircleIds.has(item)) {
            this.seenCircleIds.add(item);
            this.queriedCircles.push(item);
          }
        }
      }
    }
    return this.queriedCircles;
  }

  queryBoxes(x: number, z: number, queryRadius = 10): readonly SpatialBoxObstacle[] {
    this.queriedBoxes.length = 0;
    this.seenBoxIds.clear();
    const minCx = Math.floor((x - queryRadius) / CELL_SIZE);
    const maxCx = Math.floor((x + queryRadius) / CELL_SIZE);
    const minCz = Math.floor((z - queryRadius) / CELL_SIZE);
    const maxCz = Math.floor((z + queryRadius) / CELL_SIZE);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.boxCells.get(this.key(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (!this.seenBoxIds.has(item)) {
            this.seenBoxIds.add(item);
            this.queriedBoxes.push(item);
          }
        }
      }
    }
    return this.queriedBoxes;
  }

  /** Evaluates smooth arched deck elevation if (x, z) lies on any walkable bridge */
  getBridgeHeightAt(x: number, z: number, padMargin = 0.25): { height: number; bridgeId: string } | null {
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i];
      const dx = x - b.x;
      const dz = z - b.z;
      if (dx * dx + dz * dz > (b.halfL + 2) * (b.halfL + 2)) continue;
      const lx = dx * b.cosYaw - dz * b.sinYaw;
      const lz = dx * b.sinYaw + dz * b.cosYaw;
      if (Math.abs(lx) <= b.halfW + padMargin && Math.abs(lz) <= b.halfL + 0.3) {
        const u = Math.min(1, Math.abs(lz) / b.halfL);
        const h = 0.08 + b.archHeight * (1 - u * u);
        return { height: h, bridgeId: b.id };
      }
    }
    return null;
  }

  /** Computes nearest deep-water push-out vector if player steps into river/lake off-bridge */
  resolveWaterBoundary(
    x: number,
    z: number,
    playerRadius: number,
  ): { pushX: number; pushZ: number; nx: number; nz: number } | null {
    // Allow crossing anywhere above or on a bridge deck
    if (this.getBridgeHeightAt(x, z, 0.35)) return null;

    for (let i = 0; i < this.waterZones.length; i++) {
      const wz = this.waterZones[i];
      if (wz.kind === 'lake') {
        const p = wz.points[0];
        const dx = x - p.x;
        const dz = z - p.z;
        const minR = wz.halfWidthOrRadius + playerRadius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minR * minR && dSq > 1e-6) {
          const d = Math.sqrt(dSq);
          const nx = dx / d;
          const nz = dz / d;
          return {
            pushX: p.x + nx * minR,
            pushZ: p.z + nz * minR,
            nx,
            nz,
          };
        }
      } else {
        // Piecewise segment check for winding Solarpunk River
        for (let s = 0; s < wz.points.length - 1; s++) {
          const a = wz.points[s];
          const b = wz.points[s + 1];
          const abx = b.x - a.x;
          const abz = b.z - a.z;
          const abLenSq = abx * abx + abz * abz;
          if (abLenSq < 1e-4) continue;
          const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / abLenSq));
          const cx = a.x + abx * t;
          const cz = a.z + abz * t;
          const dx = x - cx;
          const dz = z - cz;
          const minR = wz.halfWidthOrRadius + playerRadius;
          const dSq = dx * dx + dz * dz;
          if (dSq < minR * minR && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            const nx = dx / d;
            const nz = dz / d;
            return {
              pushX: cx + nx * minR,
              pushZ: cz + nz * minR,
              nx,
              nz,
            };
          }
        }
      }
    }
    return null;
  }
}
