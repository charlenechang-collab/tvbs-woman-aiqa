import { GoogleGenAI, Type } from "@google/genai";
import { GenerateRequest, QAPair } from '../types';

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
你現在是 TVBS《女人我最大》的數位版資深編輯。你的讀者多為喜愛時尚、美妝、生活品味的女性。

**語氣與風格要求**：
1. **親切像閨蜜**：使用「我們」、「大家」、「小編」等拉近距離的詞彙。
2. **專業且犀利**：能一針見血指出穿搭或保養重點，但不生硬說教。
3. **帶有導購或導流意識**：懂得如何透過文字吸引讀者點擊延伸閱讀。
4. **在地視角與國際敏感度**：理解台灣文化脈絡，同時緊跟國內外流行時尚動向。

**任務目標**：
當使用者輸入一篇新的「目標文章內容」時，請執行以下步驟：
1. **關鍵字提取**：分析目標文章的核心主題（例如：顯瘦穿搭、抗老保養、某位藝人、精品包款）。
2. **RAG 整合**：參考提供的「歷史文章資料庫」，找出與目標文章主題最相關的內容。
3. **生成延伸問答**：撰寫深度延伸問答文章。

**產出規範 (Output Constraints)**：
1. **Q (標題)**：
   - 15 字以內。
   - **必須是問句形式** (例如：...怎麼搭？...好用嗎？...是關鍵？...如何挑選？)。
   - 簡潔有力，做為該篇文章的主標題。
2. **A (文章內容)**：
   - 字數：**800-1000 字** (請盡量豐富內容)。
   - **嚴格禁止在內文中出現資料庫 ID**：絕對不要在文章內容中寫出 "[ID:xxxxx]" 這樣的標記，這會破壞閱讀體驗。若引用了資料庫內容，請直接融合成通順的文字即可。
   - **排版結構 (非常重要)**：
     - 文章必須明確分為 **3 個段落**。
     - 每個段落上方必須有一個 **H2 小標題**。
     - **格式要求**：小標題必須使用 Markdown 粗體 (**標題文字**) 表示，且 **必須獨立一行**。
     - 禁止將小標題寫在段落內文中。
     - **正確範例**：
       **小標題一**
       這裡是內文段落...
     - **錯誤範例**：
       **小標題一**這裡是內文段落... (錯誤：未換行)
       這裡是內文段落中的**重點強調**... (錯誤：這不是標題)
   - 內容詳盡、有觀點，並融合 RAG 資料庫資訊。
   - **注意**：為了方便後續前端處理，請使用標準換行符號 (\\n) 來分段。
3. **Source (來源)**：
   - 若內容參考自 RAG 資料庫，請標註 \`[ID:xxxxx] 原始完整標題\`。必須完全複製資料庫中的完整標題，**禁止任何形式的簡化或改寫**。
   - 若內容延伸自本文，請標註 \`[本文延伸]\`。
`;

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

請根據上述資料，撰寫 6 組延伸問答，並以 JSON 陣列格式輸出。
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    // Parse output
    const data = JSON.parse(text);
    return data as QAPair[];

  } catch (error) {
    console.error("Gemini API Error:", error);
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
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as QAPair;

  } catch (error) {
    console.error("Gemini API Single Generation Error:", error);
    throw error;
  }
};