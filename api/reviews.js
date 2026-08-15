const { sql } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, stars, text FROM reviews ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { name, stars, text } = req.body || {};
      if (!name || !text || !stars) return res.status(400).json({ error: 'নাম, রেটিং ও মন্তব্য দিন।' });
      const [row] = await sql`INSERT INTO reviews (name, stars, text) VALUES (${name}, ${stars}, ${text}) RETURNING id`;

      // A review earns a one-time ৳100 promo code.
      const code = 'RVW' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await sql`INSERT INTO promo_codes (code, discount) VALUES (${code}, 100)`;

      return res.status(201).json({ id: row.id, promoCode: code });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
