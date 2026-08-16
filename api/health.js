// Visit /api/health in the browser to get a plain-language diagnosis of
// what's wrong with the database/env setup — instead of digging through
// Vercel's Function logs. Safe to leave in production; it doesn't expose
// secrets, only whether they're set and whether the connection works.
const { Pool } = require('pg');

module.exports = async (req, res) => {
  const report = {
    ok: false,
    checks: [],
  };

  // 1. Is DATABASE_URL set at all?
  if (!process.env.DATABASE_URL) {
    report.checks.push({
      step: 'DATABASE_URL environment variable',
      status: '❌ MISSING',
      meaning: 'DATABASE_URL Vercel-এ সেট করা নেই, অথবা সেট করার পর Redeploy করা হয়নি।',
      fix: 'Vercel → Settings → Environment Variables → DATABASE_URL যোগ করুন (Production টিক দিয়ে) → তারপর Deployments → Redeploy করুন।',
    });
    return res.status(200).json(report);
  }

  let parsedHost = null;
  try {
    parsedHost = new URL(process.env.DATABASE_URL.replace('postgresql://', 'https://').replace('postgres://', 'https://')).hostname;
  } catch (e) {
    report.checks.push({
      step: 'DATABASE_URL format',
      status: '❌ INVALID',
      meaning: 'DATABASE_URL-এর ফরম্যাট ঠিক নেই — এটা একটা সঠিক postgresql:// URL হওয়া উচিত।',
      value_seen: process.env.DATABASE_URL.slice(0, 30) + '...',
    });
    return res.status(200).json(report);
  }

  report.checks.push({
    step: 'DATABASE_URL format',
    status: '✅ OK',
    host_detected: parsedHost,
    warning: parsedHost && parsedHost.startsWith('db.') && parsedHost.includes('supabase.co')
      ? '⚠️ এটা Supabase-এর ডাইরেক্ট কানেকশন (db.xxxx.supabase.co) — এটা IPv6-only এবং Vercel-এ কাজ করবে না। "Session pooler" URL ব্যবহার করুন (aws-0-<region>.pooler.supabase.com)।'
      : null,
  });

  // 2. Can we actually connect and query?
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    const result = await pool.query('SELECT 1 as ok');
    report.checks.push({ step: 'Database connection', status: '✅ OK', result: result.rows[0] });
  } catch (err) {
    report.checks.push({
      step: 'Database connection',
      status: '❌ FAILED',
      error_code: err.code || null,
      error_message: err.message,
      meaning:
        err.code === 'ENETUNREACH' || err.message?.includes('ENETUNREACH')
          ? 'নেটওয়ার্ক আনরিচেবল — এটা প্রায় নিশ্চিতভাবে IPv6/IPv4 সমস্যা। Supabase হলে "Session pooler" URL ব্যবহার করুন।'
          : err.message?.includes('password authentication failed')
          ? 'পাসওয়ার্ড ভুল। DATABASE_URL-এ আসল পাসওয়ার্ড আছে কিনা যাচাই করুন ([YOUR-PASSWORD] লেখাটা রয়ে গেছে কিনা দেখুন)। পাসওয়ার্ডে বিশেষ ক্যারেক্টার (@ # % / ইত্যাদি) থাকলে URL-encode করা প্রয়োজন হতে পারে।'
          : err.message?.includes('timeout')
          ? 'কানেকশন টাইমআউট হয়েছে — হোস্ট/পোর্ট ভুল হতে পারে, অথবা এটাও IPv6 সমস্যা হতে পারে।'
          : 'অজানা কানেকশন সমস্যা — নিচের error_message-টা পড়ুন অথবা এটা কপি করে জিজ্ঞেস করুন।',
    });
    await pool.end().catch(() => {});
    return res.status(200).json(report);
  }

  // 3. Do the expected tables exist? (i.e. was schema.sql actually run here)
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN
        ('bookings','reviews','admin_accounts','service_fees','site_media','promo_codes','booking_files')
    `);
    const found = tables.rows.map((r) => r.table_name);
    const expected = ['bookings', 'reviews', 'admin_accounts', 'service_fees', 'site_media', 'promo_codes', 'booking_files'];
    const missing = expected.filter((t) => !found.includes(t));
    if (missing.length > 0) {
      report.checks.push({
        step: 'Database schema (tables)',
        status: '❌ MISSING TABLES',
        missing_tables: missing,
        meaning: 'ডাটাবেজ কানেক্ট হচ্ছে ঠিকই, কিন্তু schema.sql এই ডাটাবেজে রান করা হয়নি — টেবিলগুলোই নেই।',
        fix: 'Supabase SQL Editor-এ (এই একই DATABASE_URL যেই প্রজেক্টের) schema.sql-এর সম্পূর্ণ কোড রান করুন।',
      });
      await pool.end().catch(() => {});
      return res.status(200).json(report);
    }
    report.checks.push({ step: 'Database schema (tables)', status: '✅ OK', tables_found: found });
  } catch (err) {
    report.checks.push({ step: 'Database schema (tables)', status: '❌ ERROR', error_message: err.message });
    await pool.end().catch(() => {});
    return res.status(200).json(report);
  }

  // 4. Are the admin accounts actually seeded?
  try {
    const admins = await pool.query('SELECT phone, name, role FROM admin_accounts');
    report.checks.push({
      step: 'Admin accounts',
      status: admins.rows.length > 0 ? '✅ OK' : '❌ EMPTY',
      count: admins.rows.length,
      meaning: admins.rows.length === 0 ? 'admin_accounts টেবিল খালি — schema.sql-এর INSERT অংশটা রান হয়নি।' : null,
    });
  } catch (err) {
    report.checks.push({ step: 'Admin accounts', status: '❌ ERROR', error_message: err.message });
  }

  await pool.end().catch(() => {});
  report.ok = report.checks.every((c) => c.status.startsWith('✅'));
  report.summary = report.ok
    ? '✅ সবকিছু ঠিক আছে! সমস্যা যদি এখনও থাকে, তাহলে ANTHROPIC/GEMINI_API_KEY বা অন্য কোনো কোড সমস্যা — এই রিপোর্টটা পাঠান।'
    : '❌ উপরের যে ধাপে ❌ দেখাচ্ছে, সেটাই সমস্যা — তার "fix" অংশ অনুসরণ করুন।';
  return res.status(200).json(report);
};
