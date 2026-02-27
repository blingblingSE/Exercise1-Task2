import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, BUCKET_NAME } from '@/app/lib/supabase';

/**
 * Download the summary file from Storage with Content-Disposition: attachment
 * so the browser downloads instead of opening in a new tab.
 */
export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('path');
    if (!path?.trim()) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path.trim());

    if (error || !data) {
      console.error('Download summary error:', error);
      return NextResponse.json(
        { error: error?.message ?? 'File not found' },
        { status: 404 }
      );
    }

    const filename = path.replace(/^.*\//, '').replace(/^\d+-/, '') || 'summary.txt';
    const safeName = filename.replace(/[^\w.\-]/g, '_') || 'summary.txt';

    return new NextResponse(data, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error('Download summary error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 }
    );
  }
}
