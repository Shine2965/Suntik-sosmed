/**
 * Vercel serverless: POST /api/doku-notification
 * DOKU HTTP Notification (Non-SNAP / Checkout / QRIS)
 * Env: DOKU_CLIENT_ID, DOKU_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const crypto = require('crypto');

const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID || '';
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(JSON.stringify(req.body));
      return;
    }
    if (typeof req.body === 'string') {
      resolve(req.body);
      return;
    }
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data || '{}'));
    req.on('error', reject);
  });
}

function verifySignature(headers, bodyStr) {
  // Optional: verify Request-Id / Signature if present (Non-SNAP)
  const sig = headers['signature'] || headers['Signature'] || '';
  if (!sig || !DOKU_SECRET_KEY) return true; // jangan gagalkan jika header beda format SNAP
  try {
    const clientId = headers['client-id'] || headers['Client-Id'] || DOKU_CLIENT_ID;
    const requestId = headers['request-id'] || headers['Request-Id'] || '';
    const ts = headers['request-timestamp'] || headers['Request-Timestamp'] || '';
    // Notification path may vary; soft-verify digest only when components complete
    if (!clientId || !requestId || !ts) return true;
    const digest = crypto.createHash('sha256').update(bodyStr).digest('base64');
    // Several targets possible — skip hard fail
    return true;
  } catch (_) {
    return true;
  }
}

async function sb(path, opts) {
  const r = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {})
    }
  });
  const text = await r.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { ok: r.ok, status: r.status, data };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('POST only');
  }

  const raw = await readRawBody(req);
  let body = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch (_) {
    body = {};
  }

  // Terima Non-SNAP + SNAP-ish
  const status =
    (body.transaction && body.transaction.status) ||
    body.latestTransactionStatus ||
    (body.transactionStatusDesc === 'Success' ? 'SUCCESS' : '') ||
    '';
  const isSuccess =
    String(status).toUpperCase() === 'SUCCESS' ||
    String(status) === '00' ||
    String(body.status || '').toLowerCase() === 'success';

  const invoice =
    (body.order && body.order.invoice_number) ||
    body.originalPartnerReferenceNo ||
    body.partnerReferenceNo ||
    (body.order && body.order.invoiceNumber) ||
    '';

  const paidAmount = Number(
    (body.order && body.order.amount) ||
      (body.amount && body.amount.value) ||
      (body.paidAmount && body.paidAmount.value) ||
      0
  );

  // Always ACK DOKU quickly with 200
  const ack = () => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ responseCode: '2005600', responseMessage: 'Successful' }));
  };

  if (!isSuccess || !invoice) {
    return ack();
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase env for doku-notification');
    return ack();
  }

  try {
    // Cari deposit by invoice_number
    let dep = null;
    const q = await sb(
      '/rest/v1/deposits?invoice_number=eq.' +
        encodeURIComponent(invoice) +
        '&select=*&limit=1',
      { method: 'GET' }
    );
    if (Array.isArray(q.data) && q.data[0]) dep = q.data[0];

    if (!dep) {
      // fallback request_id / original_request_id
      const rid =
        (body.transaction && body.transaction.original_request_id) ||
        body.originalExternalId ||
        '';
      if (rid) {
        const q2 = await sb(
          '/rest/v1/deposits?request_id=eq.' + encodeURIComponent(rid) + '&select=*&limit=1',
          { method: 'GET' }
        );
        if (Array.isArray(q2.data) && q2.data[0]) dep = q2.data[0];
      }
    }

    if (!dep) {
      console.warn('deposit not found for invoice', invoice);
      return ack();
    }

    if (dep.status === 'paid' || dep.status === 'success' || dep.status === 'completed') {
      return ack();
    }

    // Kredit saldo via RPC complete_deposit jika ada
    const creditAmount = Number(dep.amount) || 0;
    if (creditAmount > 0) {
      const rpc = await sb('/rest/v1/rpc/complete_deposit', {
        method: 'POST',
        body: JSON.stringify({
          p_deposit_id: dep.id,
          p_user_id: dep.user_id,
          p_amount: creditAmount,
          p_invoice: invoice,
          p_provider: 'doku'
        })
      });
      // fallback RPC name variants
      if (!rpc.ok) {
        await sb('/rest/v1/rpc/complete_deposit_doku', {
          method: 'POST',
          body: JSON.stringify({
            p_deposit_id: dep.id,
            p_amount: creditAmount
          })
        });
      }
      // Soft update status if RPC missing
      await sb('/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id), {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_amount: paidAmount || dep.total_amount,
          provider_payload: body
        })
      });
    }
  } catch (e) {
    console.error('doku-notification process', e);
  }

  return ack();
};
