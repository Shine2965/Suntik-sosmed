import Busboy from "busboy";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed",
    });
  }

  const busboy = Busboy({
    headers: req.headers,
  });

  const fields = {};
  const files = [];

  busboy.on("field", (name, value) => {
    fields[name] = value;
  });

  busboy.on("file", (name, file, info) => {
    const chunks = [];

    file.on("data", (chunk) => {
      chunks.push(chunk);
    });

    file.on("end", () => {
      files.push({
        fieldName: name,
        filename: info.filename,
        mimeType: info.mimeType,
        size: Buffer.concat(chunks).length,
      });
    });
  });

  busboy.on("finish", () => {
    return res.status(200).json({
      success: true,
      message: "Upload berhasil diterima.",
      fields,
      totalFiles: files.length,
      files,
    });
  });

  req.pipe(busboy);
}
