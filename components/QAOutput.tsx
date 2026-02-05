import React, { useState, useEffect } from 'react';
import { QAPair } from '../types';
import { Copy, Check, Eye, Edit3, Sparkles, ChevronDown, ChevronUp, RotateCcw, Loader2, Download } from 'lucide-react';

/**
 * ============================================================================
 * 🔒 CRITICAL COMPONENT: QAOutput
 * ============================================================================
 * 此元件包含「A (文章內容)」欄位的核心顯示與複製邏輯。
 * 
 * ⚠️ 嚴格規範 (Immutable Rules)：
 * 1. 顯示規則 (Display): H2 標題必須呈現為粉色左框線樣式。
 * 2. 複製邏輯 (Copy): H2 標題必須轉為 <h2>，內文段落必須轉為 <p>。
 * 3. 粗體處理 (Bold): 支援行內粗體 (**text**)，HTML 轉換為 <b>text</b>。
 * 4. 換行處理 (Newline): 必須標準化所有換行符號，並過濾 <br>。
 * 
 * 🚫 請勿隨意修改下方的正則表達式或 HTML 生成邏輯，以免破壞 CMS 相容性。
 * ============================================================================
 */

// 🛡️ PROTECTED REGEX PATTERNS
// H2 Header: Matches line starting with ## or wrapped in ** (robust)
const HEADER_REGEX = /^\s*(?:##\s*(?:\*\*)?|(?:\*\*))(.+?)(?:\*\*)?\s*$/;
// Inline Bold: Matches **text** inside a paragraph
const INLINE_BOLD_REGEX = /\*\*(.+?)\*\*/g;

interface QAOutputProps {
  data: QAPair[];
  onRegenerate?: (index: number) => void;
  regeneratingIndex?: number | null;
}

export const QAOutput: React.FC<QAOutputProps> = ({ data, onRegenerate, regeneratingIndex }) => {
  const [editableData, setEditableData] = useState<QAPair[]>([]);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [editModes, setEditModes] = useState<{ [key: number]: boolean }>({});
  const [expandedCards, setExpandedCards] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    // ==================================================================================
    // 🛡️ CRITICAL LOGIC PROTECTION [DATA NORMALIZATION]
    // ==================================================================================
    const normalizedData = data.map(item => ({
      ...item,
      answer: item.answer
        ? item.answer
          .replace(/\\n/g, '\n')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/<br\s*\/?>/gi, '\n') // Normalize <br> to newline
          // 🔧 FIX: Force newline if AI writes "**Header** Text" on the same line.
          // Regex matches: Start of line -> Bold Text -> Followed by any non-newline text
          .replace(/^(\s*\*\*.+?\*\*)(\s*[^\n]+)$/gm, '$1\n$2')
          // 🔧 FIX: Remove [ID:xxxxx] tags from the answer content
          // AI sometimes leaks RAG IDs into the text like "如 [ID:123] 所述". This cleans it up.
          .replace(/\[ID:\s*\w+\]/gi, '')
        : ''
    }));
    setEditableData(normalizedData);

    // Preserve edit modes and expansion states where possible, or default reset
    if (Object.keys(editModes).length === 0) {
      const initialModes: { [key: number]: boolean } = {};
      const initialExpanded: { [key: number]: boolean } = {};
      data.forEach((_, idx) => {
        initialModes[idx] = false;
        initialExpanded[idx] = true; // Default expanded on mobile
      });
      setEditModes(initialModes);
      setExpandedCards(initialExpanded);
    }
  }, [data]);

  const handleChange = (index: number, field: 'question' | 'answer', value: string) => {
    const newData = [...editableData];
    newData[index] = { ...newData[index], [field]: value };
    setEditableData(newData);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('複製失敗，請手動複製');
    }
  };

  const handleCopyQ = (index: number) => {
    const rawText = editableData[index].question.trim();
    const cleanText = rawText.replace(/<[^>]*>/g, '');
    copyToClipboard(cleanText, `q-${index}`);
  };

  const convertToHtml = (rawText: string) => {
    // ==================================================================================
    // 🛡️ CRITICAL LOGIC PROTECTION [HTML GENERATION]
    // ==================================================================================
    // 1. Pre-process: Ensure headers are surrounded by newlines
    let processedText = rawText
      // Ensure double newlines before headers (## or **) to isolate them
      .replace(/((?:^|\n)\s*(?:##|\*\*).*?$)/gm, '\n$1\n')
      // Normalize multiple newlines
      .replace(/\n{3,}/g, '\n\n');

    const lines = processedText.split(/\n+/).filter(line => line.trim() !== '');

    const htmlParts = lines.map(line => {
      const trimmed = line.trim();

      // 1. Detect Header: Matches ## Title or **Title**
      // Use the shared HEADER_REGEX to ensure consistency with preview
      const headerMatch = trimmed.match(HEADER_REGEX);
      if (headerMatch) {
        // Group 1 contains the clean title text
        return `<h2>${headerMatch[1].trim()}</h2>`;
      }

      // 2. Process Paragraph with Inline Bold
      const inlineProcessed = trimmed.replace(INLINE_BOLD_REGEX, '<b>$1</b>');
      return `<p>${inlineProcessed}</p>`;
    });

    return htmlParts.join('');
  };

  const handleCopyA = (index: number) => {
    const htmlText = convertToHtml(editableData[index].answer);
    copyToClipboard(htmlText, `a-${index}`);
  };

  const handleExportJSON = () => {
    if (editableData.length === 0) {
      alert("目前沒有可匯出的資料");
      return;
    }

    const exportPayload = editableData.map((item) => ({
      question: item.question,
      answer: convertToHtml(item.answer), // Export HTML format
      sourceId: item.sourceId,
      sourceTitle: item.sourceTitle
    }));

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `tvbs-woman-qa-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const toggleMode = (idx: number) => {
    setEditModes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleCard = (idx: number) => {
    setExpandedCards(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const renderFormattedPreview = (text: string) => {
    if (!text) return null;

    // ==================================================================================
    // 🛡️ CRITICAL LOGIC PROTECTION [PREVIEW RENDERING]
    // ==================================================================================
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();

      if (!trimmed) return <div key={i} className="h-4" />;

      const headerMatch = trimmed.match(HEADER_REGEX);
      if (headerMatch) {
        return (
          <h4 key={i} className="text-lg font-bold text-pink-700 mt-6 mb-3 border-l-4 border-pink-400 pl-3 leading-tight">
            {headerMatch[1].trim()}
          </h4>
        );
      }

      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className="mb-4 text-gray-700 leading-relaxed text-base">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  if (data.length === 0) return null;

  // Shared Render Functions for Q and A Inputs
  // Changed from Components to Functions to avoid remounting/focus loss on re-render
  const renderQuestionInput = (idx: number, item: QAPair) => (
    <div className="relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] font-black text-pink-400 uppercase tracking-widest">
          標題 (15字內)
        </label>
      </div>
      <textarea
        value={item.question}
        onChange={(e) => handleChange(idx, 'question', e.target.value)}
        className="w-full h-24 lg:h-28 p-3 text-lg lg:text-xl font-bold text-gray-800 bg-white border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:ring-4 focus:ring-pink-100 transition-all resize-none shadow-sm leading-tight"
        placeholder="輸入標題..."
      />
      <button
        onClick={() => handleCopyQ(idx)}
        className={`mt-2 w-full py-2 px-3 rounded-lg shadow-sm transition-all text-sm font-bold flex items-center justify-center gap-2 ${copiedStates[`q-${idx}`]
          ? 'bg-green-500 text-white transform scale-100'
          : 'bg-gray-100 text-gray-600 hover:bg-pink-500 hover:text-white hover:shadow-lg'
          }`}
      >
        {copiedStates[`q-${idx}`] ? <Check size={16} /> : <Copy size={16} />}
        {copiedStates[`q-${idx}`] ? '已複製' : '複製'}
      </button>
    </div>
  );

  const renderAnswerInput = (idx: number, item: QAPair) => (
    <div className="relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] font-black text-pink-400 uppercase tracking-widest">
          文章內文
        </label>
        <button
          onClick={() => toggleMode(idx)}
          className="flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-800 transition-all bg-pink-100/50 px-3 py-1 rounded-full border border-pink-200"
        >
          {editModes[idx] ? <><Eye size={14} /> 預覽</> : <><Edit3 size={14} /> 編輯</>}
        </button>
      </div>

      <div className="min-h-[300px] lg:min-h-[450px] flex flex-col">
        {editModes[idx] ? (
          <textarea
            value={item.answer}
            onChange={(e) => handleChange(idx, 'answer', e.target.value)}
            className="w-full flex-grow p-4 text-base text-gray-700 bg-white border-2 border-pink-100 rounded-xl focus:border-pink-400 focus:ring-4 focus:ring-pink-100 transition-all resize-y font-sans leading-relaxed shadow-inner overflow-auto min-h-[300px] lg:min-h-[450px]"
            placeholder="輸入文章內容..."
          />
        ) : (
          <div className="w-full h-[300px] lg:h-[450px] p-4 lg:p-6 text-base bg-white border border-pink-50 rounded-xl overflow-y-auto scrollbar-hide shadow-sm">
            {renderFormattedPreview(item.answer)}
          </div>
        )}
      </div>

      <button
        onClick={() => handleCopyA(idx)}
        className={`mt-3 w-full py-3 px-4 rounded-xl shadow-sm transition-all text-sm font-bold flex items-center justify-center gap-2 ${copiedStates[`a-${idx}`]
          ? 'bg-green-500 text-white'
          : 'bg-slate-800 text-white hover:bg-pink-600 hover:shadow-lg'
          }`}
      >
        {copiedStates[`a-${idx}`] ? <Check size={18} /> : <Copy size={18} />}
        {copiedStates[`a-${idx}`] ? '已轉 HTML 並複製' : '轉 HTML 並複製'}
      </button>
    </div>
  );

  const renderSourceDisplay = (item: QAPair) => (
    <div className="text-sm text-gray-700 bg-white border border-pink-100 p-4 rounded-xl shadow-sm border-l-4 border-l-pink-500 relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Sparkles size={40} className="text-pink-500" />
      </div>
      {item.sourceId === '本文延伸' || item.sourceId.includes('本文') ? (
        <div className="font-bold text-pink-700 flex items-center gap-2">
          <Sparkles size={16} /> [本文延伸]
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-md text-xs self-start border border-slate-200">
            [ID: {item.sourceId.replace(/^ID:\s*/i, '')}]
          </div>
          <div className="font-bold text-gray-800 leading-snug">
            {item.sourceTitle}
          </div>
        </div>
      )}
    </div>
  );

  const renderRedoButton = (idx: number) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRegenerate && onRegenerate(idx);
      }}
      disabled={regeneratingIndex === idx}
      className={`
        flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all border
        ${regeneratingIndex === idx
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-transparent'
          : 'bg-white text-gray-500 border-gray-200 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200 shadow-sm'}
      `}
      title="重新生成此組問答 (Redo)"
    >
      {regeneratingIndex === idx ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <RotateCcw size={14} />
      )}
      {regeneratingIndex === idx ? '生成中...' : 'Redo'}
    </button>
  );

  return (
    <div className="w-full animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6 border-b-2 border-pink-200 pb-2">
        <h2 className="text-2xl font-bold text-pink-800 flex items-center gap-2">
          ✨ 延伸問答編輯台
        </h2>

        {/* Export JSON Button */}
        {editableData.length > 0 && (
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-pink-600 hover:shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            <Download size={18} />
            一鍵匯出 JSON
          </button>
        )}
      </div>

      {/* =======================================================================
          MOBILE VIEW (< lg) - CARD LAYOUT
          Stack columns vertically for better mobile experience
      ======================================================================== */}
      <div className="flex flex-col gap-6 lg:hidden">
        {editableData.map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-md border border-pink-100 overflow-hidden">
            {/* Mobile Card Header */}
            <div
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 flex justify-between items-center cursor-pointer"
              onClick={() => toggleCard(idx)}
            >
              <div className="flex items-center gap-3">
                <span className="bg-white/20 px-2 py-1 rounded text-sm font-bold">#{idx + 1}</span>
                <span className="font-bold truncate max-w-[200px]">{item.question || '未命名問答'}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Mobile Redo Button */}
                {onRegenerate && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onRegenerate(idx)}
                      disabled={regeneratingIndex === idx}
                      className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 text-white transition-colors"
                    >
                      {regeneratingIndex === idx ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RotateCcw size={16} />
                      )}
                    </button>
                  </div>
                )}
                {expandedCards[idx] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            {/* Mobile Card Content */}
            {expandedCards[idx] && (
              <div className="p-4 flex flex-col gap-6 bg-pink-50/10">
                <div>
                  {renderQuestionInput(idx, item)}
                </div>
                <div>
                  {renderAnswerInput(idx, item)}
                </div>
                <div>
                  <label className="text-[10px] font-black text-pink-400 uppercase tracking-widest block mb-2">來源</label>
                  {renderSourceDisplay(item)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* =======================================================================
          DESKTOP VIEW (>= lg) - TABLE LAYOUT
          Wide table optimized for full screen editing
      ======================================================================== */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-xl overflow-hidden border border-pink-100">
        <table className="w-full text-left border-collapse table-fixed">
          <colgroup>
            <col className="w-[8%]" />  {/* No: 8% (widened slightly for button) */}
            <col className="w-[20%]" /> {/* Q: 20% */}
            <col className="w-[57%]" /> {/* A: 57% */}
            <col className="w-[15%]" /> {/* Source: 15% */}
          </colgroup>
          <thead>
            <tr className="bg-gradient-to-r from-pink-600 to-rose-500 text-white">
              <th className="p-5 text-center font-bold border-r border-pink-500/30">No</th>
              <th className="p-5 font-bold border-r border-pink-500/30">Q (標題)</th>
              <th className="p-5 font-bold border-r border-pink-500/30">A (文章內容)</th>
              <th className="p-5 font-bold">Source (來源)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {editableData.map((item, idx) => (
              <tr key={idx} className="hover:bg-pink-50/20 transition-colors group">
                <td className="p-5 text-center align-top pt-8 bg-pink-50/30">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-pink-700 font-bold text-lg">{idx + 1}</span>
                    {onRegenerate && renderRedoButton(idx)}
                  </div>
                </td>

                <td className="p-5 align-top">
                  {renderQuestionInput(idx, item)}
                </td>

                <td className="p-5 align-top">
                  {renderAnswerInput(idx, item)}
                </td>

                <td className="p-5 align-top pt-10">
                  {renderSourceDisplay(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};