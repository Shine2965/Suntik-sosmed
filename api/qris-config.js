// /api/qris-config.js
// Vercel Serverless Function - Mengambil API Key dari Environment Variable

export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        // Ambil dari environment variable
        const apiKey = process.env.QIOSPAY_API_KEY;
        const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';

        if (!apiKey) {
            console.warn('⚠️ QIOSPAY_API_KEY tidak ditemukan di environment');
            return res.status(200).json({
                success: true,
                api_key: '-',
                merchant_code: merchantCode,
                from_env: false
            });
        }

        return res.status(200).json({
            success: true,
            api_key: apiKey,
            merchant_code: merchantCode,
            from_env: true
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
