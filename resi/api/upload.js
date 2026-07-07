import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

const CHAT_ID = "6317157631";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan.",
    });
  }

  const TOKEN = process.env.TELEGRAM_TOKEN;

  if (!TOKEN) {
    return res.status(500).json({
      success: false,
      message: "Environment TELEGRAM_TOKEN belum diatur.",
    });
  }

  const form = formidable({
    multiples: true,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Gagal membaca form.",
      });
    }

    try {
      const nama = Array.isArray(fields.nama)
        ? fields.nama[0]
        : fields.nama || "-";

      // Kirim nama produk
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `📦 Produk Baru\n\nNama Produk: ${nama}`,
        }),
      });

      // ================= FOTO =================

      let foto = files.foto || [];

      if (!Array.isArray(foto)) {
        foto = [foto];
      }

      foto = foto.slice(0, 3);

      for (const file of foto) {
        const body = new FormData();

        body.append("chat_id", CHAT_ID);

        body.append(
          "photo",
          new Blob([fs.readFileSync(file.filepath)]),
          file.originalFilename
        );

        await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
          method: "POST",
          body,
        });
      }

      // ================= VIDEO =================

      if (files.video) {
        const video = Array.isArray(files.video)
          ? files.video[0]
          : files.video;

        const body = new FormData();

        body.append("chat_id", CHAT_ID);

        body.append(
          "video",
          new Blob([fs.readFileSync(video.filepath)]),
          video.originalFilename
        );

        await fetch(`https://api.telegram.org/bot${TOKEN}/sendVideo`, {
          method: "POST",
          body,
        });
      }

      return res.status(200).json({
        success: true,
      });
    } catch (e) {
      console.error(e);

      return res.status(500).json({
        success: false,
        message: e.message,
      });
