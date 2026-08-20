// /api/save-transaction.js
// Vercel Serverless Function - Menyimpan data transaksi

export default async function handler(req, res) {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Hanya menerima POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Hanya POST yang diizinkan.'
        });
    }

    try {
        const data = req.body;

        if (!data || !data.trx) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap. Butuh trx ID.'
            });
        }

        // Simpan ke memory (atau bisa ke database/JSON)
        // Untuk production, gunakan database seperti Vercel KV, Supabase, atau file JSON
        // Di sini kita simpan ke file JSON sebagai contoh
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'public', 'info', 'transactions.json');

        // Baca data existing
        let transactions = [];
        try {
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf8');
                transactions = JSON.parse(raw);
            }
        } catch (e) {
            console.log('File transaksi belum ada, buat baru');
        }

        // Cek apakah sudah ada transaksi dengan ID yang sama
        const existingIndex = transactions.findIndex(t => t.trx === data.trx);
        if (existingIndex !== -1) {
            // Update data existing
            transactions[existingIndex] = {
                ...transactions[existingIndex],
                ...data,
                updatedAt: new Date().toISOString()
            };
        } else {
            // Tambahkan transaksi baru
            transactions.push({
                ...data,
                createdAt: new Date().toISOString(),
                status: 'pending'
            });
        }

        // Simpan ke file
        fs.writeFileSync(filePath, JSON.stringify(transactions, null, 2), 'utf8');

        return res.status(200).json({
            success: true,
            message: 'Transaksi berhasil disimpan!',
            trx: data.trx,
            saved: true
        });

    } catch (error) {
        console.error('Error saving transaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan data: ' + error.message
        });
    }
}
