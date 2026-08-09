// /api/config.js
// Vercel Serverless Function untuk mengambil Telegram Config dari ENV

export default function handler(req, res) {
    // ===== 1. SET CORS HEADERS =====
    res.setHeader('Access-Control-Allow-Origin', 'https://shinedomain.my.id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    // ===== 2. HANDLE PREFLIGHT =====
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ===== 3. HANYA MENERIMA GET =====
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    // ===== 4. AMBIL DARI ENVIRONMENT VARIABLE =====
    try {
        const telegramToken = process.env.TELEGRAM_TOKEN;
        const ownerId = process.env.OWNER_ID;

        if (!telegramToken || !ownerId) {
            return res.status(500).json({
                success: false,
                message: 'TELEGRAM_TOKEN atau OWNER_ID tidak ditemukan di environment'
            });
        }

        // ===== 5. KIRIM RESPONSE =====
        return res.status(200).json({
            success: true,
            telegram_token: telegramToken,
            owner_id: ownerId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
