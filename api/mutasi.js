// /api/mutasi.js
// Proxy untuk ambil mutasi QRIS dari QiosPay
// Frontend panggil: /api/mutasi?amount=51000

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const apiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
        const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';
        const targetAmount = parseInt(req.query.amount) || 0;

        // Fetch mutasi dari QiosPay
        const url = `https://qiospay.id/api/mutasi/qris/${merchantCode}/${apiKey}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`QiosPay HTTP ${response.status}`);
        }

        const data = await response.json();

        return res.status(200).json({
            success: true,
            target_amount: targetAmount,
            raw: data
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}
