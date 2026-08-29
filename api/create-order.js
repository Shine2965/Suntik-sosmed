// /api/create-order.js
// Vercel Serverless Function - Proxy order ke ordersosmed.id (menghindari CORS)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      response: false,
      data: { msg: 'Method not allowed. Gunakan POST.' }
    });
  }

  try {
    // Kredensial dari ENV (prioritas) atau fallback
    const apiId = process.env.ORDER_API_ID || process.env.ORDERSOSMED_API_ID || '11313';
    const apiKey = process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY || '23941803d5391da4e45a1bf4ebca52064fa17a53574d1c3655a0173dd7530fb1';
    const secretKey = process.env.ORDER_SECRET_KEY || process.env.ORDERSOSMED_SECRET_KEY || 'Alvino11';
    const orderUrl = process.env.ORDER_API_URL || 'https://ordersosmed.id/api-1/order';

    // Ambil body (JSON atau form)
    const body = req.body || {};
    const service = body.service ?? body.id;
    const target = body.target;
    const quantity = body.quantity;
    const additional = body.additional ?? body.comments ?? body.comment;

    // Validasi minimal
    if (!service) {
      return res.status(400).json({
        response: false,
        data: { msg: 'Parameter service (ID layanan) wajib diisi.' }
      });
    }
    if (!target) {
      return res.status(400).json({
        response: false,
        data: { msg: 'Parameter target wajib diisi.' }
      });
    }

    // Build form-urlencoded (API ordersosmed lebih stabil dengan format ini)
    const params = new URLSearchParams();
    params.append('api_id', String(apiId));
    params.append('api_key', String(apiKey));
    params.append('secret_key', String(secretKey));
    params.append('service', String(service));
    params.append('target', String(target));

    // quantity: kosongkan jika custom_comments (ada additional)
    if (additional && String(additional).trim() !== '') {
      params.append('additional', String(additional).trim());
      // quantity boleh kosong untuk custom_comments
      if (quantity !== undefined && quantity !== null && quantity !== '' && Number(quantity) > 0) {
        params.append('quantity', String(quantity));
      }
    } else {
      if (quantity === undefined || quantity === null || quantity === '' || Number(quantity) <= 0) {
        return res.status(400).json({
          response: false,
          data: { msg: 'Parameter quantity wajib diisi (kecuali layanan custom_comments).' }
        });
      }
      params.append('quantity', String(quantity));
    }

    console.log('[create-order] Proxy ke', orderUrl, '| service=', service, '| target=', target);

    const upstream = await fetch(orderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[create-order] Response bukan JSON:', text.slice(0, 300));
      return res.status(502).json({
        response: false,
        data: { msg: 'Respons API tidak valid (bukan JSON).' }
      });
    }

    // Normalisasi agar frontend mudah baca
    // Format asli ordersosmed: { response: true/false, data: { msg, order?, ... } }
    const isSuccess = data.response === true || data.status === true || data.success === true;
    const orderId =
      data.data?.order ||
      data.data?.id ||
      data.order ||
      data.id ||
      data.data?.order_id ||
      null;
    const msg =
      data.data?.msg ||
      data.data?.message ||
      data.msg ||
      data.message ||
      (isSuccess ? 'Pesanan berhasil dibuat.' : 'Gagal membuat pesanan.');

    // Kembalikan format yang konsisten untuk frontend
    return res.status(200).json({
      response: isSuccess,
      status: isSuccess,
      order: orderId,
      msg: msg,
      data: data.data || data,
      raw: data
    });

  } catch (error) {
    console.error('[create-order] Error:', error);
    return res.status(500).json({
      response: false,
      data: { msg: 'Internal server error: ' + (error.message || 'Unknown') }
    });
  }
}
