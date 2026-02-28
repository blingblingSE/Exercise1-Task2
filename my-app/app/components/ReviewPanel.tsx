'use client';

import ReactMarkdown from 'react-markdown';

const BUCKET_NAME = 'Documents';

interface ReviewPanelProps {
  title: string;
  content: string | null;
  loading: boolean;
  onClose: () => void;
  filePath?: string;
  isAiSummary?: boolean;
}

export default function ReviewPanel({ title, content, loading, onClose, filePath, isAiSummary }: ReviewPanelProps) {
  const supabaseUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '';
  const publicUrl =
    supabaseUrl && filePath ? `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${filePath}` : '';
  const downloadSummaryUrl =
    filePath && isAiSummary ? `/api/documents/download-summary?path=${encodeURIComponent(filePath)}` : '';

  function handleDownload() {
    const url = isAiSummary ? downloadSummaryUrl : publicUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div
      className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/80 overflow-hidden flex-shrink-0 min-h-0"
      style={{ minHeight: '280px' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white flex-shrink-0">
        <span className="text-sm font-medium text-slate-800 truncate pr-2" title={title}>
          Review: {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 text-lg leading-none p-1 -m-1 cursor-pointer"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="p-3 overflow-y-auto flex-1 text-sm text-slate-700 min-h-[120px]">
        {loading && (
          <div className="text-slate-500">Loading...</div>
        )}
        {!loading && content !== null && content !== '' && (
          <div className="review-content prose-custom whitespace-pre-wrap">
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1.5 text-slate-800 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-slate-800">{children}</h3>,
                p: ({ children }) => <p className="mb-1.5">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-2 my-1 text-slate-600">{children}</blockquote>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {!loading && !content && publicUrl && (
          <div className="w-full rounded border border-slate-200 bg-white overflow-hidden" style={{ minHeight: '280px' }}>
            <iframe
              src={publicUrl}
              title={title}
              className="w-full border-0"
              style={{ height: '320px' }}
            />
          </div>
        )}
      </div>
      {(publicUrl || downloadSummaryUrl) && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-t border-slate-200 bg-white flex-shrink-0 text-xs">
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-800 underline"
            >
              Open in new tab
            </a>
          )}
          <button
            type="button"
            onClick={handleDownload}
            className="text-slate-600 hover:text-slate-800 underline cursor-pointer"
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
}
