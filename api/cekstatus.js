// /api/cekstatus.js

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  // API Key Juragan Sosmed
  const API_KEY = process.env.JURAGAN_API_KEY || '5a675b8b637f08969edd6322edc4dd2a';
  const API_URL = 'https://djuragansosmed.com/api/v2';

  try {
    const params = req.method === 'POST' ? req.body : req.query;
    const { action, order, refill } = params;

    if (!action) {
      return res.status(400).json({ status: false, message: 'Parameter action wajib diisi' });
    }

    // ===== SUSUN PAYLOAD (JSON body untuk Juragan Sosmed) =====
    const payload = {
      key: API_KEY,
      action: action
    };

    if (action === 'status' || action === 'refill') {
      if (!order) {
        return res.status(400).json({ status: false, message: 'Parameter order ID wajib diisi' });
      }
      payload.order = order;
    } else if (action === 'refill_status') {
      if (!refill) {
        return res.status(400).json({ status: false, message: 'Parameter refill ID wajib diisi' });
      }
      payload.refill = refill;
    } else {
      return res.status(400).json({ status: false, message: 'Action tidak valid' });
    }

    // ===== REQUEST KE JURAGAN SOSMED =====
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Mengembalikan response ke frontend
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Error Cek Status Juragan Sosmed:', error);
    return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server' });
  }
}
