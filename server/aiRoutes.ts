import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const router = Router();

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function handleAiError(res: Response, err: unknown, context: string) {
  const message = err instanceof Error ? err.message : 'Unexpected AI service error';
  console.error(`[AI ${context}]`, message);
  const status = message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
    ? 429
    : message.includes('403') || message.includes('PERMISSION_DENIED')
      ? 403
      : 500;
  res.status(status).json({ error: message });
}

router.post('/tutor', async (req: Request, res: Response) => {
  try {
    const { message, subject = 'General STEM & Humanities', level = 1, history = [] } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'A question or message is required.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured yet. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const formattedHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m: { role?: string; text?: string }) => `${m.role === 'assistant' ? 'Tutor' : 'Student'}: ${String(m.text ?? '')}`)
          .join('\n')
      : '';

    const prompt = formattedHistory
      ? `Recent conversation:\n${formattedHistory}\n\nStudent: ${message.trim()}`
      : message.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          `You are the EDUWORLD AI Learning Tutor inside a futuristic educational city. ` +
          `Current subject focus: ${String(subject)}. Student level: ${Number(level) || 1}. ` +
          `Give clear, encouraging, accurate explanations in 2-4 concise paragraphs or bullet points, and end with one thought-provoking check-in question.`,
      },
    });

    res.json({ reply: response.text ?? 'Let us explore that concept together. Could you share what you already know about it?' });
  } catch (err) {
    handleAiError(res, err, 'tutor');
  }
});

router.post('/questions', async (req: Request, res: Response) => {
  try {
    const {
      gameTitle = 'General Knowledge',
      category = 'STEM',
      difficulty = 'explorer',
      count = 4,
    } = req.body ?? {};

    const safeCount = Math.min(Math.max(Number(count) || 4, 1), 6);
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured yet. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Generate ${safeCount} engaging multiple-choice educational questions for "${String(gameTitle)}" (Category: ${String(category)}, Difficulty: ${String(difficulty)}). Each question must have 4 options, 1 correct index (0-3), a short hint, and a clear explanation.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctIndex: { type: Type.INTEGER },
              hint: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['question', 'options', 'correctIndex', 'hint', 'explanation'],
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim());
    res.json({ questions: Array.isArray(parsed) ? parsed : [] });
  } catch (err) {
    handleAiError(res, err, 'questions');
  }
});

router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { question, studentAnswer, expectedTopic = 'Education', difficulty = 'explorer' } = req.body ?? {};
    if (typeof question !== 'string' || typeof studentAnswer !== 'string' || !studentAnswer.trim()) {
      res.status(400).json({ error: 'Question and studentAnswer are required.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured yet. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Topic: ${String(expectedTopic)} (${String(difficulty)} level).\nQuestion: ${question}\nStudent Answer: ${studentAnswer}\nEvaluate accuracy fairly and constructively.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER, description: '0 to 100 mastery score for this answer.' },
            feedback: { type: Type.STRING },
            improvementTip: { type: Type.STRING },
          },
          required: ['isCorrect', 'score', 'feedback', 'improvementTip'],
        },
      },
    });

    const result = JSON.parse((response.text ?? '{}').trim());
    res.json(result);
  } catch (err) {
    handleAiError(res, err, 'evaluate');
  }
});

router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { level = 1, xp = 0, completedGameTitles = [], unplayedGameTitles = [] } = req.body ?? {};
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured yet. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `Student level: ${Number(level)}, XP: ${Number(xp)}. ` +
        `Completed games: ${JSON.stringify(completedGameTitles)}. ` +
        `Available unplayed games: ${JSON.stringify(unplayedGameTitles)}. ` +
        `Recommend 3 personalized next games or study focuses from the available list and explain why each fits.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  gameTitle: { type: Type.STRING },
                  recommendedDifficulty: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['gameTitle', 'recommendedDifficulty', 'reason'],
              },
            },
          },
          required: ['headline', 'recommendations'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err) {
    handleAiError(res, err, 'recommendations');
  }
});

router.post('/npc', async (req: Request, res: Response) => {
  try {
    const { npcName = 'Dr. Lyra', npcRole = 'Astrophysics Mentor', districtName = 'Science Spire', playerMessage = '' } = req.body ?? {};
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured yet. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const prompt = typeof playerMessage === 'string' && playerMessage.trim()
      ? `A student approaches you in ${String(districtName)} and asks: "${playerMessage.trim()}"`
      : `A student approaches your plaza station in ${String(districtName)} for the first time. Greet them warmly and offer one intriguing educational micro-fact plus a suggested building activity.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          `You are ${String(npcName)}, ${String(npcRole)} in the ${String(districtName)} district of EDUWORLD AI, a sunlit futuristic education city. ` +
          `Keep replies warm, inspiring, educational, and concise (under 90 words).`,
      },
    });

    res.json({ dialogue: response.text ?? `Welcome to ${String(districtName)}! Ready to explore a challenge?` });
  } catch (err) {
    handleAiError(res, err, 'npc');
  }
});

router.post('/report', async (req: Request, res: Response) => {
  try {
    const {
      displayName = 'Explorer',
      level = 1,
      xp = 0,
      gamesCompletedCount = 0,
      gameSummaries = [],
    } = req.body ?? {};

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured yet. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `Generate a concise Learning Progress Report for student "${String(displayName)}": ` +
        `Level ${Number(level)}, ${Number(xp)} XP, ${Number(gamesCompletedCount)}/20 games completed. ` +
        `Recent performance: ${JSON.stringify(gameSummaries)}.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            growthAreas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            nextMilestone: { type: Type.STRING },
          },
          required: ['summary', 'strengths', 'growthAreas', 'nextMilestone'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err) {
    handleAiError(res, err, 'report');
  }
});

export default router;
