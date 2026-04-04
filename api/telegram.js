export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const TOKEN = process.env.TELEGRAM_TOKEN;
  const CHAT_ID = process.env.OWNER_ID;

  try {
    const contentType = req.headers["content-type"];

    if (contentType.includes("multipart/form-data")) {
      // HANDLE FOTO
      const formData = await req.formData();
      const message = formData.get("message");
      const photo = formData.get("photo");

      const tgForm = new FormData();
      tgForm.append("chat_id", CHAT_ID);
      tgForm.append("photo", photo);
      tgForm.append("caption", message || "");

      const response = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
        {
          method: "POST",
          body: tgForm,
        }
      );

      const data = await response.json();
      return res.status(200).json(data);
    } else {
      // HANDLE TEXT
      const { message } = req.body;

      const response = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
          }),
        }
      );

      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
