// /api/config.js
// Vercel Serverless Function - Mengambil konfigurasi dari ENV

export default function handler(req, res) {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

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
        const telegramToken = process.env.TELEGRAM_TOKEN;
        const ownerId = process.env.OWNER_ID;

        if (!telegramToken || !ownerId) {
            return res.status(500).json({
                success: false,
                message: 'Konfigurasi Telegram tidak ditemukan di environment'
            });
        }

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
