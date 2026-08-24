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
        const qiospayApiKey = process.env.QIOSPAY_API_KEY || '';
        const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';

        // ===== FAYUPEDIA CONFIG =====
        const fayupediaApiKey = process.env.FAYUPEDIA_API_KEY || '';
        const fayupediaApiId = parseInt(process.env.FAYUPEDIA_API_ID) || 5522;

        // ===== ORDERSOSMED CONFIG (TAMBAHAN BARU) =====
        const ordersosmedApiKey = process.env.ORDERSOSMED_API_KEY || '';
        const ordersosmedApiId = parseInt(process.env.ORDERSOSMED_API_ID) || 11313;
        const ordersosmedSecretKey = process.env.ORDERSOSMED_SECRET_KEY || 'Alvino11';

        // ===== RESPONSE =====
        return res.status(200).json({
            success: true,
            qiospay_api_key: qiospayApiKey,
            merchant_code: merchantCode,
            fayupedia_api_key: fayupediaApiKey,
            fayupedia_api_id: fayupediaApiId,
            ordersosmed_api_key: ordersosmedApiKey,
            ordersosmed_api_id: ordersosmedApiId,
            ordersosmed_secret_key: ordersosmedSecretKey,
            from_env: {
                qiospay: !!process.env.QIOSPAY_API_KEY,
                fayupedia: !!process.env.FAYUPEDIA_API_KEY,
                ordersosmed: !!process.env.ORDERSOSMED_API_KEY
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
