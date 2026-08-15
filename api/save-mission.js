// /api/save-mission.js
// Vercel Serverless Function - Menyimpan misi baru ke data.json

const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Hanya POST yang diizinkan.'
        });
    }

    try {
        const { data, mission } = req.body;

        if (!data || !mission) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap. Butuh data dan mission.'
            });
        }

        // Path ke file data.json
        // Untuk Vercel, kita menggunakan /tmp karena tidak bisa menulis ke filesystem
        // Untuk production, sebaiknya gunakan database atau storage
        const filePath = path.join(process.cwd(), '/', 'info', 'buzzer', 'data.json');

        // Tulis data ke file
        // Note: Di Vercel, ini hanya akan bekerja di development
        // Untuk production, gunakan database atau Vercel KV
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');

        return res.status(200).json({
            success: true,
            message: 'Misi berhasil disimpan!',
            mission: mission,
            total: data.length
        });

    } catch (error) {
        console.error('Error saving mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan data: ' + error.message
        });
    }
}
