// /api/mutasi.js
// Proxy ambil mutasi QRIS dari Qiospay — response selalu normalisasi ke data[]

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'Shine-Shop/1.0' },
        signal: controller.signal,
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

    let mutasiList = [];
    if (Array.isArray(data?.data)) mutasiList = data.data;
    else if (Array.isArray(data?.mutasi)) mutasiList = data.mutasi;
    else if (Array.isArray(data?.result)) mutasiList = data.result;
    else if (Array.isArray(data?.transactions)) mutasiList = data.transactions;
    else if (Array.isArray(data)) mutasiList = data;

    function rowAmount(m) {
      if (m == null) return 0;
      if (typeof m === 'number') return Math.floor(m);
      const v = m.amount ?? m.nominal ?? m.total ?? m.kredit ?? m.credit ?? m.value ?? 0;
      let str = String(v).trim().replace(/[Rr][Pp]/g, '').replace(/\s/g, '');
      if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf('.') > str.lastIndexOf(',')) str = str.replace(/,/g, '');
        else str = str.replace(/\./g, '').replace(',', '.');
      } else if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
      else if ((str.match(/\./g) || []).length > 1) str = str.replace(/\./g, '');
      const n = parseFloat(str);
      return isNaN(n) ? 0 : Math.floor(n);
    }

    let filtered = mutasiList;
    if (targetAmount > 0) {
      filtered = mutasiList.filter((m) => rowAmount(m) === targetAmount);
    }

    // Normalisasi agar frontend mudah match
    const normalized = filtered.map((m) => ({
      ...m,
      amount: rowAmount(m),
      nominal: rowAmount(m),
    }));

    return res.status(200).json({
      success: true,
      target_amount: targetAmount,
      count: normalized.length,
      total: mutasiList.length,
      data: normalized,
      mutasi: normalized,
      raw: data,
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
