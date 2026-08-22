# Chapai Digital Land Surveyor — Live Deployment (GitHub + Vercel + Postgres)

A static `index.html` frontend plus Vercel Serverless Functions under `/api`
that talk to a Postgres database. No framework required — Vercel serves
`index.html` as-is and runs everything in `/api` as functions.

## 🩺 Something not working? Start here.

Open **`https://<your-site>.vercel.app/api/health`** in your browser (just
visit the URL — no login needed). It checks, in order: is `DATABASE_URL`
set → does it connect → do the tables exist → are the admin accounts
seeded — and tells you in plain Bengali exactly which step is failing and
how to fix it. This is far faster than reading Vercel's Function logs.

If it says everything is ✅ but the site still shows errors, copy the
whole JSON response and share it — that pinpoints the real problem
immediately instead of guessing from a generic "500" in the browser
console.

## 🚨 If you're on Supabase and getting "server problem" on every request

**This is almost certainly the fix.** Supabase's *direct* connection string
(`db.<project-ref>.supabase.co:5432`) only accepts IPv6 connections — and
Vercel's serverless functions cannot make outbound IPv6 connections at all.
Every single database call fails, which is exactly the "সার্ভার সমস্যা" /
booking-not-found symptoms this causes.

**Fix (no code changes needed):**

1. Open your Supabase project → click **Connect** (top of the page).
2. Choose the **Session pooler** tab (not "Direct connection", not
   "Transaction pooler").
3. Copy that connection string — it looks like:
   ```
   postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual database password (not the
   literal text `[YOUR-PASSWORD]` — that's a placeholder Supabase leaves in
   the copyable string for you to fill in).
5. Paste this as `DATABASE_URL` in Vercel → Settings → Environment
   Variables, make sure **Production** is checked, Save.
6. **Redeploy** (Deployments → ⋯ → Redeploy) — env var changes never apply
   to an already-running deployment.

The Session pooler is IPv4-compatible and behaves like a normal Postgres
connection, so no code changes are needed — just the connection string.

**Works with either Neon or Supabase** (or any standard Postgres) — the
database client uses the plain `pg` driver over a normal connection string,
not a provider-specific one. **Pick one provider and use its `DATABASE_URL`
— don't mix both**, that just adds confusion about which database actually
has your data.

## ⚠️ Rotate any credentials you've pasted into chat

If you ever share a real database URL or API key in a conversation, treat
it as compromised: reset/rotate it afterwards (Neon: Project → Database →
Reset password; Supabase: Project Settings → Database → Reset password).
Never commit real credentials to Git — `.gitignore` already excludes
`.env*` files.

## 1. Create the database schema

Run `schema.sql` once against your database:
- **Neon**: SQL Editor in the Neon console, or `psql "$DATABASE_URL" -f schema.sql`
- **Supabase**: SQL Editor in the Supabase dashboard, or the same `psql` command

This creates all tables and seeds the two starting admin accounts, default
service fees, and — importantly — a **unique index on `(date, slot)`** for
non-cancelled bookings, which is what makes "no double booking" airtight
even under concurrent requests.

## 2. Push to GitHub

```bash
cd chapai-surveyor
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 3. Deploy on Vercel

1. **Add New Project** → import the repo. Framework preset: **Other**.
2. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon or Supabase connection string
   - `GEMINI_API_KEY` — your Gemini API key (see below); the AI chat box
     shows a friendly "not configured" message instead of crashing if this
     is left unset
3. **Deploy**.

## Troubleshooting: "server error" on admin login / booking search not finding results

This almost always means one of:

1. **`schema.sql` hasn't been run yet** on the database `DATABASE_URL`
   points to — the tables (`admin_accounts`, `bookings`, etc.) don't exist,
   so every query throws and the API returns a generic "সার্ভার সমস্যা"
   error. Run it (step 1) against the *exact* database your `DATABASE_URL`
   points to.
2. **`DATABASE_URL` in Vercel doesn't match where you ran `schema.sql`** —
   e.g. you ran the schema on Supabase but `DATABASE_URL` in Vercel still
   points to Neon (or vice versa). Whichever provider you're using, make
   sure both point to the *same* database.
3. **You changed an environment variable but didn't redeploy** — Vercel
   only picks up new/changed env vars on the next deployment. After editing
   one, go to Deployments → ⋯ → **Redeploy**.
4. **Opening `index.html` directly** (double-clicking the file, a `file://`
   URL) instead of visiting your real Vercel URL or running `vercel dev` —
   `/api/...` calls silently fail with no server behind them locally.

If it's still unclear, check **Vercel → your project → Deployments → (latest) →
Functions** — click into a failed function call to see the actual server
error, which is far more specific than the generic message shown on-site.

## AI assistant setup (Gemini)

The "ভূমিসুন্দর AI" chat box calls `/api/ai-assistant`, a serverless
function that forwards the request to Google's Gemini API using a key you
provide — the key is only ever read server-side
(`process.env.GEMINI_API_KEY`) and never sent to the browser.

1. Get a key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Add it as `GEMINI_API_KEY` in Vercel's Environment Variables (or
   `.env.local` for local testing).

## No-double-booking rule — how it works

- **Server-side check**: `POST /api/bookings` first looks for any existing
  non-cancelled booking on the same `date` + `slot`. If one exists, it
  rejects the request with a clear Bengali error message instead of saving.
- **Database-level guarantee**: `schema.sql` creates a `UNIQUE INDEX` on
  `(date, slot)` for non-cancelled bookings, so even simultaneous
  submissions can't both succeed — the database itself rejects the second
  insert.
- **Frontend UX**: picking a date on the public booking form checks
  `/api/bookings?date=...` and greys out already-taken time slots before
  the customer even tries to submit.
- Cancelling a booking frees its slot back up immediately.

## Security notes (please read before real launch)

- **Admin passwords are stored in plain text** in `admin_accounts`. Before
  a real launch, switch to hashed passwords (bcrypt) and real session
  tokens instead of passing a phone number as a bearer of authority.
- **CORS is wide open** (`Access-Control-Allow-Origin: *`) for easy
  testing. Restrict this to your actual domain once it's final.
- **File attachments** are stored as base64 in Postgres (`booking_files`
  table), capped at ~3MB per file client-side — fine for scanned documents/
  photos, not a substitute for real object storage (S3, Vercel Blob) for
  many large uploads.

## Local development (optional)

**Important**: opening `index.html` directly by double-clicking it will NOT
work — everything that calls `/api/...` fails silently with no server
behind it.

```bash
npm install -g vercel
cd chapai-surveyor
vercel login          # first time only
cp .env.example .env.local   # fill in DATABASE_URL and GEMINI_API_KEY
vercel dev
```

`vercel dev` runs `/api` functions locally and serves `index.html` from the
same origin — open the URL it prints (usually `http://localhost:3000`),
not the file itself.
