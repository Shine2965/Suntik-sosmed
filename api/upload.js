export const config = {
  api: {
    bodyParser: false
  }
};

import Busboy from "busboy";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhook = process.env.DISCORD_WEBHOOK;

  const busboy = Busboy({
    headers: req.headers
  });

  const fields = {};
  const files = [];

  busboy.on("field", (name, value) => {
    fields[name] = value;
  });

  busboy.on("file", (name, file, info) => {
    const chunks = [];

    file.on("data", (data) => {
      chunks.push(data);
    });

    file.on("end", () => {
      files.push({
        filename: info.filename,
        mimeType: info.mimeType,
        buffer: Buffer.concat(chunks)
      });
    });
  });

  busboy.on("finish", async () => {
    try {
      const form = new FormData();

      form.append(
        "payload_json",
        JSON.stringify({
          embeds: [
            {
              title: "📦 Bukti Packing Baru",
              color: 0x2ecc71,
              fields: [
                {
                  name: "Nama Produk",
                  value: fields.produk || "-",
                  inline: false
                },
                {
                  name: "Marketplace",
                  value: fields.marketplace || "-",
                  inline: false
                }
              ],
              timestamp: new Date().toISOString()
            }
          ]
        })
      );

      files.forEach((f, i) => {
        const blob = new Blob([f.buffer], {
          type: f.mimeType
        });

        form.append(`files[${i}]`, blob, f.filename);
      });

      const response = await fetch(webhook, {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        throw new Error("Discord webhook gagal.");
      }

      res.status(200).json({
        success: true
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        success: false,
        error: err.message
      });

    }
  });

  req.pipe(busboy);
}
