import React, { useRef, useState } from 'react';
import { Article } from '../types';

interface DatabaseUploaderProps {
  onDataLoaded: (data: Article[], fileName: string) => void;
}

declare global {
  interface Window {
    Papa: any;
  }
}

export const DatabaseUploader: React.FC<DatabaseUploaderProps> = ({ onDataLoaded }) => {
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