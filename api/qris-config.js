/**
 * GET /api/qris-config
 *  - default: public config (Fayupedia/Lollipop dari ENV)
 *  - ?action=health | /api/qris-config?health=1 : health ping
 *
 * Dihapus: qiospay, indo, irvankarde, order (ordersosmed).
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ success: false, message: 'GET only' }));
  }

  try {
    const q = req.query || {};
    const action = String(q.action || q.health || '').toLowerCase();
    const isHealth =
      action === 'health' ||
      action === 'ping' ||
      action === '1' ||
      q.health === '1' ||
      q.health === 'true';

    if (isHealth) {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          success: true,
          ok: true,
          service: 'shine-shop-api',
          route: '/api/qris-config',
          routes: [
            '/api/qris-config',
            '/api/qris-config?action=health',
            '/api/orders',
            '/api/syahpay-deposit-create',
            '/api/syahpay-deposit-status'
          ],
          from_env: {
            fayupedia: !!process.env.FAYUPEDIA_API_KEY,
            lollipop: !!process.env.LOLLIPOP_API_KEY,
            juragan: !!process.env.JURAGAN_API_KEY,
            syahpay: !!(process.env.SYAHPAY_API_KEY || process.env.SYAHPAY_APIKEY),
            supabase: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
          },
          time: new Date().toISOString()
        })
      );
    }

    const body = {
      success: true,
      fayupedia_api_key: process.env.FAYUPEDIA_API_KEY || '',
      fayupedia_api_id: parseInt(process.env.FAYUPEDIA_API_ID || '0', 10) || 0,
      lollipop_api_key: process.env.LOLLIPOP_API_KEY || '',
      juragan_api_key: process.env.JURAGAN_API_KEY || '',
      turnstile_site_key:
        process.env.TURNSTILE_SITE_KEY ||
        process.env.CF_TURNSTILE_SITE_KEY ||
        '0x4AAAAAAFyGkydYQAkRFtCp',
      from_env: {
        fayupedia: !!process.env.FAYUPEDIA_API_KEY,
        lollipop: !!process.env.LOLLIPOP_API_KEY,
        juragan: !!process.env.JURAGAN_API_KEY,
        turnstile: !!(process.env.TURNSTILE_SITE_KEY || process.env.CF_TURNSTILE_SITE_KEY)
      },
      // legacy kosong
      qiospay_api_key: '',
      merchant_code: '',
      indo_api_key: '',
      irvankarde_api_key: '',
      irvankarde_api_id: 0,
      order_api_id: 0,
      order_api_key: '',
      order_secret_key: ''
    };
    res.statusCode = 200;
    res.end(JSON.stringify(body));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: 'Internal server error' }));
  }
};
