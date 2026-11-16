import { DISTRICTS } from './districts';
import { GAMES_CATALOG } from './gamesCatalog';
import { DistrictId, LivingNpcCategory, NPCDefinition } from '../types/eduworld';

export type NpcAccessory = 'satchel' | 'backpack' | 'cap' | 'glasses' | 'tablet' | 'visor' | 'none';
export type NpcHeadStyle = 'helmet' | 'scholar-cap' | 'hair-short' | 'hair-bob';

export interface AmbientNpcAppearance {
  suitColor: string;
  accentColor: string;
  pantsColor: string;
  skinOrVisorColor: string;
  headStyle: NpcHeadStyle;
  accessory: NpcAccessory;
  scale: number;
}

export interface AmbientNpcSpec {
  id: string;
  name: string;
  role: string;
  category: Exclude<LivingNpcCategory, 'mentor'>;
  districtId: DistrictId;
  behavior: 'patrol' | 'sit' | 'converse' | 'guard';
  /** Base spawn coordinate and facing yaw */
  spawn: { x: number; z: number; yaw: number };
  /** Ordered patrol loop points for walking NPCs */
  waypoints?: { x: number; z: number }[];
  walkSpeed?: number;
  /** True if player can approach & interact with this NPC */
  interactive: boolean;
  /** Optional NPC definition shown when interacting */
  npcInfo: NPCDefinition;
  appearance: AmbientNpcAppearance;
}

function getGameCoords(gameId: string): { x: number; z: number; yaw: number } {
  const g = GAMES_CATALOG.find((item) => item.id === gameId);
  if (!g) return { x: 0, z: -20, yaw: 0 };
  const yaw = Math.atan2(-g.buildingCoords.x, -g.buildingCoords.z);
  return { x: g.buildingCoords.x, z: g.buildingCoords.z, yaw };
}

function entranceStandPoint(gameId: string, sideOffset: number, forwardDist = 5.65): { x: number; z: number; yaw: number } {
  const b = getGameCoords(gameId);
  const fwdX = Math.sin(b.yaw);
  const fwdZ = Math.cos(b.yaw);
  const rightX = Math.cos(b.yaw);
  const rightZ = -Math.sin(b.yaw);
  return {
    x: b.x + fwdX * forwardDist + rightX * sideOffset,
    z: b.z + fwdZ * forwardDist + rightZ * sideOffset,
    yaw: b.yaw + (sideOffset >= 0 ? -0.25 : 0.25),
  };
}

function sidewalkPathForDistrict(districtId: DistrictId, sideSign: 1 | -1): { x: number; z: number }[] {
  const dist = DISTRICTS.find((d) => d.id === districtId);
  if (!dist) return [{ x: 0, z: -18 }, { x: 0, z: -34 }];
  const dx = dist.plazaCoords.x;
  const dz = dist.plazaCoords.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const dirX = dx / len;
  const dirZ = dz / len;
  const perpX = Math.cos(angle);
  const perpZ = -Math.sin(angle);
  // Walk centered along the concrete sidewalk edge (3.38m from centerline)
  const lateral = sideSign * 3.38;
  const pts: { x: number; z: number }[] = [];
  const startT = 17.5;
  const endT = len - 18.0;
  pts.push({ x: dirX * startT + perpX * lateral, z: dirZ * startT + perpZ * lateral });
  pts.push({ x: dirX * ((startT + endT) * 0.5) + perpX * lateral, z: dirZ * ((startT + endT) * 0.5) + perpZ * lateral });
  pts.push({ x: dirX * endT + perpX * lateral, z: dirZ * endT + perpZ * lateral });
  pts.push({ x: dirX * ((startT + endT) * 0.5) + perpX * lateral, z: dirZ * ((startT + endT) * 0.5) + perpZ * lateral });
  return pts;
}

function districtLoopWaypoints(districtId: DistrictId, radius = 11.2, clockwise = true): { x: number; z: number }[] {
  const dist = DISTRICTS.find((d) => d.id === districtId);
  if (!dist) return [{ x: 10, z: 0 }, { x: -10, z: 0 }];
  const pts: { x: number; z: number }[] = [];
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const idx = clockwise ? i : steps - 1 - i;
    const a = (idx / steps) * Math.PI * 2 + 0.35;
    pts.push({
      x: dist.plazaCoords.x + Math.cos(a) * radius,
      z: dist.plazaCoords.z + Math.sin(a) * radius,
    });
  }
  return pts;
}

function centralPlazaRingWaypoints(radius: number, clockwise = true, phase = 0): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const idx = clockwise ? i : steps - 1 - i;
    const a = (idx / steps) * Math.PI * 2 + phase;
    pts.push({
      x: Math.sin(a) * radius,
      z: Math.cos(a) * radius,
    });
  }
  return pts;
}

function benchSeatPoint(islandIndex: number, side: 'A' | 'B'): { x: number; z: number; yaw: number } {
  const safePlazaAngles = [1.23, 2.48, -2.48, -1.23];
  const ang = safePlazaAngles[islandIndex % safePlazaAngles.length];
  const px = Math.sin(ang) * 14.2;
  const pz = Math.cos(ang) * 14.2;
  const zLocal = side === 'A' ? 1.38 : -1.38;
  return {
    x: px + zLocal * Math.sin(ang),
    z: pz + zLocal * Math.cos(ang),
    yaw: side === 'A' ? ang : ang + Math.PI,
  };
}

const bench0A = benchSeatPoint(0, 'A');
const bench1A = benchSeatPoint(1, 'A');
const bench2B = benchSeatPoint(2, 'B');
const bench3A = benchSeatPoint(3, 'A');

const solarEnt = entranceStandPoint('solar-system-adventure', 2.05, 5.75);
const chemEnt = entranceStandPoint('chemistry-lab-simulator', -2.05, 5.75);
const mathEnt = entranceStandPoint('math-kingdom', 2.05, 5.75);
const codeEnt = entranceStandPoint('coding-quest', -2.05, 5.75);
const histEnt = entranceStandPoint('history-time-traveler', 2.05, 5.75);
const ecoEnt = entranceStandPoint('eco-city-builder', -2.05, 5.75);
const cyberEnt = entranceStandPoint('cyber-safety-mission', 2.05, 5.75);
const bioEnt = entranceStandPoint('human-body-explorer', -2.05, 5.75);

const stemWalk = sidewalkPathForDistrict('stem-spire', 1);
const logicWalk = sidewalkPathForDistrict('logic-nexus', -1);
const humWalk = sidewalkPathForDistrict('humanities-plaza', 1);
const ecoWalk = sidewalkPathForDistrict('eco-sanctuary', -1);
const civicWalk = sidewalkPathForDistrict('civic-hub', 1);

const centralWalkA = centralPlazaRingWaypoints(12.8, true, 0.2);
const centralWalkB = centralPlazaRingWaypoints(19.2, false, 1.4);
const centralWalkC = centralPlazaRingWaypoints(16.2, true, 3.1);

const stemLoop = districtLoopWaypoints('stem-spire', 11.4, true);
const logicLoop = districtLoopWaypoints('logic-nexus', 11.0, false);
const humLoop = districtLoopWaypoints('humanities-plaza', 11.2, true);
const ecoLoop = districtLoopWaypoints('eco-sanctuary', 11.0, false);

// Ordered by priority so Eco/Low quality slice(0, limit) still includes every NPC category!
export const AMBIENT_NPCS: AmbientNpcSpec[] = [
  // 1. Teachers standing near educational buildings (Interactive!)
  {
    id: 'living-teacher-astro',
    name: 'Prof. Orion Hale',
    role: 'Astrophysics Lecturer',
    category: 'teacher',
    districtId: 'stem-spire',
    behavior: 'guard',
    spawn: solarEnt,
    interactive: true,
    npcInfo: {
      id: 'living-teacher-astro',
      name: 'Prof. Orion Hale',
      role: 'Astrophysics Lecturer',
      districtId: 'stem-spire',
      coords: { x: solarEnt.x, z: solarEnt.z },
      colorHex: '#0284C7',
      greeting: 'Welcome outside Helios Observatory! Watching orbital periods is the fastest way to intuit gravity.',
      suggestedTopic: 'Keplerian Orbits & Planetary Motion',
      category: 'teacher',
      directionsHint: 'Helios Observatory is directly behind me on the northern rim of Science Spire (0, -64).',
      educationalFact: 'Kepler’s Third Law proves that a planet’s orbital period squared is proportional to the cube of its semi-major axis—that is why Neptune takes 165 Earth years per orbit!',
      featuredGameId: 'solar-system-adventure',
      recommendedMissionId: 'mission-first-simulation',
    },
    appearance: {
      suitColor: '#F8FAFC',
      accentColor: '#0284C7',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#0EA5E9',
      headStyle: 'scholar-cap',
      accessory: 'tablet',
      scale: 1.04,
    },
  },
  {
    id: 'living-teacher-math',
    name: 'Dr. Priya Nair',
    role: 'Applied Mathematics Teacher',
    category: 'teacher',
    districtId: 'logic-nexus',
    behavior: 'guard',
    spawn: mathEnt,
    interactive: true,
    npcInfo: {
      id: 'living-teacher-math',
      name: 'Dr. Priya Nair',
      role: 'Applied Mathematics Teacher',
      districtId: 'logic-nexus',
      coords: { x: mathEnt.x, z: mathEnt.z },
      colorHex: '#2563EB',
      greeting: 'Hello! Arithmetic Citadel is buzzing today. Want a quick math insight or mission tip?',
      suggestedTopic: 'Ratios, Sequences & Number Patterns',
      category: 'teacher',
      directionsHint: 'Step through the Arithmetic Citadel doors behind me, or follow the east boulevard back to the Central Plaza.',
      educationalFact: 'In the Fibonacci sequence, dividing consecutive numbers rapidly converges toward the Golden Ratio (φ ≈ 1.618), which appears in spiral galaxies and sunflower seeds.',
      featuredGameId: 'math-kingdom',
      recommendedMissionId: 'mission-practice-streak',
    },
    appearance: {
      suitColor: '#EFF6FF',
      accentColor: '#2563EB',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#3B82F6',
      headStyle: 'hair-bob',
      accessory: 'glasses',
      scale: 1.0,
    },
  },
  {
    id: 'living-guide-eco',
    name: 'Maya Lin',
    role: 'Solarpunk Campus Guide',
    category: 'entrance-guide',
    districtId: 'eco-sanctuary',
    behavior: 'guard',
    spawn: ecoEnt,
    interactive: true,
    npcInfo: {
      id: 'living-guide-eco',
      name: 'Maya Lin',
      role: 'Solarpunk Campus Guide',
      districtId: 'eco-sanctuary',
      coords: { x: ecoEnt.x, z: ecoEnt.z },
      colorHex: '#059669',
      greeting: 'Hi explorer! Notice how every building in EDUWORLD harvests rooftop sunlight and shades its glass?',
      suggestedTopic: 'Net-Zero Urban Design',
      category: 'entrance-guide',
      directionsHint: 'Solarpunk Urban Lab is right behind me, and Biosphere Conservatory is just south at (32, 58).',
      educationalFact: 'Passive brise-soleil window sunshades cut summer cooling loads by up to 35% while still bouncing natural daylight onto interior ceilings.',
      featuredGameId: 'eco-city-builder',
      recommendedMissionId: 'mission-city-scout',
    },
    appearance: {
      suitColor: '#ECFDF5',
      accentColor: '#059669',
      pantsColor: '#334155',
      skinOrVisorColor: '#10B981',
      headStyle: 'hair-bob',
      accessory: 'satchel',
      scale: 0.96,
    },
  },

  // 2. Students walking around Central Plaza & Boulevards
  {
    id: 'living-student-walk-1',
    name: 'Leo Sato',
    role: 'Robotics Student',
    category: 'student-walker',
    districtId: 'logic-nexus',
    behavior: 'patrol',
    spawn: { x: centralWalkA[0].x, z: centralWalkA[0].z, yaw: 0 },
    waypoints: centralWalkA,
    walkSpeed: 2.3,
    interactive: true,
    npcInfo: {
      id: 'living-student-walk-1',
      name: 'Leo Sato',
      role: 'Robotics Student',
      districtId: 'logic-nexus',
      coords: { x: centralWalkA[0].x, z: centralWalkA[0].z },
      colorHex: '#0284C7',
      greeting: 'Hey! I’m heading around the Central Astrolabe to test my courtyard rover script later.',
      suggestedTopic: 'Autonomous Coding & Loops',
      category: 'student-walker',
      directionsHint: 'Follow the northeast sky-blue boulevard straight to Logic & Code Nexus (48, -12) for Coding Quest!',
      educationalFact: 'Decomposing a complex path into reusable loop subroutines lets autonomous robots navigate mazes using a fraction of the code.',
      featuredGameId: 'coding-quest',
      recommendedMissionId: 'mission-polymath-five',
    },
    appearance: {
      suitColor: '#F1F5F9',
      accentColor: '#0EA5E9',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'hair-short',
      accessory: 'backpack',
      scale: 0.95,
    },
  },
  {
    id: 'living-student-walk-2',
    name: 'Zara Mensah',
    role: 'Biology Undergrad',
    category: 'student-walker',
    districtId: 'stem-spire',
    behavior: 'patrol',
    spawn: { x: stemWalk[0].x, z: stemWalk[0].z, yaw: Math.PI },
    waypoints: stemWalk,
    walkSpeed: 2.1,
    interactive: true,
    npcInfo: {
      id: 'living-student-walk-2',
      name: 'Zara Mensah',
      role: 'Biology Undergrad',
      districtId: 'stem-spire',
      coords: { x: stemWalk[0].x, z: stemWalk[0].z },
      colorHex: '#0284C7',
      greeting: 'Walking up the Science Spire sidewalk! Have you visited Bio-Anatomy Dome yet?',
      suggestedTopic: 'Human Physiology & Cellular Respiration',
      category: 'student-walker',
      directionsHint: 'Keep north along this boulevard toward Science Spire (0, -48); Bio-Anatomy Dome is on the left at (-18, -48).',
      educationalFact: 'Your heart pumps roughly 7,500 liters of blood every single day through over 96,000 kilometers of blood vessels!',
      featuredGameId: 'human-body-explorer',
      recommendedMissionId: 'mission-city-scout',
    },
    appearance: {
      suitColor: '#E0F2FE',
      accentColor: '#0284C7',
      pantsColor: '#0F172A',
      skinOrVisorColor: '#0EA5E9',
      headStyle: 'hair-bob',
      accessory: 'satchel',
      scale: 0.94,
    },
  },

  // 3. Students sitting on benches (exact plaza bench coordinates!)
  {
    id: 'living-bench-1',
    name: 'Noah Patel',
    role: 'Honor Roll Student',
    category: 'bench-student',
    districtId: 'stem-spire',
    behavior: 'sit',
    spawn: bench0A,
    interactive: true,
    npcInfo: {
      id: 'living-bench-1',
      name: 'Noah Patel',
      role: 'Honor Roll Student',
      districtId: 'stem-spire',
      coords: { x: bench0A.x, z: bench0A.z },
      colorHex: '#0EA5E9',
      greeting: 'Taking a quick study break on the plaza bench! Reviewing flash notes for Chemistry Lab.',
      suggestedTopic: 'pH Scales & Chemical Reactions',
      category: 'bench-student',
      directionsHint: 'Molecular Synthesis Lab is northeast in Science Spire at (18, -48).',
      educationalFact: 'Because pH is a base-10 logarithmic scale, lemon juice at pH 2 is 10,000 times more acidic than tap water at pH 6.',
      featuredGameId: 'chemistry-lab-simulator',
      recommendedMissionId: 'mission-ai-dialogue',
    },
    appearance: {
      suitColor: '#F8FAFC',
      accentColor: '#F59E0B',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'hair-short',
      accessory: 'tablet',
      scale: 0.93,
    },
  },
  {
    id: 'living-bench-2',
    name: 'Sofia Alvarez',
    role: 'Literature Fellow',
    category: 'bench-student',
    districtId: 'humanities-plaza',
    behavior: 'sit',
    spawn: bench3A,
    interactive: true,
    npcInfo: {
      id: 'living-bench-2',
      name: 'Sofia Alvarez',
      role: 'Literature Fellow',
      districtId: 'humanities-plaza',
      coords: { x: bench3A.x, z: bench3A.z },
      colorHex: '#D97706',
      greeting: 'It’s peaceful sitting here watching the central astrolabe spin. Want a quick writing tip?',
      suggestedTopic: 'Rhetoric & Persuasive Writing',
      category: 'bench-student',
      directionsHint: 'Head west to Humanities Pavilion (-48, -12) — Lexicon Library sits at (-46, -28).',
      educationalFact: 'Combining ethos (credibility), pathos (empathy), and logos (evidence) makes persuasive essays clear and memorable.',
      featuredGameId: 'english-adventure',
      recommendedMissionId: 'mission-grand-explorer',
    },
    appearance: {
      suitColor: '#FEF3C7',
      accentColor: '#D97706',
      pantsColor: '#334155',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'hair-bob',
      accessory: 'glasses',
      scale: 0.92,
    },
  },

  // 4. Group of Students having Conversations (Central Plaza NE & Science Spire)
  {
    id: 'living-conv-central-1',
    name: 'Samir K.',
    role: 'Data Science Student',
    category: 'conversation-group',
    districtId: 'stem-spire',
    behavior: 'converse',
    spawn: { x: 6.4, z: -9.8, yaw: 0.78 },
    interactive: true,
    npcInfo: {
      id: 'living-conv-central-1',
      name: 'Samir K.',
      role: 'Data Science Student',
      districtId: 'stem-spire',
      coords: { x: 6.4, z: -9.8 },
      colorHex: '#0284C7',
      greeting: 'Elena and I were just debating how neural networks learn representations! Care to join?',
      suggestedTopic: 'Machine Learning & Neural Layers',
      category: 'conversation-group',
      directionsHint: 'Neural Nexus Pavilion is at (16, -66) in Science Spire.',
      educationalFact: 'Deep neural networks stack simple linear transforms with nonlinear activation functions so later layers detect high-level concepts.',
      featuredGameId: 'ai-learning-challenge',
      recommendedMissionId: 'mission-ai-dialogue',
    },
    appearance: {
      suitColor: '#E2E8F0',
      accentColor: '#2563EB',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'hair-short',
      accessory: 'backpack',
      scale: 0.96,
    },
  },
  {
    id: 'living-conv-central-2',
    name: 'Elena V.',
    role: 'Physics Student',
    category: 'conversation-group',
    districtId: 'stem-spire',
    behavior: 'converse',
    spawn: { x: 7.9, z: -8.6, yaw: -2.28 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-central-2',
      name: 'Elena V.',
      role: 'Physics Student',
      districtId: 'stem-spire',
      coords: { x: 7.9, z: -8.6 },
      colorHex: '#0EA5E9',
      greeting: 'Hi! Samir and I are comparing physics simulations with neural networks.',
      suggestedTopic: 'Energy Conservation & Optics',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#F8FAFC',
      accentColor: '#0EA5E9',
      pantsColor: '#334155',
      skinOrVisorColor: '#0284C7',
      headStyle: 'hair-bob',
      accessory: 'tablet',
      scale: 0.94,
    },
  },
  {
    id: 'living-conv-central-3',
    name: 'Tariq M.',
    role: 'Architecture Student',
    category: 'conversation-group',
    districtId: 'eco-sanctuary',
    behavior: 'converse',
    spawn: { x: 7.7, z: -10.8, yaw: -0.52 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-central-3',
      name: 'Tariq M.',
      role: 'Architecture Student',
      districtId: 'eco-sanctuary',
      coords: { x: 7.7, z: -10.8 },
      colorHex: '#059669',
      greeting: 'Good to see you exploring the Central Plaza!',
      suggestedTopic: 'Sustainable Campus Design',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#ECFDF5',
      accentColor: '#10B981',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#10B981',
      headStyle: 'hair-short',
      accessory: 'satchel',
      scale: 0.97,
    },
  },

  // 5. Campus Visitors exploring the city
  {
    id: 'living-visitor-1',
    name: 'Clara Jensen',
    role: 'Visiting Scholar',
    category: 'visitor',
    districtId: 'humanities-plaza',
    behavior: 'patrol',
    spawn: { x: centralWalkB[0].x, z: centralWalkB[0].z, yaw: 0 },
    waypoints: centralWalkB,
    walkSpeed: 1.75,
    interactive: true,
    npcInfo: {
      id: 'living-visitor-1',
      name: 'Clara Jensen',
      role: 'Visiting Scholar',
      districtId: 'humanities-plaza',
      coords: { x: centralWalkB[0].x, z: centralWalkB[0].z },
      colorHex: '#D97706',
      greeting: 'What an inspiring futuristic campus! I’m touring all five districts before heading to the Knowledge Museum.',
      suggestedTopic: 'Cross-Disciplinary City Tour',
      category: 'visitor',
      directionsHint: 'Every radial boulevard leads directly to one of the five academic districts; use Fast Travel anytime on the bottom dock!',
      educationalFact: 'The greatest breakthroughs in history—from da Vinci’s flying machines to modern medical imaging—happened where art, math, and science intersect.',
      featuredGameId: 'knowledge-museum',
      recommendedMissionId: 'mission-grand-explorer',
    },
    appearance: {
      suitColor: '#FFFBEB',
      accentColor: '#D97706',
      pantsColor: '#475569',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'helmet',
      accessory: 'visor',
      scale: 0.98,
    },
  },
  {
    id: 'living-visitor-2',
    name: 'Marcus Chen',
    role: 'Parent & Campus Guest',
    category: 'visitor',
    districtId: 'civic-hub',
    behavior: 'patrol',
    spawn: { x: civicWalk[0].x, z: civicWalk[0].z, yaw: 0 },
    waypoints: civicWalk,
    walkSpeed: 1.85,
    interactive: true,
    npcInfo: {
      id: 'living-visitor-2',
      name: 'Marcus Chen',
      role: 'Parent & Campus Guest',
      districtId: 'civic-hub',
      coords: { x: civicWalk[0].x, z: civicWalk[0].z },
      colorHex: '#0D9488',
      greeting: 'I’m visiting Civic Innovation Hub today—impressed by how practical the financial and cyber labs are!',
      suggestedTopic: 'Financial Literacy & Cyber Safety',
      category: 'visitor',
      directionsHint: 'Head southwest down this boulevard to reach Civic Innovation Hub (-32, 42).',
      educationalFact: 'With 7% compound growth, savings roughly double every 10 years thanks to the Rule of 72 (72 ÷ annual rate).',
      featuredGameId: 'smart-money-simulator',
      recommendedMissionId: 'mission-city-scout',
    },
    appearance: {
      suitColor: '#F0FDFA',
      accentColor: '#0D9488',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#14B8A6',
      headStyle: 'hair-short',
      accessory: 'glasses',
      scale: 1.02,
    },
  },

  // 6. More Building Entrance Guides & Teachers (representing all districts)
  {
    id: 'living-guide-cyber',
    name: 'Agent Kira',
    role: 'Cyber Security Instructor',
    category: 'teacher',
    districtId: 'civic-hub',
    behavior: 'guard',
    spawn: cyberEnt,
    interactive: true,
    npcInfo: {
      id: 'living-guide-cyber',
      name: 'Agent Kira',
      role: 'Cyber Security Instructor',
      districtId: 'civic-hub',
      coords: { x: cyberEnt.x, z: cyberEnt.z },
      colorHex: '#0D9488',
      greeting: 'Stay sharp! Cyber Shield Bastion runs live phishing & encryption defense drills inside.',
      suggestedTopic: 'Digital Identity & Encryption',
      category: 'teacher',
      directionsHint: 'Cyber Shield Bastion entrance is right beside me at (-48, 54).',
      educationalFact: 'Using unique passphrases plus hardware or app-based multi-factor authentication blocks over 99% of automated credential attacks.',
      featuredGameId: 'cyber-safety-mission',
      recommendedMissionId: 'mission-master-tier',
    },
    appearance: {
      suitColor: '#0F172A',
      accentColor: '#14B8A6',
      pantsColor: '#0F172A',
      skinOrVisorColor: '#2DD4BF',
      headStyle: 'helmet',
      accessory: 'visor',
      scale: 0.99,
    },
  },
  {
    id: 'living-guide-history',
    name: 'Prof. Julian Reid',
    role: 'Chronicle Historian',
    category: 'entrance-guide',
    districtId: 'humanities-plaza',
    behavior: 'guard',
    spawn: histEnt,
    interactive: true,
    npcInfo: {
      id: 'living-guide-history',
      name: 'Prof. Julian Reid',
      role: 'Chronicle Historian',
      districtId: 'humanities-plaza',
      coords: { x: histEnt.x, z: histEnt.z },
      colorHex: '#D97706',
      greeting: 'Step into the Chrono Archive whenever you’re ready to trace humanity’s boldest turning points!',
      suggestedTopic: 'Scientific Revolutions & Trade Routes',
      category: 'entrance-guide',
      directionsHint: 'Chrono Archive is straight behind me on the western edge of Humanities Pavilion (-60, -12).',
      educationalFact: 'The 15th-century printing press cut book production costs dramatically, accelerating literacy and the Scientific Revolution across continents.',
      featuredGameId: 'history-time-traveler',
      recommendedMissionId: 'mission-grand-explorer',
    },
    appearance: {
      suitColor: '#FEF3C7',
      accentColor: '#B45309',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'scholar-cap',
      accessory: 'tablet',
      scale: 1.03,
    },
  },
  {
    id: 'living-guide-chem',
    name: 'Dr. Nina Park',
    role: 'Chemistry Lab Mentor',
    category: 'entrance-guide',
    districtId: 'stem-spire',
    behavior: 'guard',
    spawn: chemEnt,
    interactive: true,
    npcInfo: {
      id: 'living-guide-chem',
      name: 'Dr. Nina Park',
      role: 'Chemistry Lab Mentor',
      districtId: 'stem-spire',
      coords: { x: chemEnt.x, z: chemEnt.z },
      colorHex: '#0284C7',
      greeting: 'Safety goggles on! Molecular Synthesis Lab has stoichiometry puzzles waiting inside.',
      suggestedTopic: 'Molecular Bonding & Reaction Balance',
      category: 'entrance-guide',
      directionsHint: 'Molecular Synthesis Lab is right behind me at (18, -48).',
      educationalFact: 'Catalysts speed up chemical reactions by lowering activation energy without being consumed in the final equation.',
      featuredGameId: 'chemistry-lab-simulator',
      recommendedMissionId: 'mission-first-simulation',
    },
    appearance: {
      suitColor: '#FFFFFF',
      accentColor: '#0284C7',
      pantsColor: '#334155',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'hair-bob',
      accessory: 'glasses',
      scale: 0.98,
    },
  },
  {
    id: 'living-guide-code',
    name: 'Coach Dev',
    role: 'Robotics & Code Coach',
    category: 'teacher',
    districtId: 'logic-nexus',
    behavior: 'guard',
    spawn: codeEnt,
    interactive: true,
    npcInfo: {
      id: 'living-guide-code',
      name: 'Coach Dev',
      role: 'Robotics & Code Coach',
      districtId: 'logic-nexus',
      coords: { x: codeEnt.x, z: codeEnt.z },
      colorHex: '#2563EB',
      greeting: 'Welcome to Autonomous Robotics Studio! Ready to program a zero-emission courtyard rover?',
      suggestedTopic: 'Algorithmic Sequencing & Debugging',
      category: 'teacher',
      directionsHint: 'Autonomous Robotics Studio is right here at (60, -30) in Logic & Code Nexus.',
      educationalFact: 'Writing clean, modular functions lets engineers reuse verified logic blocks and spot bugs in seconds.',
      featuredGameId: 'coding-quest',
      recommendedMissionId: 'mission-master-tier',
    },
    appearance: {
      suitColor: '#DBEAFE',
      accentColor: '#1D4ED8',
      pantsColor: '#0F172A',
      skinOrVisorColor: '#60A5FA',
      headStyle: 'hair-short',
      accessory: 'tablet',
      scale: 1.0,
    },
  },

  // --- Extended Population (Auto & High Performance Tiers) ---
  {
    id: 'living-student-walk-3',
    name: 'Hana Kim',
    role: 'Cartography Student',
    category: 'student-walker',
    districtId: 'humanities-plaza',
    behavior: 'patrol',
    spawn: { x: humWalk[0].x, z: humWalk[0].z, yaw: 0 },
    waypoints: humWalk,
    walkSpeed: 2.15,
    interactive: false,
    npcInfo: {
      id: 'living-student-walk-3',
      name: 'Hana Kim',
      role: 'Cartography Student',
      districtId: 'humanities-plaza',
      coords: { x: humWalk[0].x, z: humWalk[0].z },
      colorHex: '#D97706',
      greeting: 'Walking the Humanities sidewalk!',
      suggestedTopic: 'Global Cartography',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#FEF3C7',
      accentColor: '#D97706',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'hair-bob',
      accessory: 'backpack',
      scale: 0.94,
    },
  },
  {
    id: 'living-student-walk-4',
    name: 'Owen Brooks',
    role: 'Algorithms Student',
    category: 'student-walker',
    districtId: 'logic-nexus',
    behavior: 'patrol',
    spawn: { x: logicWalk[0].x, z: logicWalk[0].z, yaw: 0 },
    waypoints: logicWalk,
    walkSpeed: 2.25,
    interactive: false,
    npcInfo: {
      id: 'living-student-walk-4',
      name: 'Owen Brooks',
      role: 'Algorithms Student',
      districtId: 'logic-nexus',
      coords: { x: logicWalk[0].x, z: logicWalk[0].z },
      colorHex: '#2563EB',
      greeting: 'Heading to Relay Switch Tower!',
      suggestedTopic: 'Network Packet Routing',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#EFF6FF',
      accentColor: '#2563EB',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#3B82F6',
      headStyle: 'hair-short',
      accessory: 'satchel',
      scale: 0.96,
    },
  },
  {
    id: 'living-student-walk-5',
    name: 'Amara Okafor',
    role: 'Ecology Student',
    category: 'student-walker',
    districtId: 'eco-sanctuary',
    behavior: 'patrol',
    spawn: { x: ecoWalk[0].x, z: ecoWalk[0].z, yaw: 0 },
    waypoints: ecoWalk,
    walkSpeed: 2.05,
    interactive: false,
    npcInfo: {
      id: 'living-student-walk-5',
      name: 'Amara Okafor',
      role: 'Ecology Student',
      districtId: 'eco-sanctuary',
      coords: { x: ecoWalk[0].x, z: ecoWalk[0].z },
      colorHex: '#059669',
      greeting: 'Checking biosphere sensors in Eco Sanctuary!',
      suggestedTopic: 'Keystone Species & Biodiversity',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#ECFDF5',
      accentColor: '#059669',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#10B981',
      headStyle: 'hair-bob',
      accessory: 'backpack',
      scale: 0.93,
    },
  },
  {
    id: 'living-bench-3',
    name: 'Lucas Weber',
    role: 'Exchange Student',
    category: 'bench-student',
    districtId: 'logic-nexus',
    behavior: 'sit',
    spawn: bench1A,
    interactive: false,
    npcInfo: {
      id: 'living-bench-3',
      name: 'Lucas Weber',
      role: 'Exchange Student',
      districtId: 'logic-nexus',
      coords: { x: bench1A.x, z: bench1A.z },
      colorHex: '#2563EB',
      greeting: 'Enjoying the sunny plaza benches!',
      suggestedTopic: 'Campus Life',
      category: 'bench-student',
    },
    appearance: {
      suitColor: '#E2E8F0',
      accentColor: '#2563EB',
      pantsColor: '#0F172A',
      skinOrVisorColor: '#60A5FA',
      headStyle: 'hair-short',
      accessory: 'none',
      scale: 0.95,
    },
  },
  {
    id: 'living-bench-4',
    name: 'Mina Cho',
    role: 'Design Student',
    category: 'bench-student',
    districtId: 'humanities-plaza',
    behavior: 'sit',
    spawn: bench2B,
    interactive: false,
    npcInfo: {
      id: 'living-bench-4',
      name: 'Mina Cho',
      role: 'Design Student',
      districtId: 'humanities-plaza',
      coords: { x: bench2B.x, z: bench2B.z },
      colorHex: '#0D9488',
      greeting: 'Sketching the astrolabe skyline!',
      suggestedTopic: 'Solarpunk Architecture',
      category: 'bench-student',
    },
    appearance: {
      suitColor: '#F0FDFA',
      accentColor: '#0D9488',
      pantsColor: '#334155',
      skinOrVisorColor: '#2DD4BF',
      headStyle: 'hair-bob',
      accessory: 'tablet',
      scale: 0.92,
    },
  },
  {
    id: 'living-guide-bio',
    name: 'Nurse Aria',
    role: 'Anatomy Pavilion Guide',
    category: 'entrance-guide',
    districtId: 'stem-spire',
    behavior: 'guard',
    spawn: bioEnt,
    interactive: true,
    npcInfo: {
      id: 'living-guide-bio',
      name: 'Nurse Aria',
      role: 'Anatomy Pavilion Guide',
      districtId: 'stem-spire',
      coords: { x: bioEnt.x, z: bioEnt.z },
      colorHex: '#0284C7',
      greeting: 'Welcome to Bio-Anatomy Dome! Explore how organs cooperate in real time.',
      suggestedTopic: 'Circulatory & Nervous Systems',
      category: 'entrance-guide',
      directionsHint: 'Bio-Anatomy Dome is right behind me at (-18, -48).',
      educationalFact: 'Nerve impulses can race along myelinated axons at speeds over 100 meters per second!',
      featuredGameId: 'human-body-explorer',
      recommendedMissionId: 'mission-first-simulation',
    },
    appearance: {
      suitColor: '#F8FAFC',
      accentColor: '#0EA5E9',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'helmet',
      accessory: 'tablet',
      scale: 0.97,
    },
  },
  {
    id: 'living-plaza-loop-1',
    name: 'Ethan Grant',
    role: 'Science Spire Walker',
    category: 'student-walker',
    districtId: 'stem-spire',
    behavior: 'patrol',
    spawn: { x: stemLoop[0].x, z: stemLoop[0].z, yaw: 0 },
    waypoints: stemLoop,
    walkSpeed: 2.0,
    interactive: false,
    npcInfo: {
      id: 'living-plaza-loop-1',
      name: 'Ethan Grant',
      role: 'Science Spire Walker',
      districtId: 'stem-spire',
      coords: { x: stemLoop[0].x, z: stemLoop[0].z },
      colorHex: '#0284C7',
      greeting: 'Strolling around Science Spire!',
      suggestedTopic: 'STEM Studies',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#E0F2FE',
      accentColor: '#0284C7',
      pantsColor: '#0F172A',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'hair-short',
      accessory: 'backpack',
      scale: 0.95,
    },
  },
  {
    id: 'living-plaza-loop-2',
    name: 'Chloe Bennett',
    role: 'Logic Nexus Walker',
    category: 'student-walker',
    districtId: 'logic-nexus',
    behavior: 'patrol',
    spawn: { x: logicLoop[0].x, z: logicLoop[0].z, yaw: 0 },
    waypoints: logicLoop,
    walkSpeed: 2.1,
    interactive: false,
    npcInfo: {
      id: 'living-plaza-loop-2',
      name: 'Chloe Bennett',
      role: 'Logic Nexus Walker',
      districtId: 'logic-nexus',
      coords: { x: logicLoop[0].x, z: logicLoop[0].z },
      colorHex: '#2563EB',
      greeting: 'Heading between Polyhedron Atrium and Boolean Labyrinth!',
      suggestedTopic: 'Geometry & Logic',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#EFF6FF',
      accentColor: '#1D4ED8',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#60A5FA',
      headStyle: 'hair-bob',
      accessory: 'glasses',
      scale: 0.94,
    },
  },
  {
    id: 'living-conv-logic-1',
    name: 'Ravi S.',
    role: 'Geometry Scholar',
    category: 'conversation-group',
    districtId: 'logic-nexus',
    behavior: 'converse',
    spawn: { x: 52.8, z: -4.2, yaw: -2.2 },
    interactive: true,
    npcInfo: {
      id: 'living-conv-logic-1',
      name: 'Ravi S.',
      role: 'Geometry Scholar',
      districtId: 'logic-nexus',
      coords: { x: 52.8, z: -4.2 },
      colorHex: '#2563EB',
      greeting: 'We’re discussing Platonic solids before our Geometry World session!',
      suggestedTopic: 'Polyhedra & Symmetry',
      category: 'conversation-group',
      directionsHint: 'Polyhedron Atrium is just south of Logic Nexus plaza at (46, 6).',
      educationalFact: 'Euler’s formula (V - E + F = 2) holds true for every convex polyhedron—from a simple cube to a geodesic dome!',
      featuredGameId: 'geometry-world',
      recommendedMissionId: 'mission-polymath-five',
    },
    appearance: {
      suitColor: '#F8FAFC',
      accentColor: '#2563EB',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#3B82F6',
      headStyle: 'hair-short',
      accessory: 'tablet',
      scale: 0.96,
    },
  },
  {
    id: 'living-conv-logic-2',
    name: 'Tessa W.',
    role: 'Network Student',
    category: 'conversation-group',
    districtId: 'logic-nexus',
    behavior: 'converse',
    spawn: { x: 51.4, z: -5.4, yaw: 0.9 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-logic-2',
      name: 'Tessa W.',
      role: 'Network Student',
      districtId: 'logic-nexus',
      coords: { x: 51.4, z: -5.4 },
      colorHex: '#0284C7',
      greeting: 'Comparing graph theory with packet routing!',
      suggestedTopic: 'Network Topology',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#DBEAFE',
      accentColor: '#0284C7',
      pantsColor: '#334155',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'hair-bob',
      accessory: 'satchel',
      scale: 0.93,
    },
  },
  {
    id: 'living-visitor-3',
    name: 'Dr. Kenji Ito',
    role: 'Visiting Urban Planner',
    category: 'visitor',
    districtId: 'eco-sanctuary',
    behavior: 'patrol',
    spawn: { x: centralWalkC[0].x, z: centralWalkC[0].z, yaw: 0 },
    waypoints: centralWalkC,
    walkSpeed: 1.65,
    interactive: true,
    npcInfo: {
      id: 'living-visitor-3',
      name: 'Dr. Kenji Ito',
      role: 'Visiting Urban Planner',
      districtId: 'eco-sanctuary',
      coords: { x: centralWalkC[0].x, z: centralWalkC[0].z },
      colorHex: '#059669',
      greeting: 'I study walkable radial campuses—the central plaza connects all five districts effortlessly!',
      suggestedTopic: 'Walkable Cities & Clean Grids',
      category: 'visitor',
      directionsHint: 'Head southeast to Eco Sanctuary (32, 42) to try the Eco City Builder simulation.',
      educationalFact: 'Mixed-use pedestrian plazas paired with shaded walkways cut urban heat-island temperatures by several degrees Celsius.',
      featuredGameId: 'eco-city-builder',
      recommendedMissionId: 'mission-city-scout',
    },
    appearance: {
      suitColor: '#F1F5F9',
      accentColor: '#059669',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#10B981',
      headStyle: 'scholar-cap',
      accessory: 'glasses',
      scale: 1.01,
    },
  },

  // --- High Tier Additional Living NPCs (26..34) ---
  {
    id: 'living-plaza-loop-3',
    name: 'Sora Takahashi',
    role: 'Humanities Explorer',
    category: 'student-walker',
    districtId: 'humanities-plaza',
    behavior: 'patrol',
    spawn: { x: humLoop[0].x, z: humLoop[0].z, yaw: 0 },
    waypoints: humLoop,
    walkSpeed: 1.95,
    interactive: false,
    npcInfo: {
      id: 'living-plaza-loop-3',
      name: 'Sora Takahashi',
      role: 'Humanities Explorer',
      districtId: 'humanities-plaza',
      coords: { x: humLoop[0].x, z: humLoop[0].z },
      colorHex: '#D97706',
      greeting: 'Exploring Humanities Pavilion!',
      suggestedTopic: 'World Heritage',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#FFFBEB',
      accentColor: '#D97706',
      pantsColor: '#334155',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'hair-short',
      accessory: 'satchel',
      scale: 0.95,
    },
  },
  {
    id: 'living-plaza-loop-4',
    name: 'Nadia Hassan',
    role: 'Eco Sanctuary Student',
    category: 'student-walker',
    districtId: 'eco-sanctuary',
    behavior: 'patrol',
    spawn: { x: ecoLoop[0].x, z: ecoLoop[0].z, yaw: 0 },
    waypoints: ecoLoop,
    walkSpeed: 2.0,
    interactive: false,
    npcInfo: {
      id: 'living-plaza-loop-4',
      name: 'Nadia Hassan',
      role: 'Eco Sanctuary Student',
      districtId: 'eco-sanctuary',
      coords: { x: ecoLoop[0].x, z: ecoLoop[0].z },
      colorHex: '#059669',
      greeting: 'Checking solar canopy metrics!',
      suggestedTopic: 'Renewable Grids',
      category: 'student-walker',
    },
    appearance: {
      suitColor: '#ECFDF5',
      accentColor: '#10B981',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#34D399',
      headStyle: 'hair-bob',
      accessory: 'backpack',
      scale: 0.94,
    },
  },
  {
    id: 'living-conv-hum-1',
    name: 'Arthur D.',
    role: 'History Student',
    category: 'conversation-group',
    districtId: 'humanities-plaza',
    behavior: 'converse',
    spawn: { x: -42.5, z: -4.8, yaw: 2.2 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-hum-1',
      name: 'Arthur D.',
      role: 'History Student',
      districtId: 'humanities-plaza',
      coords: { x: -42.5, z: -4.8 },
      colorHex: '#D97706',
      greeting: 'Chatting about ancient trade routes!',
      suggestedTopic: 'World History',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#FEF3C7',
      accentColor: '#B45309',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#F59E0B',
      headStyle: 'hair-short',
      accessory: 'glasses',
      scale: 0.97,
    },
  },
  {
    id: 'living-conv-hum-2',
    name: 'Grace L.',
    role: 'Geography Student',
    category: 'conversation-group',
    districtId: 'humanities-plaza',
    behavior: 'converse',
    spawn: { x: -41.0, z: -5.9, yaw: -0.95 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-hum-2',
      name: 'Grace L.',
      role: 'Geography Student',
      districtId: 'humanities-plaza',
      coords: { x: -41.0, z: -5.9 },
      colorHex: '#D97706',
      greeting: 'Comparing watershed maps!',
      suggestedTopic: 'Physical Geography',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#FFFBEB',
      accentColor: '#D97706',
      pantsColor: '#334155',
      skinOrVisorColor: '#FBBF24',
      headStyle: 'hair-bob',
      accessory: 'tablet',
      scale: 0.93,
    },
  },
  {
    id: 'living-visitor-4',
    name: 'Samira Ali',
    role: 'Tech Showcase Visitor',
    category: 'visitor',
    districtId: 'stem-spire',
    behavior: 'patrol',
    spawn: { x: centralWalkA[5].x, z: centralWalkA[5].z, yaw: 2.1 },
    waypoints: [...centralWalkA.slice(5), ...centralWalkA.slice(0, 5)],
    walkSpeed: 1.8,
    interactive: false,
    npcInfo: {
      id: 'living-visitor-4',
      name: 'Samira Ali',
      role: 'Tech Showcase Visitor',
      districtId: 'stem-spire',
      coords: { x: centralWalkA[5].x, z: centralWalkA[5].z },
      colorHex: '#0284C7',
      greeting: 'Admiring the city skyline!',
      suggestedTopic: 'Campus Tour',
      category: 'visitor',
    },
    appearance: {
      suitColor: '#F8FAFC',
      accentColor: '#0284C7',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#38BDF8',
      headStyle: 'helmet',
      accessory: 'visor',
      scale: 0.97,
    },
  },
  {
    id: 'living-conv-civic-1',
    name: 'Devon R.',
    role: 'Economics Student',
    category: 'conversation-group',
    districtId: 'civic-hub',
    behavior: 'converse',
    spawn: { x: -27.5, z: 39.2, yaw: 2.4 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-civic-1',
      name: 'Devon R.',
      role: 'Economics Student',
      districtId: 'civic-hub',
      coords: { x: -27.5, z: 39.2 },
      colorHex: '#0D9488',
      greeting: 'Discussing smart savings goals!',
      suggestedTopic: 'Personal Finance',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#F0FDFA',
      accentColor: '#0D9488',
      pantsColor: '#0F172A',
      skinOrVisorColor: '#14B8A6',
      headStyle: 'hair-short',
      accessory: 'satchel',
      scale: 0.96,
    },
  },
  {
    id: 'living-conv-civic-2',
    name: 'Chloe T.',
    role: 'Strategy Student',
    category: 'conversation-group',
    districtId: 'civic-hub',
    behavior: 'converse',
    spawn: { x: -26.0, z: 38.0, yaw: -0.75 },
    interactive: false,
    npcInfo: {
      id: 'living-conv-civic-2',
      name: 'Chloe T.',
      role: 'Strategy Student',
      districtId: 'civic-hub',
      coords: { x: -26.0, z: 38.0 },
      colorHex: '#0D9488',
      greeting: 'Planning our Grand Strategy match!',
      suggestedTopic: 'Game Theory',
      category: 'conversation-group',
    },
    appearance: {
      suitColor: '#CCFBF1',
      accentColor: '#0F766E',
      pantsColor: '#1E293B',
      skinOrVisorColor: '#2DD4BF',
      headStyle: 'hair-bob',
      accessory: 'backpack',
      scale: 0.93,
    },
  },
];
