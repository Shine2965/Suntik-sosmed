// indosmm-services

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Support GET dan POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({
            status: false,
            msg: 'Method not allowed. Use GET or POST'
        });
    }

    try {
        // ===== AMBIL API KEY DARI ENV =====
        const apiKey = process.env.INDO_API_KEY || 'a1174c530b97e1bc0a7eec7baff3ac6e';

        if (!apiKey) {
            console.error('❌ INDO_API_KEY tidak ditemukan di environment');
            return res.status(500).json({
                status: false,
                msg: 'Konfigurasi API belum lengkap (INDO_API_KEY missing)'
            });
        }

        // ===== FETCH BALANCE & SERVICES secara Paralel =====
        const [resBalance, resServices] = await Promise.all([
            fetch('https://indosmm.id/api/v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ key: apiKey, action: 'balance' })
            }).catch(() => null),
            fetch('https://indosmm.id/api/v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ key: apiKey, action: 'services' })
            }).catch(() => null)
        ]);

        // ===== PARSE BALANCE =====
        let userBalance = 0;
        if (resBalance && resBalance.ok) {
            const balanceData = await resBalance.json().catch(() => null);
            if (balanceData && balanceData.balance) {
                userBalance = parseFloat(balanceData.balance) || 0;
            }
        }

        // ===== PARSE SERVICES =====
        if (!resServices || !resServices.ok) {
            const text = resServices ? await resServices.text().catch(() => '') : '';
            console.error('❌ Indosmm API HTTP error:', resServices?.status, text);
            return res.status(502).json({
                status: false,
                msg: 'Gagal menghubungi provider Indosmm'
            });
        }

        const data = await resServices.json();

        // ===== VALIDASI RESPONSE LAYANAN =====
        if (!Array.isArray(data)) {
            console.error('❌ Indosmm response invalid:', data);
            return res.status(502).json({
                status: false,
                msg: 'Respon provider tidak valid'
            });
        }

        // ===== GROUP BY CATEGORY + MARKUP 25% (1.25) =====
        const grouped = {};
        const MARKUP = 1.25; 

        for (const s of data) {
            const category = (s.category || 'Lainnya').trim() || 'Lainnya';
            if (!grouped[category]) {
                grouped[category] = [];
            }

            const type = (s.type || 'default').toLowerCase();
            const name = (s.name || '').toLowerCase();
            const needsComment =
                type.includes('comment') ||
                type === 'custom_comment' ||
                type === 'comment_likes' ||
                type === 'comment_reply' ||
                name.includes('comment') ||
                name.includes('komentar') ||
                name.includes('custom');

            const rawPrice = Number(s.rate) || 0;
            const markedUpPrice = Math.round(rawPrice * MARKUP);

            grouped[category].push({
                id: s.service,
                name: s.name || `Service #${s.service}`,
                pricePerFollower: markedUpPrice,
                rawRate: rawPrice, // Harga asli modal dari Indosmm
                diskon: null,
                min: Number(s.min) || 1,
                max: Number(s.max) || 1000000,
                average: '-',
                desc: '',
                comment: needsComment,
                type: s.type || 'default',
                refill: s.refill === true || s.refill === 1,
                rate: s.rate || 0
            });
        }

        // ===== URUTKAN KATEGORI & LAYANAN =====
        const sortedServices = {};
        Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b, 'id'))
            .forEach((cat) => {
                sortedServices[cat] = grouped[cat].sort((a, b) =>
                    String(a.name).localeCompare(String(b.name), 'id')
                );
            });

        // ===== CACHE =====
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

        // Mengembalikan object berupa data layanan dan saldo backend saat ini
        return res.status(200).json({
            status: true,
            balance: userBalance,
            services: sortedServices
        });

    } catch (error) {
        console.error('❌ Error indosmm-services:', error);
        return res.status(500).json({
            status: false,
            msg: 'Internal server error: ' + (error.message || '')
        });
    }
}
