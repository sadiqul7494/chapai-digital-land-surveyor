-- Chapai Digital Land Surveyor — Neon Postgres schema
-- Run this once against your Neon database before deploying
-- (Neon SQL editor, or: psql "$DATABASE_URL" -f schema.sql)

CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  upazila         TEXT,
  size            NUMERIC,
  service         TEXT,
  date            DATE NOT NULL,
  slot            TEXT NOT NULL,
  location        TEXT,
  fee             NUMERIC,
  promo           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | completed | cancelled
  created_by_admin BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforces "no two bookings on the same date + same time slot" at the
-- database level (the surveyor can only be in one place at a time).
-- Cancelled bookings don't block the slot.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_date_slot
  ON bookings (date, slot)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);

CREATE TABLE IF NOT EXISTS booking_files (
  id          SERIAL PRIMARY KEY,
  booking_id  TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  mime_type   TEXT,
  size_bytes  INTEGER,
  data_url    TEXT NOT NULL, -- base64 data URL; fine for small attachments (a few MB)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT PRIMARY KEY,
  discount    NUMERIC NOT NULL DEFAULT 100,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  used_by     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  phone       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL, -- see README: replace with a hashed password before real launch
  role        TEXT NOT NULL, -- business | content | assistant
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_accounts (phone, name, password, role) VALUES
  ('01725345422', 'সাদিকুল ইসলাম', 'Sa749478', 'business'),
  ('01537229237', 'সজিব ইসলাম', 'So749478', 'content')
ON CONFLICT (phone) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_fees (
  service_key   TEXT PRIMARY KEY,
  label_bn      TEXT NOT NULL,
  base_fee      NUMERIC NOT NULL,
  per_decimal   NUMERIC NOT NULL DEFAULT 0
);

INSERT INTO service_fees (service_key, label_bn, base_fee, per_decimal) VALUES
  ('boundary', 'সীমানা নির্ধারণ ও সীমানা খুঁটি স্থাপন', 3000, 150),
  ('cadmap', 'অটোক্যাড ও গ্যানাক্যাড ডিজিটাল ক্যাড জরিপ', 4500, 200),
  ('partition', 'বাটোয়ারা দলিল ও সীমানা বণ্টন রেখা নির্ধারণ', 5000, 180),
  ('verifymap', 'মৌজা ম্যাপ যাচাই ও খতিয়ান মিলানো', 2000, 0),
  ('courtcommission', 'আদালত কমিশন সার্ভে তদন্ত', 8000, 0)
ON CONFLICT (service_key) DO NOTHING;

-- Single-row table holding the editable site media (hero photos, certificate/
-- work gallery items, government links) as JSON, managed from the admin panel.
CREATE TABLE IF NOT EXISTS site_media (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  hero_photos     JSONB NOT NULL DEFAULT '[]',
  cert_photos     JSONB NOT NULL DEFAULT '[]',
  work_photos     JSONB NOT NULL DEFAULT '[]',
  related_links   JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO site_media (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
