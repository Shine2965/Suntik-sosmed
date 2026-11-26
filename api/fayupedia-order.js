/**
 * POST /api/fayupedia-order
 * Body: { service, target, quantity, custom_comments? }
 * Env: FAYUPEDIA_API_KEY, FAYUPEDIA_API_ID
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body); return;
    }
    if (typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body || '{}')); } catch (_) { resolve({}); }
      return;
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) raw = raw.slice(0, 1e6); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST') return send(res, 405, { success: false, message: 'POST only' });

    const API_KEY = (process.env.FAYUPEDIA_API_KEY || '').trim();
    const API_ID = parseInt(process.env.FAYUPEDIA_API_ID || '0', 10) || 0;
    if (!API_KEY || !API_ID) {
      return send(res, 500, {
        success: false,
        message: 'ENV FAYUPEDIA_API_KEY / FAYUPEDIA_API_ID belum di-set di Vercel'
      });
    }

    const body = await readBody(req);
    const service = body.service || body.service_id || body.serviceId;
    const target = body.target || body.link || '';
    const quantity = parseInt(body.quantity || body.jumlah || 0, 10) || 0;
    const comments = body.custom_comments || body.comments || body.comment || '';

    if (!service || !target || quantity <= 0) {
      return send(res, 400, { success: false, message: 'service, target, quantity wajib' });
    }

    const payload = {
      api_id: API_ID,
      api_key: API_KEY,
      service: service,
      target: target,
      quantity: quantity
    };
    if (comments) payload.custom_comments = comments;

    const r = await fetch('https://fayupedia.id/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    if (!r.ok) {
      return send(res, 502, { success: false, message: 'Fayupedia HTTP ' + r.status, raw: text.slice(0, 300) });
    }
    // normalize
    const orderId =
      (json && (json.order_id || json.id || (json.data && (json.data.order_id || json.data.id)))) || null;
    const ok = !!(json && (json.status === true || json.status === 'success' || orderId));
    return send(res, 200, {
      success: ok,
      order_id: orderId,
      provider: 'fayupedia',
      raw: json || { text: text.slice(0, 500) }
    });
  } catch (e) {
    return send(res, 500, { success: false, message: e.message || String(e) });
  }
};
