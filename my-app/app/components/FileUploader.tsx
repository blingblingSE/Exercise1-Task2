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
    <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id="file-upload"
        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
      />
      <label
        htmlFor="file-upload"
        className={`cursor-pointer block ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <span className="text-slate-600 font-medium">
          {uploading ? 'Uploading…' : 'Choose file or drag here'}
        </span>
        <span className="text-slate-400 text-sm block mt-1">
          PDF, DOC, TXT, MD
        </span>
      </label>
      {error && (
        <p className="mt-3 text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
}
