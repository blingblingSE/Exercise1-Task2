import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, BUCKET_NAME } from '@/app/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const safeBaseName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Reject if a file with the same name already exists
    const { data: existingList } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1000 });
    const existingNames = (existingList ?? [])
      .filter((item) => item.name && !item.name.startsWith('.'))
      .map((item) => item.name.replace(/^\d+-/, ''));
    if (existingNames.includes(safeBaseName)) {
      return NextResponse.json(
        { error: 'A file with this name has already been uploaded.' },
        { status: 409 }
      );
    }

    const timestamp = Date.now();
    const safeName = `${timestamp}-${safeBaseName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(safeName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Section 8: persist document metadata to Postgres
    const { error: dbError } = await supabase.from('documents').upsert(
      {
        path: data.path,
        name: file.name,
        size: file.size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'path' }
    );
    if (dbError) console.warn('DB insert warning:', dbError.message);

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return NextResponse.json({
      path: data.path,
      url: urlData.publicUrl,
      name: file.name,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
