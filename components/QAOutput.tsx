import React, { useState, useEffect } from 'react';
import { QAPair } from '../types';
import { Copy, Check, Eye, Edit3, Sparkles, ChevronDown, ChevronUp, RotateCcw, Loader2, Download, Trash2, AlertCircle, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, ListChecks, X, GripVertical, RefreshCw } from 'lucide-react';

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
  onRegenerateAll?: () => void;
  isGeneratingAll?: boolean;
}

export const QAOutput: React.FC<QAOutputProps> = ({ data, onRegenerate, regeneratingIndex, onRegenerateAll, isGeneratingAll }) => {
  const [editableData, setEditableData] = useState<QAPair[]>([]);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [editModes, setEditModes] = useState<{ [key: number]: boolean }>({});
  const [expandedCards, setExpandedCards] = useState<{ [key: number]: boolean }>({});

  // Modal and Drag states
  const [showSortModal, setShowSortModal] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);


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

    const dataToExport = editableData.slice(0, 6);

    const exportPayload = dataToExport.map((item) => ({
      question: item.question,
      answer: convertToHtml(item.answer) // Export HTML format
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

  const handleCopyAll = async () => {
    if (editableData.length === 0) {
      alert("目前沒有可複製的資料");
      return;
    }

    const dataToExport = editableData.slice(0, 6);

    const exportPayload = dataToExport.map((item) => ({
      question: item.question,
      answer: convertToHtml(item.answer) // Export HTML format
    }));

    const jsonString = JSON.stringify(exportPayload, null, 2);
    try {
      await navigator.clipboard.writeText(jsonString);
      alert("已複製全部 JSON 至剪貼簿");
    } catch (err) {
      console.error('Failed to copy all:', err);
      alert('複製失敗，您的瀏覽器可能不支援此功能');
    }
  };

  const toggleMode = (idx: number) => {
    setEditModes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleCard = (idx: number) => {
    setExpandedCards(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleDeleteItem = (idx: number) => {
    if (confirm("確定要刪除這組問答嗎？刪除後無法復原。")) {
      setEditableData(prev => prev.filter((_, i) => i !== idx));
      setEditModes(prev => {
        const newModes = { ...prev };
        delete newModes[idx];
        return newModes;
      });
      setExpandedCards(prev => {
        const newCards = { ...prev };
        delete newCards[idx];
        return newCards;
      });
    }
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= editableData.length) return;

    setEditableData(prev => {
      const newData = [...prev];
      const [movedItem] = newData.splice(fromIndex, 1);
      newData.splice(toIndex, 0, movedItem);
      return newData;
    });
    // Reset edit modes to force preview after moving
    setEditModes({});
  };

  const moveToTop = (idx: number) => moveItem(idx, 0);
  const moveToBottom = (idx: number) => moveItem(idx, editableData.length - 1);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    setDragOverItemIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex !== null && draggedItemIndex !== index) {
      moveItem(draggedItemIndex, index);
    }
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
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
        className={`mt-2 w-full py-2 px-3 rounded-xl shadow-sm transition-all duration-300 text-sm font-bold flex items-center justify-center gap-2 ${copiedStates[`q-${idx}`]
          ? 'bg-teal-500 text-white transform scale-100'
          : 'bg-gray-100 text-gray-600 hover:bg-pink-500 hover:text-white hover:shadow-md hover:-translate-y-0.5'
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
          className="flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-800 transition-all bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-xl border border-pink-200"
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
        className={`mt-3 w-full py-3 px-4 rounded-xl shadow-sm transition-all duration-300 text-sm font-bold flex items-center justify-center gap-2 ${copiedStates[`a-${idx}`]
          ? 'bg-teal-500 text-white'
          : 'bg-purple-900 text-white hover:bg-pink-600 hover:shadow-md hover:-translate-y-0.5'
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
          <div className="font-black text-purple-900 bg-purple-50 px-3 py-1 rounded-md text-xs self-start border border-purple-100">
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
        flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-all border whitespace-nowrap
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

  const renderDeleteButton = (idx: number, isMobile = false) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleDeleteItem(idx);
      }}
      className={`
        flex items-center justify-center transition-all group
        ${isMobile
          ? 'p-2 bg-rose-50/50 rounded-xl hover:bg-rose-500 text-rose-400 hover:text-white shadow-sm border border-rose-100'
          : 'text-xs font-bold px-3 py-1.5 rounded-xl border bg-white text-rose-500 border-rose-200 hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm gap-1'}
      `}
      title="剔除此題"
    >
      <Trash2 size={isMobile ? 16 : 14} className={`transition-transform duration-300 ${isMobile ? '' : 'group-hover:scale-110'}`} />
      {!isMobile && '刪除'}
    </button>
  );

  const renderMoveButtons = (idx: number, isMobile = false) => {
    const isFirst = idx === 0;
    const isLast = idx === editableData.length - 1;

    return (
      <div className={`flex items-center gap-1 ${isMobile ? 'bg-white/10 rounded-lg p-0.5' : 'bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-400 mb-2'}`} onClick={e => e.stopPropagation()}>
        <button onClick={() => moveToTop(idx)} disabled={isFirst} title="移至最上方" className={`p-1 rounded transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : isMobile ? 'hover:bg-white/20' : 'hover:bg-gray-200 hover:text-pink-600'}`}>
          <ChevronsUp size={isMobile ? 16 : 14} />
        </button>
        <button onClick={() => moveItem(idx, idx - 1)} disabled={isFirst} title="往上一題" className={`p-1 rounded transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : isMobile ? 'hover:bg-white/20' : 'hover:bg-gray-200 hover:text-pink-600'}`}>
          <ArrowUp size={isMobile ? 16 : 14} />
        </button>
        <button onClick={() => moveItem(idx, idx + 1)} disabled={isLast} title="往下一題" className={`p-1 rounded transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : isMobile ? 'hover:bg-white/20' : 'hover:bg-gray-200 hover:text-pink-600'}`}>
          <ArrowDown size={isMobile ? 16 : 14} />
        </button>
        <button onClick={() => moveToBottom(idx)} disabled={isLast} title="移入隔離區 (最底)" className={`p-1 rounded transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : isMobile ? 'hover:bg-white/20' : 'hover:bg-gray-200 hover:text-pink-600'}`}>
          <ChevronsDown size={isMobile ? 16 : 14} />
        </button>
      </div>
    );
  };

  return (
    <div className="w-full animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6 border-b-2 border-pink-200 pb-2">
        <h2 className="text-2xl font-bold text-pink-800 flex items-center gap-2">
          ✨ 延伸問答編輯台
        </h2>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Tertiary: Regenerate All (Ghost Style) */}
          {editableData.length > 0 && onRegenerateAll && (
            <button
              onClick={onRegenerateAll}
              disabled={isGeneratingAll}
              className="group flex items-center gap-2 text-rose-500 border-2 border-rose-100 hover:bg-rose-50/50 hover:border-rose-200 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw size={16} className={`group-hover:rotate-180 transition-transform duration-500 ${isGeneratingAll ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">重新生成全部</span>
            </button>
          )}

          {/* Secondary: Sort Overview (Glassmorphism) */}
          {editableData.length > 0 && (
            <button
              onClick={() => setShowSortModal(true)}
              className="flex items-center gap-2 bg-pink-100/80 text-pink-700 hover:bg-pink-200 border border-pink-200 px-4 py-2 rounded-xl font-bold backdrop-blur-sm transition-all transform hover:-translate-y-0.5 shadow-sm"
            >
              <ListChecks size={18} />
              <span className="hidden sm:inline">調整排序</span>
              <span className="sm:hidden">排序</span>
            </button>
          )}

          {/* Copy All (JSON) */}
          {editableData.length > 0 && (
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <Copy size={18} />
              <span className="hidden sm:inline">複製全部</span>
              <span className="sm:hidden">複製</span>
            </button>
          )}

          {/* Primary CTA: Export (Gradient + Glowing Shadow) */}
          {editableData.length > 0 && (
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-900 to-indigo-900 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 hover:-translate-y-0.5 transition-all"
            >
              <Download size={18} />
              <span className="hidden sm:inline">下載全部</span>
              <span className="sm:hidden">下載</span>
            </button>
          )}
        </div>
      </div>

      {/* =======================================================================
          SORT OVERVIEW MODAL
      ======================================================================== */}
      {showSortModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-pink-100">
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ListChecks size={24} /> 排序總覽與調整
                </h3>
                <p className="text-pink-100 text-sm mt-1">拖曳前方把手，或使用右側按鈕快速調整順序。</p>
              </div>
              <button
                onClick={() => setShowSortModal(false)}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex-grow bg-gray-50 flex flex-col gap-2 relative">
              {editableData.map((item, idx) => {
                const isQuarantine = idx >= 6;
                const isDragOver = dragOverItemIndex === idx;
                const isDragged = draggedItemIndex === idx;

                return (
                  <React.Fragment key={`modal-${idx}`}>
                    {idx === 6 && (
                      <div className="my-2 flex items-center gap-3">
                        <div className="h-px bg-rose-200 flex-grow"></div>
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 flex items-center gap-1.5 shadow-sm">
                          <AlertCircle size={14} /> 目前只支援6題，以下區域不會被匯出
                        </span>
                        <div className="h-px bg-rose-200 flex-grow"></div>
                      </div>
                    )}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`
                        flex items-center gap-3 bg-white p-3 rounded-xl border shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing
                        ${isQuarantine ? 'border-gray-200 bg-gray-50/80 grayscale-[0.3] opacity-80' : 'border-pink-100 hover:border-pink-300'}
                        ${isDragOver ? 'border-t-4 border-t-pink-500 scale-[1.02] shadow-md z-10' : ''}
                        ${isDragged ? 'opacity-20 bg-gray-100 scale-[0.98]' : ''}
                      `}
                    >
                      <div className="text-gray-400 p-1">
                        <GripVertical size={20} />
                      </div>
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold flex-shrink-0 ${isQuarantine ? 'bg-gray-200 text-gray-500' : 'bg-pink-100 text-pink-700'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-grow min-w-0 pr-4">
                        <div className={`font-bold truncate text-sm md:text-base ${isQuarantine ? 'text-gray-600' : 'text-gray-800'}`}>
                          {item.question || '未命名問答'}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">
                          {item.sourceTitle}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {renderMoveButtons(idx, true)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowSortModal(false)}
                className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm"
              >
                完成調整
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MOBILE VIEW (< lg) - CARD LAYOUT
          Stack columns vertically for better mobile experience
      ======================================================================== */}
      <div className="flex flex-col gap-6 lg:hidden">
        {editableData.map((item, idx) => {
          const isQuarantine = idx >= 6;
          return (
            <React.Fragment key={idx}>
              {idx === 6 && (
                <div className="flex flex-col items-center justify-center py-2 opacity-90 my-2">
                  <div className="w-full h-px bg-rose-300/50 mb-3"></div>
                  <span className="bg-rose-50 text-rose-500 text-[11px] px-3 py-1.5 rounded-full font-bold inline-flex items-center gap-1.5 border border-rose-100">
                    <AlertCircle size={14} /> 目前最多匯入6題，以下不會被匯出
                  </span>
                  <div className="w-full h-px bg-rose-300/50 mt-3"></div>
                </div>
              )}
              <div
                className={`bg-white rounded-2xl shadow-md border overflow-hidden transition-all duration-300
                  ${isQuarantine ? 'border-gray-200 opacity-60 grayscale-[0.6]' : 'border-pink-100'}
                `}
              >
                {/* Mobile Card Header */}
                <div
                  className={`text-white p-4 flex justify-between items-center cursor-pointer
                    ${isQuarantine ? 'bg-gray-400' : 'bg-gradient-to-r from-pink-500 to-rose-500'}
                  `}
                  onClick={() => toggleCard(idx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-white/20 px-2 py-1 rounded text-sm font-bold">#{idx + 1}</span>
                    <span className="font-bold truncate max-w-[200px]">{item.question || '未命名問答'}</span>
                  </div>

                  <div className="flex items-center gap-3">
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
                    <div onClick={(e) => e.stopPropagation()}>
                      {renderDeleteButton(idx, true)}
                    </div>
                    {expandedCards[idx] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Mobile Card Content */}
                {expandedCards[idx] && (
                  <div className={`p-4 flex flex-col gap-6 ${isQuarantine ? 'bg-gray-50' : 'bg-pink-50/10'}`}>
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
            </React.Fragment>
          );
        })}
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
            {editableData.map((item, idx) => {
              const isQuarantine = idx >= 6;

              return (
                <React.Fragment key={`desktop-${idx}`}>
                  {idx === 6 && (
                    <tr>
                      <td colSpan={4} className="p-4 pb-0 bg-transparent">
                        <div className="flex items-center justify-center py-4 relative group/quarantine">
                          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-300 to-transparent opacity-50 z-0"></div>
                          <span className="relative z-10 bg-rose-50 border border-rose-200 text-rose-500 text-sm px-5 py-2 rounded-full font-bold shadow-sm flex items-center gap-2 tracking-wide backdrop-blur-sm">
                            <AlertCircle size={16} className="text-rose-400" /> 目前《女人我最大》的後台最多只能匯入6題，以下這區不會被匯出
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`
                      group transition-all duration-300
                      ${isQuarantine ? 'bg-gray-50/50 hover:bg-gray-100/50 opacity-60 grayscale-[0.6]' : 'hover:bg-pink-50/30'}
                    `}
                  >
                    <td className={`p-4 text-center align-top pt-8 ${isQuarantine ? '' : 'bg-pink-50/20'} border-r border-gray-100/50`}>
                      <div className="flex flex-col items-center gap-2">
                        <span className={`font-bold text-lg mb-1 ${isQuarantine ? 'text-gray-500' : 'text-pink-700'}`}>{idx + 1}</span>
                        {onRegenerate && renderRedoButton(idx)}
                        {renderDeleteButton(idx)}
                      </div>
                    </td>

                    <td className="p-4 align-top">
                      {renderQuestionInput(idx, item)}
                    </td>

                    <td className="p-4 align-top">
                      {renderAnswerInput(idx, item)}
                    </td>

                    <td className="p-4 align-top pt-10">
                      {renderSourceDisplay(item)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};