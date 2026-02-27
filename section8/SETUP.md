# Section 8 启动步骤

## 1. 在 Supabase 创建 documents 表（必须）

1. 打开 https://supabase.com/dashboard/project/pysmqyekdngvusqijxge
2. 左侧 **SQL Editor** → **New query**
3. 复制 `section8/migrations/001_create_documents.sql` 的全部内容
4. 粘贴到编辑器，点击 **Run**
5. 看到 **Success. No rows returned** 表示成功（DDL 不返回行是正常的）

## 2. 配置 .env.local（必须）

确保 `my-app/.env.local` 包含：

```
NEXT_PUBLIC_SUPABASE_URL=https://pysmqyekdngvusqijxge.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
OPENAI_API_KEY=你的DeepSeek_key
OPENAI_BASE_URL=https://api.deepseek.com/v1
```

## 3. 启动本地开发

```bash
cd my-app
npm install   # 首次需要
npm run dev
```

4. 打开 http://localhost:3000 测试

---

**如果表未创建**：应用仍可运行（上传、摘要、删除），但摘要不会缓存到 DB，列表的 `has_summary` 会一直是 false。
