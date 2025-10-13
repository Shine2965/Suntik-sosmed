// api/discord.js
import fetch from "node-fetch";

const WEBHOOK_ID = "1426927009099022398";
const WEBHOOK_TOKEN = "GpimaTC1YPY7d-MyWsq_CegBeEIHWOGdhIjeXbAkDh_qZQkA_HOJxMDY5QqB65lXvo0W";
const DISCORD_BASE = `https://discord.com/api/webhooks/${WEBHOOK_ID}/${WEBHOOK_TOKEN}`;

let cache = [];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!body?.content) return res.status(400).json({ error: "Konten kosong" });

      // kirim ke Discord
      const result = await fetch(DISCORD_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: body.username || "Anon",
          content: body.content,
        }),
      });

      if (!result.ok) throw new Error("Gagal kirim ke Discord");
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  else if (req.method === "GET") {
    try {
      const r = await fetch(`${DISCORD_BASE}/messages?limit=30`);
      if (!r.ok) throw new Error("Gagal ambil dari Discord");
      const data = await r.json();
      cache = data.map(m => ({
        id: m.id,
        username: m.author?.username || m.username || "User",
        content: m.content,
        timestamp: m.timestamp,
      }));
      res.json(cache);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  else {
    res.status(405).end();
  }
}
