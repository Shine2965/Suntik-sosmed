export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id, message, button_text, button_url } = req.body;

    const TOKEN = process.env.TELEGRAM_TOKEN;

    if (!TOKEN) {
      return res.status(500).json({ error: "Token tidak tersedia" });
    }

    const payload = {
      chat_id: user_id,
      text: message,
      parse_mode: "HTML"
    };

    // Tambahkan tombol jika ada
    if (button_text && button_url) {
      payload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: button_text,
              url: button_url
            }
          ]
        ]
      };
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
