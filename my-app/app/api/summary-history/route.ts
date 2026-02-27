import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json(
        { error: 'path is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('documents')
      .select('summary_history')
      .eq('path', path)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const history = (data?.summary_history as Array<{ summary: string; language: string; created_at: string }>) ?? [];
    return NextResponse.json({ history });
  } catch (err) {
    console.error('Summary history error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load history' },
      { status: 500 }
    );
  }
}
