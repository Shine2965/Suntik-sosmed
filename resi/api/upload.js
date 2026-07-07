import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";

export const config = {
  api: {
    bodyParser: false,
  },
};

const WEBHOOK =
  "https://discord.com/api/webhooks/1482244992725553164/k6boQq7vBc3184RxiPtG6-obIKDZQWBu0f8cHQnLTevnwo8wFuaUKzhWzRkJ3Hl0_yne";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method tidak diizinkan",
    });
  }

  const form = formidable({
    multiples: true,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Gagal membaca data.",
      });
    }

    try {
      const data = new FormData();

      const nama = Array.isArray(fields.nama)
        ? fields.nama[0]
        : fields.nama || "-";

      data.append(
        "content",
        `📦 **Upload Produk Baru**

**Nama Produk:** ${nama}`
      );

      // Foto
      if (files.foto) {
        const fotoFiles = Array.isArray(files.foto)
          ? files.foto
          : [files.foto];

        for (const file of fotoFiles) {
          data.append(
            "files[]",
            fs.createReadStream(file.filepath),
            file.originalFilename
          );
        }
      }

      // Video
      if (files.video) {
        const video = Array.isArray(files.video)
          ? files.video[0]
          : files.video;

        data.append(
          "files[]",
          fs.createReadStream(video.filepath),
          video.originalFilename
        );
      }

      const response = await fetch(WEBHOOK, {
        method: "POST",
        body: data,
        headers: data.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text();

        return res.status(500).json({
          success: false,
          message: text,
        });
      }

      return res.json({
        success: true,
      });
    } catch (e) {
      console.error(e);

      return res.status(500).json({
        success: false,
        message: "Upload gagal.",
      });
    }
  });
}
