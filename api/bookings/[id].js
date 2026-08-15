const { sql } = require('../../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const [row] = await sql`SELECT * FROM bookings WHERE id = ${id}`;
      if (!row) return res.status(404).json({ error: 'বুকিং পাওয়া যায়নি।' });
      const files = await sql`SELECT name, mime_type, size_bytes, data_url FROM booking_files WHERE booking_id = ${id}`;
      return res.status(200).json({ ...row, files });
    }

    if (req.method === 'PATCH') {
      const { status } = req.body || {};
      const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'সঠিক স্ট্যাটাস দিন।' });
      const [row] = await sql`UPDATE bookings SET status = ${status} WHERE id = ${id} RETURNING *`;
      if (!row) return res.status(404).json({ error: 'বুকিং পাওয়া যায়নি।' });
      return res.status(200).json(row);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM bookings WHERE id = ${id}`;
      return res.status(200).json({ deleted: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'এই তারিখ ও সময়ে ইতিমধ্যে একটি বুকিং আছে।', code: 'SLOT_TAKEN' });
    }
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
