# Chapai Digital Land Surveyor — No-Database (Browser Storage) Version

This is a **100% static site** — a single `index.html` file, no backend,
no database, no build step. Every piece of data — bookings, reviews,
promo codes, admin accounts, service fees, uploaded photos, and messages —
lives in the visitor's own browser via `localStorage`.

## 🚨 Please read this before using it for real customers

Because everything is stored **per-browser, on each visitor's own device**:

- A **customer who books (or messages) on their phone** — that data exists
  only in *their* phone's browser storage.
- The **admin, logged in on a different computer**, will **not see it** —
  their browser has its own, completely separate storage.

**This only really works if the same person/browser does everything** —
local testing, a personal demo, or a single-device kiosk. It is **not** a
working multi-user system for a real public business where customers book
from their own phones and an admin manages things from their own computer.
For that, you need a shared database — see the sibling `chapai-surveyor`
project (Postgres + Vercel) we built earlier for that purpose.

## The "Message the Admin" feature — how it actually works

Since a true in-website chat inbox needs the same cross-device data
sharing that bookings do (impossible with localStorage alone), this
feature works in two layers:

1. **WhatsApp (reliable, works across all devices)** — submitting the
   message form immediately opens WhatsApp with the message pre-filled to
   the surveyor's number (+880 1321-554340). This is the channel that
   actually gets the message to the admin no matter what device they're on.
2. **Local admin inbox (same-device only)** — a copy is also saved to this
   browser's storage and appears in the admin panel's "বার্তা অনুসন্ধান"
   tab, where the admin can reply. This only works if the admin checks it
   on the *same browser* the message was sent from — it's included for
   completeness/demo purposes, not as the reliable delivery path.

## What's in this project

Just `index.html` and `package.json` (no dependencies — the `package.json`
is only there in case you later add a build step). No `api/` folder, no
schema, no environment variables, no database provider to set up.

## Deploying

Since it's a plain static file, deploy it anywhere:

- **Vercel / Netlify / Cloudflare Pages**: import the repo, no config needed.
- **GitHub Pages**: enable Pages on the repo, point it at this file.
- Or just open `index.html` directly in a browser — it works completely
  standalone with zero setup.

## Admin accounts (seeded automatically, per browser)

The first time the site loads in any browser, it seeds two admin accounts
into that browser's storage:

| Role | Phone | Password |
|---|---|---|
| এডমিন (মালিক) | 01725345422 | Sa749478 |
| ডেভেলপার এডমিন | 01537229237 | So749478 |

**Change these passwords** before real use.

## No-double-booking rule

Still enforced — but only *within one browser's own stored bookings*. Two
different customers booking from two different phones for the same
date/time will not be blocked from each other, for the same
cross-device-storage reason described above.

## Storage limits

Browsers cap `localStorage` at roughly 5–10MB per site. Bookings, reviews,
messages, and especially uploaded photos (compressed base64, capped at
~3MB per file) all count against this. If storage fills up, saves fail
with a clear error message instead of corrupting data.
