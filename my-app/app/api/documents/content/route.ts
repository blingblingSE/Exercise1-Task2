import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, BUCKET_NAME } from '@/app/lib/supabase';

const SUPPORTED_TEXT = ['.txt', '.md'];
const SUPPORTED_PDF = ['.pdf'];
const SUPPORTED_DOCX = ['.docx', '.doc'];

async function extractText(
  _path: string,
  buffer: Buffer,
  ext: string
): Promise<string> {
  const lower = ext.toLowerCase();
  if (SUPPORTED_TEXT.includes(lower)) return buffer.toString('utf-8');
  if (SUPPORTED_PDF.includes(lower)) {
    const { extractText: extFn, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extFn(pdf, { mergePages: true });
    return text || '';
  }
  if (SUPPORTED_DOCX.includes(lower)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  throw new Error(`Preview not available for this file type (${ext}).`);
}

/**
 * GET /api/documents/content?path=... — returns extracted text for display in Review panel.
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
      return NextResponse.json(
        { error: error?.message ?? 'File not found' },
        { status: 404 }
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '.txt';

    const content = await extractText(path, buffer, ext);
    return NextResponse.json({ content: content || '(Empty file)' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load content';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
