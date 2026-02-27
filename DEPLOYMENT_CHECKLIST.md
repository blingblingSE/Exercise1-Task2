# Local Testing & Vercel Deployment Checklist

## Part 1: Local Development Environment Testing

### 1.1 Start the app
```bash
cd my-app
npm install   # if needed
npm run dev
```
Open http://localhost:3000

### 1.2 Test Section 6 (Supabase Object Store)
- [ ] **Upload** – Upload a .txt, .pdf, or .docx file
- [ ] **List** – Files appear in the list
- [ ] **Sort** – Toggle sort by name / date
- [ ] **Download** – Download button works
- [ ] **Copy link** – Copy link works
- [ ] **Delete** – Delete button works

### 1.3 Test Section 7 (AI Summary)
- [ ] **Summarize .txt** – Click Summarize on a .txt file, see summary
- [ ] **Summarize .pdf** – Test PDF summary
- [ ] **Summarize .docx** – Test Word document summary
- [ ] **Loading state** – "Generating summary..." shows while waiting
- [ ] **Close modal** – × button and Esc key close the modal
- [ ] **Unsupported file** – .jpg or other type shows appropriate error

### 1.4 Test responsive design
- [ ] Resize browser to mobile width – layout adapts
- [ ] Buttons wrap on small screens

### 1.5 Verify build
```bash
cd my-app
npm run build
```
- [ ] Build completes without errors

---

## Part 2: Deploy to Vercel

### 2.1 Push to GitHub
```bash
git add .
git commit -m "Section 6 & 7 complete"
git push origin main
```

### 2.2 Create Vercel project
1. Go to https://vercel.com → Sign in with GitHub
2. **Add New** → **Project**
3. Import your repository
4. **Root Directory**: set to `my-app` (important!)
5. Click **Deploy** (first deploy may fail without env vars – that's ok)

### 2.3 Add environment variables
**Settings** → **Environment Variables** → Add:

| Name | Value | Notes |
|------|-------|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL | |
| `OPENAI_API_KEY` | Your DeepSeek/OpenAI key | |
| `OPENAI_BASE_URL` | `https://api.deepseek.com/v1` | If using DeepSeek |

### 2.4 Redeploy
**Deployments** → ⋯ on latest → **Redeploy**

---

## Part 3: Verify Deployed Environment

### 3.1 Test on Vercel URL (e.g. https://xxx.vercel.app)
- [ ] **Upload** works
- [ ] **List / Sort / Download / Copy / Delete** work
- [ ] **AI Summary** works (may take 5–10 seconds)
- [ ] **Responsive** on mobile view

### 3.2 If something fails
- Check Vercel **Functions** logs for API errors
- Confirm all env vars are set and correct
- Ensure Root Directory is `my-app`
