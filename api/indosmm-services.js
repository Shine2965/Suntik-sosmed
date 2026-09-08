// /api/indosmm-services.js
// Vercel Serverless Function - Proxy ke Indosmm API v2/services
// Mengambil daftar layanan, markup harga 8%, group by category

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            status: false,
            msg: 'Method not allowed'
        });
    }

    try {
        // ===== AMBIL API KEY DARI ENVIRONMENT =====
        const apiKey = process.env.INDO_API_KEY || 'a1174c530b97e1bc0a7eec7baff3ac6e';

        if (!apiKey) {
            console.error('❌ INDO_API_KEY tidak ditemukan di environment');
            return res.status(500).json({
                status: false,
                msg: 'Konfigurasi API belum lengkap (INDO_API_KEY missing)'
            });
        }

        console.log('📡 Fetching services from Indosmm API...');

        // ===== GET KE INDOSMM API - DAFTAR LAYANAN =====
        const response = await fetch('https://indosmm.id/api/v2/', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': apiKey
            }
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error('❌ Indosmm API HTTP error:', response.status, text);
            return res.status(502).json({
                status: false,
                msg: `Gagal menghubungi provider (HTTP ${response.status})`
            });
        }

        const data = await response.json();
        console.log('📦 Indosmm response status:', data.status);

        // ===== VALIDASI RESPONSE =====
        if (!data.status || !Array.isArray(data.services)) {
            console.error('❌ Indosmm response invalid:', data);
            return res.status(502).json({
                status: false,
                msg: data.msg || 'Respon provider tidak valid'
            });
        }

        // ===== GROUP BY CATEGORY + MARKUP 8% =====
        const grouped = {};
        const MARKUP = 1.08; // +8%

        for (const s of data.services) {
            // Kategori fallback
            const category = (s.category || 'Lainnya').trim() || 'Lainnya';
            if (!grouped[category]) {
                grouped[category] = [];
            }

            // Deteksi apakah butuh komentar berdasarkan type atau name
            const type = (s.type || 'default').toLowerCase();
            const name = (s.name || '').toLowerCase();
            const needsComment =
                type.includes('comment') ||
                type === 'custom_comment' ||
                type === 'comment_likes' ||
                type === 'comment_reply' ||
                name.includes('comment') ||
                name.includes('komentar');

            // Harga dari Indosmm = per 1.000 unit
            // Markup 8%, dibulatkan
            const rawPrice = Number(s.price) || 0;
            const markedUpPrice = Math.round(rawPrice * MARKUP);

            // Cek apakah ada diskon dari provider
            let diskon = null;
            if (s.discount && s.discount > 0 && s.discount < rawPrice) {
                diskon = Math.round(s.discount * MARKUP);
            }

            // Service object untuk frontend
            const serviceObj = {
                id: s.id,
                name: s.name || `Service #${s.id}`,
                pricePerFollower: markedUpPrice,
                min: Number(s.min) || 1,
                max: Number(s.max) || 1000000,
                average: s.average || s.avg_time || '-',
                desc: s.description || s.desc || '',
                comment: needsComment,
                type: s.type || 'default',
                refill: s.refill === 1 || s.refill === true,
                // Tambahkan diskon jika ada
                ...(diskon && { diskon: diskon })
            };

            grouped[category].push(serviceObj);
        }

        // ===== URUTKAN KATEGORI & LAYANAN =====
        const sorted = {};
        Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b, 'id'))
            .forEach((cat) => {
                sorted[cat] = grouped[cat].sort((a, b) =>
                    String(a.name).localeCompare(String(b.name), 'id')
                );
            });

        // ===== CACHE DI EDGE (VERCEL) =====
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

        console.log(`✅ ${sorted.length} kategori, total ${data.services.length} layanan dimuat dari Indosmm`);

        return res.status(200).json(sorted);

    } catch (error) {
        console.error('❌ Error indosmm-services:', error);
        return res.status(500).json({
            status: false,
            msg: 'Internal server error: ' + (error.message || '')
        });
    }
}
