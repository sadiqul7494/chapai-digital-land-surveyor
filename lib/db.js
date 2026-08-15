// Shared Neon/Postgres client for all API routes.
// Uses @neondatabase/serverless — an HTTP-based driver that works well in
// Vercel's serverless functions (no persistent TCP connection needed).
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  // Fails loudly at request time rather than silently — see README for how
  // to set DATABASE_URL as a Vercel environment variable.
  console.error('DATABASE_URL is not set. Add it in your Vercel project settings (Environment Variables).');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = { sql };
