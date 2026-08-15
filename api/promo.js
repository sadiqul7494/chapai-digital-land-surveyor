const { sql } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'কোড দিন।' });
    const [row] = await sql`SELECT code, discount, used FROM promo_codes WHERE code = ${code.toUpperCase()}`;
    if (!row) return res.status(404).json({ error: 'এই প্রোমো কোডটি সঠিক নয়।' });
    if (row.used) return res.status(410).json({ error: 'এই প্রোমো কোডটি আগেই ব্যবহার হয়ে গেছে।' });
    return res.status(200).json({ valid: true, discount: row.discount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
