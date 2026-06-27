export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const {
      title,
      message,
      endTime
    } = req.body;

    if (!title || !message || !endTime) {
      return res.status(400).json({
        error: "Data tidak lengkap."
      });
    }

    const OWNER = "shine2965";
    const REPO = "Suntik-sosmed";
    const BRANCH = "Yey";
    const PATH = "maintenance/maintenance.json";

    const TOKEN = procces.env.GITHUB_TOKEN;

    if (!TOKEN) {
      return res.status(500).json({
        error: "GITHUB_TOKEN belum diatur."
      });
    }

    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`;

    // Ambil SHA file
    const file = await fetch(api, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (!file.ok) {
      const text = await file.text();
      return res.status(500).json({
        error: text
      });
    }

    const json = await file.json();

    const content = {
      title,
      message,
      endTime
    };

    const body = {
      message: `Update maintenance ${new Date().toLocaleString("id-ID")}`,
      content: Buffer.from(
        JSON.stringify(content, null, 2)
      ).toString("base64"),
      sha: json.sha,
      branch: BRANCH
    };

    const update = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const result = await update.json();

    if (!update.ok) {
      return res.status(500).json(result);
    }

    return res.status(200).json({
      success: true,
      message: "Maintenance berhasil diperbarui.",
      commit: result.commit.html_url
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
      }
