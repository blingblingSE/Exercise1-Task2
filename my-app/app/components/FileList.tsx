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
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
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

  async function handleDelete(path: string) {
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

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <span className="text-sm text-slate-500">
          {filteredFiles.length} file(s){' '}
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
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Refresh
          </button>
        </div>
      </div>
      <ul className="divide-y divide-slate-200">
        {sortedFiles.map((file) => {
          const displayName = file.name.replace(/^\d+-/, '');
          const isDeleting = deleting === file.path;
          const url = getPublicUrl(file.path);
          return (
            <li
              key={file.path}
              className="flex items-center justify-between py-3 px-2 hover:bg-slate-50 rounded group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0 flex-1 relative group/name">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-800 hover:text-slate-600 truncate block font-medium"
                    title={displayName}
                  >
                    {displayName}
                  </a>
                  <div
                    className="invisible group-hover/name:visible absolute left-0 bottom-full mb-1 px-2 py-1.5 text-xs font-normal text-slate-200 bg-slate-800 rounded shadow-lg z-10 break-words"
                    style={{ width: 'max-content', maxWidth: 'min(320px, 90vw)' }}
                  >
                    {displayName}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap items-center">
                    {file.is_ai_summary && (
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
                        className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                      >
                        Download summary
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => handleSummarize(file.path, displayName)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-3 py-1.5 rounded border border-slate-700"
                  title="Summarize"
                >
                  Summarize
                </button>
                <button
                  onClick={() => handleDownload(file.path, displayName)}
                  className="text-slate-600 hover:text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 hover:border-slate-300"
                  title="Download"
                >
                  Download
                </button>
                <button
                  onClick={() => handleCopyLink(file.path)}
                  className="text-slate-600 hover:text-slate-800 text-sm px-2 py-1 rounded border border-slate-200 hover:border-slate-300"
                  title="Copy link"
                >
                  {copiedPath === file.path ? 'Copied' : 'Link'}
                </button>
                <button
                  onClick={() => handleDelete(file.path)}
                  disabled={isDeleting}
                  className="text-slate-600 hover:text-red-700 text-sm px-2 py-1 rounded border border-slate-200 hover:border-red-200 disabled:opacity-50"
                  title="Delete"
                >
                  {isDeleting ? '…' : 'Delete'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
