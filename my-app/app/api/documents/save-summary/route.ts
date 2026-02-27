import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, BUCKET_NAME } from '@/app/lib/supabase';

/**
 * Save the stored summary as a separate file in Storage and link it to the document (RAG-style association).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { filePath?: string; fileName?: string; summary?: string };
    const { filePath, fileName: customName, summary: summaryFromBody } = body;
    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Use summary from request body (current modal content) so Save works for 中文/粤语 too.
    // Otherwise read from DB (English cache).
    let summaryText: string | null = summaryFromBody?.trim() || null;
    if (!summaryText) {
      const { data: row, error: fetchErr } = await supabase
        .from('documents')
        .select('summary')
        .eq('path', filePath)
        .maybeSingle();
      if (fetchErr) {
        return NextResponse.json(
          { error: 'Could not load document. Try again.' },
          { status: 500 }
        );
      }
      summaryText = row?.summary?.trim() || null;
    }
    if (!summaryText) {
      return NextResponse.json(
        { error: 'No summary to save. Generate a summary first.' },
        { status: 400 }
      );
    }

    const baseName = filePath.replace(/^\d+-/, '').replace(/\.[^.]+$/, '') || 'document';
    const safeBase = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const timestamp = Date.now();
    let summaryFileName: string;
    if (customName?.trim()) {
      const base = customName.trim().replace(/\.txt$/i, '');
      summaryFileName = `${timestamp}-${base.replace(/[^a-zA-Z0-9.\-_]/g, '_')}.txt`;
    } else {
      summaryFileName = `${timestamp}-summary_${safeBase}.txt`;
    }

    const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const textBuffer = Buffer.from(summaryText, 'utf-8');
    const buffer = Buffer.concat([utf8Bom, textBuffer]);

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(summaryFileName, buffer, {
        contentType: 'text/plain; charset=utf-8',
        upsert: false,
      });

    if (uploadErr) {
      console.error('Save summary upload error:', uploadErr);
      return NextResponse.json(
        { error: uploadErr.message },
        { status: 500 }
      );
    }

    const { error: updateErr } = await supabase
      .from('documents')
      .update({
        summary_file_path: uploadData.path,
        updated_at: new Date().toISOString(),
      })
      .eq('path', filePath);

    if (updateErr) console.warn('DB update warning:', updateErr.message);

    return NextResponse.json({
      summaryFilePath: uploadData.path,
      summaryFileName: summaryFileName.replace(/^\d+-/, ''),
      alreadySaved: false,
    });
  } catch (err) {
    console.error('Save summary error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save summary as file' },
      { status: 500 }
    );
  }
}
