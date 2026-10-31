// /api/mutasi.js — Proxy mutasi QRIS Qiospay
// Frontend: /api/mutasi?amount=51000

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
    const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';
    const targetAmount = parseInt(req.query?.amount || req.body?.amount || 0, 10) || 0;

    const url = `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;
    console.log('📡 Fetch mutasi merchant:', merchantCode, 'target:', targetAmount);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Shine-Shop/1.0',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Qiospay HTTP ${response.status} ${response.statusText}`);
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Qiospay response bukan JSON: ${rawText.substring(0, 200)}`);
    }

    const isSuccess =
      data.status === 'success' ||
      data.success === true ||
      data.status === true ||
      data.status === 'ok' ||
      Array.isArray(data.data) ||
      Array.isArray(data);

    if (!isSuccess) {
      return res.status(200).json({
        success: false,
        message: data.message || data.messages || data.msg || 'Qiospay response tidak sukses',
        raw: data
      });
    }

    let mutasiList = [];
    if (Array.isArray(data.data)) mutasiList = data.data;
    else if (Array.isArray(data.mutasi)) mutasiList = data.mutasi;
    else if (Array.isArray(data.result)) mutasiList = data.result;
    else if (Array.isArray(data.transactions)) mutasiList = data.transactions;
    else if (Array.isArray(data)) mutasiList = data;

    // Normalisasi amount ke number
    mutasiList = mutasiList.map((m) => {
      if (!m || typeof m !== 'object') return m;
      const amt = Math.floor(parseFloat(String(m.amount ?? m.nominal ?? m.total ?? 0).replace(/[^\d.-]/g, '')) || 0);
      return { ...m, amount: amt, _amount: amt };
    });

    let filtered = mutasiList;
    if (targetAmount > 0) {
      filtered = mutasiList.filter((m) => Math.floor(Number(m.amount) || 0) === targetAmount);
    }

    return res.status(200).json({
      success: true,
      target_amount: targetAmount,
      count: filtered.length,
      total: mutasiList.length,
      data: filtered,
      // kirim juga list penuh agar client bisa match manual
      all: targetAmount > 0 ? mutasiList.slice(0, 50) : undefined,
      raw: data
    });
  } catch (error) {
    console.error('❌ Mutasi error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      code: error.name === 'AbortError' ? 'TIMEOUT' : null
    });
  }
}
