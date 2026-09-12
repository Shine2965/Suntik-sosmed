export default async function handler(req, res) {
  // Izinkan request dari frontend (CORS Header)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request dari browser
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Hanya terima method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, service, link, quantity, comments } = req.body;

    // Ambil API Key dari Environment Variables Vercel
    const apiKey = process.env.INDO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ status: false, message: 'INDO_API_KEY belum diatur di Vercel' });
    }

    // Susun data form-urlencoded untuk dikirim ke Indosmm
    const payload = new URLSearchParams();
    payload.append('key', apiKey);
    payload.append('action', action || 'add');
    payload.append('service', service);
    payload.append('link', link);
    payload.append('quantity', quantity);
    
    if (comments) {
      payload.append('comments', comments);
    }

    // Request ke API Indosmm dari server Vercel (Bebas CORS)
    const response = await fetch('https://indosmm.id/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: payload.toString()
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
}
