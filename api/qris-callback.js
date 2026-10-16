// /api/qris-callback.js
// Endpoint callback dari QiosPay
// Set di dashboard QiosPay: https://shinedomain.my.id/api/qris-callback
// Secret key: gunakan env CALLBACK_SECRET_KEY

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const secret = process.env.CALLBACK_SECRET_KEY || 'Alvino11';
        
        // Verifikasi secret dari query atau header
        const providedSecret = req.query.secret || req.headers['x-secret-key'];
        if (providedSecret !== secret) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const payload = req.body || {};
        console.log('📥 QRIS Callback:', JSON.stringify(payload));

        // Simpan log ke memory (di produksi gunakan database)
        // Frontend akan polling /api/mutasi untuk konfirmasi,
        // jadi callback ini hanya untuk logging/backup.
        
        return res.status(200).json({
            success: true,
            message: 'Callback received',
            received_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Callback error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
