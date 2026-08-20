// /api/get-transaction.js
// Vercel Serverless Function - Mengambil data transaksi berdasarkan ID

export default async function handler(req, res) {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Hanya GET yang diizinkan.'
        });
    }

    try {
        const { trx } = req.query;

        if (!trx) {
            return res.status(400).json({
                success: false,
                message: 'Parameter trx wajib diisi.'
            });
        }

        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'public', 'info', 'transactions.json');

        // Baca data
        let transactions = [];
        try {
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf8');
                transactions = JSON.parse(raw);
            }
        } catch (e) {
            console.log('File transaksi belum ada');
        }

        // Cari transaksi
        const transaction = transactions.find(t => t.trx === trx);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaksi tidak ditemukan'
            });
        }

        return res.status(200).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        console.error('Error getting transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil data: ' + error.message
        });
    }
}
