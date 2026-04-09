export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id, message, buttons } = req.body;

    const TOKEN = process.env.TELEGRAM_TOKEN;

    const payload = {
      chat_id: user_id,
      text: message,
      parse_mode: "HTML"
    };

    // Jika ada banyak tombol
    if (buttons && buttons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: buttons
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
