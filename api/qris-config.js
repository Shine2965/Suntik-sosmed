// /api/qris-config.js
// Jangan hardcode secret production — pakai Vercel Environment Variables
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    return res.status(200).json({
      success: true,
      qiospay_api_key: process.env.QIOSPAY_API_KEY || '',
      merchant_code: process.env.QIOSPAY_MERCHANT_CODE || '',
      indo_api_key: process.env.INDO_API_KEY || '',
      juragan_api_key: process.env.JURAGAN_API_KEY || '',
      order_api_id: parseInt(process.env.ORDER_API_ID || process.env.ORDERSOSMED_API_ID) || 0,
      order_api_key: process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY || '',
      order_secret_key: process.env.ORDER_SECRET_KEY || process.env.ORDERSOSMED_SECRET_KEY || '',
      fayupedia_api_key: process.env.FAYUPEDIA_API_KEY || '',
      fayupedia_api_id: parseInt(process.env.FAYUPEDIA_API_ID) || 0,
      irvankarde_api_key: process.env.IRVANKARDE_API_KEY || '',
      irvankarde_api_id: parseInt(process.env.IRVANKARDE_API_ID) || 0,
      lollipop_api_key: process.env.LOLLIPOP_API_KEY || '',
      // Turnstile site key boleh publik; secret HANYA server
      turnstile_site_key: process.env.TURNSTILE_SITE_KEY || process.env.CF_TURNSTILE_SITE_KEY || '0x4AAAAAAFyGkydYQAkRFtCp',
      from_env: {
        qiospay: !!process.env.QIOSPAY_API_KEY,
        turnstile: !!(process.env.TURNSTILE_SITE_KEY || process.env.CF_TURNSTILE_SITE_KEY)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
