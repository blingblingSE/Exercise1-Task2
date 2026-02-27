-- Summary history (keep last 10 per document)
alter table public.documents
  add column if not exists summary_history jsonb default '[]'::jsonb;
