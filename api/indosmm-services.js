// /api/indosmm-balance.js
// Vercel Serverless Function - Cek saldo Indosmm (POST)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      status: false,
      msg: 'Method not allowed. Use GET or POST'
    });
  }

  try {
    // Ambil API key dari environment (lebih aman)
    const apiKey = process.env.INDO_API_KEY || 'a11570b88893e5d72b274539c98c1fba';

    if (!apiKey) {
      console.error('❌ INDO_API_KEY tidak ditemukan');
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API belum lengkap'
      });
    }

    const payload = {
      key: apiKey,
      action: 'balance'
    };

    const response = await fetch('https://indosmm.id/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('❌ Indosmm balance HTTP error:', response.status, text);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${response.status})`
      });
    }

    const data = await response.json();

    // Validasi response
    if (!data || typeof data.balance === 'undefined') {
      console.error('❌ Response balance invalid:', data);
      return res.status(502).json({
        status: false,
        msg: 'Respon saldo tidak valid'
      });
    }

    // Cache singkat (opsional)
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    return res.status(200).json({
      status: true,
      balance: Number(data.balance) || 0,
      currency: data.currency || 'IDR'
    });

  } catch (error) {
    console.error('❌ Error indosmm-balance:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error: ' + (error.message || '')
    });
  }
}
