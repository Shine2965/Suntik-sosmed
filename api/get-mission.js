// /api/get-missions.js
// Vercel Serverless Function - Mengambil data misi dari Vercel KV Storage

import { kv } from '@vercel/global-config';

export default async function handler(req, res) {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        const key = 'buzzer_missions';
        
        // Ambil data dari Vercel KV
        const data = await kv.get(key);
        
        if (!data) {
            // Jika belum ada data, kembalikan array kosong
            return res.status(200).json({
                success: true,
                missions: [],
                total: 0,
                message: 'Belum ada misi tersimpan',
                storage: 'Vercel KV',
                timestamp: new Date().toISOString()
            });
        }

        // Parse data
        let missions;
        try {
            missions = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (parseError) {
            // Jika data tidak bisa di-parse, coba ambil dari backup terakhir
            console.warn('⚠️ Data corrupt, mencoba backup...');
            const backupKeys = await kv.keys('buzzer_missions_backup_*');
            
            if (backupKeys.length > 0) {
                const latestBackup = backupKeys.sort().reverse()[0];
                const backupData = await kv.get(latestBackup);
                if (backupData) {
                    missions = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;
                    // Restore data utama
                    await kv.set(key, JSON.stringify(missions));
                    console.log(`✅ Data restored from backup: ${latestBackup}`);
                } else {
                    missions = [];
                }
            } else {
                missions = [];
            }
        }

        if (!Array.isArray(missions)) {
            missions = [];
        }

        console.log(`✅ Data misi dimuat: ${missions.length} misi`);

        return res.status(200).json({
            success: true,
            missions: missions,
            total: missions.length,
            storage: 'Vercel KV',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching missions:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil data: ' + error.message
        });
    }
}
