// /api/accounts.js
// Vercel Serverless Function dengan Domain + IP Validation
// Hanya bisa diakses oleh domain shinedomain.my.id & IP 114.8.223.223

// ===================== KONFIGURASI =====================
// Daftar domain yang diizinkan
const ALLOWED_DOMAINS = [
    'shinedomain.my.id',
    'www.shinedomain.my.id',
    'localhost',
    '127.0.0.1'
];

// Daftar IP yang diizinkan (tanpa port)
const ALLOWED_IPS = [
    '114.8.223.223',
    '::1', // localhost IPv6
    '127.0.0.1' // localhost IPv4
];

// Rate Limiting: maks 10 request per menit per IP
const RATE_LIMIT_WINDOW = 60000; // 1 menit
const RATE_LIMIT_MAX = 10;
const rateLimitStore = new Map();

// ===================== HELPER FUNCTIONS =====================

// Cek apakah IP ada di daftar yang diizinkan
function isIPAllowed(ip) {
    if (!ip) return false;
    // Bersihkan IP dari port jika ada
    const cleanIP = ip.split(':')[0];
    return ALLOWED_IPS.includes(cleanIP) || ALLOWED_IPS.includes(ip);
}

// Cek apakah domain ada di daftar yang diizinkan
function isDomainAllowed(origin) {
    if (!origin) return false;
    return ALLOWED_DOMAINS.some(domain => {
        return origin.includes(domain) || origin.endsWith(domain);
    });
}

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
    // ===== 1. AMBIL INFORMASI REQUEST =====
    const origin = req.headers.origin || '';
    const host = req.headers.host || '';
    const userAgent = req.headers['user-agent'] || '';
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress || 
                     '';

    // ===== 2. SET CORS HEADERS =====
    // Cek apakah origin diizinkan
    const isDomainValid = isDomainAllowed(origin) || isDomainAllowed(host);
    
    if (isDomainValid) {
        res.setHeader('Access-Control-Allow-Origin', origin || 'https://shinedomain.my.id');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        // Jika domain tidak diizinkan, tetap set tapi dengan origin yang valid
        res.setHeader('Access-Control-Allow-Origin', 'https://shinedomain.my.id');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 jam cache

    // ===== 3. HANDLE PREFLIGHT (OPTIONS) =====
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ===== 4. HANYA MENERIMA GET =====
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Hanya GET yang diizinkan.'
        });
    }

    // ===== 5. VALIDASI DOMAIN (KEAMANAN UTAMA 1) =====
    const isDomainValidStrict = isDomainAllowed(origin) || isDomainAllowed(host);
    
    if (!isDomainValidStrict && process.env.NODE_ENV === 'production') {
        console.warn(`🚫 [DOMAIN] Akses ditolak | Origin: ${origin} | Host: ${host} | IP: ${clientIp}`);
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Domain tidak terdaftar.',
            error: 'FORBIDDEN_DOMAIN'
        });
    }

    // ===== 6. VALIDASI IP (KEAMANAN UTAMA 2) =====
    const isIPValid = isIPAllowed(clientIp);
    
    if (!isIPValid && process.env.NODE_ENV === 'production') {
        console.warn(`🚫 [IP] Akses ditolak | IP: ${clientIp} | Origin: ${origin}`);
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. IP Address tidak terdaftar.',
            error: 'FORBIDDEN_IP'
        });
    }

    // ===== 7. RATE LIMITING =====
    if (!checkRateLimit(clientIp)) {
        console.warn(`⏳ [RATE LIMIT] Terlalu banyak request | IP: ${clientIp}`);
        return res.status(429).json({
            success: false,
            message: 'Terlalu banyak request. Silakan coba lagi dalam 1 menit.',
            error: 'RATE_LIMIT_EXCEEDED'
        });
    }

    // ===== 8. AMBIL DATA DARI ENVIRONMENT VARIABLE =====
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

        // ===== 9. LOG AKSES (untuk monitoring) =====
        console.log(`✅ Akses diizinkan | IP: ${clientIp} | Domain: ${origin || host} | Total Akun: ${accounts.length}`);
        console.log(`📋 User-Agent: ${userAgent.substring(0, 100)}`);

        // ===== 10. KIRIM RESPONSE =====
        return res.status(200).json({
            success: true,
            accounts: accounts,
            total: accounts.length,
            timestamp: new Date().toISOString(),
            request_info: {
                ip: clientIp ? clientIp.split(',')[0].trim() : 'unknown',
                domain: origin || host || 'unknown',
                allowed_domain: isDomainValidStrict,
                allowed_ip: isIPValid
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
