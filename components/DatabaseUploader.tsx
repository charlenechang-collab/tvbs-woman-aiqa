import React, { useRef, useState } from 'react';
import { Article } from '../types';

interface DatabaseUploaderProps {
  onDataLoaded: (data: Article[], fileName: string) => void;
  compact?: boolean;
}

declare global {
  interface Window {
    Papa: any;
  }
}

export const DatabaseUploader: React.FC<DatabaseUploaderProps> = ({ onDataLoaded, compact }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // Helper to normalize keys (remove BOM, trim, lowercase)
  const normalizeKey = (key: string) => key ? key.trim().replace(/^[\uFEFF]/, '').toLowerCase() : '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    if (window.Papa) {
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const rawData = results.data;
          if (!rawData || rawData.length === 0) {
            alert("CSV 檔案似乎是空的");
            setLoading(false);
            return;
          }

          // Inspect first row to determine mapping
          const firstRow = rawData[0];
          const keys = Object.keys(firstRow);

          // Improved Key Detection Logic
          const findKey = (candidates: string[]) => {
            // 1. Exact match (normalized)
            const exact = keys.find(k => candidates.includes(normalizeKey(k)));
            if (exact) return exact;

            // 2. Partial match (key contains candidate)
            const partial = keys.find(k => candidates.some(c => normalizeKey(k).includes(c)));
            if (partial) return partial;

            return null;
          };

          const idKey = findKey(['id', 'article_id', 'post_id', '編號']) || keys.find(k => k.toLowerCase().includes('id')) || 'id';

          // Expanded title candidates to catch common variations
          const titleKey = findKey(['title', 'post_title', 'headline', 'subject', 'topic', 'name', '標題', 'article_title']) || 'title';

          // Find content key
          let contentKey = findKey(['content', 'body', 'text', '內文', '內容', 'description', 'article_content', 'post_content']);

          if (!contentKey) {
            // Fallback: find the column with the longest average length in the first 10 rows
            let maxAvgLen = -1;
            keys.forEach(k => {
              let totalLen = 0;
              let count = 0;
              for (let i = 0; i < Math.min(rawData.length, 10); i++) {
                const val = rawData[i][k];
                if (typeof val === 'string') {
                  totalLen += val.length;
                  count++;
                }
              }
              const avg = count > 0 ? totalLen / count : 0;
              // Exclude the detected title key from content candidates to avoid swapping
              if (k !== titleKey && k !== idKey && avg > maxAvgLen) {
                maxAvgLen = avg;
                contentKey = k;
              }
            });
          }

          // Last resort fallback
          if (!contentKey && keys.length > 0) {
            contentKey = keys.find(k => k !== idKey && k !== titleKey) || keys[keys.length - 1];
          }



          const normalizedData: Article[] = rawData.map((row: any) => ({
            id: String(row[idKey] || 'unknown').trim(),
            title: String(row[titleKey] || 'No Title').trim(),
            content: contentKey ? String(row[contentKey] || '').trim() : '',
            ...row
          }));

          onDataLoaded(normalizedData, file.name);
          setLoading(false);
        },
        error: (err: any) => {
          console.error("CSV Parse Error", err);
          alert("CSV 解析失敗");
          setLoading(false);
        }
      });
    } else {
      alert("CSV Parser not loaded. Please refresh.");
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="p-2 rounded-xl bg-gray-50 hover:bg-pink-50 text-gray-400 hover:text-pink-600 border border-gray-200 transition-colors shadow-sm disabled:opacity-50"
          title="手動更新資料庫 (CSV)"
        >
          {loading ? (
             <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mb-6">
      <div
        className="border-2 border-dashed border-pink-300 bg-pink-50 rounded-xl p-6 text-center cursor-pointer hover:bg-pink-100 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
        {loading ? (
          <p className="text-pink-600 font-semibold animate-pulse">正在讀取資料庫...</p>
        ) : (
          <div>
            <p className="text-lg font-bold text-pink-700 mb-1">步驟 1：上傳 RAG 資料庫</p>
            <p className="text-sm text-pink-500">
              請上傳文章資料庫檔案，包含 id, title, content 欄位的 CSV
            </p>
          </div>
        )}
      </div>
    </div>
  );
};