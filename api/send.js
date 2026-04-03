export const config = {
  api: {
    bodyParser: false, // WAJIB untuk upload file
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const OWNER_ID = process.env.OWNER_ID;

    // ambil raw form data dari request
    const form = await req.formData();

    // paksa chat_id dari env (biar ga bisa diubah user)
    form.set("chat_id", OWNER_ID);

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form,
      }
    );

    const data = await response.json();

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
