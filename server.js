import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================
// CONFIG
// =============================

const API_KEY = "tz1kcs-eizrjo-bqmt10-13suhv-n7m7zt";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================
// STATIC HTML
// =============================

app.use(express.static(__dirname));

// =============================
// API SERVICE
// =============================

app.get("/api/service", async (req, res) => {

    try {

        const response = await fetch("https://fayupedia.id/api/services", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: API_KEY
            })
        });

        const data = await response.json();

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            status: false,
            msg: "Gagal mengambil layanan."
        });

    }

});

// =============================
// API ORDER
// =============================

app.post("/api/order", async (req, res) => {

    try {

        const {

            service,
            quantity,
            target

        } = req.body;

        const response = await fetch("https://fayupedia.id/api/order", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                api_key: API_KEY,

                service,

                quantity,

                target

            })

        });

        const data = await response.json();

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({

            status: false,

            msg: "Gagal membuat order."

        });

    }

});

// =============================
// HOME
// =============================

app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "index.html"));

});
let requests = {};
let burst = {};
let blacklist = new Set();

// ===== CONFIG =====
const MAX_REQUEST = 10;
const WINDOW_MS = 60 * 1000;

const BURST_LIMIT = 30;
const BURST_WINDOW = 5000;

// ===== TELEGRAM =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ===== CLOUDFLARE =====
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = "ff68faf37e1fcf258de1def5a8210848";

// ===== FUNCTION =====
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// ===== TELEGRAM =====
async function sendTelegram(message) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      })
    });
  } catch (err) {
    console.log("Telegram error:", err);
  }
}

// ===== CLOUDFLARE BLOCK =====
async function blockIPCloudflare(ip) {
  try {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/access_rules/rules`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "block",
        configuration: {
          target: "ip",
          value: ip
        },
        notes: "Auto blocked by Vercel DDoS Protection"
      })
    });

    console.log("☁️ Cloudflare blocked:", ip);
  } catch (err) {
    console.log("Cloudflare error:", err);
  }
}

// ===== HANDLER =====
export default async function handler(req, res) {
  const ip = getIP(req);
  const now = Date.now();
  const ua = req.headers["user-agent"] || "unknown";
  const url = req.url;

  // 🚫 BLACKLIST
  if (blacklist.has(ip)) {
    return res.status(403).json({
      status: "blocked",
      message: "IP diblokir permanen"
    });
  }

  // ===== RATE LIMIT =====
  if (!requests[ip]) requests[ip] = [];
  requests[ip].push(now);

  requests[ip] = requests[ip].filter(
    (t) => now - t < WINDOW_MS
  );

  if (requests[ip].length > MAX_REQUEST) {
    blacklist.add(ip);

    await blockIPCloudflare(ip);

    await sendTelegram(
      `🚫 RATE LIMIT\nIP: ${ip}\nRequest: ${requests[ip].length}/min\nURL: ${url}\nUA: ${ua}`
    );

    return res.status(429).json({
      status: "limit"
    });
  }

  // ===== BURST =====
  if (!burst[ip]) burst[ip] = [];
  burst[ip].push(now);

  burst[ip] = burst[ip].filter(
    (t) => now - t < BURST_WINDOW
  );

  if (burst[ip].length > BURST_LIMIT) {
    blacklist.add(ip);

    await blockIPCloudflare(ip);

    await sendTelegram(
      `🔥 SERANGAN DDOS DETECTED\nIP: ${ip}\nBurst: ${burst[ip].length}/5s\nURL: ${url}\nUA: ${ua}\n\n NO DAMAHE KIDS`
    );

    return res.status(403).json({
      status: "ddos"
    });
  }

  res.status(200).json({
    status: "ok",
    ip
  });
        }
// =============================
// START SERVER
// =============================

app.listen(PORT, () => {

    console.log(`Server berjalan di http://localhost:${PORT}`);

});
