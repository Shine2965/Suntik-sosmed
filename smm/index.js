export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, service, link, quantity, order } = req.body;

  const API_KEY = process.env.SMM_API_KEY;
  const API_URL = "https://lollipop-smm.com/api/v2";

  try {
    let params = {
      key: API_KEY,
      action
    };

    // ADD ORDER
    if (action === "add") {
      if (!service || !link || !quantity) {
        return res.status(400).json({ error: "Data tidak lengkap" });
      }

      params.service = service;
      params.link = link;
      params.quantity = quantity;
    }

    // STATUS ORDER
    if (action === "status") {
      if (!order) {
        return res.status(400).json({ error: "Order ID kosong" });
      }

      params.order = order;
    }

    // SERVICES
    if (action === "services") {
      // tidak perlu tambahan
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(params)
    });

    const data = await response.json();

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}
