import React from 'react';

interface ArticleInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const ArticleInput: React.FC<ArticleInputProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="w-full mb-6">
      <label className="block text-pink-800 font-bold text-lg mb-2">
        步驟 2：貼上文章內容
      </label>
      <textarea
        className="w-full h-64 p-4 rounded-xl border border-pink-200 focus:ring-2 focus:ring-pink-400 focus:border-transparent outline-none resize-none shadow-sm text-gray-700"
        placeholder="請在此貼上文章內容..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
};