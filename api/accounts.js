// /api/accounts.js
// Vercel Serverless Function - Tanpa Domain & IP Validation

// ===================== KONFIGURASI =====================
// Rate Limiting: maks 10 request per menit per IP
const RATE_LIMIT_WINDOW = 60000; // 1 menit
const RATE_LIMIT_MAX = 10;
const rateLimitStore = new Map();

// ===================== HELPER FUNCTIONS =====================

// Cek rate limit
function checkRateLimit(ip) {
    if (!ip) return true; // Skip rate limit jika IP tidak diketahui
    
    const now = Date.now();
    const key = ip.split(':')[0]; // Bersihkan IP dari port
    
    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, []);
    }
    
    const timestamps = rateLimitStore.get(key);
    // Hapus timestamp yang sudah lewat window
    const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    
    // Cek apakah melebihi batas
    if (validTimestamps.length >= RATE_LIMIT_MAX) {
        return false;
    }
    
    // Tambahkan timestamp baru
    validTimestamps.push(now);
    rateLimitStore.set(key, validTimestamps);
    return true;
}

// Bersihkan rate limit store setiap 5 menit
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of rateLimitStore) {
        const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (valid.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, valid);
        }
    }
}, 300000); // 5 menit

// ===================== MAIN HANDLER =====================
export default function handler(req, res) {
    // ===== 1. SET CORS HEADERS =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 jam cache

    // ===== 2. HANDLE PREFLIGHT (OPTIONS) =====
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ===== 3. HANYA MENERIMA GET =====
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Hanya GET yang diizinkan.'
        });
    }

    // ===== 4. AMBIL INFORMASI REQUEST =====
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress || 
                     '';

    // ===== 5. RATE LIMITING =====
    if (!checkRateLimit(clientIp)) {
        console.warn(`⏳ [RATE LIMIT] Terlalu banyak request | IP: ${clientIp}`);
        return res.status(429).json({
            success: false,
            message: 'Terlalu banyak request. Silakan coba lagi dalam 1 menit.',
            error: 'RATE_LIMIT_EXCEEDED'
        });
    }

    // ===== 6. AMBIL DATA DARI ENVIRONMENT VARIABLE =====
    try {
        const accountsEnv = process.env.ACCOUNTS_DATA;
        
        if (!accountsEnv) {
            console.error('❌ ACCOUNTS_DATA tidak ditemukan di environment');
            return res.status(500).json({
                success: false,
                message: 'Data tidak ditemukan. Hubungi admin.',
                error: 'DATA_NOT_FOUND'
            });
        }

        // Parse data
        let accounts;
        try {
            accounts = JSON.parse(accountsEnv);
        } catch (parseError) {
            console.error('❌ Gagal parse ACCOUNTS_DATA:', parseError);
            return res.status(500).json({
                success: false,
                message: 'Format data tidak valid. Hubungi admin.',
                error: 'INVALID_DATA_FORMAT'
            });
        }

        if (!Array.isArray(accounts)) {
            return res.status(500).json({
                success: false,
                message: 'Data harus berupa array. Hubungi admin.',
                error: 'INVALID_DATA_TYPE'
            });
        }

        // ===== 7. LOG AKSES (untuk monitoring) =====
        console.log(`✅ Akses diizinkan | IP: ${clientIp} | Total Akun: ${accounts.length}`);

        // ===== 8. KIRIM RESPONSE =====
        return res.status(200).json({
            success: true,
            accounts: accounts,
            total: accounts.length,
            timestamp: new Date().toISOString(),
            request_info: {
                ip: clientIp ? clientIp.split(',')[0].trim() : 'unknown'
            }
        });

    } catch (error) {
        console.error('❌ Error internal:', error);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server.',
            error: 'INTERNAL_SERVER_ERROR'
        });
    }
}

// ===================== EXPORT UNTUK VERCEL =====================
export const config = {
    api: {
        bodyParser: false,
        externalResolver: true
    }
};
