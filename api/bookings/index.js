const { sql } = require('../../lib/db');

function genId() {
  return 'BK' + Date.now().toString().slice(-8);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { phone, date } = req.query || {};
      let rows;
      if (date) {
        rows = await sql`SELECT id, date, slot, status FROM bookings WHERE date = ${date} AND status <> 'cancelled'`;
      } else if (phone) {
        rows = await sql`SELECT * FROM bookings WHERE phone = ${phone} ORDER BY created_at DESC`;
      } else {
        rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC`;
      }
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.name || !/^01[0-9]{9}$/.test(b.phone || '') || !b.date || !b.slot) {
        return res.status(400).json({ error: 'নাম, সঠিক মোবাইল নম্বর, তারিখ ও সময় দিন।' });
      }

      // ---- Double-booking prevention ----
      // The surveyor can only be in one place at a time: reject a new booking
      // if an active (non-cancelled) booking already exists for the same
      // date + time slot. The database also enforces this via a unique
      // partial index (see schema.sql) as a second line of defense against
      // race conditions — this check just gives a friendly error message.
      const clash = await sql`
        SELECT id FROM bookings
        WHERE date = ${b.date} AND slot = ${b.slot} AND status <> 'cancelled'
        LIMIT 1`;
      if (clash.length > 0) {
        return res.status(409).json({
          error: `${b.date} তারিখে ${b.slot} সময়ে ইতিমধ্যে একটি বুকিং আছে। অনুগ্রহ করে অন্য তারিখ বা সময় বেছে নিন।`,
          code: 'SLOT_TAKEN',
        });
      }

      const id = genId();
      const status = b.status === 'confirmed' ? 'confirmed' : 'pending';

      const [row] = await sql`
        INSERT INTO bookings
          (id, name, phone, upazila, size, service, date, slot, location, fee, promo, status, created_by_admin, attachment_count)
        VALUES
          (${id}, ${b.name}, ${b.phone}, ${b.upazila || null}, ${b.size || null}, ${b.service || null},
           ${b.date}, ${b.slot}, ${b.location || null}, ${b.fee || null}, ${b.promo || null},
           ${status}, ${!!b.createdByAdmin}, ${b.attachmentCount || 0})
        RETURNING *`;

      if (Array.isArray(b.attachments) && b.attachments.length) {
        for (const f of b.attachments) {
          await sql`
            INSERT INTO booking_files (booking_id, name, mime_type, size_bytes, data_url)
            VALUES (${id}, ${f.name}, ${f.type || null}, ${Math.round(f.size || 0)}, ${f.dataUrl})`;
        }
      }

      if (b.promo) {
        await sql`UPDATE promo_codes SET used = TRUE, used_by = ${id} WHERE code = ${b.promo}`;
      }

      return res.status(201).json(row);
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    // A unique-index violation (23505) means another request grabbed the same
    // date+slot a split second earlier — treat it the same as our own check.
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'এই তারিখ ও সময়ে ইতিমধ্যে একটি বুকিং নেওয়া হয়ে গেছে। অন্য সময় বেছে নিন।', code: 'SLOT_TAKEN' });
    }
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
