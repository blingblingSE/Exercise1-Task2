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

    const files = (data ?? [])
      .filter((item) => item.name && !item.name.startsWith('.'))
      .map((item) => ({
        name: item.name,
        path: item.name,
        created_at: item.created_at,
        metadata: item.metadata,
        size: item.metadata?.size ?? null,
      }));

    return NextResponse.json({ files });
  } catch (err) {
    console.error('List error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'List failed' },
      { status: 500 }
    );
  }
}
