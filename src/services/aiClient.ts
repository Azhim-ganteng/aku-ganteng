import { DifficultyLevel, GameQuestion } from '../types/eduworld';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status})`);
  }
  return data as T;
}

export async function askAiTutor(params: {
  message: string;
  subject: string;
  level: number;
  history: { role: 'user' | 'assistant'; text: string }[];
}): Promise<{ reply: string }> {
  return postJson('/api/ai/tutor', params);
}

export async function generateDynamicQuestions(params: {
  gameTitle: string;
  category: string;
  difficulty: DifficultyLevel;
  count?: number;
}): Promise<{ questions: GameQuestion[] }> {
  return postJson('/api/ai/questions', params);
}

export async function evaluateOpenAnswer(params: {
  question: string;
  studentAnswer: string;
  expectedTopic: string;
  difficulty: DifficultyLevel;
}): Promise<{
  isCorrect: boolean;
  score: number;
  feedback: string;
  improvementTip: string;
}> {
  return postJson('/api/ai/evaluate', params);
}

export async function fetchLearningRecommendations(params: {
  level: number;
  xp: number;
  completedGameTitles: string[];
  unplayedGameTitles: string[];
}): Promise<{
  headline: string;
  recommendations: {
    gameTitle: string;
    recommendedDifficulty: string;
    reason: string;
  }[];
}> {
  return postJson('/api/ai/recommendations', params);
}

export async function talkToDistrictNpc(params: {
  npcName: string;
  npcRole: string;
  districtName: string;
  playerMessage?: string;
}): Promise<{ dialogue: string }> {
  return postJson('/api/ai/npc', params);
}

export async function generateProgressReport(params: {
  displayName: string;
  level: number;
  xp: number;
  gamesCompletedCount: number;
  gameSummaries: { title: string; bestScore: number; bestAccuracy: number; difficulty: string }[];
}): Promise<{
  summary: string;
  strengths: string[];
  growthAreas: string[];
  nextMilestone: string;
}> {
  return postJson('/api/ai/report', params);
}
