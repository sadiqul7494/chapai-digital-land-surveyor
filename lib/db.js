// Shared Postgres client for all API routes.
// Uses the standard `pg` driver over a connection pool — this works with
// ANY Postgres provider via a normal connection string (Neon, Supabase,
// RDS, etc.), unlike Neon's HTTP-only serverless driver which only talks
// to Neon's own infrastructure.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  // Fails loudly at request time rather than silently — see README for how
  // to set DATABASE_URL as a Vercel environment variable.
  console.error('DATABASE_URL is not set. Add it in your Vercel project settings (Environment Variables).');
}

// Reused across warm serverless invocations (stored on globalThis so a
// module reload during local `vercel dev` doesn't leak connections).
const pool =
  globalThis.__pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // both Neon and Supabase require SSL
    max: 3, // keep small — serverless functions run many concurrent instances
  });
globalThis.__pgPool = pool;

// A tagged-template helper so the rest of the codebase can keep writing
// `sql\`SELECT ... WHERE x = ${val}\`` exactly like the Neon driver did.
async function sql(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  const res = await pool.query(text, values);
  return res.rows;
}

module.exports = { sql, pool };
