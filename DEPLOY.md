# Deploy Guide (Tablet + Login + Privacy)

## 1. Create Supabase project
1. Go to https://supabase.com and create a project.
2. Open SQL Editor and run [`supabase-schema.sql`](./supabase-schema.sql).
3. In Authentication -> Providers, keep Email enabled.
4. In Authentication -> URL Configuration:
   - Set Site URL to your deployed app URL.
   - Add redirect URLs:
     - `https://YOUR_DOMAIN/index.html`
     - `https://YOUR_DOMAIN/group-editor.html`
     - `https://YOUR_DOMAIN/saved-groups.html`

## 2. Configure app credentials
1. In Supabase -> Settings -> API, copy:
   - Project URL
   - anon public key
2. Edit [`config.js`](./config.js) and replace placeholders.

## 3. Deploy frontend

### Option A: Netlify
1. Push this folder to a Git repo.
2. Create a new Netlify site from that repo.
3. Build command: none
4. Publish directory: project root (`.`)

### Option B: Vercel
1. Push this folder to a Git repo.
2. Import project in Vercel.
3. Framework preset: Other
4. Build command: none
5. Output directory: `.`

## 4. Tablet setup
1. Open deployed URL on tablet.
2. Login via magic link email.
3. Add to Home Screen:
   - iPad/Safari: Share -> Add to Home Screen
   - Android/Chrome: menu -> Install app

## 5. Privacy model
- Every row is linked to `auth.uid()`.
- Row Level Security (RLS) is enabled.
- Users can only read/write their own data.

## 6. Local run
Use a static server in this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/login.html`.
