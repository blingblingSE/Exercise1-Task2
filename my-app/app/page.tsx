'use client';

import { useState, useCallback } from 'react';
import FileUploader from './components/FileUploader';
import FileList from './components/FileList';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Document Upload and File Management System
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Section 6 · Supabase Object Store · Section 7 · AI Summary
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            Upload Documents
          </h2>
          <FileUploader onUploadSuccess={handleUploadSuccess} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            My Files
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <FileList key={refreshKey} />
          </div>
        </section>
      </main>
    </div>
  );
}
