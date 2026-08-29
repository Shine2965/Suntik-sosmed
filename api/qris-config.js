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

        // ===== ORDER SOSMED CONFIG =====
        const orderApiId = parseInt(process.env.ORDER_API_ID || process.env.ORDERSOSMED_API_ID) || 11313;
        const orderApiKey = process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY || '23941803d5391da4e45a1bf4ebca52064fa17a53574d1c3655a0173dd7530fb1';
        const orderSecretKey = process.env.ORDER_SECRET_KEY || process.env.ORDERSOSMED_SECRET_KEY || 'Alvino11';

        // ===== LEGACY (opsional, jika masih dipakai) =====
        const fayupediaApiKey = process.env.FAYUPEDIA_API_KEY || '';
        const fayupediaApiId = parseInt(process.env.FAYUPEDIA_API_ID) || 5522;
        const irvankardeApiKey = process.env.IRVANKARDE_API_KEY || '';
        const irvankardeApiId = parseInt(process.env.IRVANKARDE_API_ID) || 81074;
        
        // ===== RESPONSE =====
        // Catatan: order_api_key & secret TIDAK dikirim ke frontend (aman).
        // Order dilakukan via proxy /api/create-order
        return res.status(200).json({
            success: true,
            qiospay_api_key: qiospayApiKey,
            merchant_code: merchantCode,
            // Hanya kirim ID (bukan key) ke frontend
            order_api_id: orderApiId,
            // Legacy
            fayupedia_api_key: fayupediaApiKey,
            fayupedia_api_id: fayupediaApiId,
            irvankarde_api_key: irvankardeApiKey,
            irvankarde_api_id: irvankardeApiId,
            from_env: {
                qiospay: !!process.env.QIOSPAY_API_KEY,
                order: !!(process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY),
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
