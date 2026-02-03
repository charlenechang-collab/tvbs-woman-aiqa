import { GoogleGenAI, Type } from "@google/genai";
import { GenerateRequest, QAPair } from '../types';

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

import SYSTEM_INSTRUCTION from '../prompts/v1.1_trend_optimization.txt?raw';

// 🚀 Optimized Model Strategy for Pro Users
// 🚀 Optimized Model Strategy for Cost Efficiency
const MODELS_TO_TRY = [
  'gemini-1.5-flash',       // ⚡ Fastest & Cheapest (Priority for Cost Saving)
  'gemini-1.5-pro',         // 🥇 High Quality Fallback
  'gemini-2.0-flash',       // 🚀 Next Gen
  'gemini-1.0-pro',         // Legacy Fallback
];

// Helper to retry API calls with Model Fallback
const generateWithFallback = async (
  generateFn: (model: string) => Promise<any>
): Promise<string> => {
  let lastError: any = null;

  for (const model of MODELS_TO_TRY) {
    console.log(`[Google AI Pro] Attempting generation with model: ${model}...`);
    try {
      // 1. Try the model with robust retries for Pro tier
      const result = await callGeminiWithRetry(async () => {
        return await generateFn(model);
      }, 2, 1000); // 2 retries per model to ensure stability

      console.log(`✅ SUCCESS: Model ${model} generated content.`);
      return result;

    } catch (error: any) {
      console.warn(`⚠️ Model ${model} failed, switching to next... Error:`, error.message || error);
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
      error.status === 429 || // Also retry on Rate Limit (Pro should have higher limits but still possible)
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
          systemInstruction: SYSTEM_INSTRUCTION,
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
          systemInstruction: SYSTEM_INSTRUCTION, // Reuse the same persona
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