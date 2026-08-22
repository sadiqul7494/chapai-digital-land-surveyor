// Visit /api/health in the browser to get a plain-language diagnosis of
// what's wrong with the database/env setup — instead of digging through
// Vercel's Function logs. Safe to leave in production; it doesn't expose
// secrets, only whether they're set and whether the connection works.
const { Pool } = require('pg');

module.exports = async (req, res) => {
  const report = { ok: false, checks: [] };
  const raw = process.env.DATABASE_URL;

  // 1. Is DATABASE_URL set at all?
  if (!raw) {
    report.checks.push({
      step: 'DATABASE_URL environment variable',
      status: '❌ MISSING',
      meaning: 'DATABASE_URL Vercel-এ সেট করা নেই, অথবা সেট করার পর Redeploy করা হয়নি।',
      fix: 'Vercel → Settings → Environment Variables → DATABASE_URL যোগ করুন (Production টিক দিয়ে) → তারপর Deployments → Redeploy করুন।',
    });
    return res.status(200).json(report);
  }

  // 2. Look for the most common copy-paste mistakes BEFORE trying to parse
  //    it as a URL, so we can give a precise diagnosis instead of a generic
  //    parse error.
  const userinfoSegment = raw.split('@')[0] || ''; // "postgresql://postgres.xxx:PASSWORD"

  if (raw.includes('[YOUR-PASSWORD]')) {
    report.checks.push({
      step: 'DATABASE_URL format',
      status: '❌ PLACEHOLDER NOT REPLACED',
      meaning: 'আপনার URL-এ এখনো আক্ষরিক লেখা "[YOUR-PASSWORD]" রয়ে গেছে — এটা Supabase-এর একটা placeholder, আসল পাসওয়ার্ড না।',
      fix: 'Supabase → Project Settings → Database থেকে আসল পাসওয়ার্ড কপি করে "[YOUR-PASSWORD]" (স্কয়ার ব্র্যাকেটসহ পুরোটা) এর জায়গায় বসান। তারপর Vercel-এ আপডেট করে Redeploy করুন।',
    });
    return res.status(200).json(report);
  }

  if (/[[\]]/.test(userinfoSegment)) {
    report.checks.push({
      step: 'DATABASE_URL format',
      status: '❌ INVALID CHARACTERS',
      meaning: 'ইউজারনেম/পাসওয়ার্ড অংশে স্কয়ার ব্র্যাকেট [ ] আছে, যেটা URL-এ অবৈধ।',
      fix: 'পাসওয়ার্ডের চারপাশের [ ] চিহ্নগুলো মুছে ফেলুন — শুধু আসল পাসওয়ার্ডটুকু রাখুন।',
    });
    return res.status(200).json(report);
  }

  let parsedHost = null;
  try {
    parsedHost = new URL(raw.replace(/^postgres(ql)?:\/\//, 'https://')).hostname;
  } catch (e) {
    report.checks.push({
      step: 'DATABASE_URL format',
      status: '❌ INVALID',
      meaning: 'DATABASE_URL পার্স করা যাচ্ছে না — সম্ভবত পাসওয়ার্ডে বিশেষ ক্যারেক্টার (@ # % / : ইত্যাদি) আছে যেগুলো URL-encode করা প্রয়োজন।',
      parse_error: e.message,
      fix: 'পাসওয়ার্ডে @ # % / : এই ধরনের চিহ্ন থাকলে সেগুলোকে %-encoded ফর্মে বদলাতে হবে (যেমন @ হলে %40), অথবা Supabase-এ গিয়ে সহজ (শুধু অক্ষর-সংখ্যা দিয়ে) একটা নতুন পাসওয়ার্ড রিসেট করে নিন — সেটাই সবচেয়ে সহজ সমাধান।',
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

  // 3. Can we actually connect and query?
  const pool = new Pool({
    connectionString: raw,
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
          ? 'পাসওয়ার্ড ভুল। DATABASE_URL-এ আসল পাসওয়ার্ড আছে কিনা যাচাই করুন।'
          : err.message?.includes('timeout')
          ? 'কানেকশন টাইমআউট হয়েছে — হোস্ট/পোর্ট ভুল হতে পারে, অথবা এটাও IPv6 সমস্যা হতে পারে।'
          : 'অজানা কানেকশন সমস্যা — নিচের error_message-টা পড়ুন অথবা এটা কপি করে জিজ্ঞেস করুন।',
    });
    await pool.end().catch(() => {});
    return res.status(200).json(report);
  }

  // 4. Do the expected tables exist? (i.e. was schema.sql actually run here)
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

  // 5. Are the admin accounts actually seeded?
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
    ? '✅ সবকিছু ঠিক আছে! সমস্যা যদি এখনও থাকে, তাহলে GEMINI_API_KEY বা অন্য কোনো কোড সমস্যা — এই রিপোর্টটা পাঠান।'
    : '❌ উপরের যে ধাপে ❌ দেখাচ্ছে, সেটাই সমস্যা — তার "fix" অংশ অনুসরণ করুন।';
  return res.status(200).json(report);
};
