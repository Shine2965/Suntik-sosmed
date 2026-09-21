// /api/qris-config.js
// Vercel Serverless Function - Mengambil semua konfigurasi dari Environment Variable

export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        // ===== QIOSPAY CONFIG =====
        const qiospayApiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
        const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';

        // ===== INDOSMM CONFIG =====
        const indoApiKey = process.env.INDO_API_KEY || '4ed44f3cf37683ca04b27636f4a66ca5';

        // ===== ORDER SOSMED CONFIG (LEGACY) =====
        const orderApiId = parseInt(process.env.ORDER_API_ID || process.env.ORDERSOSMED_API_ID) || 11313;
        const orderApiKey = process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY || '';
        const orderSecretKey = process.env.ORDER_SECRET_KEY || process.env.ORDERSOSMED_SECRET_KEY || 'Alvino11';

        // ===== FAYUPEDIA CONFIG (TETAP ADA) =====
        const fayupediaApiKey = process.env.FAYUPEDIA_API_KEY || 'fbztdy-mv2vyz-eubpwc-mobrnb-4bqift';
        const fayupediaApiId = parseInt(process.env.FAYUPEDIA_API_ID) || 287358;

        // ===== IRVANKARDE CONFIG =====
        const irvankardeApiKey = process.env.IRVANKARDE_API_KEY || '';
        const irvankardeApiId = parseInt(process.env.IRVANKARDE_API_ID) || 81074;

        // ===== LOLLIPOP CONFIG =====
        const lollipopApiKey = process.env.LOLLIPOP_API_KEY || 'f02e52d385961e16764fb7ff248487e7';

        // ===== DISCORD WEBHOOK CONFIG =====
        // Diambil dari ENV. Fallback ke webhook default jika ENV tidak diset.
        const discordWebhook = process.env.DISCORD_WEBHOOK_URL 
            || process.env.DISCORD_WEBHOOK 
            || 'https://discord.com/api/webhooks/1482244992725553164/k6boQq7vBc3184RxiPtG6-obIKDZQWBu0f8cHQnLTevnwo8wFuaUKzhWzRkJ3Hl0_yne';

        // ===== RESPONSE =====
        return res.status(200).json({
            success: true,
            qiospay_api_key: qiospayApiKey,
            merchant_code: merchantCode,

            // ===== DISCORD =====
            discord_webhook_url: discordWebhook,

            // ===== INDOSMM =====
            indo_api_key: indoApiKey,

            // ===== LEGACY ORDER SOSMED =====
            order_api_id: orderApiId,

            // ===== FAYUPEDIA =====
            fayupedia_api_key: fayupediaApiKey,
            fayupedia_api_id: fayupediaApiId,

            // ===== IRVANKARDE =====
            irvankarde_api_key: irvankardeApiKey,
            irvankarde_api_id: irvankardeApiId,

            // ===== LOLLIPOP =====
            lollipop_api_key: lollipopApiKey,

            from_env: {
                qiospay: !!process.env.QIOSPAY_API_KEY,
                indo: !!process.env.INDO_API_KEY,
                order: !!(process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY),
                fayupedia: !!process.env.FAYUPEDIA_API_KEY,
                irvankarde: !!process.env.IRVANKARDE_API_KEY,
                lollipop: !!process.env.LOLLIPOP_API_KEY,
                discord: !!(process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK)
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
