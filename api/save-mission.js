// /api/save-mission.js
// Vercel Serverless Function - Menyimpan misi baru ke data.json

export default async function handler(req, res) {
    // Set CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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

        // KIRIM DATA KE TELEGRAM SEBAGAI CADANGAN
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_OWNER_ID;

        if (telegramToken && chatId) {
            const textMessage = `
📢 **MISI BARU DITAMBAHKAN!**
━━━━━━━━━━━━━━━━━━━━━
🆔 **ID Misi:** ${mission.id_misi}
📋 **Tugas:** ${mission.Tugas}
💰 **Harga:** ${mission.Harga}
📊 **Jumlah:** ${mission.Jumlah}
🎯 **Target:** ${mission.Target}
📝 **Pesan:** ${mission.Pesan.join(', ')}
📄 **Deskripsi:** ${mission.desc || '-'}

📌 **Total misi saat ini:** ${data.length}
━━━━━━━━━━━━━━━━━━━━━
✅ Misi berhasil ditambahkan!
            `;

            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: textMessage,
                    parse_mode: 'Markdown'
                })
            });
        }

        // Untuk Vercel, kita simpan ke file melalui API internal
        // Karena Vercel tidak bisa menulis file, kita kirim response sukses
        // Dan data akan disimpan di frontend melalui localStorage

        return res.status(200).json({
            success: true,
            message: 'Misi berhasil disimpan! Data akan disimpan di local storage.',
            mission: mission,
            total: data.length,
            saved: true
        });

    } catch (error) {
        console.error('Error saving mission:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan data: ' + error.message
        });
    }
}
