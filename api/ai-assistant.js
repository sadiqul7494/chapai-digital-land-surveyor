// Server-side proxy for the "Bhumishundar AI" land-assistant chat — uses
// Google's Gemini API. The key is only ever read here on the server
// (process.env.GEMINI_API_KEY) and never sent to the browser.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'এআই সহকারী এখনো চালু করা হয়নি — সার্ভারে GEMINI_API_KEY সেট করা নেই।',
    });
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'কোনো বার্তা পাওয়া যায়নি।' });
    }

    // Convert our {role:'user'|'assistant', content:string} history into
    // Gemini's {role:'user'|'model', parts:[{text}]} format.
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const model = 'gemini-2.5-flash';
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{
              text: 'তুমি "ভূমিসুন্দর এআই" — বাংলাদেশের জমি, ভূমি জরিপ, নামজারি, খতিয়ান (আরএস/সিএস/বিএস), সীমানা আইন, ভূমি উন্নয়ন কর, রেজিস্ট্রেশন সংক্রান্ত প্রশ্নের উত্তর দাও। সবসময় বাংলায়, সংক্ষিপ্ত ও স্পষ্টভাবে উত্তর দাও। জমি সংক্রান্ত নয় এমন প্রশ্নে ভদ্রভাবে জানাও যে তুমি শুধু ভূমি সংক্রান্ত বিষয়ে সাহায্য করতে পারো। এটি আইনি পরামর্শ নয়, সাধারণ তথ্য মাত্র।',
            }],
          },
          tools: [{ google_search: {} }],
        }),
      }
    );

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Gemini API error:', data);
      return res.status(upstream.status).json({ error: data.error?.message || 'এআই থেকে উত্তর পাওয়া যায়নি।' });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const answer = parts.map((p) => p.text).filter(Boolean).join('\n') || 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না।';
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'সার্ভার সমস্যা, আবার চেষ্টা করুন।' });
  }
};
