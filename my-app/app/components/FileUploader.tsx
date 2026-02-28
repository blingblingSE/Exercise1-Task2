'use client';

import { useState, useRef } from 'react';

interface FileUploaderProps {
  onUploadSuccess: () => void;
}

export default function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadSuccess();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <label
      htmlFor="file-upload"
      className={`block border border-dashed border-slate-300 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-2 hover:border-slate-400 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id="file-upload"
        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
      />
      <span className={`text-sm ${uploading ? 'text-slate-500' : 'text-slate-600 font-medium'}`}>
        {uploading ? 'Uploading…' : 'Choose file'}
      </span>
      <span className="text-slate-400 text-xs">PDF, DOC, TXT, MD</span>
      {error && (
        <span className="text-red-600 text-xs">{error}</span>
      )}
    </label>
  );
}
