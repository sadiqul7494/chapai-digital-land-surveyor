const { sql } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // এখানে ব্যাকটিক (``) ব্যবহার করা হয়েছে
      const [row] = await sqlSELECT hero_photos, cert_photos, work_photos, related_links FROM site_media WHERE id = 1;
      return res.status(200).json(row || { hero_photos: [], cert_photos: [], work_photos: [], related_links: [] });
    }

    if (req.method === 'PUT') {
      const { field, value } = req.body || {};
      const json = JSON.stringify(value ?? []);
      
      switch (field) {
        case 'hero_photos':
          await sqlUPDATE site_media SET hero_photos = ${json}::jsonb WHERE id = 1;
          break;
        case 'cert_photos':
          await sqlUPDATE site_media SET cert_photos = ${json}::jsonb WHERE id = 1;
          break;
        case 'work_photos':
          await sqlUPDATE site_media SET work_photos = ${json}::jsonb WHERE id = 1;
          break;
        case 'related_links':
          await sqlUPDATE site_media SET related_links = ${json}::jsonb WHERE id = 1;
          break;
        default:
          return res.status(400).json({ error: 'সঠিক ফিল্ড নাম দিন।' });
      }
      return res.status(200).json({ saved: true });
    }

    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
