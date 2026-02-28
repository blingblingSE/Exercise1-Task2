'use client';

import { useState, useCallback } from 'react';
import FileUploader from './components/FileUploader';
import FileList from './components/FileList';
import SummaryPanel, {
  type SummaryLanguage,
  type SummaryModel,
  type SelectedFileForSummary,
} from './components/SummaryPanel';
import ReviewPanel from './components/ReviewPanel';

const COLUMN_MIN_HEIGHT = 'min(68vh, 560px)';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedFileForSummary, setSelectedFileForSummary] = useState<SelectedFileForSummary | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [review, setReview] = useState<{
    title: string;
    content: string | null;
    loading: boolean;
    filePath: string;
    isAiSummary: boolean;
  } | null>(null);

  const handleUploadSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSelectForSummary = useCallback((path: string, displayName: string, notSupported?: boolean) => {
    setSelectedFileForSummary({ path, displayName });
    setSummary(null);
    setSummaryLoading(false);
    if (notSupported) {
      setSummaryError(`Summary not supported for this file type. Use .txt, .md, .pdf, .doc, .docx`);
    } else {
      setSummaryError(null);
    }
  }, []);

  const handleOpenReview = useCallback((path: string, displayName: string, isAiSummary: boolean) => {
    if (isAiSummary) {
      setReview({ title: displayName, content: null, loading: true, filePath: path, isAiSummary });
      fetch(`/api/documents/download-summary?path=${encodeURIComponent(path)}`)
        .then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            let msg = text || 'Failed to load';
            try {
              const j = JSON.parse(text);
              if (j?.error) msg = j.error;
            } catch {
              /* use msg as-is */
            }
            throw new Error(msg);
          }
          return text;
        })
        .then((text) => {
          setReview((prev) => (prev ? { ...prev, content: text, loading: false } : null));
        })
        .catch((e) => {
          setReview((prev) =>
            prev ? { ...prev, content: e instanceof Error ? e.message : 'Failed to load content.', loading: false } : null
          );
        });
    } else {
      // Uploaded (non-AI) file: no content fetch — show panel with "Open in new tab" / "Download" at bottom (same as before: jump to page to view)
      setReview({ title: displayName, content: null, loading: false, filePath: path, isAiSummary: false });
    }
  }, []);

  const handleGenerateSummary = useCallback(async (path: string, language: SummaryLanguage, model: SummaryModel) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path, language, model }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summarize failed');
      setSummary(data.summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate summary';
      setSummaryError(
        msg.includes('abort') ? 'Request timed out (60s). Try a shorter document or check network.' : msg
      );
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const handleSaveSummaryAsFile = useCallback(
    async (filePath: string, fileName?: string, summaryText?: string): Promise<string | undefined> => {
      const res = await fetch('/api/documents/save-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, fileName: fileName || undefined, summary: summaryText || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setRefreshKey((k) => k + 1);
      return data.summaryFilePath as string | undefined;
    },
    []
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            Document Upload and File Management
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-4 lg:gap-6 items-stretch">
          {/* Left column: more space for Upload + Files + Review */}
          <div
            className="min-w-0 flex flex-col gap-3"
            style={{ minHeight: COLUMN_MIN_HEIGHT }}
          >
            <section>
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Upload
              </h2>
              <FileUploader onUploadSuccess={handleUploadSuccess} />
            </section>
            <section className="flex-1 min-h-0 flex flex-col">
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Files
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex-1 min-h-0 flex flex-col">
                <FileList
                  key={refreshKey}
                  onSelectForSummary={handleSelectForSummary}
                  onOpenReview={handleOpenReview}
                />
              </div>
            </section>
            {review && (
              <section className="flex-shrink-0 flex flex-col min-h-[320px]">
                <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Review
                </h2>
                <ReviewPanel
                  title={review.title}
                  content={review.content}
                  loading={review.loading}
                  onClose={() => setReview(null)}
                  filePath={review.filePath}
                  isAiSummary={review.isAiSummary}
                />
              </section>
            )}
          </div>

          {/* Right column: AI Summary */}
          <div className="min-w-0 flex flex-col" style={{ minHeight: COLUMN_MIN_HEIGHT }}>
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              AI Summary
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex-1 flex flex-col min-h-0">
              <SummaryPanel
                selectedFile={selectedFileForSummary}
                summary={summary}
                loading={summaryLoading}
                error={summaryError}
                onGenerate={(lang, model) =>
                  selectedFileForSummary ? handleGenerateSummary(selectedFileForSummary.path, lang, model) : undefined
                }
                onSaveAsFile={handleSaveSummaryAsFile}
                onClearSelection={() => {
                  setSelectedFileForSummary(null);
                  setSummary(null);
                  setSummaryError(null);
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
