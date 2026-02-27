# Section 8: Database Integration with Supabase

**Requirements:**
- Integrate with Supabase Postgres to store document metadata and AI summaries
- Screenshots of data in Supabase Postgres Database

---

## Implementation

### 1. Database schema

Table `documents`:
- `id` (uuid, PK)
- `path` (text, unique) — Storage path
- `name` (text) — Original filename
- `size` (bigint) — File size in bytes
- `created_at` (timestamptz)
- `summary` (text, nullable) — AI-generated summary
- `updated_at` (timestamptz)

### 2. Migration

Run in **Supabase Dashboard → SQL Editor**:

```sql
-- See section8/migrations/001_create_documents.sql
```

### 3. Integration points

| Action | DB operation |
|--------|--------------|
| Upload | Insert/upsert document row |
| Summarize | Check cache first; if miss, call AI then upsert summary |
| Delete | Delete row when file removed from Storage |
| List | Enrich file list with `has_summary` from DB |

### 4. Cached summaries

If a document already has a summary in the DB, the Summarize API returns it without calling the AI (faster, no API cost).

---

**Steps with major screenshots:**
> [your steps and screenshots go here]
