-- Optional: link document to its saved summary file (RAG-style association)
alter table public.documents
  add column if not exists summary_file_path text;
