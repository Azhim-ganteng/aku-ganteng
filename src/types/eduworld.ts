export type NavTab =
  | 'home'
  | 'explore'
  | 'games'
  | 'ai-assistant'
  | 'missions'
  | 'achievements'
  | 'leaderboard'
  | 'profile'
  | 'settings';

export type DistrictId =
  | 'stem-spire'
  | 'logic-nexus'
  | 'humanities-plaza'
  | 'eco-sanctuary'
  | 'civic-hub';

export type GameCategory =
  | 'STEM & Lab'
  | 'Logic & Code'
  | 'World & Humanities'
  | 'Eco & Civic';

export type DifficultyLevel = 'explorer' | 'scholar' | 'master';

export type VisorStyle = 'sky' | 'amber' | 'emerald' | 'obsidian';
export type PackStyle = 'wings' | 'thruster' | 'satchel' | 'none';
export type QualityTier = 'auto' | 'low' | 'high';

export interface AvatarConfig {
  suitColor: string;
  accentColor: string;
  visorStyle: VisorStyle;
  packStyle: PackStyle;
}

export interface AppSettings {
  qualityTier: QualityTier;
  soundEnabled: boolean;
  cameraSensitivity: number;
}

export interface GameQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
}

export interface GameDefinition {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  category: GameCategory;
  districtId: DistrictId;
  buildingName: string;
  buildingCoords: { x: number; z: number };
  buildingHeight: number;
  accentHex: string;
  roofType: 'dome' | 'spire' | 'terrace' | 'prism';
  engineType: 'solar-system' | 'math-kingdom' | 'coding-quest' | 'ai-challenge';
  coverImage?: string;
  learningObjectives: string[];
  estimatedMinutes: number;
  fallbackQuestions: GameQuestion[];
}

export interface DistrictDefinition {
  id: DistrictId;
  name: string;
  tagline: string;
  accentHex: string;
  plazaCoords: { x: number; z: number };
  npc: NPCDefinition;
}

export type LivingNpcCategory =
  | 'mentor'
  | 'student-walker'
  | 'teacher'
  | 'visitor'
  | 'bench-student'
  | 'conversation-group'
  | 'entrance-guide';

export interface NPCDefinition {
  id: string;
  name: string;
  role: string;
  districtId: DistrictId;
  coords: { x: number; z: number };
  colorHex: string;
  greeting: string;
  suggestedTopic: string;
  category?: LivingNpcCategory;
  isMentor?: boolean;
  directionsHint?: string;
  educationalFact?: string;
  featuredGameId?: string;
  recommendedMissionId?: string;
}

export interface GameProgressRecord {
  gameId: string;
  bestScore: number;
  bestAccuracy: number;
  playCount: number;
  highestDifficulty: DifficultyLevel;
  updatedAt: string;
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  rewardCoins: number;
  targetCount: number;
  metric: 'gamesCompleted' | 'totalPlays' | 'districtsVisited' | 'xpEarned' | 'aiChats' | 'masterCleared';
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  tier: 'Bronze' | 'Silver' | 'Gold';
  metric: 'gamesCompleted' | 'level' | 'districtsVisited' | 'coins' | 'xp';
  threshold: number;
}

export interface PlayerState {
  displayName: string;
  title: string;
  xp: number;
  level: number;
  coins: number;
  streakDays: number;
  avatar: AvatarConfig;
  settings: AppSettings;
  visitedDistricts: DistrictId[];
  claimedMissions: string[];
  unlockedAchievements: string[];
  gameProgress: Record<string, GameProgressRecord>;
  aiInteractionsCount: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  title: string;
  xp: number;
  level: number;
  gamesCompletedCount: number;
  avatarAccentColor: string;
}

export interface GameCompletionPayload {
  gameId: string;
  score: number;
  accuracy: number;
  difficulty: DifficultyLevel;
}

export type OpenWorldDistrictId =
  | 'science-district'
  | 'technology-district'
  | 'humanities-district'
  | 'eco-sanctuary-preserve'
  | 'innovation-district'
  | 'recreation-district';

export interface OpenWorldFacility {
  name: string;
  kind: 'lab' | 'observatory' | 'library' | 'museum' | 'park' | 'stadium' | 'hub' | 'conservatory';
  offsetX: number;
  offsetZ: number;
  height: number;
  width: number;
  depth: number;
  roofType: 'dome' | 'spire' | 'terrace' | 'prism' | 'arch';
}

export interface OpenWorldDistrictDefinition {
  id: OpenWorldDistrictId;
  number: number;
  name: string;
  shortName: string;
  tagline: string;
  accentHex: string;
  secondaryHex: string;
  plazaCoords: { x: number; z: number };
  angleRad: number;
  linkedInnerDistrictId: DistrictId;
  featuredGameIds: string[];
  guideNpc: {
    id: string;
    name: string;
    role: string;
    greeting: string;
    suggestedTopic: string;
    directionsHint: string;
    educationalFact: string;
    featuredGameId: string;
  };
  facilities: OpenWorldFacility[];
}

export interface WorldLandmarkDefinition {
  id: string;
  districtId: OpenWorldDistrictId;
  name: string;
  description: string;
  coords: { x: number; z: number };
  discoveryRadius: number;
  rewardXp: number;
  rewardCoins: number;
  accentHex: string;
  linkedGameId: string;
}

export interface ExplorationObjective {
  id: string;
  title: string;
  description: string;
  metric: 'outerDistrictsVisited' | 'landmarksDiscovered' | 'bridgesCrossed' | 'totalZonesVisited';
  targetCount: number;
  rewardXp: number;
  rewardCoins: number;
}

export interface BridgeDefinition {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  length: number;
  width: number;
  archHeight: number;
  accentHex: string;
}

export interface WaterBodyDefinition {
  id: string;
  name: string;
  kind: 'lake' | 'river';
  points: { x: number; z: number }[];
  widthOrRadius: number;
}

export interface ExplorationProgressState {
  visitedOuterDistricts: OpenWorldDistrictId[];
  discoveredLandmarks: string[];
  crossedBridges: string[];
  claimedObjectives: string[];
}

// --- Creative Sandbox Building System ---
export type SandboxItemCategory = 'blocks' | 'objects' | 'unlockable';

export type SandboxTool = 'place' | 'remove' | 'move' | 'duplicate';

export interface SandboxCatalogItem {
  id: string;
  name: string;
  category: SandboxItemCategory;
  kind: 'block' | 'object';
  size: { w: number; h: number; d: number };
  colorHex: string;
  accentHex?: string;
  walkableTop: boolean;
  transparent?: boolean;
  unlockRequirementLabel?: string;
}

export interface PlacedSandboxObject {
  id: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
  rotY: number; // radians
  materialVariant?: string;
}

export interface BuildZoneDefinition {
  id: string;
  name: string;
  theme: string;
  centerX: number;
  centerZ: number;
  halfW: number;
  halfD: number;
  accentHex: string;
}

export interface SandboxBuildProject {
  buildId: string;
  name: string;
  zoneId: string;
  items: PlacedSandboxObject[];
  updatedAt: string;
}

// --- Mini Game Hub System ---
export type MiniGameId =
  | 'parkour'
  | 'treasure-hunt'
  | 'quiz-battle'
  | 'science-challenge'
  | 'network-puzzle'
  | 'racing'
  | 'farming';

export interface MiniGameDefinition {
  id: MiniGameId;
  title: string;
  tagline: string;
  instructions: string;
  accentHex: string;
  badgeId: string;
  badgeTitle: string;
  unlockItemId: string;
  unlockItemName: string;
  baseXp: number;
  baseCoins: number;
}

export interface MiniGameCompletionPayload {
  miniGameId: MiniGameId;
  score: number;
  timeSeconds?: number;
  accuracy?: number;
  won: boolean;
}

export interface MiniGameProgressState {
  completedIds: MiniGameId[];
  bestScores: Partial<Record<MiniGameId, number>>;
  bestTimes: Partial<Record<MiniGameId, number>>;
  unlockedBadges: string[];
  unlockedSandboxItems: string[];
  playCounts: Partial<Record<MiniGameId, number>>;
}


