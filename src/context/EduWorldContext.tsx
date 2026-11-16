import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AppSettings,
  AvatarConfig,
  DifficultyLevel,
  DistrictId,
  ExplorationProgressState,
  GameCompletionPayload,
  GameDefinition,
  GameProgressRecord,
  LeaderboardEntry,
  NavTab,
  NPCDefinition,
  OpenWorldDistrictId,
  PlayerState,
} from '../types/eduworld';
import { GAMES_CATALOG } from '../data/gamesCatalog';
import { ACHIEVEMENTS, MISSIONS } from '../data/missionsAndBadges';
import {
  EXPLORATION_OBJECTIVES,
  OPEN_WORLD_DISTRICTS,
  WORLD_LANDMARKS,
} from '../data/openWorldData';
import { OperationType, auth, db, googleProvider, handleFirestoreError } from '../services/firebase';
import { playCoinTone, playSuccessTone } from '../utils/audio';

const STORAGE_KEY = 'eduworld_ai_player_v1';
const OPEN_WORLD_STORAGE_KEY = 'eduworld_openworld_v1';

const DEFAULT_OPEN_WORLD_STATE: ExplorationProgressState = {
  visitedOuterDistricts: [],
  discoveredLandmarks: [],
  crossedBridges: [],
  claimedObjectives: [],
};

const DEFAULT_PLAYER_STATE: PlayerState = {
  displayName: 'Sky Scholar',
  title: 'Campus Explorer',
  xp: 120,
  level: 1,
  coins: 50,
  streakDays: 1,
  avatar: {
    suitColor: '#F8FAFC',
    accentColor: '#0284C7',
    visorStyle: 'sky',
    packStyle: 'wings',
  },
  settings: {
    qualityTier: 'auto',
    soundEnabled: true,
    cameraSensitivity: 1.0,
  },
  visitedDistricts: ['stem-spire'],
  claimedMissions: [],
  unlockedAchievements: [],
  gameProgress: {},
  aiInteractionsCount: 0,
};

export function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 250) + 1);
}

export function computeTitleFromLevel(level: number): string {
  if (level >= 10) return 'Solarpunk Laureate';
  if (level >= 7) return 'Grand Architect';
  if (level >= 5) return 'City Fellow';
  if (level >= 3) return 'Academy Scholar';
  return 'Campus Explorer';
}

function difficultyRank(diff: DifficultyLevel): number {
  if (diff === 'master') return 3;
  if (diff === 'scholar') return 2;
  return 1;
}

interface ToastMessage {
  id: number;
  title: string;
  detail: string;
}

interface EduWorldContextValue {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  player: PlayerState;
  user: User | null;
  authReady: boolean;
  isSyncing: boolean;
  isSigningIn: boolean;
  leaderboard: LeaderboardEntry[];
  activeGame: GameDefinition | null;
  openGame: (game: GameDefinition) => void;
  closeGame: () => void;
  activeNpc: NPCDefinition | null;
  openNpc: (npc: NPCDefinition) => void;
  closeNpc: () => void;
  teleportTarget: { x: number; z: number; label: string; nonce: number } | null;
  teleportToBuilding: (game: GameDefinition) => void;
  teleportToDistrict: (districtId: DistrictId, coords: { x: number; z: number }, label: string) => void;
  teleportToCoords: (x: number, z: number, label: string) => void;
  openWorldProgress: ExplorationProgressState;
  visitOuterDistrict: (id: OpenWorldDistrictId) => void;
  discoverLandmark: (landmarkId: string) => void;
  recordBridgeCrossed: (bridgeId: string) => void;
  claimExplorationObjective: (objectiveId: string) => void;
  recordGameCompletion: (payload: GameCompletionPayload) => Promise<{ xpEarned: number; coinsEarned: number }>;
  visitDistrict: (districtId: DistrictId) => void;
  claimMission: (missionId: string) => void;
  recordAiInteraction: () => void;
  updateProfileAppearance: (displayName: string, avatar: AvatarConfig) => void;
  updateSettings: (settings: AppSettings) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  toast: ToastMessage | null;
  dismissToast: () => void;
  notify: (title: string, detail: string) => void;
}

const EduWorldContext = createContext<EduWorldContextValue | null>(null);

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_VISORS: AvatarConfig['visorStyle'][] = ['sky', 'amber', 'emerald', 'obsidian'];
const VALID_PACKS: AvatarConfig['packStyle'][] = ['wings', 'thruster', 'satchel', 'none'];
const VALID_QUALITY_TIERS: AppSettings['qualityTier'][] = ['auto', 'low', 'high'];

function sanitizeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value) ? value : fallback;
}

function sanitizeIdList<T extends string>(value: unknown, maxLen: number, fallback: T[] = []): T[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is T => typeof item === 'string' && item.length >= 1 && item.length <= 64)
    .slice(0, maxLen);
}

function sanitizeClampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeClampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function loadGuestState(): PlayerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYER_STATE;
    const parsed = JSON.parse(raw) as Partial<PlayerState>;
    const rawAvatar = (parsed.avatar ?? {}) as Partial<AvatarConfig>;
    const rawSettings = (parsed.settings ?? {}) as Partial<AppSettings>;
    return {
      ...DEFAULT_PLAYER_STATE,
      ...parsed,
      displayName:
        typeof parsed.displayName === 'string' && parsed.displayName.trim()
          ? parsed.displayName.trim().slice(0, 48)
          : DEFAULT_PLAYER_STATE.displayName,
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim().slice(0, 48)
          : DEFAULT_PLAYER_STATE.title,
      xp: sanitizeClampInt(parsed.xp, 0, 10000000, DEFAULT_PLAYER_STATE.xp),
      level: sanitizeClampInt(parsed.level, 1, 500, DEFAULT_PLAYER_STATE.level),
      coins: sanitizeClampInt(parsed.coins, 0, 10000000, DEFAULT_PLAYER_STATE.coins),
      streakDays: sanitizeClampInt(parsed.streakDays, 1, 10000, DEFAULT_PLAYER_STATE.streakDays),
      avatar: {
        suitColor: sanitizeHexColor(rawAvatar.suitColor, DEFAULT_PLAYER_STATE.avatar.suitColor),
        accentColor: sanitizeHexColor(rawAvatar.accentColor, DEFAULT_PLAYER_STATE.avatar.accentColor),
        visorStyle: VALID_VISORS.includes(rawAvatar.visorStyle as AvatarConfig['visorStyle'])
          ? (rawAvatar.visorStyle as AvatarConfig['visorStyle'])
          : DEFAULT_PLAYER_STATE.avatar.visorStyle,
        packStyle: VALID_PACKS.includes(rawAvatar.packStyle as AvatarConfig['packStyle'])
          ? (rawAvatar.packStyle as AvatarConfig['packStyle'])
          : DEFAULT_PLAYER_STATE.avatar.packStyle,
      },
      settings: {
        qualityTier: VALID_QUALITY_TIERS.includes(rawSettings.qualityTier as AppSettings['qualityTier'])
          ? (rawSettings.qualityTier as AppSettings['qualityTier'])
          : DEFAULT_PLAYER_STATE.settings.qualityTier,
        soundEnabled:
          typeof rawSettings.soundEnabled === 'boolean'
            ? rawSettings.soundEnabled
            : DEFAULT_PLAYER_STATE.settings.soundEnabled,
        cameraSensitivity: sanitizeClampFloat(
          rawSettings.cameraSensitivity,
          0.2,
          3.0,
          DEFAULT_PLAYER_STATE.settings.cameraSensitivity,
        ),
      },
      visitedDistricts: sanitizeIdList<DistrictId>(parsed.visitedDistricts, 10, ['stem-spire']),
      claimedMissions: sanitizeIdList<string>(parsed.claimedMissions, 30, []),
      unlockedAchievements: sanitizeIdList<string>(parsed.unlockedAchievements, 30, []),
      gameProgress: parsed.gameProgress && typeof parsed.gameProgress === 'object' ? parsed.gameProgress : {},
    };
  } catch {
    return DEFAULT_PLAYER_STATE;
  }
}

function loadOpenWorldProgress(): ExplorationProgressState {
  try {
    const raw = localStorage.getItem(OPEN_WORLD_STORAGE_KEY);
    if (!raw) return DEFAULT_OPEN_WORLD_STATE;
    const parsed = JSON.parse(raw) as Partial<ExplorationProgressState>;
    return {
      visitedOuterDistricts: sanitizeIdList<OpenWorldDistrictId>(parsed.visitedOuterDistricts, 12, []),
      discoveredLandmarks: sanitizeIdList<string>(parsed.discoveredLandmarks, 32, []),
      crossedBridges: sanitizeIdList<string>(parsed.crossedBridges, 12, []),
      claimedObjectives: sanitizeIdList<string>(parsed.claimedObjectives, 24, []),
    };
  } catch {
    return DEFAULT_OPEN_WORLD_STATE;
  }
}

export const EduWorldProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [player, setPlayer] = useState<PlayerState>(loadGuestState);
  const [openWorldProgress, setOpenWorldProgress] = useState<ExplorationProgressState>(loadOpenWorldProgress);
  const openWorldProgressRef = useRef<ExplorationProgressState>(openWorldProgress);
  openWorldProgressRef.current = openWorldProgress;
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const signingInRef = useRef(false);
  const syncedUidRef = useRef<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeGame, setActiveGame] = useState<GameDefinition | null>(null);
  const [activeNpc, setActiveNpc] = useState<NPCDefinition | null>(null);
  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number; label: string; nonce: number } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback((title: string, detail: string) => {
    setToast({ id: Date.now(), title, detail });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Persist guest & open-world exploration state locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    } catch {
      // Ignore quota issues in private browsing
    }
  }, [player]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_WORLD_STORAGE_KEY, JSON.stringify(openWorldProgress));
    } catch {
      // Ignore quota issues in private browsing
    }
  }, [openWorldProgress]);

  // Helper to evaluate newly unlocked achievements
  const evaluateAchievements = useCallback((state: PlayerState): string[] => {
    const gamesCompleted = Object.keys(state.gameProgress).length;
    const unlocked = new Set(state.unlockedAchievements);

    for (const ach of ACHIEVEMENTS) {
      let current = 0;
      if (ach.metric === 'gamesCompleted') current = gamesCompleted;
      else if (ach.metric === 'level') current = state.level;
      else if (ach.metric === 'districtsVisited') current = state.visitedDistricts.length;
      else if (ach.metric === 'coins') current = state.coins;
      else if (ach.metric === 'xp') current = state.xp;
      if (current >= ach.threshold) {
        unlocked.add(ach.id);
      }
    }
    return Array.from(unlocked).slice(0, 30);
  }, []);

  // Sync user profile + private email + leaderboard on verified sign-in
  const syncSignedInUser = useCallback(async (firebaseUser: User) => {
    if (!firebaseUser.emailVerified) return;
    setIsSyncing(true);
    let currentOp = OperationType.GET;
    let currentPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);

    try {
      const snap = await getDoc(userRef);
      let resolvedState: PlayerState;

      if (!snap.exists()) {
        const local = loadGuestState();
        const safeName =
          (firebaseUser.displayName || local.displayName || 'Sky Scholar').trim().slice(0, 48) || 'Sky Scholar';
        const level = sanitizeClampInt(computeLevelFromXp(local.xp), 1, 500, 1);
        const title = computeTitleFromLevel(level).slice(0, 48);
        const achievements = sanitizeIdList<string>(
          evaluateAchievements({ ...local, level, title }),
          30,
          [],
        );

        resolvedState = {
          ...local,
          displayName: safeName,
          level,
          title,
          unlockedAchievements: achievements,
        };

        currentOp = OperationType.CREATE;
        currentPath = `users/${firebaseUser.uid}`;
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          displayName: resolvedState.displayName,
          title: resolvedState.title,
          xp: sanitizeClampInt(resolvedState.xp, 0, 10000000, 0),
          level: resolvedState.level,
          coins: sanitizeClampInt(resolvedState.coins, 0, 10000000, 0),
          streakDays: sanitizeClampInt(resolvedState.streakDays, 1, 10000, 1),
          avatarSuitColor: sanitizeHexColor(resolvedState.avatar.suitColor, '#F8FAFC'),
          avatarAccentColor: sanitizeHexColor(resolvedState.avatar.accentColor, '#0284C7'),
          avatarVisorStyle: VALID_VISORS.includes(resolvedState.avatar.visorStyle)
            ? resolvedState.avatar.visorStyle
            : 'sky',
          avatarPackStyle: VALID_PACKS.includes(resolvedState.avatar.packStyle)
            ? resolvedState.avatar.packStyle
            : 'wings',
          visitedDistricts: sanitizeIdList<DistrictId>(resolvedState.visitedDistricts, 10, ['stem-spire']),
          claimedMissions: sanitizeIdList<string>(resolvedState.claimedMissions, 30, []),
          unlockedAchievements: resolvedState.unlockedAchievements,
          gamesCompletedCount: sanitizeClampInt(Object.keys(resolvedState.gameProgress).length, 0, 20, 0),
          qualityTier: VALID_QUALITY_TIERS.includes(resolvedState.settings.qualityTier)
            ? resolvedState.settings.qualityTier
            : 'auto',
          soundEnabled: Boolean(resolvedState.settings.soundEnabled),
          cameraSensitivity: sanitizeClampFloat(resolvedState.settings.cameraSensitivity, 0.2, 3.0, 1.0),
          updatedAt: serverTimestamp(),
        });
      } else {
        const data = snap.data();
        currentOp = OperationType.LIST;
        currentPath = `users/${firebaseUser.uid}/gameProgress`;
        const progressQuery = query(
          collection(db, 'users', firebaseUser.uid, 'gameProgress'),
          where('uid', '==', firebaseUser.uid),
        );
        const progressSnap = await getDocs(progressQuery);
        const loadedProgress: Record<string, GameProgressRecord> = {};
        progressSnap.forEach((docSnap) => {
          const gp = docSnap.data();
          loadedProgress[docSnap.id] = {
            gameId: docSnap.id,
            bestScore: Number(gp.bestScore) || 0,
            bestAccuracy: Number(gp.bestAccuracy) || 0,
            playCount: Number(gp.playCount) || 1,
            highestDifficulty: (gp.highestDifficulty as DifficultyLevel) || 'explorer',
            updatedAt: new Date().toISOString(),
          };
        });

        resolvedState = {
          displayName: String(data.displayName || 'Sky Scholar').trim().slice(0, 48) || 'Sky Scholar',
          title: String(data.title || 'Campus Explorer').trim().slice(0, 48) || 'Campus Explorer',
          xp: sanitizeClampInt(data.xp, 0, 10000000, 0),
          level: sanitizeClampInt(data.level, 1, 500, 1),
          coins: sanitizeClampInt(data.coins, 0, 10000000, 0),
          streakDays: sanitizeClampInt(data.streakDays, 1, 10000, 1),
          avatar: {
            suitColor: sanitizeHexColor(data.avatarSuitColor, '#F8FAFC'),
            accentColor: sanitizeHexColor(data.avatarAccentColor, '#0284C7'),
            visorStyle: VALID_VISORS.includes(data.avatarVisorStyle) ? data.avatarVisorStyle : 'sky',
            packStyle: VALID_PACKS.includes(data.avatarPackStyle) ? data.avatarPackStyle : 'wings',
          },
          settings: {
            qualityTier: VALID_QUALITY_TIERS.includes(data.qualityTier) ? data.qualityTier : 'auto',
            soundEnabled: typeof data.soundEnabled === 'boolean' ? data.soundEnabled : true,
            cameraSensitivity: sanitizeClampFloat(data.cameraSensitivity, 0.2, 3.0, 1.0),
          },
          visitedDistricts: sanitizeIdList<DistrictId>(data.visitedDistricts, 10, ['stem-spire']),
          claimedMissions: sanitizeIdList<string>(data.claimedMissions, 30, []),
          unlockedAchievements: sanitizeIdList<string>(data.unlockedAchievements, 30, []),
          gameProgress: loadedProgress,
          aiInteractionsCount: 0,
        };
      }

      // Sync isolated PII record
      if (firebaseUser.email && firebaseUser.email.trim().length >= 3) {
        currentOp = OperationType.WRITE;
        currentPath = `users/${firebaseUser.uid}/private/info`;
        const piiRef = doc(db, 'users', firebaseUser.uid, 'private', 'info');
        await setDoc(piiRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email.trim().slice(0, 120),
          updatedAt: serverTimestamp(),
        });
      }

      // Sync public leaderboard entry
      currentOp = OperationType.WRITE;
      currentPath = `leaderboard/${firebaseUser.uid}`;
      const lbRef = doc(db, 'leaderboard', firebaseUser.uid);
      await setDoc(lbRef, {
        uid: firebaseUser.uid,
        displayName: resolvedState.displayName.slice(0, 48),
        title: resolvedState.title.slice(0, 48),
        xp: sanitizeClampInt(resolvedState.xp, 0, 10000000, 0),
        level: sanitizeClampInt(resolvedState.level, 1, 500, 1),
        gamesCompletedCount: sanitizeClampInt(Object.keys(resolvedState.gameProgress).length, 0, 20, 0),
        avatarAccentColor: sanitizeHexColor(resolvedState.avatar.accentColor, '#0284C7'),
        updatedAt: serverTimestamp(),
      });

      syncedUidRef.current = firebaseUser.uid;
      setPlayer(resolvedState);
    } catch (error) {
      handleFirestoreError(error, currentOp, currentPath);
    } finally {
      setIsSyncing(false);
    }
  }, [evaluateAchievements]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        syncedUidRef.current = null;
        return;
      }
      if (firebaseUser.emailVerified) {
        syncSignedInUser(firebaseUser).catch((err) => {
          console.error('Failed to sync profile:', err);
        });
      }
    });
    return () => unsubscribe();
  }, [syncSignedInUser]);

  // Guard against @firebase/auth PopupOperation.onAuthEvent race where cleanup clears pendingPromise before reject() runs
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? '');
      if (message.includes('Pending promise was never set')) {
        event.preventDefault();
        signingInRef.current = false;
        setIsSigningIn(false);
        notify(
          'Sign-In Interrupted',
          'The Google sign-in popup closed before completing. Please try again or continue in Guest Mode.',
        );
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [notify]);

  // Listen to public leaderboard (non-PII)
  useEffect(() => {
    const lbQuery = query(
      collection(db, 'leaderboard'),
      where('xp', '>=', 0),
      orderBy('xp', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(
      lbQuery,
      (snapshot) => {
        const rows: LeaderboardEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({
            uid: docSnap.id,
            displayName: String(d.displayName || 'Scholar'),
            title: String(d.title || 'Campus Explorer'),
            xp: Number(d.xp) || 0,
            level: Number(d.level) || 1,
            gamesCompletedCount: Number(d.gamesCompletedCount) || 0,
            avatarAccentColor: String(d.avatarAccentColor || '#0284C7'),
          });
        });
        setLeaderboard(rows);
      },
      (error) => {
        // Non-fatal fallback if offline or rules disallow before boot
        console.warn('Leaderboard subscription notice:', error.message);
      },
    );
    return () => unsub();
  }, []);

  const persistProgressUpdate = useCallback(
    async (next: PlayerState) => {
      if (!user || !user.emailVerified || syncedUidRef.current !== user.uid) return;
      let currentOp = OperationType.UPDATE;
      let currentPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          xp: sanitizeClampInt(next.xp, 0, 10000000, 0),
          level: sanitizeClampInt(next.level, 1, 500, 1),
          coins: sanitizeClampInt(next.coins, 0, 10000000, 0),
          streakDays: sanitizeClampInt(next.streakDays, 1, 10000, 1),
          title: next.title.trim().slice(0, 48) || 'Campus Explorer',
          visitedDistricts: sanitizeIdList<DistrictId>(next.visitedDistricts, 10, ['stem-spire']),
          claimedMissions: sanitizeIdList<string>(next.claimedMissions, 30, []),
          unlockedAchievements: sanitizeIdList<string>(next.unlockedAchievements, 30, []),
          gamesCompletedCount: sanitizeClampInt(Object.keys(next.gameProgress).length, 0, 20, 0),
          updatedAt: serverTimestamp(),
        });
        currentOp = OperationType.WRITE;
        currentPath = `leaderboard/${user.uid}`;
        await setDoc(doc(db, 'leaderboard', user.uid), {
          uid: user.uid,
          displayName: next.displayName.trim().slice(0, 48) || 'Sky Scholar',
          title: next.title.trim().slice(0, 48) || 'Campus Explorer',
          xp: sanitizeClampInt(next.xp, 0, 10000000, 0),
          level: sanitizeClampInt(next.level, 1, 500, 1),
          gamesCompletedCount: sanitizeClampInt(Object.keys(next.gameProgress).length, 0, 20, 0),
          avatarAccentColor: sanitizeHexColor(next.avatar.accentColor, '#0284C7'),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, currentOp, currentPath);
      }
    },
    [user],
  );

  const recordGameCompletion = useCallback(
    async ({ gameId, score, accuracy, difficulty }: GameCompletionPayload) => {
      const diffMultiplier = difficulty === 'master' ? 1.6 : difficulty === 'scholar' ? 1.25 : 1.0;
      const xpEarned = Math.round((80 + score * 0.4 + accuracy * 0.8) * diffMultiplier);
      const coinsEarned = Math.round((30 + accuracy * 0.45) * diffMultiplier);

      let nextStateSnapshot: PlayerState | null = null;
      let updatedGameRecord: GameProgressRecord | null = null;

      setPlayer((prev) => {
        const existing = prev.gameProgress[gameId];
        const nextDifficulty =
          existing && difficultyRank(existing.highestDifficulty) > difficultyRank(difficulty)
            ? existing.highestDifficulty
            : difficulty;

        const record: GameProgressRecord = {
          gameId,
          bestScore: Math.max(existing?.bestScore ?? 0, Math.round(score)),
          bestAccuracy: Math.min(100, Math.max(existing?.bestAccuracy ?? 0, Math.round(accuracy))),
          playCount: (existing?.playCount ?? 0) + 1,
          highestDifficulty: nextDifficulty,
          updatedAt: new Date().toISOString(),
        };
        updatedGameRecord = record;

        const nextXp = prev.xp + xpEarned;
        const nextLevel = computeLevelFromXp(nextXp);
        const nextTitle = computeTitleFromLevel(nextLevel);
        const draft: PlayerState = {
          ...prev,
          xp: nextXp,
          level: nextLevel,
          title: nextTitle,
          coins: prev.coins + coinsEarned,
          gameProgress: {
            ...prev.gameProgress,
            [gameId]: record,
          },
        };
        draft.unlockedAchievements = evaluateAchievements(draft);
        nextStateSnapshot = draft;
        return draft;
      });

      playSuccessTone(player.settings.soundEnabled);
      notify('Simulation Completed', `+${xpEarned} XP and +${coinsEarned} EduCoins awarded.`);

      if (user && user.emailVerified && syncedUidRef.current === user.uid && nextStateSnapshot && updatedGameRecord) {
        const rec = updatedGameRecord as GameProgressRecord;
        const gpPath = `users/${user.uid}/gameProgress/${gameId}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'gameProgress', gameId), {
            uid: user.uid,
            gameId,
            bestScore: sanitizeClampInt(rec.bestScore, 0, 1000000, 0),
            bestAccuracy: sanitizeClampInt(rec.bestAccuracy, 0, 100, 0),
            playCount: sanitizeClampInt(rec.playCount, 1, 100000, 1),
            highestDifficulty: rec.highestDifficulty,
            updatedAt: serverTimestamp(),
          });
          await persistProgressUpdate(nextStateSnapshot);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, gpPath);
        }
      }

      return { xpEarned, coinsEarned };
    },
    [evaluateAchievements, notify, persistProgressUpdate, player.settings.soundEnabled, user],
  );

  const visitDistrict = useCallback(
    (districtId: DistrictId) => {
      setPlayer((prev) => {
        if (prev.visitedDistricts.includes(districtId)) return prev;
        const next: PlayerState = {
          ...prev,
          xp: prev.xp + 30,
          coins: prev.coins + 15,
          visitedDistricts: [...prev.visitedDistricts, districtId].slice(0, 10),
        };
        next.level = computeLevelFromXp(next.xp);
        next.title = computeTitleFromLevel(next.level);
        next.unlockedAchievements = evaluateAchievements(next);
        persistProgressUpdate(next).catch(() => {});
        return next;
      });
    },
    [evaluateAchievements, persistProgressUpdate],
  );

  const claimMission = useCallback(
    (missionId: string) => {
      const mission = MISSIONS.find((m) => m.id === missionId);
      if (!mission) return;

      setPlayer((prev) => {
        if (prev.claimedMissions.includes(missionId)) return prev;
        const nextXp = prev.xp + mission.rewardXp;
        const nextLevel = computeLevelFromXp(nextXp);
        const next: PlayerState = {
          ...prev,
          xp: nextXp,
          level: nextLevel,
          title: computeTitleFromLevel(nextLevel),
          coins: prev.coins + mission.rewardCoins,
          claimedMissions: [...prev.claimedMissions, missionId].slice(0, 30),
        };
        next.unlockedAchievements = evaluateAchievements(next);
        persistProgressUpdate(next).catch(() => {});
        return next;
      });

      playCoinTone(player.settings.soundEnabled);
      notify('Mission Claimed', `${mission.title}: +${mission.rewardXp} XP, +${mission.rewardCoins} Coins`);
    },
    [evaluateAchievements, notify, persistProgressUpdate, player.settings.soundEnabled],
  );

  const awardExplorationBonus = useCallback(
    (xpBonus: number, coinsBonus: number) => {
      setPlayer((prev) => {
        const nextXp = prev.xp + xpBonus;
        const nextLevel = computeLevelFromXp(nextXp);
        const next: PlayerState = {
          ...prev,
          xp: nextXp,
          level: nextLevel,
          title: computeTitleFromLevel(nextLevel),
          coins: prev.coins + coinsBonus,
        };
        next.unlockedAchievements = evaluateAchievements(next);
        persistProgressUpdate(next).catch(() => {});
        return next;
      });
    },
    [evaluateAchievements, persistProgressUpdate],
  );

  const visitOuterDistrict = useCallback(
    (id: OpenWorldDistrictId) => {
      if (openWorldProgressRef.current.visitedOuterDistricts.includes(id)) return;
      const distDef = OPEN_WORLD_DISTRICTS.find((d) => d.id === id);
      const nextState: ExplorationProgressState = {
        ...openWorldProgressRef.current,
        visitedOuterDistricts: [...openWorldProgressRef.current.visitedOuterDistricts, id],
      };
      openWorldProgressRef.current = nextState;
      setOpenWorldProgress(nextState);
      awardExplorationBonus(40, 20);
      playCoinTone(player.settings.soundEnabled);
      notify(
        `${distDef?.name ?? 'District'} Discovered`,
        '+40 XP & +20 EduCoins awarded for exploring an outer district.',
      );
    },
    [awardExplorationBonus, notify, player.settings.soundEnabled],
  );

  const discoverLandmark = useCallback(
    (landmarkId: string) => {
      if (openWorldProgressRef.current.discoveredLandmarks.includes(landmarkId)) return;
      const lm = WORLD_LANDMARKS.find((l) => l.id === landmarkId);
      if (!lm) return;
      const nextState: ExplorationProgressState = {
        ...openWorldProgressRef.current,
        discoveredLandmarks: [...openWorldProgressRef.current.discoveredLandmarks, landmarkId],
      };
      openWorldProgressRef.current = nextState;
      setOpenWorldProgress(nextState);
      awardExplorationBonus(lm.rewardXp, lm.rewardCoins);
      playSuccessTone(player.settings.soundEnabled);
      notify(
        `Landmark Discovered: ${lm.name}`,
        `+${lm.rewardXp} XP & +${lm.rewardCoins} EduCoins awarded.`,
      );
    },
    [awardExplorationBonus, notify, player.settings.soundEnabled],
  );

  const recordBridgeCrossed = useCallback((bridgeId: string) => {
    if (openWorldProgressRef.current.crossedBridges.includes(bridgeId)) return;
    const nextState: ExplorationProgressState = {
      ...openWorldProgressRef.current,
      crossedBridges: [...openWorldProgressRef.current.crossedBridges, bridgeId],
    };
    openWorldProgressRef.current = nextState;
    setOpenWorldProgress(nextState);
  }, []);

  const claimExplorationObjective = useCallback(
    (objectiveId: string) => {
      if (openWorldProgressRef.current.claimedObjectives.includes(objectiveId)) return;
      const obj = EXPLORATION_OBJECTIVES.find((o) => o.id === objectiveId);
      if (!obj) return;
      const nextState: ExplorationProgressState = {
        ...openWorldProgressRef.current,
        claimedObjectives: [...openWorldProgressRef.current.claimedObjectives, objectiveId],
      };
      openWorldProgressRef.current = nextState;
      setOpenWorldProgress(nextState);
      awardExplorationBonus(obj.rewardXp, obj.rewardCoins);
      playCoinTone(player.settings.soundEnabled);
      notify(
        'Exploration Objective Claimed',
        `${obj.title}: +${obj.rewardXp} XP, +${obj.rewardCoins} EduCoins`,
      );
    },
    [awardExplorationBonus, notify, player.settings.soundEnabled],
  );

  const recordAiInteraction = useCallback(() => {
    setPlayer((prev) => ({
      ...prev,
      aiInteractionsCount: prev.aiInteractionsCount + 1,
    }));
  }, []);

  const updateProfileAppearance = useCallback(
    (displayName: string, avatar: AvatarConfig) => {
      const safeName = displayName.trim().slice(0, 48) || 'Sky Scholar';
      const safeAvatar: AvatarConfig = {
        suitColor: sanitizeHexColor(avatar.suitColor, '#F8FAFC'),
        accentColor: sanitizeHexColor(avatar.accentColor, '#0284C7'),
        visorStyle: VALID_VISORS.includes(avatar.visorStyle) ? avatar.visorStyle : 'sky',
        packStyle: VALID_PACKS.includes(avatar.packStyle) ? avatar.packStyle : 'wings',
      };
      setPlayer((prev) => {
        const next: PlayerState = {
          ...prev,
          displayName: safeName,
          avatar: safeAvatar,
        };
        if (user && user.emailVerified && syncedUidRef.current === user.uid) {
          updateDoc(doc(db, 'users', user.uid), {
            displayName: safeName,
            avatarSuitColor: safeAvatar.suitColor,
            avatarAccentColor: safeAvatar.accentColor,
            avatarVisorStyle: safeAvatar.visorStyle,
            avatarPackStyle: safeAvatar.packStyle,
            updatedAt: serverTimestamp(),
          }).catch((error) => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
          setDoc(doc(db, 'leaderboard', user.uid), {
            uid: user.uid,
            displayName: safeName,
            title: next.title.trim().slice(0, 48) || 'Campus Explorer',
            xp: sanitizeClampInt(next.xp, 0, 10000000, 0),
            level: sanitizeClampInt(next.level, 1, 500, 1),
            gamesCompletedCount: sanitizeClampInt(Object.keys(next.gameProgress).length, 0, 20, 0),
            avatarAccentColor: safeAvatar.accentColor,
            updatedAt: serverTimestamp(),
          }).catch((error) => handleFirestoreError(error, OperationType.WRITE, `leaderboard/${user.uid}`));
        }
        return next;
      });
      notify('Avatar Updated', 'Your customization is now live in the 3D city.');
    },
    [notify, user],
  );

  const updateSettings = useCallback(
    (settings: AppSettings) => {
      const safeSettings: AppSettings = {
        qualityTier: VALID_QUALITY_TIERS.includes(settings.qualityTier) ? settings.qualityTier : 'auto',
        soundEnabled: Boolean(settings.soundEnabled),
        cameraSensitivity: sanitizeClampFloat(settings.cameraSensitivity, 0.2, 3.0, 1.0),
      };
      setPlayer((prev) => {
        const next = { ...prev, settings: safeSettings };
        if (user && user.emailVerified && syncedUidRef.current === user.uid) {
          updateDoc(doc(db, 'users', user.uid), {
            qualityTier: safeSettings.qualityTier,
            soundEnabled: safeSettings.soundEnabled,
            cameraSensitivity: safeSettings.cameraSensitivity,
            updatedAt: serverTimestamp(),
          }).catch((error) => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
        }
        return next;
      });
      notify('Settings Saved', 'Graphics and control preferences updated.');
    },
    [notify, user],
  );

  const signInWithGoogle = useCallback(async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setIsSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        notify('Signed In', `Welcome to EDUWORLD AI, ${cred.user.displayName || 'Scholar'}.`);
      }
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      const rawMsg = error instanceof Error ? error.message : 'Unable to sign in right now.';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        notify('Sign-In Cancelled', 'Popup was closed before sign-in finished. You can keep exploring in Guest Mode.');
      } else if (code === 'auth/popup-blocked') {
        notify('Popup Blocked', 'Please allow browser popups for this window to sign in with Google.');
      } else if (code === 'auth/unauthorized-domain') {
        notify(
          'Domain Not Authorized',
          'This preview domain is not listed in Firebase Auth authorized domains yet. Guest Mode remains active.',
        );
      } else if (rawMsg.includes('Pending promise was never set')) {
        notify(
          'Sign-In Interrupted',
          'The Google sign-in popup closed before completing. Please try again or continue in Guest Mode.',
        );
      } else {
        notify('Sign-In Notice', rawMsg);
      }
    } finally {
      signingInRef.current = false;
      setIsSigningIn(false);
    }
  }, [notify]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    notify('Signed Out', 'Switched to local Guest Explorer mode.');
  }, [notify]);

  const openGame = useCallback((game: GameDefinition) => {
    setActiveNpc(null);
    setActiveGame(game);
  }, []);

  const closeGame = useCallback(() => {
    setActiveGame(null);
  }, []);

  const openNpc = useCallback((npc: NPCDefinition) => {
    setActiveNpc(npc);
  }, []);

  const closeNpc = useCallback(() => {
    setActiveNpc(null);
  }, []);

  const teleportToBuilding = useCallback((game: GameDefinition) => {
    setActiveTab('explore');
    setTeleportTarget({
      x: game.buildingCoords.x,
      z: game.buildingCoords.z + 9,
      label: game.buildingName,
      nonce: Date.now(),
    });
  }, []);

  const teleportToDistrict = useCallback((districtId: DistrictId, coords: { x: number; z: number }, label: string) => {
    setActiveTab('explore');
    visitDistrict(districtId);
    setTeleportTarget({
      x: coords.x,
      z: coords.z + 8,
      label,
      nonce: Date.now(),
    });
  }, [visitDistrict]);

  const teleportToCoords = useCallback((x: number, z: number, label: string) => {
    setActiveTab('explore');
    setTeleportTarget({
      x,
      z,
      label,
      nonce: Date.now(),
    });
  }, []);

  const value = useMemo<EduWorldContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      player,
      user,
      authReady,
      isSyncing,
      isSigningIn,
      leaderboard,
      activeGame,
      openGame,
      closeGame,
      activeNpc,
      openNpc,
      closeNpc,
      teleportTarget,
      teleportToBuilding,
      teleportToDistrict,
      teleportToCoords,
      openWorldProgress,
      visitOuterDistrict,
      discoverLandmark,
      recordBridgeCrossed,
      claimExplorationObjective,
      recordGameCompletion,
      visitDistrict,
      claimMission,
      recordAiInteraction,
      updateProfileAppearance,
      updateSettings,
      signInWithGoogle,
      signOutUser,
      toast,
      dismissToast,
      notify,
    }),
    [
      activeTab,
      player,
      user,
      authReady,
      isSyncing,
      isSigningIn,
      leaderboard,
      activeGame,
      openGame,
      closeGame,
      activeNpc,
      openNpc,
      closeNpc,
      teleportTarget,
      teleportToBuilding,
      teleportToDistrict,
      teleportToCoords,
      openWorldProgress,
      visitOuterDistrict,
      discoverLandmark,
      recordBridgeCrossed,
      claimExplorationObjective,
      recordGameCompletion,
      visitDistrict,
      claimMission,
      recordAiInteraction,
      updateProfileAppearance,
      updateSettings,
      signInWithGoogle,
      signOutUser,
      toast,
      dismissToast,
      notify,
    ],
  );

  return <EduWorldContext.Provider value={value}>{children}</EduWorldContext.Provider>;
};

export function useEduWorld() {
  const ctx = useContext(EduWorldContext);
  if (!ctx) throw new Error('useEduWorld must be used inside EduWorldProvider');
  return ctx;
}

export function getMissionMetricValue(player: PlayerState, metric: string): number {
  switch (metric) {
    case 'gamesCompleted':
      return Object.keys(player.gameProgress).length;
    case 'totalPlays':
      return Object.values(player.gameProgress).reduce((acc, g) => acc + g.playCount, 0);
    case 'districtsVisited':
      return player.visitedDistricts.length;
    case 'xpEarned':
      return player.xp;
    case 'aiChats':
      return player.aiInteractionsCount;
    case 'masterCleared':
      return Object.values(player.gameProgress).filter((g) => g.highestDifficulty === 'master').length;
    default:
      return 0;
  }
}

export function getGameById(id: string): GameDefinition | undefined {
  return GAMES_CATALOG.find((g) => g.id === id);
}
