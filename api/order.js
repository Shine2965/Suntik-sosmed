export const config = {
  api: {
    bodyParser: false
  }
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ message: "Error parsing form" });
    }

    const user = fields.user;
    const stars = parseInt(fields.stars);
    const payment = fields.payment;

    const price = stars * 190;

    const TOKEN = process.env.TELEGRAM_TOKEN;
    const OWNER = process.env.OWNER_ID;

    try {

      // =========================
      // 1. Kirim Invoice ke User
      // =========================
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendInvoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user,
          title: "Pembelian Stars",
          description: `${stars} Stars (Rp${price})`,
          payload: "stars_payment",
          currency: "XTR",
          prices: [
            {
              label: "Stars",
              amount: stars * 100
            }
          ]
        })
      });

      // =========================
      // 2. Kirim ke OWNER
      // =========================
      let caption = `
📥 ORDER BARU

👤 User: ${user}
⭐ Stars: ${stars}
💰 Total: Rp${price}

💳 Pembayaran:
${payment}
`;

      if (files.file) {
        const filePath = files.file.filepath;

        const formData = new FormData();
        formData.append("chat_id", OWNER);
        formData.append("caption", caption);
        formData.append("photo", fs.createReadStream(filePath));

        await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
          method: "POST",
          body: formData
        });

      } else {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: OWNER,
            text: caption
          })
        });
      }

      res.json({ message: "Order berhasil dikirim!" });

    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });
              }
