'use client';

import { useState, useEffect } from 'react';
import SummaryModal from './SummaryModal';

interface FileItem {
  name: string;
  path: string;
  created_at: string;
  size?: number | null;
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

  async function handleSummarize(path: string, displayName: string) {
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
    setSummaryModal({ open: true, title: displayName, path });
    setSummary(null);
    setSummaryError(null);
    if (!SUMMARIZABLE_EXT.includes(ext)) {
      setSummaryError(`Summary not supported for ${ext || 'this file type'}. Use .txt, .md, .pdf, .doc, .docx`);
      return;
    }
    setSummaryLoading(true);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path }),
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

  const sortedFiles = [...files].sort((a, b) => {
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
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <span className="text-sm text-slate-500">{files.length} file(s)</span>
        <div className="flex items-center gap-2">
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
            className="text-sm text-blue-600 hover:underline"
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
                <span className="text-xl">📄</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline truncate block font-medium"
                  >
                    {displayName}
                  </a>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    {file.created_at && (
                      <span>{new Date(file.created_at).toLocaleString()}</span>
                    )}
                    {file.size != null && (
                      <span>{formatSize(file.size)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => handleSummarize(file.path, displayName)}
                  className="text-emerald-600 hover:text-emerald-800 text-sm px-2 py-1 rounded hover:bg-emerald-50"
                  title="AI Summary"
                >
                  ✨ Summarize
                </button>
                <button
                  onClick={() => handleDownload(file.path, displayName)}
                  className="text-slate-600 hover:text-slate-800 text-sm px-2 py-1 rounded hover:bg-slate-100"
                  title="Download"
                >
                  ⬇
                </button>
                <button
                  onClick={() => handleCopyLink(file.path)}
                  className="text-slate-600 hover:text-slate-800 text-sm px-2 py-1 rounded hover:bg-slate-100"
                  title="Copy link"
                >
                  {copiedPath === file.path ? '✓' : '🔗'}
                </button>
                <button
                  onClick={() => handleDelete(file.path)}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                  title="Delete"
                >
                  {isDeleting ? '...' : '🗑'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
