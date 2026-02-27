import { NextResponse } from 'next/server';
import { createSupabaseAdmin, BUCKET_NAME } from '@/app/lib/supabase';

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('Supabase list error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const storageFiles = (data ?? [])
      .filter((item) => item.name && !item.name.startsWith('.'))
      .map((item) => ({
        name: item.name,
        path: item.name,
        created_at: item.created_at,
        metadata: item.metadata,
        size: item.metadata?.size ?? null,
      }));

    // Section 8: enrich with DB data (skip if table not created yet)
    let dbMap = new Map<string, { path: string; summary: string | null; summary_file_path: string | null }>();
    const summaryFilePaths = new Set<string>();
    if (storageFiles.length > 0) {
      const paths = storageFiles.map((f) => f.path);
      const { data: dbRows, error: dbErr } = await supabase
        .from('documents')
        .select('path, summary, summary_file_path')
        .in('path', paths);
      if (!dbErr && dbRows) {
        dbMap = new Map(dbRows.map((r) => [r.path, r]));
        dbRows.forEach((r) => {
          if (r.summary_file_path) summaryFilePaths.add(r.summary_file_path);
        });
      }
    }
    const files = storageFiles.map((f) => {
      const doc = dbMap.get(f.path);
      const isAiSummary = summaryFilePaths.has(f.path);
      return {
        ...f,
        has_summary: !!doc?.summary,
        summary_file_path: doc?.summary_file_path ?? null,
        is_ai_summary: isAiSummary,
      };
    });

    return NextResponse.json({ files });
  } catch (err) {
    console.error('List error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'List failed' },
      { status: 500 }
    );
  }
}
