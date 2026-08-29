// /api/irvankade-services.js
// Vercel Serverless Function - Proxy ke API Irvankade SMM
// Mengambil daftar layanan, markup harga 5%, group by category

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
    const apiKey = process.env.IRVANKARDE_API_KEY || '';

    if (!apiKey) {
      console.error('IRVANKARDE_API_KEY tidak ditemukan di environment');
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API belum lengkap (IRVANKARDE_API_KEY missing)'
      });
    }

    // POST ke Irvankade SMM
    const response = await fetch('https://irvankedesmm.co.id/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        api_id: apiId,
        api_key: apiKey
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Irvankade API HTTP error:', response.status, text);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${response.status})`
      });
    }

    const data = await response.json();

    if (!data.status || !Array.isArray(data.data)) {
      console.error('Irvankade response invalid:', data);
      return res.status(502).json({
        status: false,
        msg: data.msg || 'Respon provider tidak valid'
      });
    }

    // Group by category + markup 5% + map ke format frontend
    const grouped = {};
    const MARKUP = 1.06; // +6% (disesuaikan dengan Fayupedia)

    for (const s of data.data) {
      // Skip jika status 0 (tidak aktif)
      if (s.status === 0) continue;

      const category = (s.category || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      // Deteksi apakah butuh komentar berdasarkan type
      const type = (s.type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply' ||
        type === 'custom comments';

      // Harga dari Irvankade = per 1.000 unit (sudah dalam format Rupiah)
      // Markup 6%, dibulatkan
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
        status: s.status === 1
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

    // Cache singkat di edge
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json(sorted);
  } catch (error) {
    console.error('Error irvankade-services:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error'
    });
  }
}
