const { sql } = require('../../lib/db');

// NOTE on security: this is a straightforward phone+password check matching
// the original prototype's trust model. Passwords are stored in plain text
// in the database, which is fine for an internal low-stakes tool but should
// be upgraded (bcrypt hashing + real sessions/JWT) before handling anything
// sensitive. See README "Security notes".
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) return res.status(400).json({ error: 'মোবাইল নম্বর ও পাসওয়ার্ড দিন।' });

    const [admin] = await sql`SELECT phone, name, role FROM admin_accounts WHERE phone = ${phone} AND password = ${password}`;
    if (!admin) return res.status(401).json({ error: 'মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' });

    return res.status(200).json(admin);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
