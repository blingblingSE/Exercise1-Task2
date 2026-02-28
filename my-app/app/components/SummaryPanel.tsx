'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export type SummaryLanguage = 'en' | 'zh' | 'yue';

/** Model used for AI summary: DeepSeek V3.2 or GitHub GPT-4.1 */
export type SummaryModel = 'deepseek' | 'gpt4.1';

export interface SelectedFileForSummary {
  path: string;
  displayName: string;
}

interface SummaryPanelProps {
  selectedFile: SelectedFileForSummary | null;
  summary: string | null;
  loading: boolean;
  error: string | null;
  onGenerate: (language: SummaryLanguage, model: SummaryModel) => void;
  onSaveAsFile: (filePath: string, fileName?: string, summaryText?: string) => Promise<string | undefined>;
  onClearSelection?: () => void;
}

export default function SummaryPanel({
  selectedFile,
  summary,
  loading,
  error,
  onGenerate,
  onSaveAsFile,
  onClearSelection,
}: SummaryPanelProps) {
  const [language, setLanguage] = useState<SummaryLanguage>('en');
  const [model, setModel] = useState<SummaryModel>('deepseek');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [saveFileName, setSaveFileName] = useState('');
  const [history, setHistory] = useState<Array<{ summary: string; language: string; created_at: string }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setSaveStatus('idle');
      setSaveError('');
      setSaveFileName('');
      setHistory([]);
      setHistoryOpen(false);
      setExpandedHistoryIndex(null);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (selectedFile && summary && !saveFileName) {
      const base = selectedFile.path.replace(/^.*\//, '').replace(/\.[^/.]+$/, '') || 'document';
      setSaveFileName(`summary_${base}.txt`);
    }
  }, [selectedFile, summary, saveFileName]);

  useEffect(() => {
    if (!selectedFile?.path) return;
    fetch(`/api/summary-history?path=${encodeURIComponent(selectedFile.path)}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]));
  }, [selectedFile?.path, summary]);

  if (!selectedFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm p-6 text-center">
        <p>Click &quot;AI summary&quot; on a file in the list to show the summary panel here.</p>
      </div>
    );
  }

  const filePath = selectedFile.path;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between flex-shrink-0 border-b border-slate-200 pb-3 mb-3">
        <h3 className="font-medium text-slate-800 truncate pr-2" title={selectedFile.displayName}>
          {selectedFile.displayName}
        </h3>
        {onClearSelection && (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-slate-500 hover:text-slate-700 text-lg leading-none p-1 -m-1 cursor-pointer select-none"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        {loading && (
          <div className="text-slate-500 text-center py-6">
            <div className="animate-pulse">Generating summary...</div>
            <p className="text-xs mt-2">This may take 10-30 seconds</p>
          </div>
        )}
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
            <p className="font-medium">Summary failed</p>
            <p className="mt-1 break-words">{error}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(error)}
              className="mt-2 text-xs text-red-600 hover:underline"
            >
              Copy error
            </button>
          </div>
        )}
        {!loading && !error && !summary && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Model</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="model-panel"
                  value="deepseek"
                  checked={model === 'deepseek'}
                  onChange={() => setModel('deepseek')}
                  className="text-slate-700"
                />
                <span>DeepSeek V3.2</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="model-panel"
                  value="gpt4.1"
                  checked={model === 'gpt4.1'}
                  onChange={() => setModel('gpt4.1')}
                  className="text-slate-700"
                />
                <span>GPT-4.1</span>
              </label>
            </div>
            <p className="text-sm text-slate-500">Language</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="lang-panel"
                  value="en"
                  checked={language === 'en'}
                  onChange={() => setLanguage('en')}
                  className="text-slate-700"
                />
                <span>English</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="lang-panel"
                  value="zh"
                  checked={language === 'zh'}
                  onChange={() => setLanguage('zh')}
                  className="text-slate-700"
                />
                <span>中文</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="lang-panel"
                  value="yue"
                  checked={language === 'yue'}
                  onChange={() => setLanguage('yue')}
                  className="text-slate-700"
                />
                <span>粤语</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => onGenerate(language, model)}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded border border-slate-700"
            >
              Generate
            </button>
            {history.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  {historyOpen ? 'Hide' : 'Show'} summary history ({history.length})
                </button>
                {historyOpen && (
                  <ul className="mt-2 space-y-2 max-h-[40vh] overflow-y-auto">
                    {history.map((item, i) => {
                      const isExpanded = expandedHistoryIndex === i;
                      return (
                        <li key={i} className="text-xs border-l-2 border-slate-200 pl-2">
                          <span className="text-slate-400">
                            {new Date(item.created_at).toLocaleString()} · {item.language}
                          </span>
                          <p className={`text-slate-600 mt-0.5 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {item.summary}
                          </p>
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryIndex((k) => (k === i ? null : i))}
                            className="text-slate-500 hover:text-slate-700 mt-1 text-xs"
                          >
                            {isExpanded ? 'Show less' : 'Show full'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {!loading && !error && summary && (
          <div className="space-y-3">
            <div className="summary-content prose-custom text-slate-700 text-sm leading-relaxed">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 text-slate-800 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-slate-800">{children}</h3>,
                  p: ({ children }) => <p className="mb-2">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-3 my-2 text-slate-600">{children}</blockquote>,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
            {history.length > 1 && (
              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  {historyOpen ? 'Hide' : 'Show'} history ({history.length - 1} previous)
                </button>
                {historyOpen && (
                  <ul className="mt-2 space-y-2 max-h-[40vh] overflow-y-auto">
                    {history.slice(1).map((item, i) => {
                      const isExpanded = expandedHistoryIndex === i;
                      return (
                        <li key={i} className="text-xs border-l-2 border-slate-200 pl-2">
                          <span className="text-slate-400">
                            {new Date(item.created_at).toLocaleString()} · {item.language}
                          </span>
                          <p className={`text-slate-600 mt-0.5 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {item.summary}
                          </p>
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryIndex((k) => (k === i ? null : i))}
                            className="text-slate-500 hover:text-slate-700 mt-1 text-xs"
                          >
                            {isExpanded ? 'Show less' : 'Show full'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {filePath && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">File name (optional)</label>
                  <input
                    type="text"
                    value={saveFileName}
                    onChange={(e) => setSaveFileName(e.target.value)}
                    placeholder="e.g. my-summary.txt"
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setSaveStatus('saving');
                    setSaveError('');
                    try {
                      await onSaveAsFile(filePath, saveFileName.trim() || undefined, summary ?? undefined);
                      setSaveStatus('saved');
                    } catch (e) {
                      setSaveStatus('error');
                      setSaveError(e instanceof Error ? e.message : 'Save failed');
                    }
                  }}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  className="text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded px-3 py-1.5 disabled:opacity-50"
                >
                  {saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'saved'
                      ? 'Saved (download from list)'
                      : 'Save summary'}
                </button>
                {saveStatus === 'error' && (
                  <span className="ml-2 text-xs text-red-600">{saveError || 'Failed'}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
