# Create Families Group

Web app to manage families and build/schedule groups with private login.

## Features
- Magic-link login (Supabase Auth)
- Families database (last name, address, phone, dog/cat status)
- Group editor (title, professores, drivers, target kids, arrival/departure)
- Family allocation per group (boys/girls)
- Total kids and target comparison
- Saved groups list (open, duplicate, delete, PDF)
- Row-level privacy per logged-in user (RLS)
- Tablet-friendly UI + PWA install support

## Tech
- Vanilla HTML/CSS/JS
- Supabase (Auth + Postgres)
- Static hosting (Netlify/Vercel)

## Project Structure
- `login.html`, `login.js`: authentication screen
- `index.html`: families page
- `group-editor.html`: create/edit group
- `saved-groups.html`: saved groups view
- `app.js`: main app logic
- `supabaseClient.js`: Supabase SDK init
- `config.js`: generated locally/in CI from env vars (ignored by git)
- `scripts/generate-config.mjs`: writes `config.js` from `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `supabase-schema.sql`: DB schema + RLS policies
- `manifest.webmanifest`, `sw.js`, `icon.svg`: PWA assets
- `DEPLOY.md`: deployment checklist

## Local Run
```bash
cd "/Users/martascaramella/Code/create-groups-project"
python3 -m http.server 8080
```
Open: `http://localhost:8080/login.html`

## Supabase Setup
1. Create Supabase project.
2. Run `supabase-schema.sql` in SQL Editor.
3. Copy Project URL + anon public key from Project Settings > API.
4. Update `config.js`:
```js
export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```
5. In Auth URL settings, add local and production redirect URLs.

## Deploy
Use Netlify or Vercel as static hosting.
- Netlify config: `netlify.toml`
- Vercel config: `vercel.json`

See `DEPLOY.md` for exact steps.

## Security Notes
- Keep real keys out of git history.
- Revoke and rotate any token accidentally exposed.
- Use RLS policies (already included in schema).

## License
Private/internal use.

## Safe Config (No Secrets Committed)
1. Keep real values only in local env vars or Netlify env vars.
2. Generate local `config.js` for development:
```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" SUPABASE_ANON_KEY="YOUR_ANON_KEY" node scripts/generate-config.mjs
```
3. `config.js` is gitignored and should not be committed.
4. In Netlify, set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

