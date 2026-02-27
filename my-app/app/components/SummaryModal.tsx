'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summary: string | null;
  loading: boolean;
  error: string | null;
}

export default function SummaryModal({
  isOpen,
  onClose,
  title,
  summary,
  loading,
  error,
}: SummaryModalProps) {
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
          <h3 className="font-semibold text-slate-800 truncate pr-2">
            Summary: {title}
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
            <div className="text-red-600 text-sm">{error}</div>
          )}
          {!loading && !error && summary && (
            <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
              {summary}
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
