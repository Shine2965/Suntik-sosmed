/**
 * /api/cekstatus.js
 * Backend proxy untuk Indosmm API
 * - Cek Status Order
 * - Create Refill
 * - Cek Refill Status
 *
 * Method: POST
 * Body (JSON):
 * {
 *   "action": "status" | "refill" | "refill_status",
 *   "order": "123"          // untuk single status / refill
 *   "orders": "123,456"     // untuk multiple
 *   "refill": "1"           // untuk single refill_status
 *   "refills": "1,2,3"      // untuk multiple refill_status
 * }
 */

const API_URL = 'https://indosmm.id/api/v2';
const API_KEY = 'a11570b88893e5d72b274539c98c1fba';

async function callIndosmm(params) {
  const body = new URLSearchParams({
    key: API_KEY,
    ...params
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString(),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        error: true,
        message: `HTTP ${res.status}`,
        status: res.status
      };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { error: true, message: 'Timeout - server terlalu lama merespons' };
    }
    return { error: true, message: err.message || 'Gagal menghubungi Indosmm' };
  }
}

// ===== Handler utama =====
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method Not Allowed. Gunakan POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { action } = body;

    if (!action) {
      return res.status(400).json({ error: true, message: 'Parameter action wajib diisi' });
    }

    let result;

    // ---------- STATUS ----------
    if (action === 'status') {
      if (body.order) {
        result = await callIndosmm({ action: 'status', order: String(body.order) });
      } else if (body.orders) {
        result = await callIndosmm({ action: 'status', orders: String(body.orders) });
      } else {
        return res.status(400).json({ error: true, message: 'Parameter order atau orders wajib diisi' });
      }
    }

    // ---------- CREATE REFILL ----------
    else if (action === 'refill') {
      if (body.order) {
        result = await callIndosmm({ action: 'refill', order: String(body.order) });
      } else if (body.orders) {
        result = await callIndosmm({ action: 'refill', orders: String(body.orders) });
      } else {
        return res.status(400).json({ error: true, message: 'Parameter order atau orders wajib diisi' });
      }
    }

    // ---------- REFILL STATUS ----------
    else if (action === 'refill_status') {
      if (body.refill) {
        result = await callIndosmm({ action: 'refill_status', refill: String(body.refill) });
      } else if (body.refills) {
        result = await callIndosmm({ action: 'refill_status', refills: String(body.refills) });
      } else {
        return res.status(400).json({ error: true, message: 'Parameter refill atau refills wajib diisi' });
      }
    }

    else {
      return res.status(400).json({
        error: true,
        message: 'Action tidak valid. Gunakan: status | refill | refill_status'
      });
    }

    // Kembalikan hasil dari Indosmm
    return res.status(200).json(result);

  } catch (err) {
    console.error('cekstatus error:', err);
    return res.status(500).json({
      error: true,
      message: err.message || 'Internal Server Error'
    });
  }
}

// Untuk CommonJS (jika diperlukan)
if (typeof module !== 'undefined') {
  module.exports = handler;
}
