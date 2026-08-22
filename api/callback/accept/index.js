// /api/callback/accept/{secret_key}/index.js
// Vercel Serverless Function - Callback QRIS Auto-Verifikasi

export default async function handler(req, res) {
    // ===== KONFIGURASI =====
    const SECRET_KEY = 'd1370635be9857299bde44b946c938655534efdff7ef5246685b67ef91decb1c';
    const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1482244989021851748/oq__kcKXWHJILOG96lbfFxfZKoKCLEqkLJrlSS_rTQ6YEhgSTnFL_Guu8ZulERNEmCZV';
    const TELEGRAM_CHAT_ID = '-1002112920606';
    const WHATSAPP_NUMBER = '6289518103883';

    // ===== HANYA MENERIMA POST =====
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    // ===== VALIDASI SECRET KEY =====
    const { secret_key } = req.query;
    if (secret_key !== SECRET_KEY) {
        console.warn('❌ Callback: Secret key tidak valid');
        return res.status(403).json({
            success: false,
            message: 'Invalid secret key'
        });
    }

    try {
        // ===== AMBIL DATA CALLBACK =====
        const callbackData = req.body;
        console.log('📩 Callback diterima:', JSON.stringify(callbackData, null, 2));

        // ===== VALIDASI DATA =====
        const {
            status,
            order_id,
            amount,
            merchant_code,
            payment_method,
            transaction_id,
            customer_name,
            customer_email,
            payment_time
        } = callbackData;

        // Cek apakah status sukses
        if (status !== 'success' && status !== 'paid' && status !== 'settlement') {
            console.log(`ℹ️ Status bukan sukses: ${status}`);
            return res.status(200).json({
                success: true,
                message: 'Status not success, ignoring'
            });
        }

        // ===== EKSTRAK DATA DARI order_id =====
        // Format order_id: TRX123456789_username_platform
        const parts = order_id ? order_id.split('_') : [];
        const trx = parts[0] || order_id || '-';
        const userRef = parts[1] || '-';
        const platform = parts[2] || 'sosmed-2';

        // ===== AMBIL DATA TRANSAKSI DARI LOCAL STORAGE ATAU DATABASE =====
        // Untuk Vercel, kita simpan di memory atau gunakan file sementara
        // Sebaiknya gunakan database untuk production
        
        // Kirim notifikasi ke Discord
        const discordMessage = `
💰 **PEMBAYARAN OTOMATIS TERDETEKSI!**
━━━━━━━━━━━━━━━━━━━━━
🆔 **ID Transaksi:** ${trx}
📋 **Layanan:** ${callbackData.product_name || '-'}
💵 **Total Bayar:** Rp ${(parseInt(amount) || 0).toLocaleString('id-ID')}
📧 **Email:** ${customer_email || '-'}
👤 **Customer:** ${customer_name || '-'}
📅 **Waktu:** ${payment_time || new Date().toISOString()}
🔄 **Status:** ✅ SUCCESS (Auto-Verified)
━━━━━━━━━━━━━━━━━━━━━
🔔 Pembayaran terverifikasi secara otomatis!
        `;

        // Kirim ke Discord
        await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: discordMessage
            })
        });

        // Kirim ke Telegram
        await fetch('/api/send-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: discordMessage
            })
        });

        console.log(`✅ Callback processed: ${trx} - ${status}`);

        // ===== RESPON KE QIOSPAY =====
        return res.status(200).json({
            success: true,
            message: 'Callback processed successfully',
            order_id: order_id,
            status: 'verified'
        });

    } catch (error) {
        console.error('❌ Callback error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
          }
