# Chapai Digital Land Surveyor — Live Deployment (GitHub + Vercel + Neon)

This folder is a ready-to-deploy version of the site: a static `index.html`
frontend plus a set of Vercel Serverless Functions under `/api` that talk to
your Neon Postgres database. No framework (Next.js etc.) is required —
Vercel serves `index.html` as-is and runs everything in `/api` as functions.

## ⚠️ Important — rotate your database password first

You shared your Neon connection string (including the password) in our
chat. That's fine for me to use *once* to help you configure things, but:

1. **Reset the password** in the Neon console (Project → your database →
   *Reset password*) once you're done here, since it's now been typed into
   a chat log.
2. **Never** put the connection string in code, in this repo, or commit it
   to GitHub. It only ever goes into Vercel's *Environment Variables*
   (step 3 below) and your own local `.env.local` (which is git-ignored).

## 1. Create the database schema

In the Neon console, open the **SQL Editor** for your `neondb` database and
run the contents of `schema.sql` (or from a terminal:
`psql "$DATABASE_URL" -f schema.sql`). This creates the tables and seeds:

- The two starting admin accounts (phone/password as already set on the
  site — **change these passwords** once you're live, via the admin panel
  concept described below or directly in the `admin_accounts` table).
- Default service fees.
- A unique constraint that blocks two active bookings on the same date +
  time slot — this is what makes the "no double booking" rule airtight even
  under concurrent requests, not just a client-side check.

## 2. Push this folder to GitHub

```bash
cd chapai-surveyor
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/` and any `.env*` file, so your
database URL will never end up in the repo.

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import
   the GitHub repo you just pushed.
2. Framework preset: choose **Other** (no build step needed).
3. Before deploying, open **Environment Variables** and add:
   - `DATABASE_URL` = your Neon connection string
     (`postgresql://neondb_owner:...@ep-morning-dust-....neon.tech/neondb?sslmode=require`)
   - `ANTHROPIC_API_KEY` = your own Anthropic API key (see "AI assistant
     setup" below) — the site's "ভূমিসুন্দর AI" chat will show a friendly
     error instead of crashing if this is left unset, but won't answer.
4. Click **Deploy**. Vercel will install `@neondatabase/serverless` from
   `package.json` and deploy `/api/*` as serverless functions automatically.

That's it — your live URL will serve the site, and every booking, review,
fee change, and admin action will read/write to your real Postgres
database instead of a browser-only preview.

## AI assistant setup

The "ভূমিসুন্দর AI" chat box on the site calls `/api/ai-assistant`, a
serverless function that forwards the request to Anthropic's API using an
API key you provide — the key is only ever read server-side
(`process.env.ANTHROPIC_API_KEY`) and never sent to the browser.

1. Get a key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   (this requires an Anthropic API account with billing set up — separate
   from a claude.ai subscription).
2. Add it as `ANTHROPIC_API_KEY` in Vercel's Environment Variables (or in
   `.env.local` for local testing).

Until this is set, the chat box will show a clear "not configured yet"
message instead of failing silently.

## No-double-booking rule — how it works

- **Server-side check**: `POST /api/bookings` first looks for any existing
  non-cancelled booking on the same `date` + `slot`. If one exists, it
  rejects the request with a clear Bengali error message instead of saving.
- **Database-level guarantee**: `schema.sql` also creates a
  `UNIQUE INDEX` on `(date, slot)` for non-cancelled bookings. Even if two
  people submit at the exact same instant (a race condition the
  application-level check alone can't fully prevent), the database itself
  will reject the second insert — so it's genuinely impossible to end up
  with two active bookings in the same slot.
- **Frontend UX**: on the public booking form, picking a date now checks
  `/api/bookings?date=...` and greys out any time slot that's already
  taken, so customers see the conflict before they even try to submit.
- Cancelling a booking frees its slot back up immediately.

## Security notes (please read before real launch)

This mirrors the original prototype's simple trust model, which is fine to
get live quickly but should be hardened before handling real customer data
at scale:

- **Admin passwords are stored in plain text** in `admin_accounts`. Before
  a real launch, switch to hashed passwords (e.g. bcrypt) and proper
  session tokens (e.g. signed JWT cookies) instead of passing a phone
  number as a bearer of authority on each request.
- **CORS is wide open** (`Access-Control-Allow-Origin: *`) on every API
  route for easy testing. Once your domain is final, restrict this to your
  actual domain.
- **File attachments** are stored as base64 in Postgres (`booking_files`
  table), capped at ~3MB per file client-side. This is fine for scanned
  documents/photos but not a substitute for real large-file/object storage
  (e.g. S3, Vercel Blob) if you expect many large uploads.

## Local development (optional)

**Important**: opening `index.html` directly by double-clicking it (a
`file://` URL) will NOT work — bookings, admin login, the AI assistant, and
everything else that calls `/api/...` will silently fail, because there's
no server there to handle those paths. This is almost certainly why booking
entries, "add admin", etc. weren't showing anything when tested this way.

To actually run it locally with working APIs:

```bash
npm install -g vercel
cd chapai-surveyor
vercel login          # first time only
cp .env.example .env.local   # then fill in DATABASE_URL and ANTHROPIC_API_KEY
vercel dev
```

`vercel dev` starts a local server (usually `http://localhost:3000`) that
runs the `/api` functions exactly like production and serves `index.html`
from the same origin — open that URL, not the file itself.

Once deployed to Vercel with `DATABASE_URL` (and `ANTHROPIC_API_KEY`) set
as real Environment Variables, everything — booking creation, the admin
panel showing entries, adding new admins, fees, media, and the AI
assistant — works the same way, no code changes needed.
