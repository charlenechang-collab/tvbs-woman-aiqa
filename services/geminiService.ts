
import { GenerateRequest, QAPair } from '../types';
import SYSTEM_INSTRUCTION_TEMPLATE from '../prompts/v2_base_prompt.txt?raw';

// 🚀 Local Cache Key for Daily Trends
const CACHE_KEY = 'daily_trends';

interface DailyTrends {
  date: string;
  keywords: string[];
}

/**
 * REST API Helper for Gemini
 * 使用 REST API 而非 SDK，以確保最大相容性並避開 SDK 版本問題
 */
const GEMINI_BASE_URL_STUDIO = "https://generativelanguage.googleapis.com/v1beta/models";

// 硬編碼 API Key 以確保測試無誤
const HARDCODED_KEY = 'AIzaSyAdJ7BC4L9kQv2OIC4fSEWYgWFTvsxuqY8';

async function callGeminiRaw(modelId: string, payload: any): Promise<any> {
  const apiKey = process.env.API_KEY || HARDCODED_KEY;
  if (!apiKey) throw new Error("API Key is missing!");

  // 清理模型名稱，確保格式正確
  // 例如 "models/gemini-1.5-flash" -> "gemini-1.5-flash"
  const cleanModel = modelId.replace('models/', '');

  // 直接構建請求 URL
  const url = `${GEMINI_BASE_URL_STUDIO}/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorBody = "";
    try { errorBody = await response.text(); } catch (e) { }

    // 如果是 404，拋出特定錯誤，並包含詳細原因
    if (response.status === 404) {
      throw new Error(`MODEL_NOT_FOUND: ${cleanModel} (Details: ${errorBody})`);
    }

    throw new Error(`Gemini API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data;
}

// (Trend generation removed as per user request to strictly rely on RAG)
const getDailyTrends = async (): Promise<string> => {
  return "";
};

/**
 * 核心生成邏輯：支援自動降級 (Fallback)
 */
const generateWithFallback = async (
  createPayload: (model: string) => any
): Promise<string> => {

  // 這裡列出我們「確定曾經可以用」的模型
  // 順序：優先嘗試省錢的 Flash 系列 -> 失敗才試高級的 Pro 系列
  const MODELS = [
    'gemini-3.0-flash-preview', // 優先：最新且最便宜
    'gemini-2.5-flash',         // 次選：上一代便宜版
    'gemini-1.5-flash',         // 備選：更舊的便宜版

    // 以下為高級備援 (當 Flash 全滅才用)
    'gemini-3.0-pro-preview',
    'gemini-2.5-pro',
    'gemini-1.5-pro'
  ];

  let lastError: any = null;

  for (const model of MODELS) {
    console.log(`[Google AI] 嘗試模型: ${model}...`);
    try {
      const payload = createPayload(model);

      // 執行請求
      const data = await callGeminiRaw(model, payload);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text && data.promptFeedback) {
        // 如果被 Safety Filter 擋下，這不算連線失敗，直接拋出
        throw new Error(`內容被安全設定阻擋: ${JSON.stringify(data.promptFeedback)}`);
      }
      if (!text) {
        console.warn(`Model ${model} 回傳空內容，嘗試下一個...`);
        continue;
      }

      console.log(`✅ 成功: 模型 ${model} 已生成內容。`);
      return text;

    } catch (error: any) {
      // 如果錯誤包含 MODEL_NOT_FOUND (404)，這很正常，我們只需要換下一個模型
      if (error.message.includes('MODEL_NOT_FOUND') || error.message.includes('404')) {
        console.warn(`⚠️ 模型 ${model} 不可用 (404)，切換至下一個...`);
      } else {
        console.warn(`⚠️ 模型 ${model} 發生其他錯誤:`, error.message);
      }
      lastError = error;

      // 如果是 API Key 錯誤，就不需要再試了，直接中斷
      if (error.message.includes("400") || error.message.includes("403") || error.message.includes("API Key")) {
        throw error;
      }
    }
  }

  throw new Error(`所有模型皆失敗。最後錯誤: ${lastError?.message || 'Unknown'}`);
};



export const generateExtendedQA = async (request: GenerateRequest): Promise<QAPair[]> => {
  const { inputArticle, ragContext } = request;

  // Clean System Prompt: Remove trend placeholders if they exist
  const systemInstructionText = SYSTEM_INSTRUCTION_TEMPLATE.replace('{{today_trends}}', ' (無須參考外部趨勢，請專注於資料庫內容) ');

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
2. **剩餘的** 可以是基於「目標文章」的延伸 ([本文延伸])。
3. 如果 RAG 文章非常相關，您可以生成超過 3 組 RAG 問答。
4. 絕對不可以全部都是 [本文延伸]。

請以 JSON 陣列格式輸出。
`;

  return JSON.parse(await generateWithFallback((model) => ({
    system_instruction: { parts: [{ text: systemInstructionText }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            answer: { type: "STRING" },
            sourceId: { type: "STRING" },
            sourceTitle: { type: "STRING" }
          },
          required: ["question", "answer", "sourceId", "sourceTitle"]
        }
      }
    }
  }))) as QAPair[];
};


export const generateSingleQA = async (request: GenerateRequest): Promise<QAPair> => {
  const { inputArticle, ragContext } = request;

  // Clean System Prompt
  const systemInstructionText = SYSTEM_INSTRUCTION_TEMPLATE.replace('{{today_trends}}', ' (無須參考外部趨勢，請專注於資料庫內容) ');

  const contextString = ragContext.map((ctx, index) =>
    `[文章 ${index + 1}] ID: ${ctx.id}\n標題: ${ctx.title}\n內容摘要: ${ctx.content}\n`
  ).join('\n----------------\n');

  const prompt = `
**目標文章內容**：
${inputArticle}

**檢索到的歷史文章 (RAG Context)**：
${contextString}

請根據上述資料，撰寫 **1 組** 全新的延伸問答 (Q&A)，請嘗試切入不同的觀點。
`;

  return JSON.parse(await generateWithFallback((model) => ({
    system_instruction: { parts: [{ text: systemInstructionText }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          answer: { type: "STRING" },
          sourceId: { type: "STRING" },
          sourceTitle: { type: "STRING" }
        },
        required: ["question", "answer", "sourceId", "sourceTitle"]
      }
    }
  }))) as QAPair;
};