const { sql } = require('../../lib/db');

// Authorization here is deliberately simple (matches the prototype): the
// caller must pass the acting admin's phone number, and we check their role
// is 'business' before allowing add/delete. This is NOT strong security —
// see README "Security notes" for how to harden this before a real launch.
async function requireBusinessAdmin(req, res) {
  const actingPhone = req.body?.actingPhone || req.query?.actingPhone;
  if (!actingPhone) {
    res.status(401).json({ error: 'অনুমোদন প্রয়োজন।' });
    return false;
  }
  const [acting] = await sql`SELECT role FROM admin_accounts WHERE phone = ${actingPhone}`;
  if (!acting || acting.role !== 'business') {
    res.status(403).json({ error: 'আপনার এই কাজের অনুমতি নেই।' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT phone, name, role, created_at FROM admin_accounts ORDER BY created_at ASC`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      if (!(await requireBusinessAdmin(req, res))) return;
      const { name, phone, password, role } = req.body || {};
      if (!name || !/^01[0-9]{9}$/.test(phone || '') || !password || !['assistant', 'business'].includes(role)) {
        return res.status(400).json({ error: 'সঠিক তথ্য দিন। নতুন এডমিন শুধু "সহকারী" বা "মালিক" রোলে যোগ করা যাবে।' });
      }
      const existing = await sql`SELECT phone FROM admin_accounts WHERE phone = ${phone}`;
      if (existing.length) return res.status(409).json({ error: 'এই মোবাইল নম্বরে ইতিমধ্যে একজন এডমিন আছে।' });

      const [row] = await sql`INSERT INTO admin_accounts (phone, name, password, role) VALUES (${phone}, ${name}, ${password}, ${role}) RETURNING phone, name, role, created_at`;
      return res.status(201).json(row);
    }

    if (req.method === 'DELETE') {
      if (!(await requireBusinessAdmin(req, res))) return;
      const { phone } = req.body || {};
      const protectedPhones = ['01725345422', '01537229237'];
      if (protectedPhones.includes(phone)) return res.status(403).json({ error: 'এই এডমিনকে মুছে ফেলা যাবে না।' });
      await sql`DELETE FROM admin_accounts WHERE phone = ${phone}`;
      return res.status(200).json({ deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
