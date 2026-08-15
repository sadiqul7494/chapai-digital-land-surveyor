// Server-side proxy for the "Bhumishundar AI" land-assistant chat.
// The direct browser -> api.anthropic.com call in the original prototype
// only worked inside Claude.ai's own artifact sandbox, which injects
// credentials behind the scenes. A real deployment needs its own Anthropic
// API key, kept here as an environment variable and never exposed to the
// browser. See README "AI assistant setup".
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'এআই সহকারী এখনো চালু করা হয়নি — সার্ভারে ANTHROPIC_API_KEY সেট করা নেই।',
    });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'কোনো বার্তা পাওয়া যায়নি।' });
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: 'তুমি "ভূমিসুন্দর এআই" — বাংলাদেশের জমি, ভূমি জরিপ, নামজারি, খতিয়ান (আরএস/সিএস/বিএস), সীমানা আইন, ভূমি উন্নয়ন কর, রেজিস্ট্রেশন সংক্রান্ত প্রশ্নের উত্তর দাও। সবসময় বাংলায়, সংক্ষিপ্ত ও স্পষ্টভাবে উত্তর দাও। প্রয়োজনে ওয়েব সার্চ ব্যবহার করে সাম্প্রতিক ও সঠিক তথ্য দাও। জমি সংক্রান্ত নয় এমন প্রশ্নে ভদ্রভাবে জানাও যে তুমি শুধু ভূমি সংক্রান্ত বিষয়ে সাহায্য করতে পারো। এটি আইনি পরামর্শ নয়, সাধারণ তথ্য মাত্র।',
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Anthropic API error:', data);
      return res.status(upstream.status).json({ error: data.error?.message || 'এআই থেকে উত্তর পাওয়া যায়নি।' });
    }

    const textParts = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return res.status(200).json({ answer: textParts || 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না।' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
