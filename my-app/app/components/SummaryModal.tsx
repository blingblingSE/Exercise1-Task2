'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type SummaryLanguage = 'en' | 'zh' | 'yue';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summary: string | null;
  loading: boolean;
  error: string | null;
  filePath?: string | null;
  onGenerate?: (language: SummaryLanguage) => void;
  onSaveAsFile?: (filePath: string, fileName?: string, summaryText?: string) => Promise<string | undefined>;
}

export default function SummaryModal({
  isOpen,
  onClose,
  title,
  summary,
  loading,
  error,
  filePath,
  onGenerate,
  onSaveAsFile,
}: SummaryModalProps) {
  const [language, setLanguage] = useState<SummaryLanguage>('en');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [saveFileName, setSaveFileName] = useState('');
  const [history, setHistory] = useState<Array<{ summary: string; language: string; created_at: string }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSaveStatus('idle');
      setSaveError('');
      setSaveFileName('');
      setHistory([]);
      setHistoryOpen(false);
      setExpandedHistoryIndex(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (filePath && summary && !saveFileName) {
      const base = filePath.replace(/^.*\//, '').replace(/\.[^/.]+$/, '') || 'document';
      setSaveFileName(`summary_${base}.txt`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- default only when summary/filePath first available
  }, [filePath, summary]);

  useEffect(() => {
    if (!isOpen || !filePath) return;
    fetch(`/api/summary-history?path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]));
  }, [isOpen, filePath, summary]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0 relative z-10 bg-white">
          <h3 className="font-medium text-slate-800 truncate pr-2">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none p-2 -m-2 cursor-pointer select-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading && (
            <div className="text-slate-500 text-center py-8">
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
          {!loading && !error && !summary && onGenerate && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Language</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
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
                    name="lang"
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
                    name="lang"
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
                onClick={() => onGenerate(language)}
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
                    <ul className="mt-2 space-y-2 max-h-[50vh] overflow-y-auto">
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
              <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                {summary}
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
                    <ul className="mt-2 space-y-2 max-h-[50vh] overflow-y-auto">
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
              {filePath && onSaveAsFile && (
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
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modal, document.body)
    : modal;
}
