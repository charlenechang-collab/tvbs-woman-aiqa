import React, { useState, useEffect } from 'react';
import { DatabaseUploader } from './components/DatabaseUploader';
import { ArticleInput } from './components/ArticleInput';
import { QAOutput } from './components/QAOutput';
import { Article, QAPair } from './types';
import { findRelevantArticles } from './services/rag';
import { generateExtendedQA, generateSingleQA } from './services/geminiService';
import { Loader2, Sparkles, BookOpen, AlertCircle } from 'lucide-react';

export default function App() {
  const [dbData, setDbData] = useState<Article[]>([]);
  const [dbName, setDbName] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [qaResults, setQaResults] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which specific row is regenerating
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Auto-load database.csv
  useEffect(() => {
    const loadDefaultDatabase = async () => {
      try {
        const response = await fetch('/database.csv');
        if (!response.ok) return;

        const csvText = await response.text();
        if (!csvText || csvText.trim().length === 0) return;

        if ((window as any).Papa) {
          (window as any).Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
              const rawData = results.data;
              if (rawData && rawData.length > 0) {
                // --- START: Rigid Parsing Logic (Synced with DatabaseUploader) ---
                const firstRow = rawData[0];
                const keys = Object.keys(firstRow);
                const normalizeKey = (key: string) => key ? key.trim().replace(/^[\uFEFF]/, '').toLowerCase() : '';

                const findKey = (candidates: string[]) => {
                  const exact = keys.find(k => candidates.includes(normalizeKey(k)));
                  if (exact) return exact;
                  const partial = keys.find(k => candidates.some(c => normalizeKey(k).includes(c)));
                  if (partial) return partial;
                  return null;
                };

                const idKey = findKey(['id', 'article_id', 'post_id', '編號']) || keys.find(k => k.toLowerCase().includes('id')) || 'id';
                const titleKey = findKey(['title', 'post_title', 'headline', 'subject', 'topic', 'name', '標題', 'article_title']) || 'title';

                // Add '內容' to detection list
                let contentKey = findKey(['content', 'body', 'text', '內文', '內容', 'description', 'article_content', 'post_content']);

                if (!contentKey && keys.length > 0) {
                  // Fallback: use last column or non-id/title column
                  contentKey = keys.find(k => k !== idKey && k !== titleKey) || keys[keys.length - 1];
                }

                console.log(`[Auto-Load] Mapped columns - ID: ${idKey}, Title: ${titleKey}, Content: ${contentKey}`);

                const normalizedData = rawData.map((row: any) => ({
                  id: String(row[idKey] || 'unknown').trim(),
                  title: String(row[titleKey] || 'No Title').trim(),
                  content: contentKey ? String(row[contentKey] || '').trim() : '',
                  ...row
                }));
                // --- END: Rigid Parsing Logic ---

                setDbData(normalizedData);
                setDbName('Auto-Loaded Database');
              }
            }
          });
        }
      } catch (e) {
        console.warn("Auto-load failed", e);
      }
    };

    if ((window as any).Papa) {
      loadDefaultDatabase();
    } else {
      setTimeout(loadDefaultDatabase, 1000);
    }
  }, []);

  // Helper to process raw AI result and map ID to Title
  const processRawResult = (item: QAPair, database: Article[]): QAPair => {
    // Skip "本文延伸"
    if (item.sourceId === '本文延伸' || item.sourceId.includes('本文')) {
      return item;
    }

    // Clean up ID: remove brackets [], "ID:" prefix, and whitespace
    const cleanId = item.sourceId.replace(/\[|\]/g, '').replace(/^(ID:|id:)\s*/i, '').trim();

    // Find exact match in the loaded database
    const originalArticle = database.find(article => article.id === cleanId);

    if (originalArticle) {
      return {
        ...item,
        sourceId: cleanId, // Standardize ID format
        sourceTitle: originalArticle.title // Use the EXACT title from CSV
      };
    }

    return item;
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      alert("請先輸入文章內容");
      return;
    }
    if (dbData.length === 0) {
      alert("請先上傳 RAG 資料庫 (CSV)");
      return;
    }

    setLoading(true);
    setError(null);
    setQaResults([]);

    try {
      // 1. Client-side RAG Retrieval
      const contextArticles = findRelevantArticles(inputText, dbData, 5);

      if (contextArticles.length === 0) {
        throw new Error("無法從資料庫中找到相關文章，請檢查 CSV 內容是否正確。");
      }

      // 2. Call Gemini
      const results = await generateExtendedQA({
        inputArticle: inputText,
        ragContext: contextArticles
      });

      // 3. Post-processing
      const enhancedResults = results.map(item => processRawResult(item, dbData));

      setQaResults(enhancedResults);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "生成失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSingle = async (index: number) => {
    if (!inputText.trim() || dbData.length === 0) return;

    setRegeneratingIndex(index);
    try {
      // 1. Re-fetch context (fast client-side op)
      const contextArticles = findRelevantArticles(inputText, dbData, 5);

      // 2. Call Gemini for single item
      const newPair = await generateSingleQA({
        inputArticle: inputText,
        ragContext: contextArticles
      });

      // 3. Post-processing
      const processedPair = processRawResult(newPair, dbData);

      // 4. Update state
      setQaResults(prev => {
        const next = [...prev];
        next[index] = processedPair;
        return next;
      });

    } catch (err: any) {
      console.error("Regeneration failed:", err);
      alert("重試失敗，請稍後再試。");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-pink-100 shadow-sm">
        <div className="max-w-[95%] xl:max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-pink-600 text-white p-2 rounded-lg">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">女人我最大</h1>
              <p className="text-xs text-pink-500 font-medium tracking-widest uppercase">AI Extended Q&A Generator</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
            <BookOpen size={16} />
            <span>Senior Editor Mode</span>
          </div>
        </div>
      </header>

      {/* Main Container: Fluid width to accommodate large table */}
      <main className="w-full mx-auto px-4 py-8">

        {/* Input Section Container */}
        <div className="max-w-5xl mx-auto">
          {/* Intro */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-gray-800 mb-2">延伸問答產生器</h2>
            <p className="text-gray-500">
              結合《女人我最大》文章資料庫，生成 AI 延伸問答。
            </p>
          </div>


          {/* Step 1: Upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                資料庫設定
              </h3>
              {dbName && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  已載入: {dbName} ({dbData.length} 筆資料)
                </span>
              )}
            </div>

            <DatabaseUploader onDataLoaded={(data, name) => {
              setDbData(data);
              setDbName(name);
            }} />

            {/* Auto-load Message or Error */}
            {!dbName && (
              <div className="flex items-start gap-2 text-xs text-orange-500 bg-orange-50 p-3 rounded-lg">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>若未自動載入，請手動上傳文章資料庫 (CSV)。</p>
              </div>
            )}
          </div>

          {/* Step 2: Input */}
          <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 mb-8 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                文章內容
              </h3>
            </div>
            <ArticleInput value={inputText} onChange={setInputText} disabled={loading} />

            <div className="flex justify-end mt-4">
              <button
                onClick={handleGenerate}
                disabled={loading || !inputText || !dbData.length}
                className={`
                  px-8 py-3 rounded-full font-bold text-white shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95
                  ${(loading || !inputText || !dbData.length) ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-pink-200'}
                `}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    此由 AI 奴才肝出，唯一要求：請編輯大大去喝水 💧
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    產生延伸問答
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded-r shadow-sm flex items-center gap-3">
              <AlertCircle size={24} />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className="max-w-[98%] 2xl:max-w-7xl mx-auto">
          <QAOutput
            data={qaResults}
            onRegenerate={handleRegenerateSingle}
            regeneratingIndex={regeneratingIndex}
          />
        </div>

      </main>

      <footer className="text-center text-gray-400 text-sm py-8">
        © 2026 TVBS 女人我最大 | 數位事業部
      </footer>
    </div>
  );
}