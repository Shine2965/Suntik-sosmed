export default async function handler(req, res) {
  // ==============================
  // CORS
  // =============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      response: false,
      message: "Method tidak diizinkan"
    });
  }

  // ==============================
  // API CONFIG
  // ==============================
  const API_ID = process.env.ORDER_API_ID;
  const API_KEY = process.env.ORDER_API_KEY;
  const SECRET_KEY = process.env.ORDER_SECRET_KEY;

  if (!API_ID || !API_KEY || !SECRET_KEY) {
    return res.status(500).json({
      response: false,
      message: "Konfigurasi API belum lengkap di server."
    });
  }

  try {
    const params = new URLSearchParams();

    params.append("api_id", API_ID);
    params.append("api_key", API_KEY);
    params.append("secret_key", SECRET_KEY);

    const response = await fetch(
      "https://ordersosmed.id/api-1/service",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      return res.status(502).json({
        response: false,
        message: "Response dari Ordersosmed bukan JSON.",
        raw: text.substring(0, 500)
      });
    }

    if (!result.response) {
      return res.status(400).json({
        response: false,
        message: result.message || "Gagal mengambil layanan.",
        data: result.data || []
      });
    }

    // ==========================================
    // NORMALISASI DATA UNTUK FRONTEND SHINE SHOP
    // ==========================================

    const categories = {};

    for (const service of result.data || []) {
      const category = service.category_name || "Lainnya";

      if (!categories[category]) {
        categories[category] = [];
      }

      /*
       * API SMM biasanya memberikan harga per 1000.
       *
       * Contoh:
       * price = 50000
       *
       * Maka:
       * pricePerFollower = 50
       *
       * sehingga frontend:
       * jumlah 100 x Rp50 = Rp5.000
       */

      const pricePerUnit = Number(service.price || 0) / 1000;

      categories[category].push({
        id: service.id,
        name: service.service_name || `Layanan ${service.id}`,

        pricePerFollower: pricePerUnit,

        // Tidak ada diskon dari API
        diskon: null,

        min: Number(service.min || 1),
        max: Number(service.max || 0),

        refill: service.refill === true,

        type: service.type || "primary",

        category_id: service.category_id,

        category_name: service.category_name,

        desc: service.description || "-",

        // Untuk kompatibilitas frontend
        comment:
          service.type === "custom_comments" ||
          service.type === "custom_comments_package",

        average: "-"
      });
    }

    return res.status(200).json({
      response: true,
      data: categories,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("Ordersosmed API Error:", error);

    return res.status(500).json({
      response: false,
      message: "Terjadi kesalahan saat menghubungi Ordersosmed.",
      error: error.message
    });
  }
}
