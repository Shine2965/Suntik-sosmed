// /api/ivankarde-services.js
// Vercel Serverless Function - Proxy ke Ivankarde API dengan Fallback

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: false,
      msg: 'Method not allowed'
    });
  }

  try {
    const apiId = parseInt(process.env.IRVANKARDE_API_ID) || 81074;
    const apiKey = process.env.IRVANKARDE_API_KEY || 'f0ugsa-n4ntem-ruhdvz-afehho-4uqw1k';

    // === FAKULTATIF: MOCK DATA (FALLBACK) ===
    const MOCK_DATA = {
      status: true,
      msg: 'OK (MOCK)',
      data: [
        {
          id: 1,
          name: 'Instagram Followers HQ',
          type: 'Default',
          category: 'Instagram Followers',
          price: 55000,
          min: 100,
          max: 100000,
          refill: 1,
          status: 1,
          note: 'Followers instagram berkualitas tinggi'
        },
        {
          id: 2,
          name: 'Instagram Followers Super Cepat',
          type: 'Default',
          category: 'Instagram Followers',
          price: 45000,
          min: 50,
          max: 50000,
          refill: 1,
          status: 1,
          note: 'Followers instagram dengan kecepatan tinggi'
        },
        {
          id: 3,
          name: 'Instagram Likes HQ',
          type: 'Default',
          category: 'Instagram Likes',
          price: 15000,
          min: 10,
          max: 10000,
          refill: 0,
          status: 1,
          note: 'Likes instagram berkualitas'
        },
        {
          id: 4,
          name: 'Instagram Views Story',
          type: 'Default',
          category: 'Instagram Views',
          price: 5000,
          min: 50,
          max: 100000,
          refill: 1,
          status: 1,
          note: 'Viewers story instagram'
        },
        {
          id: 5,
          name: 'TikTok Followers',
          type: 'Default',
          category: 'TikTok Followers',
          price: 65000,
          min: 100,
          max: 50000,
          refill: 1,
          status: 1,
          note: 'Followers tiktok berkualitas'
        },
        {
          id: 6,
          name: 'YouTube Subscribers',
          type: 'Default',
          category: 'YouTube Subscribers',
          price: 75000,
          min: 50,
          max: 10000,
          refill: 1,
          status: 1,
          note: 'Subscriber youtube permanen'
        }
      ]
    };

    // === PROXY KE IVANKARDE ===
    let useMock = false;
    let responseData = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://irvankedesmm.co.id/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'ShineShop/1.0'
        },
        body: JSON.stringify({
          api_id: apiId,
          api_key: apiKey
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const raw = await response.json();
      
      if (raw && raw.status === true && Array.isArray(raw.data) && raw.data.length > 0) {
        responseData = raw;
      } else {
        throw new Error(raw.msg || 'Data tidak valid dari provider');
      }

    } catch (fetchError) {
      console.warn('Ivankarde API error, using mock data:', fetchError.message);
      useMock = true;
      responseData = MOCK_DATA;
    }

    // === PROSES DATA ===
    const sourceData = useMock ? MOCK_DATA.data : responseData.data;
    const grouped = {};
    const MARKUP = 1.06;

    for (const s of sourceData) {
      if (s.status === 0) continue;

      const category = (s.category || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      const type = (s.type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply' ||
        type === 'custom comments' ||
        type === 'mentions custom list' ||
        type === 'poll' ||
        type === 'comment replies';

      const rawPrice = Number(s.price) || 0;
      const markedUpPrice = Math.round(rawPrice * MARKUP);

      grouped[category].push({
        id: s.id,
        name: s.name || `Service #${s.id}`,
        pricePerFollower: markedUpPrice,
        min: Number(s.min) || 1,
        max: Number(s.max) || 1000000,
        average: '-',
        desc: s.note || s.description || '',
        comment: needsComment,
        type: s.type || 'default',
        refill: s.refill === 1 || s.refill === true,
        status: s.status === 1 || s.status === true
      });
    }

    // Urutkan kategori & layanan
    const sorted = {};
    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .forEach((cat) => {
        sorted[cat] = grouped[cat].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), 'id')
        );
      });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    
    return res.status(200).json(sorted);

  } catch (error) {
    console.error('Error ivankarde-services:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error: ' + (error.message || '')
    });
  }
}
