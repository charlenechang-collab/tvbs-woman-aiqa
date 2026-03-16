
import { GenerateRequest, QAPair } from '../types';
import SYSTEM_INSTRUCTION_TEMPLATE from '../prompts/v2_base_prompt';

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
async function callGeminiRaw(modelId: string, payload: any): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    // Instead of direct API call, we use our secure Next.js API route
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ modelId, payload }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = {};
      try { errorData = await response.json(); } catch (e) { }

      // If it's a 404 proxy from the Vercel edge
      if (errorData.is404 || response.status === 404) {
        throw new Error(`MODEL_NOT_FOUND: ${modelId} (Details: ${errorData.error || response.statusText})`);
      }

      throw new Error(`Gemini API Error (${response.status}): ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT: 請求已超時 (60秒)，請稍後再試。');
    }
    throw error;
  }
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
    'gemini-2.5-flash',         // Google 當前主力推薦 (相容性最高)
    'gemini-2.0-flash',         // 穩定版 Flash
    'gemini-1.5-flash',         // 舊版備用 Flash

    // 以下為高級備援 (當 Flash 全滅才用)
    'gemini-2.5-pro',
    'gemini-2.0-pro-exp',
    'gemini-1.5-pro'
  ];

  let lastError: any = null;

  for (const model of MODELS) {

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

        continue;
      }


      return text;

    } catch (error: any) {
      // 如果錯誤包含 MODEL_NOT_FOUND (404)，這很正常，我們只需要換下一個模型
      if (error.message.includes('MODEL_NOT_FOUND') || error.message.includes('404')) {

      } else {

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

**請撰寫「精確 6 組」延伸問答，並嚴格遵守以下分配 (Total = 6 items)**：
1. **RAG 歷史文章題 (至多 3-4 組)**：
   - 檢索到的文章若與本篇文章主題相關，請優先從中提取延伸問答。
   - Source 必須是該篇文章的原始標題。
   - **嚴禁幻覺**：內容必須基於檢索到的文章事實。
   - **防呆機制**：若檢索到的 RAG 文章與目標文章「完全不相關」(例如主題差異極大)，請直接忽略該篇 RAG 文章，並將名額讓給「本文延伸題」。
2. **本文延伸題 (至少 2-3 組，或補齊不足的名額)**：
   - 若 RAG 資料不足或不相關，剩下的名額請全部用「目標文章」的延伸題補齊。
   - Source 標註為 \`[本文延伸]\`。
3. **總數檢核**：輸出的 JSON Array 長度 **必須等於 6**。絕對不要多，也不要少。

**標題 (Question) 修正規則**：
- **禁止使用簡略問句**：嚴禁出現「...是？」、「...有？」、「...為何？」這種不完整的結尾。
- **必須是完整問句**：
  - ❌ 錯誤：日系穿搭要點，是？
  - ✅ 正確：日系穿搭有哪些必備要點？
  - ❌ 錯誤：皮衣保養，怎麼做？
  - ✅ 正確：皮衣保養的正確步驟是什麼？
- 確保語意完整。

**多樣性與不重複原則 (Anti-Duplication) ⚠️非常重要**：
- 你產出的這 6 題問答，其「探討切入點」與「核心概念」**必須完全不同**。
- **嚴禁**用換句話說的方式詢問同一個概念 (例如：Q1問「怎麼瘦肚子」、Q2又問「消除腹部脂肪的方法」)。
- RAG 題請針對不同文章的獨特重點提問。
- 本文延伸題請盡可能從生活應用、迷思破解、或是跨領域結合 (例如：保養結合飲食) 等多角度切入。

【嚴格輸出格式限制】
你的回答 (answer) 必須「精確地」包含一個前言、三個小標題與三個段落，不可以多也不可以少。請嚴格套用以下的 Markdown 骨架：

**注意：三個小標題必須嚴格使用 ## (H2) 標籤開頭，絕對禁止使用 ### (H3) 或是單純加粗。**

<前言段落，不含任何標題>

## <第一個小標題，長度不超過15字>
<第一段內文>

## <第二個小標題，長度不超過15字>
<第二段內文>

## <第三個小標題，長度不超過15字>
<第三段內文>

絕對禁止產生第4個標題或只產生2個標題。

**JSON 輸出範例 (請嚴格模仿此結構，只輸出 6 項)**：
[
  { "question": "Q1...", "answer": "...", "sourceId": "...", "sourceTitle": "..." },
  { "question": "Q2...", "answer": "...", "sourceId": "...", "sourceTitle": "..." },
  { "question": "Q3...", "answer": "...", "sourceId": "...", "sourceTitle": "..." },
  { "question": "Q4...", "answer": "...", "sourceId": "...", "sourceTitle": "..." },
  { "question": "Q5...", "answer": "...", "sourceId": "...", "sourceTitle": "..." },
  { "question": "Q6...", "answer": "...", "sourceId": "...", "sourceTitle": "..." }
]
**⚠️ 重要警告：Generating more than 6 items will be penalized. STOP immediately after the 6th item.**

請以 JSON 陣列格式輸出。
`;

  const finalOutput = JSON.parse(await generateWithFallback((model) => ({
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

  // 🛡️ User requested to rely on Prompt Rules, allowing editors to manually delete extra items.
  return finalOutput;
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

【嚴格輸出格式限制】
你的回答 (answer) 必須「精確地」包含一個前言、三個小標題與三個段落，不可以多也不可以少。請嚴格套用以下的 Markdown 骨架：

**注意：三個小標題必須嚴格使用 ## (H2) 標籤開頭，絕對禁止使用 ### (H3) 或是單純加粗。**

<前言段落，不含任何標題>

## <第一個小標題，長度不超過15字>
<第一段內文>

## <第二個小標題，長度不超過15字>
<第二段內文>

## <第三個小標題，長度不超過15字>
<第三段內文>

絕對禁止產生第4個標題或只產生2個標題。
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