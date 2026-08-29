// /api/ivankarde-services.js
// Vercel Serverless Function - Pure Proxy ke Ivankarde API
// NO MOCK DATA — Real API only

export default async function handler(req, res) {
  // ===== CORS =====
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
    // ===== AMBIL ENV =====
    const apiId = parseInt(process.env.IRVANKARDE_API_ID) || 81074;
    const apiKey = process.env.IRVANKARDE_API_KEY || 'f0ugsa-n4ntem-ruhdvz-afehho-4uqw1k';

    if (!apiKey || apiKey === '') {
      console.error('IRVANKARDE_API_KEY tidak ditemukan di environment');
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API tidak lengkap (API_KEY missing)'
      });
    }

    // ===== PROXY KE IVANKARDE =====
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

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
      console.error('Ivankarde API HTTP error:', response.status, response.statusText);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${response.status})`
      });
    }

    const raw = await response.json();

    // ===== VALIDASI RESPONSE =====
    if (!raw || raw.status !== true || !Array.isArray(raw.data)) {
      console.error('Ivankarde response invalid:', raw);
      return res.status(502).json({
        status: false,
        msg: raw?.msg || 'Respon provider tidak valid'
      });
    }

    if (raw.data.length === 0) {
      return res.status(200).json({});
    }

    // ===== PROSES DATA =====
    const grouped = {};
    const MARKUP = 1.06; // +6%

    for (const s of raw.data) {
      // Skip service yang nonaktif (status: 0)
      if (s.status === 0) continue;

      const category = (s.category || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      // Deteksi tipe komentar
      const type = (s.type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply' ||
        type === 'custom comments' ||
        type === 'mentions custom list' ||
        type === 'mentions hashtag' ||
        type === 'mentions user followers' ||
        type === 'mentions media likers' ||
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

    // ===== URUTKAN KATEGORI & LAYANAN =====
    const sorted = {};
    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .forEach((cat) => {
        sorted[cat] = grouped[cat].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), 'id')
        );
      });

    // ===== CACHE =====
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json(sorted);

  } catch (error) {
    console.error('Error ivankarde-services:', error);

    // ===== ERROR HANDLING =====
    if (error.name === 'AbortError') {
      return res.status(504).json({
        status: false,
        msg: 'Provider timeout (10 detik)'
      });
    }

    return res.status(500).json({
      status: false,
      msg: 'Internal server error: ' + (error.message || '')
    });
  }
}
