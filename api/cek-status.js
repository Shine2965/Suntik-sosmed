// /api/cekstatus.js

export default async function handler(req, res) {
  // Hanya menerima method POST atau GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  // Masukkan API Key IndoSMM Anda di sini (atau via environment variable process.env.INDOSMM_API_KEY)
  const API_KEY = process.env.INDOSMM_API_KEY || 'MASUKKAN_API_KEY_INDOSMM_ANDA';
  const API_URL = 'https://indosmm.id/api/v2'; // Ulangi/sesuaikan URL API resmi IndoSMM jika berbeda

  try {
    const params = req.method === 'POST' ? req.body : req.query;
    const { action, order, refill } = params;

    if (!action) {
      return res.status(400).json({ status: false, message: 'Parameter action wajib diisi' });
    }

    // Buat payload untuk dikirim ke IndoSMM
    const payload = new URLSearchParams();
    payload.append('key', API_KEY);
    payload.append('action', action);

    if (action === 'status' || action === 'refill') {
      if (!order) {
        return res.status(400).json({ status: false, message: 'Parameter order ID wajib diisi' });
      }
      payload.append('order', order);
    } else if (action === 'refill_status') {
      if (!refill) {
        return res.status(400).json({ status: false, message: 'Parameter refill ID wajib diisi' });
      }
      payload.append('refill', refill);
    } else {
      return res.status(400).json({ status: false, message: 'Action tidak valid' });
    }

    // Request ke API IndoSMM
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    const data = await response.json();

    // Mengembalikan response ke frontend
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error Cek Status IndoSMM:', error);
    return res.status(500).json({ status: false, message: 'Terjadi kesalahan pada server' });
  }
}
