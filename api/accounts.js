// /api/accounts.js
// Vercel Serverless Function untuk membaca environment variable

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Hanya menerima GET
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    try {
        // Ambil data dari environment variable Vercel
        // Format: JSON string dari accounts
        const accountsEnv = process.env.ACCOUNTS_DATA;
        
        if (!accountsEnv) {
            return res.status(500).json({
                success: false,
                message: 'ACCOUNTS_DATA environment variable not set'
            });
        }

        // Parse JSON dari environment variable
        let accounts = [];
        try {
            accounts = JSON.parse(accountsEnv);
        } catch (parseError) {
            return res.status(500).json({
                success: false,
                message: 'Invalid JSON format in ACCOUNTS_DATA'
            });
        }

        if (!Array.isArray(accounts)) {
            return res.status(500).json({
                success: false,
                message: 'ACCOUNTS_DATA must be an array'
            });
        }

        // Kirim response sukses
        return res.status(200).json({
            success: true,
            accounts: accounts,
            total: accounts.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in /api/accounts:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
};
