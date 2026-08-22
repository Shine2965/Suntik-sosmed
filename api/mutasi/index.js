// /api/mutasi/index.js
// Vercel Serverless Function - Cek Mutasi QRIS

export default async function handler(req, res) {
    // ===== KONFIGURASI =====
    const MERCHANT_CODE = 'QP052692';
    const API_KEY = 'd1370635be9857299bde44b946c938655534efdff7ef5246685b67ef91decb1c';
    const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1482244989021851748/oq__kcKXWHJILOG96lbfFxfZKoKCLEqkLJrlSS_rTQ6YEhgSTnFL_Guu8ZulERNEmCZV';
    const TELEGRAM_CHAT_ID = '-1002112920606';

    // ===== HANYA MENERIMA GET =====
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        // ===== AMBIL DATA MUTASI DARI QIOSPAY =====
        const qiospayUrl = `https://qiospay.id/api/mutasi/qris/${MERCHANT_CODE}/${API_KEY}`;
        
        console.log('📡 Fetching mutasi dari Qiospay...');
        
        const response = await fetch(qiospayUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Qiospay API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Mutasi diterima dari Qiospay');

        // ===== FILTER TRANSAKSI YANG BELUM DIPROSES =====
        // Simpan riwayat transaksi yang sudah diproses di memory/file
        // Untuk production, gunakan database
        
        const processedTransactions = new Set();
        // Coba load dari environment variable atau memory
        try {
            const saved = process.env.PROCESSED_TRANSACTIONS || '';
            saved.split(',').forEach(id => {
                if (id) processedTransactions.add(id);
            });
        } catch(e) {}

        // ===== PROSES SETIAP TRANSAKSI =====
        const transactions = data.data || [];
        let processedCount = 0;

        for (const tx of transactions) {
            const orderId = tx.order_id || tx.id || '';
            
            // Skip jika sudah diproses
            if (processedTransactions.has(orderId)) continue;

            // Cek status sukses
            if (tx.status === 'success' || tx.status === 'paid' || tx.status === 'settlement') {
                // ===== KIRIM NOTIFIKASI KE DISCORD =====
                const message = `
💰 **PEMBAYARAN QRIS TERDETEKSI!**
━━━━━━━━━━━━━━━━━━━━━
🆔 **Order ID:** ${orderId}
💵 **Nominal:** Rp ${(parseInt(tx.amount) || 0).toLocaleString('id-ID')}
📅 **Tanggal:** ${tx.created_at || '-'}
🔄 **Status:** ✅ SUCCESS
📱 **Metode:** QRIS
━━━━━━━━━━━━━━━━━━━━━
🔔 Pembayaran terverifikasi secara otomatis!
                `;

                await fetch(DISCORD_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: message
                    })
                });

                // Kirim ke Telegram
                await fetch('/api/send-telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        text: message
                    })
                });

                // Tandai sebagai sudah diproses
                processedTransactions.add(orderId);
                processedCount++;
                console.log(`✅ Transaksi ${orderId} diproses (auto-verified)`);
            }
        }

        // Update processed transactions ke environment (tidak bisa di Vercel)
        // Untuk production, gunakan database

        return res.status(200).json({
            success: true,
            message: 'Mutasi checked successfully',
            total_transactions: transactions.length,
            processed_count: processedCount,
            data: data
        });

    } catch (error) {
        console.error('❌ Mutasi error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}
