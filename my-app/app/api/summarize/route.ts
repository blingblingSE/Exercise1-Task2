import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, BUCKET_NAME } from '@/app/lib/supabase';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const SUPPORTED_TEXT = ['.txt', '.md'];
const SUPPORTED_PDF = ['.pdf'];
const SUPPORTED_DOCX = ['.docx', '.doc'];

async function extractText(
  _path: string,
  buffer: Buffer,
  ext: string
): Promise<string> {
  const lower = ext.toLowerCase();

  if (SUPPORTED_TEXT.includes(lower)) {
    return buffer.toString('utf-8');
  }

  if (SUPPORTED_PDF.includes(lower)) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text || '';
  }

  if (SUPPORTED_DOCX.includes(lower)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  throw new Error(`Unsupported file type for summary: ${ext}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { filePath?: string; language?: string };
    const { filePath, language = 'en' } = body;
    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Section 8: return cached summary only when the *last* summary was English.
    // zh/yue should always regenerate or use their own latest run.
    const useCache = language === 'en' || !language;
    if (useCache) {
      const { data: cached, error: cacheErr } = await supabase
        .from('documents')
        .select('summary, summary_history')
        .eq('path', filePath)
        .maybeSingle();

      if (!cacheErr && cached?.summary?.trim()) {
        const history =
          ((cached as any).summary_history as Array<{
            summary: string;
            language: string;
            created_at: string;
          }>) ?? [];
        const last = history[0];
        // Only reuse cache if the latest summary was generated in English.
        if (!last || last.language === 'English') {
          return NextResponse.json({ summary: cached.summary, cached: true });
        }
      }
    }

    const langInstruction =
      language === 'zh'
        ? 'You MUST provide the summary in Mandarin Chinese (普通话/中文). Use simplified Chinese characters only. Do NOT use English.'
        : language === 'yue'
          ? 'You MUST provide the summary in Cantonese (粤语/广东话). Use traditional Chinese characters and Cantonese vocabulary (e.g. 嘅、係、唔、咁、呢度). Do NOT use Mandarin or English.'
          : 'Provide the summary in English.';

    const apiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && !geminiKey) {
      return NextResponse.json(
        { error: 'Add GEMINI_API_KEY or OPENAI_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'File not found' },
        { status: 404 }
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')) : '.txt';

    const text = await extractText(filePath, buffer, ext);

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'No text content could be extracted from this file.' },
        { status: 400 }
      );
    }

    const truncated = text.length > 2500 ? text.slice(0, 2500) + '...' : text;

    let summary: string;

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { maxOutputTokens: 1000 },
      });
      const prompt = `You are a helpful assistant that summarizes documents concisely. ${langInstruction} Use plain text only—no markdown, no ** or other formatting symbols.

Document to summarize:

${truncated}`;
      const result = await model.generateContent(prompt);
      const response = result.response;
      try {
        summary = response.text()?.trim() || 'No summary generated.';
      } catch (textErr) {
        const candidates = response.candidates;
        const blocked = candidates?.[0]?.finishReason;
        throw new Error(
          `Gemini blocked response${blocked ? `: ${blocked}` : ''}. Try a different document.`
        );
      }
    } else {
      const baseURL = process.env.OPENAI_BASE_URL;
      const openai = new OpenAI({
        apiKey,
        ...(baseURL && { baseURL }),
        timeout: 120_000,
      });
      const model =
        baseURL?.includes('deepseek') ? 'deepseek-chat' : 'gpt-4o-mini';
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              `You are a helpful assistant that summarizes documents concisely. ${langInstruction} Use plain text only—no markdown, no ** or other formatting symbols.`,
          },
          {
            role: 'user',
            content: `Summarize the following document:\n\n${truncated}`,
          },
        ],
        max_tokens: 1000,
      });
      summary =
        completion.choices[0]?.message?.content?.trim() || 'No summary generated.';
    }

    // Section 8: persist summary + append to history (last 10)
    const now = new Date().toISOString();
    const langLabel = language === 'zh' ? '中文' : language === 'yue' ? '粤语' : 'English';
    const { data: existing } = await supabase
      .from('documents')
      .select('summary_history')
      .eq('path', filePath)
      .maybeSingle();
    const prevHistory = (existing?.summary_history as Array<{ summary: string; language: string; created_at: string }> | null) ?? [];
    const newEntry = { summary, language: langLabel, created_at: now };
    const summaryHistory = [newEntry, ...prevHistory].slice(0, 10);

    const upsertData: Record<string, unknown> = {
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      updated_at: now,
    };
    // Only cache the latest English summary in the summary column.
    if (language === 'en' || !language) {
      (upsertData as any).summary = summary;
    }

    const { error: dbError } = await supabase.from('documents').upsert(upsertData, {
      onConflict: 'path',
    });
    if (dbError) console.warn('DB summary save warning:', dbError.message);

    const { error: histErr } = await supabase
      .from('documents')
      .update({ summary_history: summaryHistory, updated_at: now })
      .eq('path', filePath);
    if (histErr) console.warn('DB summary_history update warning:', histErr.message);

    return NextResponse.json({ summary });
  } catch (err) {
    const e = err as Record<string, unknown>;
    const apiMsg =
      (e?.error as { message?: string })?.message ??
      (e?.message as string) ??
      (err instanceof Error ? err.message : 'Failed to generate summary');
    console.error('Summarize error:', err instanceof Error ? err.message : String(err));
    let hint = '';
    if (String(apiMsg).includes('invalid_request') || (e?.code as string) === 'invalid_request_error') {
      hint =
        ' Check: 1) DeepSeek balance at platform.deepseek.com 2) API key valid 3) Account activated.';
    } else if (String(apiMsg).includes('timed out') || String(apiMsg).includes('timeout')) {
      hint = ' Try DeepSeek: OPENAI_BASE_URL=https://api.deepseek.com/v1';
    }
    return NextResponse.json(
      { error: apiMsg + hint },
      { status: 500 }
    );
  }
}
