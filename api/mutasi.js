// /api/mutasi.js
// Proxy ambil mutasi QRIS dari Qiospay
// Frontend: /api/mutasi?amount=51000

export default async function handler(req, res) {
  // ============ CORS ============
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
    const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';
    const targetAmount = parseInt(req.query?.amount || 0);

    // ===== FETCH MUTASI DARI QIOSPAY =====
    const url = `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;
    console.log('📡 Fetch mutasi:', url.replace(apiKey, '***'));

    // ✅ Timeout 15 detik agar tidak hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Shine-Shop/1.0',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Qiospay HTTP ${response.status} ${response.statusText}`);
    }

    const rawText = await response.text();
    console.log('📊 Qiospay raw length:', rawText.length);

    // ✅ Parse JSON dengan aman
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Qiospay response bukan JSON: ${rawText.substring(0, 200)}`);
    }

    console.log('📊 Qiospay response:', JSON.stringify(data).substring(0, 500));

    // ===== VALIDASI FORMAT RESPONSE (support berbagai format) =====
    // Format 1: { status: "success", data: [...] }
    // Format 2: { success: true, data: [...] }
    // Format 3: { status: true, data: [...] }
    // Format 4: { data: [...] } (langsung array)
    // Format 5: [...]
    
    const isSuccess =
      data.status === 'success' ||
      data.success === true ||
      data.status === true ||
      data.status === 'ok' ||
      (Array.isArray(data.data) && data.data.length >= 0) ||
      Array.isArray(data);

    if (!isSuccess) {
      return res.status(200).json({
        success: false,
        message: data.message || data.msg || 'Qiospay response tidak sukses',
        raw: data,
      });
    }

    // ✅ Normalisasi data agar konsisten
    let mutasiList = [];
    if (Array.isArray(data.data)) mutasiList = data.data;
    else if (Array.isArray(data.mutasi)) mutasiList = data.mutasi;
    else if (Array.isArray(data.result)) mutasiList = data.result;
    else if (Array.isArray(data)) mutasiList = data;
    else if (Array.isArray(data.transactions)) mutasiList = data.transactions;

    // ✅ Filter nominal kalau ada `targetAmount`
    let filtered = mutasiList;
    if (targetAmount > 0) {
      filtered = mutasiList.filter((m) => {
        const amt = parseFloat(m.amount ?? m.nominal ?? m.total ?? 0);
        return Math.floor(amt) === targetAmount;
      });
    }

    return res.status(200).json({
      success: true,
      target_amount: targetAmount,
      count: filtered.length,
      total: mutasiList.length,
      data: filtered,
      raw: data, // tetap kirim raw untuk debug
    });
  } catch (error) {
    console.error('❌ Mutasi error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      code: error.code || null,
    });
  }
}
