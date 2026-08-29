// /api/irvankede-services.js
// Vercel Serverless Function - Proxy ke Irvankede SMM API
// Mengambil daftar layanan, markup harga 5%, group by category
// Endpoint: https://irvankedesmm.co.id/api/services (POST)

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
    // Sesuai qris-config.js: IRVANKARDE_API_ID default 81074
    const apiId = parseInt(process.env.IRVANKARDE_API_ID || process.env.IRVANKEDE_API_ID) || 81074;
    const apiKey = process.env.IRVANKARDE_API_KEY || process.env.IRVANKEDE_API_KEY || '';

    if (!apiKey) {
      console.error('IRVANKARDE_API_KEY / IRVANKEDE_API_KEY tidak ditemukan di environment');
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API belum lengkap (IRVANKARDE_API_KEY missing)'
      });
    }

    // POST ke Irvankede
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
      console.error('Irvankede API HTTP error:', response.status, text);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${response.status})`
      });
    }

    const data = await response.json();

    // Support beberapa bentuk respon umum panel SMM
    // 1) { status: true, services: [...] }
    // 2) { status: true, data: [...] }
    // 3) langsung array
    let services = null;
    if (Array.isArray(data)) {
      services = data;
    } else if (data && Array.isArray(data.services)) {
      services = data.services;
    } else if (data && Array.isArray(data.data)) {
      services = data.data;
    }

    if (!services) {
      console.error('Irvankede response invalid:', data);
      return res.status(502).json({
        status: false,
        msg: (data && (data.msg || data.message || data.error)) || 'Respon provider tidak valid'
      });
    }

    // Group by category + markup 5% + map ke format frontend
    const grouped = {};
    const MARKUP = 1.05; // +5%

    for (const s of services) {
      const category = (s.category || s.Category || 'Lainnya').toString().trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      // Deteksi apakah butuh komentar berdasarkan type
      const type = String(s.type || s.Type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply';

      // Harga dari Irvankede = per 1.000 unit
      // Markup 5%, dibulatkan — frontend: total = (jumlah / 1000) * price
      const rawPrice = Number(s.price ?? s.rate ?? s.Price) || 0;
      const markedUpPrice = Math.round(rawPrice * MARKUP);

      const id = s.id ?? s.service ?? s.service_id;
      const name = s.name || s.service || s.service_name || `Service #${id}`;
      const min = Number(s.min ?? s.minimum) || 1;
      const max = Number(s.max ?? s.maximum) || 1000000;
      const desc = s.description || s.desc || s.note || '';

      grouped[category].push({
        id: id,
        name: name,
        // pricePerFollower = harga per 1000 (setelah markup)
        pricePerFollower: markedUpPrice,
        min: min,
        max: max,
        average: s.average || '-',
        desc: desc,
        comment: needsComment,
        type: s.type || 'default',
        refill: s.refill === 1 || s.refill === true || s.refill === '1'
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
    console.error('Error irvankede-services:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error'
    });
  }
}
