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
        const qiospayApiKey = process.env.QIOSPAY_API_KEY || 'd1370635be9857299bde44b946c938655534efdff7ef5246685b67ef91decb1c';
        const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';

        // ===== FAYUPEDIA CONFIG =====
        const fayupediaApiKey = process.env.FAYUPEDIA_API_KEY || '';
        const fayupediaApiId = parseInt(process.env.FAYUPEDIA_API_ID) || 5522;

        // ===== IRVANKARDE SMM CONFIG =====
        const irvankardeApiKey = process.env.IRVANKARDE_API_KEY || 'qxy0j2-4rvp5g-fc0dxu-gdr7qp-xbqawa';
        const irvankardeApiId = parseInt(process.env.IRVANKARDE_API_ID) || 81074;
        const irvankardeApiUrl = process.env.IRVANKARDE_API_URL || 'https://irvankedesmm.co.id/api';

        // ===== RESPONSE =====
        return res.status(200).json({
            success: true,
            qiospay_api_key: qiospayApiKey,
            merchant_code: merchantCode,
            fayupedia_api_key: fayupediaApiKey,
            fayupedia_api_id: fayupediaApiId,
            irvankarde_api_key: irvankardeApiKey,
            irvankarde_api_id: irvankardeApiId,
            irvankarde_api_url: irvankardeApiUrl,
            from_env: {
                qiospay: !!process.env.QIOSPAY_API_KEY,
                fayupedia: !!process.env.FAYUPEDIA_API_KEY,
                irvankarde: !!process.env.IRVANKARDE_API_KEY
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
