import * as THREE from 'three';
import { QualityTier } from '../../types/eduworld';

export interface ProceduralTextureSet {
  limestoneMap: THREE.CanvasTexture;
  limestoneNormal: THREE.CanvasTexture;
  limestoneRoughness: THREE.CanvasTexture;
  limestoneAo: THREE.CanvasTexture;
  glassMap: THREE.CanvasTexture;
  glassRoughness: THREE.CanvasTexture;
  glassNormal: THREE.CanvasTexture;
  glassEmissive: THREE.CanvasTexture;
  titaniumRoughness: THREE.CanvasTexture;
  titaniumNormal: THREE.CanvasTexture;
  roofGardenMap: THREE.CanvasTexture;
  roofGardenNormal: THREE.CanvasTexture;
  solarPanelMap: THREE.CanvasTexture;
  solarPanelNormal: THREE.CanvasTexture;
  plazaMap: THREE.CanvasTexture;
  plazaNormal: THREE.CanvasTexture;
  plazaAo: THREE.CanvasTexture;
  plazaEdgeMap: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  grassNormal: THREE.CanvasTexture;
  grassRoughness: THREE.CanvasTexture;
  roadMap: THREE.CanvasTexture;
  roadNormal: THREE.CanvasTexture;
  roadRoughness: THREE.CanvasTexture;
  roadAo: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  sidewalkNormal: THREE.CanvasTexture;
  sidewalkRoughness: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  barkNormal: THREE.CanvasTexture;
  barkRoughness: THREE.CanvasTexture;
  foliageMap: THREE.CanvasTexture;
  foliageNormal: THREE.CanvasTexture;
  foliageRoughness: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  buildingAoSkirtMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

// Deterministic pseudo-random helper so procedural textures look consistent & crisp
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

// Convert a grayscale height canvas into a tangent-space normal map CanvasTexture
function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  repeatX = 1,
  repeatY = 1,
  maxAniso = 4,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [outCanvas, outCtx] = makeCanvas(w);
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createCityTextureSet(
  renderer: THREE.WebGLRenderer,
  lowCostMode: boolean,
  qualityTier: QualityTier = 'auto',
): ProceduralTextureSet {
  // High-definition 1024px maps on desktop/GPU, balanced 512px on Eco/software WebGL
  const res = lowCostMode ? 512 : 1024;
  const subRes = lowCostMode ? 256 : 512;
  const capAniso = renderer.capabilities.getMaxAnisotropy();
  const maxAniso = lowCostMode ? 2 : qualityTier === 'high' ? Math.min(16, capAniso) : Math.min(8, capAniso);
  const textures: THREE.Texture[] = [];

  const register = (tex: THREE.CanvasTexture, isSrgb: boolean, rx = 1, ry = 1): THREE.CanvasTexture => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (isSrgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    textures.push(tex);
    return tex;
  };

  // 1. High-Definition Two-Tone Architectural Limestone & Composite Cladding (Avoids washed-out white!)
  const [limeColorC, limeColorCtx] = makeCanvas(res);
  const [limeHeightC, limeHeightCtx] = makeCanvas(res);
  const [limeRoughC, limeRoughCtx] = makeCanvas(res);
  const [limeAoC, limeAoCtx] = makeCanvas(res);

  limeColorCtx.fillStyle = '#94a3b8';
  limeColorCtx.fillRect(0, 0, res, res);
  limeHeightCtx.fillStyle = '#505050';
  limeHeightCtx.fillRect(0, 0, res, res);
  limeRoughCtx.fillStyle = '#d4d4d4';
  limeRoughCtx.fillRect(0, 0, res, res);
  limeAoCtx.fillStyle = '#ffffff';
  limeAoCtx.fillRect(0, 0, res, res);

  const cols = 4;
  const rows = 8;
  const pw = res / cols;
  const ph = res / rows;
  const seamPx = Math.max(3, Math.round(res / 190));

  for (let r = 0; r < rows; r++) {
    const xOffset = (r % 2) * (pw * 0.5);
    const isAccentCourse = r % 4 === 0;
    for (let c = -1; c <= cols; c++) {
      const px = c * pw + xOffset;
      const py = r * ph;
      const shade = Math.round((hash2(c + 10, r + 20) - 0.5) * 14);
      // Warm architectural limestone/sandstone-ivory (~216-226 instead of 248 white) with slate accent courses
      const base = isAccentCourse ? 188 + shade : 218 + shade;
      limeColorCtx.fillStyle = isAccentCourse
        ? `rgb(${base - 4}, ${base + 2}, ${base + 10})`
        : `rgb(${base + 4}, ${base + 3}, ${base})`;
      limeColorCtx.fillRect(px + seamPx, py + seamPx, pw - seamPx * 2, ph - seamPx * 2);

      // Horizontal travertine sedimentary veining
      for (let s = 0; s < 3; s++) {
        const sy = py + seamPx + hash2(c * 7 + s, r * 11) * (ph - seamPx * 3);
        limeColorCtx.fillStyle = 'rgba(100, 116, 139, 0.14)';
        limeColorCtx.fillRect(px + seamPx, sy, pw - seamPx * 2, Math.max(2, res / 320));
      }

      // Inner chamfered panel bevel highlight
      limeColorCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      limeColorCtx.lineWidth = Math.max(1, seamPx * 0.5);
      limeColorCtx.strokeRect(px + seamPx + 2, py + seamPx + 2, pw - seamPx * 2 - 4, ph - seamPx * 2 - 4);

      const roughVal = (isAccentCourse ? 148 : 186) + Math.round(hash2(c * 3, r * 7) * 30);
      limeRoughCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      limeRoughCtx.fillRect(px + seamPx, py + seamPx, pw - seamPx * 2, ph - seamPx * 2);

      // Fine mineral pores
      const fleckCount = lowCostMode ? 8 : 18;
      for (let f = 0; f < fleckCount; f++) {
        const fx = px + 6 + hash2(c * 13 + f, r * 17) * (pw - 12);
        const fy = py + 6 + hash2(c * 19, r * 23 + f) * (ph - 12);
        limeColorCtx.fillStyle = 'rgba(71, 85, 105, 0.16)';
        limeColorCtx.fillRect(fx, fy, 2, 2);
      }

      // Raised block body + crisp recessed reveal groove
      limeHeightCtx.fillStyle = isAccentCourse ? '#d0d0d0' : '#ececec';
      limeHeightCtx.fillRect(px + seamPx, py + seamPx, pw - seamPx * 2, ph - seamPx * 2);

      // Clean per-panel crevice & chamfer AO (no full-tile vertical stripe so repeat(1,2) never seams mid-wall)
      limeAoCtx.strokeStyle = '#64748b';
      limeAoCtx.lineWidth = seamPx * 2.4;
      limeAoCtx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      limeAoCtx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      limeAoCtx.lineWidth = seamPx * 4.0;
      limeAoCtx.strokeRect(px + seamPx, py + seamPx, pw - seamPx * 2, ph - seamPx * 2);
    }
  }

  const limestoneMap = register(new THREE.CanvasTexture(limeColorC), true, 1, 2);
  const limestoneRoughness = register(new THREE.CanvasTexture(limeRoughC), false, 1, 2);
  const limestoneAo = register(new THREE.CanvasTexture(limeAoC), false, 1, 2);
  const limestoneNormal = heightCanvasToNormalTexture(limeHeightC, 3.2, 1, 2, maxAniso);
  textures.push(limestoneNormal);

  // 2. High-Contrast Deep Tinted Architectural Glass Curtain Wall (Dark Frames + Interior Room Depth)
  const [glassColorC, glassColorCtx] = makeCanvas(res);
  const [glassRoughC, glassRoughCtx] = makeCanvas(res);
  const [glassHeightC, glassHeightCtx] = makeCanvas(res);
  const [glassEmitC, glassEmitCtx] = makeCanvas(res);

  // Dark anodized aluminum mullions & spandrel frames
  glassColorCtx.fillStyle = '#1e293b';
  glassColorCtx.fillRect(0, 0, res, res);
  glassRoughCtx.fillStyle = '#686868';
  glassRoughCtx.fillRect(0, 0, res, res);
  glassHeightCtx.fillStyle = '#f4f4f4';
  glassHeightCtx.fillRect(0, 0, res, res);
  glassEmitCtx.fillStyle = '#000000';
  glassEmitCtx.fillRect(0, 0, res, res);

  const gCols = 4;
  const gRows = 6;
  const gw = res / gCols;
  const gh = res / gRows;
  const mullionPad = Math.max(6, Math.round(res / 84));

  for (let r = 0; r < gRows; r++) {
    for (let c = 0; c < gCols; c++) {
      const gx = c * gw;
      const gy = r * gh;
      const px = gx + mullionPad;
      const py = gy + mullionPad;
      const pwPane = gw - mullionPad * 2;
      const phPane = gh - mullionPad * 2;

      // Deep sapphire-slate glazed tint with crisp sky reflection gradient
      const paneGrad = glassColorCtx.createLinearGradient(px, py, px + pwPane * 0.35, py + phPane);
      const roomTone = hash2(c * 5 + 1, r * 9 + 2);
      paneGrad.addColorStop(0, '#3876a8');
      paneGrad.addColorStop(0.35, roomTone > 0.5 ? '#1b4970' : '#163d61');
      paneGrad.addColorStop(0.75, '#0f2b46');
      paneGrad.addColorStop(1, '#091c30');
      glassColorCtx.fillStyle = paneGrad;
      glassColorCtx.fillRect(px, py, pwPane, phPane);

      // Subtle architectural spandrel band & diagonal sky sheen inside each pane
      glassColorCtx.fillStyle = 'rgba(186, 230, 253, 0.28)';
      glassColorCtx.fillRect(px + 2, py + 2, pwPane - 4, phPane * 0.22);

      // Subtle diagonal sky reflection glint across upper glazing
      glassColorCtx.fillStyle = 'rgba(224, 242, 254, 0.14)';
      glassColorCtx.beginPath();
      glassColorCtx.moveTo(px + pwPane * 0.12, py + 2);
      glassColorCtx.lineTo(px + pwPane * 0.45, py + 2);
      glassColorCtx.lineTo(px + pwPane * 0.18, py + phPane * 0.72);
      glassColorCtx.lineTo(px + 2, py + phPane * 0.72);
      glassColorCtx.closePath();
      glassColorCtx.fill();

      // Subtle interior architectural Venetian blinds on select office bays
      if (roomTone > 0.45) {
        glassColorCtx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        for (let b = 0; b < 4; b++) {
          glassColorCtx.fillRect(px + 3, py + 4 + b * (phPane * 0.08), pwPane - 6, Math.max(1.5, res / 420));
        }
      }

      // Inner window sill shadow & metallic frame gasket highlight
      glassColorCtx.fillStyle = 'rgba(15, 23, 42, 0.44)';
      glassColorCtx.fillRect(px, py + phPane - Math.max(4, res / 170), pwPane, Math.max(4, res / 170));
      glassColorCtx.strokeStyle = 'rgba(148, 163, 184, 0.34)';
      glassColorCtx.lineWidth = Math.max(1, res / 512);
      glassColorCtx.strokeRect(px - 1, py - 1, pwPane + 2, phPane + 2);

      // Mirror-smooth glass roughness (~0.06) vs satin-matte dark mullions
      glassRoughCtx.fillStyle = '#0e0e0e';
      glassRoughCtx.fillRect(px, py, pwPane, phPane);

      // Recessed glass plane inside proud mullions
      glassHeightCtx.fillStyle = '#5a5a5a';
      glassHeightCtx.fillRect(px, py, pwPane, phPane);

      // Varied warm-amber & cool-cyan office/lab interior glow (with overhead ceiling light bar)
      const isWarmRoom = hash2(c * 11, r * 7) > 0.66;
      const roomStrength = roomTone > 0.3 ? 115 + roomTone * 115 : 46 + roomTone * 50;
      if (isWarmRoom) {
        glassEmitCtx.fillStyle = `rgb(${Math.round(roomStrength)}, ${Math.round(roomStrength * 0.84)}, ${Math.round(roomStrength * 0.58)})`;
      } else {
        glassEmitCtx.fillStyle = `rgb(${Math.round(roomStrength * 0.45)}, ${Math.round(roomStrength * 0.78)}, ${Math.round(roomStrength)})`;
      }
      glassEmitCtx.fillRect(px + 3, py + 3, pwPane - 6, phPane - 6);
      if (roomTone > 0.35) {
        glassEmitCtx.fillStyle = isWarmRoom ? 'rgba(254, 243, 199, 0.55)' : 'rgba(224, 242, 254, 0.52)';
        glassEmitCtx.fillRect(px + pwPane * 0.18, py + 5, pwPane * 0.64, Math.max(3, phPane * 0.1));
      }

      // Secondary horizontal transom & vertical center mullion bar
      const transomY = py + phPane * 0.6;
      const barT = Math.max(3, Math.round(mullionPad * 0.5));
      glassColorCtx.fillStyle = '#334155';
      glassColorCtx.fillRect(px, transomY, pwPane, barT);
      glassColorCtx.fillRect(px + pwPane * 0.5 - barT * 0.4, py, barT * 0.8, phPane);

      glassRoughCtx.fillStyle = '#646464';
      glassRoughCtx.fillRect(px, transomY, pwPane, barT);
      glassRoughCtx.fillRect(px + pwPane * 0.5 - barT * 0.4, py, barT * 0.8, phPane);

      glassHeightCtx.fillStyle = '#d4d4d4';
      glassHeightCtx.fillRect(px, transomY, pwPane, barT);
      glassHeightCtx.fillRect(px + pwPane * 0.5 - barT * 0.4, py, barT * 0.8, phPane);

      glassEmitCtx.fillStyle = '#000000';
      glassEmitCtx.fillRect(px, transomY, pwPane, barT);
      glassEmitCtx.fillRect(px + pwPane * 0.5 - barT * 0.4, py, barT * 0.8, phPane);
    }
  }

  const glassMap = register(new THREE.CanvasTexture(glassColorC), true, 1, 2);
  const glassRoughness = register(new THREE.CanvasTexture(glassRoughC), false, 1, 2);
  const glassEmissive = register(new THREE.CanvasTexture(glassEmitC), true, 1, 2);
  const glassNormal = heightCanvasToNormalTexture(glassHeightC, 3.4, 1, 2, maxAniso);
  textures.push(glassNormal);

  // 3. Brushed Architectural Titanium & Anodized Slate Steel
  const [tiRoughC, tiRoughCtx] = makeCanvas(res);
  const [tiHeightC, tiHeightCtx] = makeCanvas(res);
  tiRoughCtx.fillStyle = '#525252';
  tiRoughCtx.fillRect(0, 0, res, res);
  tiHeightCtx.fillStyle = '#808080';
  tiHeightCtx.fillRect(0, 0, res, res);
  for (let y = 0; y < res; y += 2) {
    const v = 64 + Math.round(hash2(y, 17) * 36);
    tiRoughCtx.fillStyle = `rgb(${v},${v},${v})`;
    tiRoughCtx.fillRect(0, y, res, 1);
    const hv = 110 + Math.round(hash2(19, y) * 36);
    tiHeightCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    tiHeightCtx.fillRect(0, y, res, 1);
  }
  const titaniumRoughness = register(new THREE.CanvasTexture(tiRoughC), false, 1, 3);
  const titaniumNormal = heightCanvasToNormalTexture(tiHeightC, 1.8, 1, 3, maxAniso);
  textures.push(titaniumNormal);

  // 4. Roof Terrace Botanical Garden Texture
  const [roofGC, roofGCtx] = makeCanvas(subRes);
  const [roofGH, roofGHCtx] = makeCanvas(subRes);
  roofGCtx.fillStyle = '#15803d';
  roofGCtx.fillRect(0, 0, subRes, subRes);
  roofGHCtx.fillStyle = '#848484';
  roofGHCtx.fillRect(0, 0, subRes, subRes);
  const patchCount = lowCostMode ? 550 : 1300;
  for (let i = 0; i < patchCount; i++) {
    const gx = hash2(i, 4.1) * subRes;
    const gy = hash2(6.3, i) * subRes;
    const t = hash2(i * 0.4, i * 0.9);
    roofGCtx.fillStyle = t > 0.5 ? 'rgba(74, 222, 128, 0.36)' : 'rgba(20, 83, 45, 0.42)';
    roofGCtx.fillRect(gx, gy, 4, 4);
    const hv = Math.round(95 + t * 90);
    roofGHCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    roofGHCtx.fillRect(gx, gy, 4, 4);
  }
  const roofGardenMap = register(new THREE.CanvasTexture(roofGC), true, 2, 2);
  const roofGardenNormal = heightCanvasToNormalTexture(roofGH, 1.8, 2, 2, maxAniso);
  textures.push(roofGardenNormal);

  // 5. Rooftop Photovoltaic Solar Panel Array Texture
  const [solC, solCtx] = makeCanvas(subRes);
  const [solH, solHCtx] = makeCanvas(subRes);
  solCtx.fillStyle = '#1e293b';
  solCtx.fillRect(0, 0, subRes, subRes);
  solHCtx.fillStyle = '#c8c8c8';
  solHCtx.fillRect(0, 0, subRes, subRes);
  const sCols = 4;
  const sRows = 6;
  const sw = subRes / sCols;
  const sh = subRes / sRows;
  for (let r = 0; r < sRows; r++) {
    for (let c = 0; c < sCols; c++) {
      const sx = c * sw + 3;
      const sy = r * sh + 3;
      const cellW = sw - 6;
      const cellH = sh - 6;
      const cellGrad = solCtx.createLinearGradient(sx, sy, sx + cellW, sy + cellH);
      cellGrad.addColorStop(0, '#163b6b');
      cellGrad.addColorStop(0.55, '#0f294a');
      cellGrad.addColorStop(1, '#091b34');
      solCtx.fillStyle = cellGrad;
      solCtx.fillRect(sx, sy, cellW, cellH);

      // Fine silver photovoltaic busbars
      solCtx.fillStyle = 'rgba(203, 213, 225, 0.32)';
      solCtx.fillRect(sx + cellW * 0.32, sy, 1, cellH);
      solCtx.fillRect(sx + cellW * 0.68, sy, 1, cellH);

      solCtx.strokeStyle = 'rgba(148, 163, 184, 0.48)';
      solCtx.lineWidth = 1.5;
      solCtx.strokeRect(sx, sy, cellW, cellH);
      solHCtx.fillStyle = '#909090';
      solHCtx.fillRect(sx, sy, cellW, cellH);
    }
  }
  const solarPanelMap = register(new THREE.CanvasTexture(solC), true, 1, 1);
  const solarPanelNormal = heightCanvasToNormalTexture(solH, 2.4, 1, 1, maxAniso);
  textures.push(solarPanelNormal);

  // 6. High-Detail Warm Architectural Travertine Plaza Deck (Richer tone so shadows & contrast pop!)
  const [plazaColorC, plazaColorCtx] = makeCanvas(res);
  const [plazaHeightC, plazaHeightCtx] = makeCanvas(res);
  const [plazaAoC, plazaAoCtx] = makeCanvas(res);

  plazaColorCtx.fillStyle = '#94a3b8';
  plazaColorCtx.fillRect(0, 0, res, res);
  plazaHeightCtx.fillStyle = '#707070';
  plazaHeightCtx.fillRect(0, 0, res, res);
  plazaAoCtx.fillStyle = '#ffffff';
  plazaAoCtx.fillRect(0, 0, res, res);

  const tiles = 8;
  const ts = res / tiles;
  const pSeam = Math.max(2, Math.round(res / 340));
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x = tx * ts;
      const y = ty * ts;
      const delta = Math.round((hash2(tx * 7, ty * 11) - 0.5) * 14);
      const isSlateBand = (tx + ty) % 4 === 0;
      if (isSlateBand) {
        plazaColorCtx.fillStyle = `rgb(${168 + delta}, ${179 + delta}, ${192 + delta})`;
      } else {
        plazaColorCtx.fillStyle = `rgb(${202 + delta}, ${208 + delta}, ${214 + delta})`;
      }
      plazaColorCtx.fillRect(x + pSeam, y + pSeam, ts - pSeam * 2, ts - pSeam * 2);

      const grainN = lowCostMode ? 5 : 14;
      for (let g = 0; g < grainN; g++) {
        const gx = x + 4 + hash2(tx * 17 + g, ty * 29) * (ts - 8);
        const gy = y + 4 + hash2(tx * 31, ty * 13 + g) * (ts - 8);
        plazaColorCtx.fillStyle = 'rgba(71, 85, 105, 0.14)';
        plazaColorCtx.fillRect(gx, gy, 2, 2);
      }

      plazaHeightCtx.fillStyle = '#e2e2e2';
      plazaHeightCtx.fillRect(x + pSeam, y + pSeam, ts - pSeam * 2, ts - pSeam * 2);

      plazaAoCtx.strokeStyle = '#8b99ab';
      plazaAoCtx.lineWidth = Math.max(3, res / 170);
      plazaAoCtx.strokeRect(x, y, ts, ts);
    }
  }
  const plazaMap = register(new THREE.CanvasTexture(plazaColorC), true, 24, 24);
  const plazaAo = register(new THREE.CanvasTexture(plazaAoC), false, 24, 24);
  const plazaNormal = heightCanvasToNormalTexture(plazaHeightC, 2.2, 24, 24, maxAniso);
  textures.push(plazaNormal);

  // Soft Plaza-to-Meadow Edge Blend Ring Texture
  const [pEdgeC, pEdgeCtx] = makeCanvas(256);
  const edgeGrad = pEdgeCtx.createRadialGradient(128, 128, 72, 128, 128, 126);
  edgeGrad.addColorStop(0, 'rgba(148, 163, 184, 0.85)');
  edgeGrad.addColorStop(0.55, 'rgba(100, 116, 139, 0.38)');
  edgeGrad.addColorStop(1, 'rgba(100, 116, 139, 0)');
  pEdgeCtx.fillStyle = edgeGrad;
  pEdgeCtx.fillRect(0, 0, 256, 256);
  const plazaEdgeMap = new THREE.CanvasTexture(pEdgeC);
  plazaEdgeMap.colorSpace = THREE.SRGBColorSpace;
  textures.push(plazaEdgeMap);

  // 7. Rich Natural Solarpunk Meadow Grass (Vibrant emerald/sage greens instead of pale gray!)
  const [grassC, grassCtx] = makeCanvas(res);
  const [grassH, grassHCtx] = makeCanvas(res);
  const [grassRC, grassRCtx] = makeCanvas(res);
  grassCtx.fillStyle = '#4e8a52';
  grassCtx.fillRect(0, 0, res, res);
  grassHCtx.fillStyle = '#808080';
  grassHCtx.fillRect(0, 0, res, res);
  grassRCtx.fillStyle = '#dcdddd';
  grassRCtx.fillRect(0, 0, res, res);

  // Broad organic lawn variation patches (moss vs sunlit clover meadow)
  const lawnPatches = lowCostMode ? 28 : 64;
  for (let p = 0; p < lawnPatches; p++) {
    const px = hash2(p * 3.1, 7.2) * res;
    const py = hash2(9.4, p * 2.3) * res;
    const rad = res * (0.09 + hash2(p, p * 1.7) * 0.16);
    const pGrad = grassCtx.createRadialGradient(px, py, 2, px, py, rad);
    const warm = hash2(p * 1.9, 4.7) > 0.5;
    pGrad.addColorStop(0, warm ? 'rgba(106, 168, 92, 0.42)' : 'rgba(54, 110, 62, 0.44)');
    pGrad.addColorStop(1, 'rgba(78, 138, 82, 0)');
    grassCtx.fillStyle = pGrad;
    grassCtx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }

  const bladeCount = lowCostMode ? 1800 : 4400;
  for (let i = 0; i < bladeCount; i++) {
    const gx = hash2(i, 1.3) * res;
    const gy = hash2(2.7, i) * res;
    const tone = hash2(i * 0.7, i * 0.3);
    grassCtx.fillStyle =
      tone > 0.66
        ? 'rgba(122, 186, 102, 0.54)'
        : tone > 0.32
          ? 'rgba(56, 112, 64, 0.52)'
          : 'rgba(88, 152, 86, 0.52)';
    grassCtx.fillRect(gx, gy, 3, 7);

    const hv = Math.round(92 + tone * 98);
    grassHCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    grassHCtx.fillRect(gx, gy, 3, 6);

    const rv = Math.round(186 + (1 - tone) * 56);
    grassRCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    grassRCtx.fillRect(gx, gy, 4, 6);
  }
  // Subtle clover & wildflower highlights for crisp close-up ground read
  const speckCount = lowCostMode ? 80 : 220;
  for (let s = 0; s < speckCount; s++) {
    const fx = hash2(s * 3.3, 14.1) * res;
    const fy = hash2(19.7, s * 2.9) * res;
    grassCtx.fillStyle = s % 5 === 0 ? 'rgba(254, 240, 138, 0.42)' : 'rgba(134, 239, 172, 0.34)';
    grassCtx.fillRect(fx, fy, 2, 2);
  }
  const grassMap = register(new THREE.CanvasTexture(grassC), true, 34, 34);
  const grassRoughness = register(new THREE.CanvasTexture(grassRC), false, 34, 34);
  const grassNormal = heightCanvasToNormalTexture(grassH, 2.0, 34, 34, maxAniso);
  textures.push(grassNormal);

  // 8. Architectural Dark-Slate Boulevard Paver Road (Crisp contrast with sidewalks & buildings!)
  const [roadC, roadCtx] = makeCanvas(res);
  const [roadHC, roadHCtx] = makeCanvas(res);
  const [roadRC, roadRCtx] = makeCanvas(res);
  const [roadAoC, roadAoCtx] = makeCanvas(subRes);

  roadCtx.fillStyle = '#334155';
  roadCtx.fillRect(0, 0, res, res);
  roadHCtx.fillStyle = '#686868';
  roadHCtx.fillRect(0, 0, res, res);
  roadRCtx.fillStyle = '#b6b6b6';
  roadRCtx.fillRect(0, 0, res, res);
  roadAoCtx.fillStyle = '#ffffff';
  roadAoCtx.fillRect(0, 0, subRes, subRes);

  const segs = 16;
  const segH = res / segs;
  const subCols = 6;
  const subW = res / subCols;
  for (let s = 0; s < segs; s++) {
    for (let c = 0; c < subCols; c++) {
      const shade = Math.round((hash2(s + c * 3, 31) - 0.5) * 14);
      roadCtx.fillStyle = `rgb(${56 + shade}, ${69 + shade}, ${86 + shade})`;
      roadCtx.fillRect(c * subW + 2, s * segH + 2, subW - 4, segH - 4);

      const rv = 148 + Math.round(hash2(c * 7, s * 11) * 38);
      roadRCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      roadRCtx.fillRect(c * subW + 2, s * segH + 2, subW - 4, segH - 4);

      roadHCtx.fillStyle = '#c8c8c8';
      roadHCtx.fillRect(c * subW + 2, s * segH + 2, subW - 4, segH - 4);
    }
  }
  // Fine stone aggregate grain
  const aggN = lowCostMode ? 500 : 1400;
  for (let i = 0; i < aggN; i++) {
    const ax = hash2(i, 41.2) * res;
    const ay = hash2(29.8, i) * res;
    roadCtx.fillStyle = hash2(i * 0.5, 7) > 0.5 ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.22)';
    roadCtx.fillRect(ax, ay, 2, 2);
  }

  // Crisp bright lane edge markings & subtle dashed lane guides
  roadCtx.fillStyle = 'rgba(241, 245, 249, 0.88)';
  roadCtx.fillRect(res * 0.052, 0, res * 0.032, res);
  roadCtx.fillRect(res * 0.916, 0, res * 0.032, res);
  roadRCtx.fillStyle = '#5c5c5c';
  roadRCtx.fillRect(res * 0.052, 0, res * 0.032, res);
  roadRCtx.fillRect(res * 0.916, 0, res * 0.032, res);

  // Subtle curb-edge gutter AO along left/right edges of road
  const roadEdgeGrad = roadAoCtx.createLinearGradient(0, 0, subRes, 0);
  roadEdgeGrad.addColorStop(0, 'rgba(30, 41, 59, 0.58)');
  roadEdgeGrad.addColorStop(0.14, 'rgba(255, 255, 255, 0)');
  roadEdgeGrad.addColorStop(0.86, 'rgba(255, 255, 255, 0)');
  roadEdgeGrad.addColorStop(1, 'rgba(30, 41, 59, 0.58)');
  roadAoCtx.fillStyle = roadEdgeGrad;
  roadAoCtx.fillRect(0, 0, subRes, subRes);

  const roadMap = register(new THREE.CanvasTexture(roadC), true, 1, 8);
  const roadRoughness = register(new THREE.CanvasTexture(roadRC), false, 1, 8);
  const roadAo = register(new THREE.CanvasTexture(roadAoC), false, 1, 1);
  const roadNormal = heightCanvasToNormalTexture(roadHC, 2.0, 1, 8, maxAniso);
  textures.push(roadNormal);

  // 9. Detailed Sidewalk Concrete Curb & Expansion Joint Pavers
  const [swColorC, swColorCtx] = makeCanvas(subRes);
  const [swHeightC, swHeightCtx] = makeCanvas(subRes);
  const [swRoughC, swRoughCtx] = makeCanvas(subRes);
  swColorCtx.fillStyle = '#94a3b8';
  swColorCtx.fillRect(0, 0, subRes, subRes);
  swHeightCtx.fillStyle = '#707070';
  swHeightCtx.fillRect(0, 0, subRes, subRes);
  swRoughCtx.fillStyle = '#bcbcbc';
  swRoughCtx.fillRect(0, 0, subRes, subRes);

  const swRows = 8;
  const swH = subRes / swRows;
  for (let r = 0; r < swRows; r++) {
    const shade = 198 + Math.round((hash2(r, 43) - 0.5) * 12);
    swColorCtx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 11})`;
    swColorCtx.fillRect(3, r * swH + 3, subRes - 6, swH - 6);

    swHeightCtx.fillStyle = '#dcdcdc';
    swHeightCtx.fillRect(3, r * swH + 3, subRes - 6, swH - 6);

    for (let f = 0; f < 18; f++) {
      const fx = 5 + hash2(r * 13 + f, 51) * (subRes - 10);
      const fy = r * swH + 5 + hash2(61, r * 17 + f) * (swH - 10);
      swColorCtx.fillStyle = 'rgba(71, 85, 105, 0.2)';
      swColorCtx.fillRect(fx, fy, 2, 2);
    }
  }
  const sidewalkMap = register(new THREE.CanvasTexture(swColorC), true, 1, 10);
  const sidewalkRoughness = register(new THREE.CanvasTexture(swRoughC), false, 1, 10);
  const sidewalkNormal = heightCanvasToNormalTexture(swHeightC, 2.1, 1, 10, maxAniso);
  textures.push(sidewalkNormal);

  // 10. Rich Grooved Tree Bark (Albedo, Normal, Roughness)
  const [barkC, barkCtx] = makeCanvas(subRes);
  const [barkH, barkHCtx] = makeCanvas(subRes);
  const [barkRC, barkRCtx] = makeCanvas(subRes);
  barkCtx.fillStyle = '#5c3d28';
  barkCtx.fillRect(0, 0, subRes, subRes);
  barkHCtx.fillStyle = '#888888';
  barkHCtx.fillRect(0, 0, subRes, subRes);
  barkRCtx.fillStyle = '#dcdcdc';
  barkRCtx.fillRect(0, 0, subRes, subRes);

  const barkStrips = lowCostMode ? 48 : 96;
  for (let i = 0; i < barkStrips; i++) {
    const x = (i / barkStrips) * subRes;
    const w = Math.max(2, subRes / barkStrips);
    const t = hash2(i * 1.7, 13.3);
    barkCtx.fillStyle = t > 0.5 ? 'rgba(130, 92, 62, 0.48)' : 'rgba(54, 34, 20, 0.56)';
    barkCtx.fillRect(x, 0, w, subRes);
    const hv = Math.round(60 + t * 135);
    barkHCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    barkHCtx.fillRect(x, 0, w, subRes);
    const rv = Math.round(206 + (1 - t) * 44);
    barkRCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    barkRCtx.fillRect(x, 0, w, subRes);
  }
  const barkMap = register(new THREE.CanvasTexture(barkC), true, 2, 2);
  const barkRoughness = register(new THREE.CanvasTexture(barkRC), false, 2, 2);
  const barkNormal = heightCanvasToNormalTexture(barkH, 2.6, 2, 2, maxAniso);
  textures.push(barkNormal);

  // 11. High-Detail Stylized Botanical Tree Foliage Texture (Albedo, Normal, Roughness)
  const [folC, folCtx] = makeCanvas(subRes);
  const [folH, folHCtx] = makeCanvas(subRes);
  const [folRC, folRCtx] = makeCanvas(subRes);
  folCtx.fillStyle = '#dcecd8';
  folCtx.fillRect(0, 0, subRes, subRes);
  folHCtx.fillStyle = '#787878';
  folHCtx.fillRect(0, 0, subRes, subRes);
  folRCtx.fillStyle = '#c4c4c4';
  folRCtx.fillRect(0, 0, subRes, subRes);

  const leafClusters = lowCostMode ? 240 : 600;
  for (let i = 0; i < leafClusters; i++) {
    const lx = hash2(i * 2.1, 3.7) * subRes;
    const ly = hash2(5.9, i * 1.4) * subRes;
    const lr = (subRes / 32) * (0.65 + hash2(i, i * 0.5) * 0.85);
    const tone = hash2(i * 0.8, 19.1);
    folCtx.fillStyle = tone > 0.52 ? 'rgba(255, 255, 255, 0.65)' : 'rgba(138, 178, 140, 0.62)';
    folCtx.beginPath();
    folCtx.arc(lx, ly, lr, 0, Math.PI * 2);
    folCtx.fill();

    const hv = Math.round(82 + tone * 135);
    folHCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    folHCtx.beginPath();
    folHCtx.arc(lx, ly, lr, 0, Math.PI * 2);
    folHCtx.fill();

    const rv = Math.round(162 + (1 - tone) * 66);
    folRCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    folRCtx.beginPath();
    folRCtx.arc(lx, ly, lr, 0, Math.PI * 2);
    folRCtx.fill();
  }
  const foliageMap = register(new THREE.CanvasTexture(folC), true, 2, 2);
  const foliageRoughness = register(new THREE.CanvasTexture(folRC), false, 2, 2);
  const foliageNormal = heightCanvasToNormalTexture(folH, 2.2, 2, 2, maxAniso);
  textures.push(foliageNormal);

  // 12. Animated Water Ripple Normal Map
  const waveRes = lowCostMode ? 256 : 512;
  const [waterHC, waterHCtx] = makeCanvas(waveRes);
  const wImg = waterHCtx.createImageData(waveRes, waveRes);
  const wd = wImg.data;
  const tau = Math.PI * 2;
  for (let y = 0; y < waveRes; y++) {
    for (let x = 0; x < waveRes; x++) {
      const u = (x / waveRes) * tau;
      const v = (y / waveRes) * tau;
      const wave =
        Math.sin(u * 3 + v * 2) * 0.35 +
        Math.cos(u * 5 - v * 4) * 0.25 +
        Math.sin((u + v) * 7) * 0.15;
      const val = Math.round((wave * 0.5 + 0.5) * 255);
      const idx = (y * waveRes + x) * 4;
      wd[idx] = val;
      wd[idx + 1] = val;
      wd[idx + 2] = val;
      wd[idx + 3] = 255;
    }
  }
  waterHCtx.putImageData(wImg, 0, 0);
  const waterNormal = heightCanvasToNormalTexture(waterHC, 1.85, 12, 12, maxAniso);
  textures.push(waterNormal);

  // 13. Soft Radial Contact Shadow Disc (for avatar & trees)
  const [shadC, shadCtx] = makeCanvas(128);
  const radGrad = shadCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  radGrad.addColorStop(0, 'rgba(15, 23, 42, 0.5)');
  radGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
  radGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  shadCtx.fillStyle = radGrad;
  shadCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadC);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  textures.push(contactShadowMap);

  // 14. Grounded Building Ambient Occlusion Skirt
  const [bAoC, bAoCtx] = makeCanvas(256);
  const bGrad = bAoCtx.createRadialGradient(128, 128, 66, 128, 128, 126);
  bGrad.addColorStop(0, 'rgba(15, 23, 42, 0.54)');
  bGrad.addColorStop(0.62, 'rgba(15, 23, 42, 0.26)');
  bGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  bAoCtx.fillStyle = bGrad;
  bAoCtx.fillRect(0, 0, 256, 256);
  const buildingAoSkirtMap = new THREE.CanvasTexture(bAoC);
  buildingAoSkirtMap.colorSpace = THREE.SRGBColorSpace;
  textures.push(buildingAoSkirtMap);

  return {
    limestoneMap,
    limestoneNormal,
    limestoneRoughness,
    limestoneAo,
    glassMap,
    glassRoughness,
    glassNormal,
    glassEmissive,
    titaniumRoughness,
    titaniumNormal,
    roofGardenMap,
    roofGardenNormal,
    solarPanelMap,
    solarPanelNormal,
    plazaMap,
    plazaNormal,
    plazaAo,
    plazaEdgeMap,
    grassMap,
    grassNormal,
    grassRoughness,
    roadMap,
    roadNormal,
    roadRoughness,
    roadAo,
    sidewalkMap,
    sidewalkNormal,
    sidewalkRoughness,
    barkMap,
    barkNormal,
    barkRoughness,
    foliageMap,
    foliageNormal,
    foliageRoughness,
    waterNormal,
    contactShadowMap,
    buildingAoSkirtMap,
    dispose: () => {
      textures.forEach((t) => t.dispose());
    },
  };
}
