/**
 * POST/GET /api/syahpay-deposit-status
 * Body: { invoice_id, deposit_id? }
 * Jika SyahPay status=paid → kredit saldo (amount + cashback_unique) + mutasi + tandai paid/success
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET') {
      const u = new URL(req.url || '/', 'http://localhost');
      resolve({
        invoice_id: u.searchParams.get('invoice_id') || '',
        deposit_id: u.searchParams.get('deposit_id') || ''
      });
      return;
    }
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function sb(url, key, path, opts) {
  const r = await fetch(url.replace(/\/$/, '') + path, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts && opts.headers)
    }
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { ok: r.ok, status: r.status, json, text };
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method !== 'POST' && req.method !== 'GET') {
      return send(res, 405, { success: false, message: 'POST/GET only' });
    }

    const API_KEY = (process.env.SYAHPAY_API_KEY || process.env.SYAHPAY_APIKEY || '').trim();
    const SUPABASE_URL = (
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      ''
    ).replace(/\/$/, '');
    const SUPABASE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!API_KEY) {
      return send(res, 500, { success: false, message: 'SYAHPAY_API_KEY belum di-set' });
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return send(res, 500, {
        success: false,
        message: 'SUPABASE_URL / SERVICE_ROLE_KEY belum di-set di Vercel'
      });
    }

    const body = await readBody(req);
    const invoiceId = String(body.invoice_id || '').trim();
    const depositId = String(body.deposit_id || '').trim();
    if (!invoiceId) {
      return send(res, 400, { success: false, message: 'invoice_id wajib' });
    }

    // 1) Status dari SyahPay
    const stUrl =
      'https://syahpay.biz.id/api/invoice/status?invoice_id=' + encodeURIComponent(invoiceId);
    const r = await fetch(stUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': API_KEY,
        Authorization: 'Bearer ' + API_KEY
      }
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}
    if (!r.ok || !json) {
      return send(res, 502, {
        success: false,
        message: 'SyahPay status HTTP ' + r.status + ': ' + text.slice(0, 200)
      });
    }

    const status = String(json.status || '').toLowerCase();

    // 2) Ambil deposit row
    let dep = null;
    if (depositId) {
      const q = await sb(
        SUPABASE_URL,
        SUPABASE_KEY,
        '/rest/v1/deposits?id=eq.' + encodeURIComponent(depositId) + '&select=*&limit=1',
        { method: 'GET' }
      );
      if (Array.isArray(q.json) && q.json[0]) dep = q.json[0];
    }
    if (!dep) {
      const q2 = await sb(
        SUPABASE_URL,
        SUPABASE_KEY,
        '/rest/v1/deposits?invoice_number=eq.' +
          encodeURIComponent(invoiceId) +
          '&select=*&order=created_at.desc&limit=1',
        { method: 'GET' }
      );
      if (Array.isArray(q2.json) && q2.json[0]) dep = q2.json[0];
    }

    let credited = false;
    let creditDetail = null;
    let newBalance = null;

    if (status === 'paid' && dep) {
      const already =
        dep.balance_credited === true ||
        dep.status === 'success' ||
        dep.status === 'completed' ||
        (dep.status === 'paid' && dep.balance_credited === true);

      if (already && dep.balance_credited === true) {
        credited = true;
        creditDetail = { already_credited: true };
      } else {
        // Kredit: amount + cashback 10% unique
        const baseAmt = Math.floor(Number(dep.amount) || 0);
        const cashback =
          Math.floor(Number(dep.cashback_unique) || 0) ||
          Math.floor((Number(dep.unique_code) || 0) * 0.1);
        const creditAmt = baseAmt + cashback;

        // A) Coba RPC complete_deposit (beberapa signature)
        const rpcBodies = [
          {
            p_deposit_id: dep.id,
            p_user_id: dep.user_id,
            p_amount: creditAmt,
            p_invoice: invoiceId,
            p_provider: 'syahpay'
          },
          { p_deposit_id: dep.id },
          { deposit_id: dep.id },
          { p_id: dep.id }
        ];
        let rpcOk = false;
        for (const rb of rpcBodies) {
          const rpc = await sb(SUPABASE_URL, SUPABASE_KEY, '/rest/v1/rpc/complete_deposit', {
            method: 'POST',
            body: JSON.stringify(rb)
          });
          if (rpc.ok && rpc.json && (rpc.json.success === true || rpc.json === true)) {
            rpcOk = true;
            credited = true;
            creditDetail = rpc.json;
            newBalance = rpc.json.new_balance;
            break;
          }
          creditDetail = { rpc_try: rb, result: rpc.json || rpc.text };
        }

        // B) Fallback langsung update balance (service role)
        if (!rpcOk && creditAmt > 0 && dep.user_id) {
          const pr = await sb(
            SUPABASE_URL,
            SUPABASE_KEY,
            '/rest/v1/profiles?id=eq.' + encodeURIComponent(dep.user_id) + '&select=id,balance,email',
            { method: 'GET' }
          );
          const profile = Array.isArray(pr.json) && pr.json[0] ? pr.json[0] : null;
          if (profile) {
            const before = Number(profile.balance) || 0;
            const after = before + creditAmt;

            // Bypass trigger: coba RPC admin/internal dulu
            const bypassRpcs = [
              {
                path: '/rest/v1/rpc/admin_credit_balance',
                body: {
                  p_user_id: dep.user_id,
                  p_amount: creditAmt,
                  p_note: 'Deposit SyahPay ' + invoiceId
                }
              },
              {
                path: '/rest/v1/rpc/secure_credit_balance',
                body: {
                  p_user_id: dep.user_id,
                  p_amount: creditAmt,
                  p_reason: 'deposit_syahpay',
                  p_ref: invoiceId
                }
              }
            ];
            let creditedVia = null;
            for (const br of bypassRpcs) {
              const rr = await sb(SUPABASE_URL, SUPABASE_KEY, br.path, {
                method: 'POST',
                body: JSON.stringify(br.body)
              });
              if (rr.ok && rr.json && rr.json.success !== false) {
                creditedVia = br.path;
                credited = true;
                break;
              }
            }

            if (!credited) {
              // Direct PATCH — butuh service role + mungkin disable trigger
              const up = await sb(
                SUPABASE_URL,
                SUPABASE_KEY,
                '/rest/v1/profiles?id=eq.' + encodeURIComponent(dep.user_id),
                {
                  method: 'PATCH',
                  headers: {
                    Prefer: 'return=representation',
                    'X-Balance-Write': '1'
                  },
                  body: JSON.stringify({ balance: after })
                }
              );
              if (up.ok) {
                credited = true;
                creditedVia = 'direct_patch';
                newBalance = after;
              } else {
                creditDetail = {
                  error: 'patch_failed',
                  status: up.status,
                  body: up.json || up.text
                };
              }
            }

            if (credited) {
              newBalance = newBalance != null ? newBalance : after;
              // mutasi
              await sb(SUPABASE_URL, SUPABASE_KEY, '/rest/v1/balance_mutations', {
                method: 'POST',
                body: JSON.stringify({
                  user_id: dep.user_id,
                  email: dep.email || profile.email,
                  amount: creditAmt,
                  type: 'deposit',
                  note:
                    'Deposit SyahPay paid' +
                    (cashback ? ' +cashback ' + cashback : '') +
                    ' inv ' +
                    invoiceId,
                  balance_before: before,
                  balance_after: after
                })
              });
              // mark deposit
              await sb(
                SUPABASE_URL,
                SUPABASE_KEY,
                '/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id),
                {
                  method: 'PATCH',
                  body: JSON.stringify({
                    status: 'paid',
                    balance_credited: true,
                    paid_at: new Date().toISOString(),
                    paid_amount: json.total || dep.total_amount
                  })
                }
              );
              creditDetail = {
                via: creditedVia || 'fallback',
                amount: creditAmt,
                cashback: cashback,
                balance_before: before,
                balance_after: after
              };
            }
          } else {
            creditDetail = { error: 'profile_not_found', user_id: dep.user_id };
          }
        } else if (rpcOk) {
          await sb(
            SUPABASE_URL,
            SUPABASE_KEY,
            '/rest/v1/deposits?id=eq.' + encodeURIComponent(dep.id),
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'paid',
                balance_credited: true,
                paid_at: new Date().toISOString()
              })
            }
          );
        }
      }
    } else if (status === 'paid' && !dep) {
      creditDetail = { error: 'deposit_row_not_found', invoice_id: invoiceId };
    }

    return send(res, 200, {
      success: true,
      invoice_id: invoiceId,
      status: status,
      amount: json.amount,
      fee: json.fee,
      total: json.total,
      qris_image: json.qris_image,
      payment_link: json.payment_link,
      expired_at: json.expired_at,
      credited: credited,
      credit_detail: creditDetail,
      new_balance: newBalance,
      deposit_id: dep ? dep.id : null
    });
  } catch (e) {
    return send(res, 500, {
      success: false,
      message: 'FUNCTION_ERROR: ' + (e && e.message ? e.message : String(e))
    });
  }
};
