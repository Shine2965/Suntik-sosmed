// /api/save-mission.js
// Vercel Serverless Function - Menyimpan misi baru ke Vercel KV Storage

import { kv } from '@vercel/global-config';

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

        // ===== SIMPAN KE VERCEL KV =====
        const key = 'buzzer_missions';
        
        // Simpan seluruh data misi ke KV
        await kv.set(key, JSON.stringify(data));
        
        // Simpan juga sebagai backup dengan timestamp
        await kv.set(`${key}_backup_${Date.now()}`, JSON.stringify(data));

        // Log aktivitas
        console.log(`✅ Misi baru disimpan: ${mission.id_misi} - ${mission.Tugas}`);
        console.log(`📊 Total misi: ${data.length}`);

        return res.status(200).json({
            success: true,
            message: 'Misi berhasil disimpan!',
            mission: mission,
            total: data.length,
            storage: 'Vercel KV',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error saving mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan data: ' + error.message
        });
    }
}
