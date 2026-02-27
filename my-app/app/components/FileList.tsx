'use client';

import { useState, useEffect } from 'react';
import SummaryModal, { type SummaryLanguage } from './SummaryModal';

interface FileItem {
  name: string;
  path: string;
  created_at: string;
  size?: number | null;
  has_summary?: boolean;
  summary_file_path?: string | null;
  is_ai_summary?: boolean;
}

const SUMMARIZABLE_EXT = ['.txt', '.md', '.pdf', '.doc', '.docx'];

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileList() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'ai' | 'original'>('all');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    title: string;
    content: string | null;
    loading: boolean;
  }>({ open: false, title: '', content: null, loading: false });
  const [summaryModal, setSummaryModal] = useState<{
    open: boolean;
    title: string;
    path: string | null;
  }>({ open: false, title: '', path: null });
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucketName = 'Documents';

  async function fetchFiles() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, []);

  async function handleDelete(path: string, displayName?: string) {
    const name = displayName || path.replace(/^\d+-/, '');
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(path);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setFiles((prev) => prev.filter((f) => f.path !== path));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  function getPublicUrl(path: string) {
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${path}`;
  }

  async function handleCopyLink(path: string) {
    const url = getPublicUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      alert('Failed to copy link');
    }
  }

  function handleDownload(path: string, displayName: string) {
    const url = getPublicUrl(path);
    const a = document.createElement('a');
    a.href = url;
    a.download = displayName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const isAiSummaryFile = (file: FileItem) =>
    !!file.is_ai_summary || /^\d+-summary_/.test(file.path);

  async function handleReview(file: FileItem, displayName: string) {
    if (isAiSummaryFile(file)) {
      setReviewModal({ open: true, title: displayName, content: null, loading: true });
      try {
        const res = await fetch(
          `/api/documents/download-summary?path=${encodeURIComponent(file.path)}`
        );
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
        setReviewModal((prev) => ({ ...prev, content: text, loading: false }));
      } catch (e) {
        setReviewModal((prev) => ({
          ...prev,
          content: e instanceof Error ? e.message : 'Failed to load content.',
          loading: false,
        }));
      }
    } else {
      handleDownload(file.path, displayName);
    }
  }

  function handleDownloadSummaryFile(summaryFilePath: string) {
    const url = `/api/documents/download-summary?path=${encodeURIComponent(summaryFilePath)}`;
    const filename = summaryFilePath.replace(/^.*\//, '').replace(/^\d+-/, '') || 'summary.txt';
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleSummarize(path: string, displayName: string) {
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
    setSummaryModal({ open: true, title: displayName, path });
    setSummary(null);
    setSummaryError(null);
    setSummaryLoading(false);
    if (!SUMMARIZABLE_EXT.includes(ext)) {
      setSummaryError(`Summary not supported for ${ext || 'this file type'}. Use .txt, .md, .pdf, .doc, .docx`);
      return;
    }
  }

  async function handleGenerateSummary(path: string, language: SummaryLanguage) {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path, language }),
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
  }

  async function handleSaveSummaryAsFile(filePath: string, fileName?: string, summaryText?: string): Promise<string | undefined> {
    const res = await fetch('/api/documents/save-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, fileName: fileName || undefined, summary: summaryText || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');
    await fetchFiles();
    return data.summaryFilePath as string | undefined;
  }

  const filteredFiles = files.filter((f) => {
    if (filterBy === 'ai') return !!f.is_ai_summary;
    if (filterBy === 'original') return !f.is_ai_summary;
    return true;
  });

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredBySearch = searchLower
    ? filteredFiles.filter((f) =>
        f.name.replace(/^\d+-/, '').toLowerCase().includes(searchLower)
      )
    : filteredFiles;

  const sortedFiles = [...filteredBySearch].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(sortedFiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedFiles = sortedFiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filterBy, sortBy, searchQuery]);

  if (loading) {
    return (
      <div className="text-slate-500 py-8 text-center">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 py-4 text-center">
        {error}
        <button
          onClick={fetchFiles}
          className="ml-2 text-blue-600 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-slate-500 py-8 text-center">
        No documents yet. Upload your first file above.
      </div>
    );
  }

  return (
    <div>
      <SummaryModal
        isOpen={summaryModal.open}
        onClose={() => setSummaryModal({ open: false, title: '', path: null })}
        title={summaryModal.title}
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        filePath={summaryModal.path}
        onGenerate={
          summaryModal.path
            ? (lang) => handleGenerateSummary(summaryModal.path!, lang)
            : undefined
        }
        onSaveAsFile={
          summaryModal.path
            ? (path, fileName, summaryText) => handleSaveSummaryAsFile(path, fileName, summaryText)
            : undefined
        }
      />
      {reviewModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setReviewModal({ open: false, title: '', content: null, loading: false })}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
              <h3 className="font-medium text-slate-800 truncate pr-2">{reviewModal.title}</h3>
              <button
                type="button"
                onClick={() => setReviewModal({ open: false, title: '', content: null, loading: false })}
                className="text-slate-500 hover:text-slate-700 text-2xl leading-none p-2 -m-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {reviewModal.loading ? (
                <div className="text-slate-500 text-sm">Loading...</div>
              ) : reviewModal.content !== null ? (
                <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                  {reviewModal.content}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search by file name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 placeholder:text-slate-400"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <span className="text-sm text-slate-500">
          {filteredBySearch.length} file(s){' '}
          {filterBy !== 'all' && (
            <span className="text-slate-400">
              ({filterBy === 'ai' ? 'AI only' : 'Non-AI'})
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm text-slate-500">Filter:</span>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as 'all' | 'ai' | 'original')}
              className="text-sm border border-slate-200 rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="ai">AI</option>
              <option value="original">Non-AI</option>
            </select>
          </div>
          <span className="text-sm text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date')}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            <option value="date">Date (newest)</option>
            <option value="name">Name</option>
          </select>
          <button
            onClick={fetchFiles}
            className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
      <ul className="divide-y divide-slate-200">
        {paginatedFiles.map((file) => {
          const displayName = file.name.replace(/^\d+-/, '');
          const isDeleting = deleting === file.path;
          const url = getPublicUrl(file.path);
          return (
            <li
              key={file.path}
              className="flex flex-col py-3 px-2 hover:bg-slate-50 rounded group"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-800 hover:text-slate-600 truncate block font-medium text-sm"
                  title={displayName}
                >
                  {displayName}
                </a>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                  {(file.is_ai_summary || /^\d+-summary_/.test(file.path)) && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] uppercase tracking-wide">
                      AI generate
                    </span>
                  )}
                  {file.created_at && (
                    <span>{new Date(file.created_at).toLocaleString()}</span>
                  )}
                  {file.size != null && (
                    <span>{formatSize(file.size)}</span>
                  )}
                  {file.summary_file_path && file.path !== file.summary_file_path && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSummaryFile(file.summary_file_path!)}
                      className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download summary
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-2 shrink-0">
                <button
                  onClick={() => handleSummarize(file.path, displayName)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-2 py-1 rounded border border-slate-700 inline-flex items-center gap-1"
                  title="AI summary"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  AI summary
                </button>
                <button
                  onClick={() => handleReview(file, displayName)}
                  className="text-slate-600 hover:text-slate-800 text-xs px-2 py-1 rounded border border-slate-200 hover:border-slate-300 inline-flex items-center gap-1"
                  title="Review"
                >
                  <span className="inline-flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-slate-600"
                      viewBox="0 0 1024 1024"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M512 224C281.6 224 128 384 96 512c32 128 185.6 288 416 288s384-160 416-288c-32-128-185.6-288-416-288zm0 448a160 160 0 1 1 0-320 160 160 0 0 1 0 320zm0-256a96 96 0 1 0 0 192 96 96 0 0 0 0-192z"
                      />
                    </svg>
                    <span>Review</span>
                  </span>
                </button>
                <button
                  onClick={() => handleCopyLink(file.path)}
                  className="text-slate-600 hover:text-slate-800 text-xs px-2 py-1 rounded border border-slate-200 hover:border-slate-300 inline-flex items-center gap-1"
                  title="Copy link"
                >
                  {copiedPath === file.path ? (
                    <>
                      <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Link
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(file.path, displayName)}
                  disabled={isDeleting}
                  className="text-slate-600 hover:text-red-700 text-xs px-2 py-1 rounded border border-slate-200 hover:border-red-200 disabled:opacity-50 inline-flex items-center gap-1"
                  title="Delete"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  {isDeleting ? '…' : 'Delete'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
          <span className="text-sm text-slate-500">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-1"
            >
              Next
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
