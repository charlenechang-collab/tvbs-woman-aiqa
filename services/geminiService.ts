import { GoogleGenAI, Type } from "@google/genai";
import { GenerateRequest, QAPair } from '../types';
import SYSTEM_INSTRUCTION_TEMPLATE from '../prompts/v2_base_prompt.txt?raw';

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 🚀 Local Cache Key for Daily Trends
const CACHE_KEY = 'daily_trends';

interface DailyTrends {
  date: string;
  keywords: string[];
}

/**
 * Get daily trends from localStorage or fetch new ones if cache is expired.
 * Implements client-side caching to reduce token usage and API calls.
 */
const getDailyTrends = async (): Promise<string> => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const cachedData = localStorage.getItem(CACHE_KEY);

  if (cachedData) {
    try {
      const parsedCache: DailyTrends = JSON.parse(cachedData);
      // Check if cache is from today
      if (parsedCache.date === today && parsedCache.keywords && parsedCache.keywords.length > 0) {
        console.log('✅ Cache Hit: Using stored daily trends.');
        return parsedCache.keywords.join('、');
      }
    } catch (e) {
      console.warn('Error parsing cached trends, fetching new ones.');
    }
  }

  console.log('⚠️ Cache Miss: Fetching new daily trends...');

  // In a real environment, this logic would trigger a "Web Search Skill" or call a backend API.
  // Since we are running client-side, we simulate the "Agent Search" result here.
  const keywords = await fetchNewTrends();

  // Summarize to top 5 keywords to save tokens
  const top5Keywords = keywords.slice(0, 5);

  // Save to cache
  const newCache: DailyTrends = {
    date: today,
    keywords: top5Keywords,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));

  return top5Keywords.join('、');
};

/**
 * Fetches real-time trends using Gemini with Google Search Grounding.
 * This replaces the simulated "Agent Skill" with actual AI Web Search.
 */
const fetchNewTrends = async (): Promise<string[]> => {
  console.log('🌍 Conducting Live Web Search for Trends...');

  // Calculate current year and month dynamically (e.g., "2026年2月")
  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1; // getMonth is 0-indexed
  const dateString = `${currentYear}年${currentMonth}月`;

  const searchPrompt = `
    請搜尋目前 ${dateString} 台灣最流行的「美妝」與「時尚」關鍵字。
    請歸納出最熱門的 前 5 個 關鍵字 (例如：特色妝容、熱門成分、流行色系)。
    
    回傳格式要求：
    1. 只回傳關鍵字，用「、」分隔。
    2. 不要 markdown，不要前言後語。
    3. 每個關鍵字可以附帶英文 (例如：原生感底妝 (Native Skin))。
  `;

  try {
    // Call Gemini with Google Search Tool enabled
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Use Flash for speed & cost
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }], // 🚀 Enable Live Search
        responseMimeType: "text/plain",
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Trend Search");

    console.log('🔍 Raw Trend Search Result:', text);

    // Parse result (split by "、" or "," or newline)
    const keywords = text.split(/[,、\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 5); // Take top 5

    if (keywords.length === 0) throw new Error("Failed to parse keywords");

    return keywords;

  } catch (error) {
    console.error("⚠️ Trend Search Failed, using fallback list.", error);

    // Fallback list if Search fails (Backup Safety)
    return [
      '原生感底妝 (Native Skin)',
      '蜜糖水光唇 (Honey Glazed Lips)',
      '柔化哥德風 (Soft Goth)',
      '修容腮紅 (Contouring Blush)',
      '外泌體保養 (Exosomes)'
    ];
  }
};

// 🚀 Optimized Model Strategy: Forced Economy Mode
const MODELS_TO_TRY = [
  'gemini-1.5-flash',       // ⚡ Fastest & Cheapest (Forced as per v2.1 spec)
];

// Helper to retry API calls with Model Fallback
const generateWithFallback = async (
  generateFn: (model: string) => Promise<any>
): Promise<string> => {
  let lastError: any = null;

  for (const model of MODELS_TO_TRY) {
    console.log(`[Google AI] Attempting generation with model: ${model}...`);
    try {
      // 1. Try the model with robust retries
      const result = await callGeminiWithRetry(async () => {
        return await generateFn(model);
      }, 2, 1000); // 2 retries per model

      console.log(`✅ SUCCESS: Model ${model} generated content.`);
      return result;

    } catch (error: any) {
      console.warn(`⚠️ Model ${model} failed... Error:`, error.message || error);
      lastError = error;

      // If 403/Forbidden (API Key issue) -> Stop immediately
      if (error.response?.status === 403) throw error;
    }
  }

  // If all models fail
  throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
};

// Helper to retry API calls on 503/429 (Transient server errors)
const callGeminiWithRetry = async <T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const isOverloaded =
      error.status === 503 ||
      error.status === 429 || // Also retry on Rate Limit
      (error.message && error.message.includes('Overloaded')) ||
      (error.message && error.message.includes('busy'));

    if (isOverloaded && retries > 0) {
      console.log(`⏳ API Busy/Rate Limit. Retrying in ${delay}ms... (Retries left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiWithRetry(operation, retries - 1, delay * 1.5); // Exponential backoff
    }
    throw error;
  }
};

export const generateExtendedQA = async (request: GenerateRequest): Promise<QAPair[]> => {
  const { inputArticle, ragContext } = request;

  // 1. Get Daily Trends (Cached or Fetched)
  const todayTrends = await getDailyTrends();

  // 2. Inject Trends into System Prompt (Dynamic Injection)
  const systemInstruction = SYSTEM_INSTRUCTION_TEMPLATE.replace('{{today_trends}}', todayTrends);

  // Prepare context string
  const contextString = ragContext.map((ctx, index) =>
    `[文章 ${index + 1}] ID: ${ctx.id}\n標題: ${ctx.title}\n內容摘要: ${ctx.content}\n`
  ).join('\n----------------\n');

  const prompt = `
**目標文章內容**：
${inputArticle}

**檢索到的歷史文章 (RAG Context)**：
${contextString}

**請撰寫 6 組延伸問答，並嚴格遵守以下分配**：
1. **優先撰寫至少 3 組** 與「歷史文章 (RAG Context)」高度相關的問答。
   - 這些問答的 Source 必須是 RAG 文章的標題。
   - 內容必須基於歷史文章的事實，**嚴禁幻覺**。
2. **剩餘的** 可以是基於「目標文章」的延伸 ([本文延伸])。
3. 如果 RAG 文章非常相關，您可以生成超過 3 組 RAG 問答 (例如 4 組 RAG + 2 組 本文延伸)。
4. 絕對不可以全部都是 [本文延伸]。

請以 JSON 陣列格式輸出。
`;

  try {
    const text = await generateWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction, // Dynamic Prompt with injected trends
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "問題標題，15字以內，必須是問句形式（例如：...怎麼搭？...是什麼？）" },
                answer: { type: Type.STRING, description: "回答內容，約800-1000字，需包含3個小標題。⚠️重要：小標題(**文字**)必須獨立一行，前後請換行。嚴格禁止出現 [ID:xxxxx]。" },
                sourceId: { type: Type.STRING, description: "參考來源ID，例如 '57759' 或 '本文延伸'" },
                sourceTitle: { type: Type.STRING, description: "必須完全複製 RAG 資料庫中的【原始完整標題】，禁止簡化或改寫。" },
              },
              required: ["question", "answer", "sourceId", "sourceTitle"],
            },
          },
        },
      });
      if (!response.text) throw new Error("No response from AI");
      return response.text;
    });

    // Parse output
    const data = JSON.parse(text);
    return data as QAPair[];

  } catch (error) {
    console.error("Gemini API All Models Failed:", error);
    throw error;
  }
};

/**
 * Generates a SINGLE QA pair based on the context.
 * Used for the "Redo" functionality.
 */
export const generateSingleQA = async (request: GenerateRequest): Promise<QAPair> => {
  const { inputArticle, ragContext } = request;

  // 1. Get Daily Trends (Cached or Fetched)
  const todayTrends = await getDailyTrends();

  // 2. Inject Trends into System Prompt
  const systemInstruction = SYSTEM_INSTRUCTION_TEMPLATE.replace('{{today_trends}}', todayTrends);

  const contextString = ragContext.map((ctx, index) =>
    `[文章 ${index + 1}] ID: ${ctx.id}\n標題: ${ctx.title}\n內容摘要: ${ctx.content}\n`
  ).join('\n----------------\n');

  // Slightly modified prompt to ask for just one high-quality pair
  const prompt = `
**目標文章內容**：
${inputArticle}

**檢索到的歷史文章 (RAG Context)**：
${contextString}

請根據上述資料，撰寫 **1 組** 全新的延伸問答 (Q&A)，請嘗試切入不同的觀點。
`;

  try {
    const text = await generateWithFallback(async (model) => {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction, // Reuse the same persona
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT, // Requesting a single Object, not Array
            properties: {
              question: { type: Type.STRING, description: "問題標題，15字以內，必須是問句形式（例如：...怎麼搭？...是什麼？）" },
              answer: { type: Type.STRING, description: "回答內容，約800-1000字，需包含3個小標題。⚠️重要：小標題(**文字**)必須獨立一行，前後請換行。嚴格禁止出現 [ID:xxxxx]。" },
              sourceId: { type: Type.STRING, description: "參考來源ID，例如 '57759' 或 '本文延伸'" },
              sourceTitle: { type: Type.STRING, description: "必須完全複製 RAG 資料庫中的【原始完整標題】，禁止簡化或改寫。" },
            },
            required: ["question", "answer", "sourceId", "sourceTitle"],
          },
        },
      });
      if (!response.text) throw new Error("No response from AI");
      return response.text;
    });

    return JSON.parse(text) as QAPair;

  } catch (error) {
    console.error("Gemini API Single Generation Error:", error);
    throw error;
  }
};