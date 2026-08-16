const { sql } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT service_key, label_bn, base_fee, per_decimal FROM service_fees ORDER BY service_key`;
      return res.status(200).json(rows);
    }

    if (req.method === 'PUT') {
      const { actingPhone, fees } = req.body || {};
      const [acting] = await sql`SELECT role FROM admin_accounts WHERE phone = ${actingPhone}`;
      if (!acting || acting.role !== 'business') return res.status(403).json({ error: 'শুধুমাত্র মালিক এডমিন ফি পরিবর্তন করতে পারবেন।' });

      for (const key of Object.keys(fees || {})) {
        const f = fees[key];
        await sql`UPDATE service_fees SET base_fee = ${f.base}, per_decimal = ${f.perDecimal} WHERE service_key = ${key}`;
      }
      const rows = await sql`SELECT service_key, label_bn, base_fee, per_decimal FROM service_fees ORDER BY service_key`;
      return res.status(200).json(rows);
    }

    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
