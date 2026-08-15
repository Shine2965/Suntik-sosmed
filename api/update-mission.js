// /api/update-mission.js
// Vercel Serverless Function - Update data misi (untuk history, dll)

import { kv } from '@vercel/global-config';

export default async function handler(req, res) {
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
        const { missionId, updates } = req.body;

        if (!missionId || !updates) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap. Butuh missionId dan updates.'
            });
        }

        const key = 'buzzer_missions';
        let data = await kv.get(key);
        
        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Data misi tidak ditemukan'
            });
        }

        let missions = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (!Array.isArray(missions)) {
            return res.status(500).json({
                success: false,
                message: 'Format data tidak valid'
            });
        }

        // Cari misi berdasarkan ID
        const index = missions.findIndex(m => m.id_misi === missionId);
        
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: `Misi dengan ID ${missionId} tidak ditemukan`
            });
        }

        // Update misi
        missions[index] = { ...missions[index], ...updates };
        
        // Simpan kembali ke KV
        await kv.set(key, JSON.stringify(missions));

        console.log(`✅ Misi diupdate: ${missionId}`);

        return res.status(200).json({
            success: true,
            message: 'Misi berhasil diupdate!',
            mission: missions[index],
            total: missions.length,
            storage: 'Vercel KV',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error updating mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal update data: ' + error.message
        });
    }
}
