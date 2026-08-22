// Shared Postgres client for all API routes.
// Uses the standard `pg` driver over a connection pool — this works with
// ANY Postgres provider via a normal connection string (Neon, Supabase,
// RDS, etc.), unlike Neon's HTTP-only serverless driver which only talks
// to Neon's own infrastructure.
//
// IMPORTANT if you're on Supabase: use the "Session pooler" connection
// string (Project → Connect → Session pooler), NOT the direct connection
// (db.<ref>.supabase.co:5432). The direct connection is IPv6-only, and
// Vercel serverless functions cannot make outbound IPv6 connections — that
// mismatch is the #1 cause of "server problem" errors on every request.
// See README "Troubleshooting" for the exact steps.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it in your Vercel project settings (Environment Variables).');
}

const pool =
  globalThis.__pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // both Neon and Supabase require SSL
    max: 1, // one connection per serverless invocation is enough, and keeps
             // us well under the pooler's connection limit under load
    connectionTimeoutMillis: 8000, // fail fast with a clear error instead of
                                     // hanging for Vercel's whole function timeout
    idleTimeoutMillis: 10000,
  });
globalThis.__pgPool = pool;

// A tagged-template helper so the rest of the codebase can keep writing
// `sql\`SELECT ... WHERE x = ${val}\`` exactly like before.
async function sql(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  try {
    const res = await pool.query(text, values);
    return res.rows;
  } catch (err) {
    // Surface connection-level failures with a distinct message so they're
    // easy to spot in Vercel's Function logs (vs. a generic query error).
    if (err && (err.code === 'ETIMEDOUT' || err.code === 'ENETUNREACH' || err.message?.includes('timeout'))) {
      console.error('DB CONNECTION FAILED — likely using an IPv6-only connection string on Vercel. Use the Supabase "Session pooler" URL instead of the direct connection. Original error:', err.message);
    }
    throw err;
  }
}

module.exports = { sql, pool };
