const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const TELEGRAM_TOKEN = "8785872128:AAGJApScDjRIjg1VorXB35OvrvtUDCtVr0M";
const CHAT_ID = "-1003853365342";

const RATE_LIMIT = 5; // max request
const WINDOW_TIME = 5 * 1000; // 10 detik
const AUTO_UNBLOCK_TIME = 60 * 60 * 1000; // 1 jam

// whitelist IP (biar ga ke block)
const WHITELIST = ["127.0.0.1", "::1"];

// ================= DATA =================
let ipLogs = {};
let blockedIPs = new Map();

// ================= TELEGRAM =================
async function sendTelegram(msg) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

// ================= MIDDLEWARE =================
app.use(async (req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    req.ip;

  // skip whitelist
  if (WHITELIST.includes(ip)) return next();

  // cek IP diblok
  if (blockedIPs.has(ip)) {
    return res.status(403).send("🚫 IP BLOCKED");
  }

  // tracking request
  if (!ipLogs[ip]) {
    ipLogs[ip] = {
      count: 1,
      start: Date.now()
    };
  } else {
    ipLogs[ip].count++;
  }

  const elapsed = Date.now() - ipLogs[ip].start;

  // reset window
  if (elapsed > WINDOW_TIME) {
    ipLogs[ip] = {
      count: 1,
      start: Date.now()
    };
  }

  // DETEKSI DDoS
  if (ipLogs[ip].count > RATE_LIMIT) {
    blockedIPs.set(ip, Date.now());

    console.log("🚫 IP diblok:", ip);

    // kirim telegram
    sendTelegram(`
🚫 <b>IP DIBLOK</b>
IP: <code>${ip}</code>
Request: ${ipLogs[ip].count}
Status: DDoS terdeteksi
Waktu: ${new Date().toLocaleString()}
    `);

    return res.status(403).send("🚫 DDoS detected, IP blocked");
  }

  next();
});

// ================= AUTO UNBLOCK =================
setInterval(() => {
  const now = Date.now();

  for (let [ip, time] of blockedIPs) {
    if (now - time > AUTO_UNBLOCK_TIME) {
      blockedIPs.delete(ip);

      sendTelegram(`
✅ <b>IP DIUNBLOCK</b>
IP: <code>${ip}</code>
Status: Sudah dibuka otomatis
      `);

      console.log("✅ IP di-unblock:", ip);
    }
  }
}, 60 * 1000);

// ================= ROUTES =================
app.get("/", (req, res) => {
  res.send("🔥 Server Aman - Anti DDoS Aktif");
});

// manual block
app.get("/block", async (req, res) => {
  const ip = req.query.ip;

  if (!ip) return res.send("Masukkan IP");

  blockedIPs.set(ip, Date.now());

  await sendTelegram(`
🚫 <b>MANUAL BLOCK</b>
IP: <code>${ip}</code>
  `);

  res.send("IP diblok manual");
});

// manual unblock
app.get("/unblock", async (req, res) => {
  const ip = req.query.ip;

  if (!ip) return res.send("Masukkan IP");

  blockedIPs.delete(ip);

  await sendTelegram(`
✅ <b>MANUAL UNBLOCK</b>
IP: <code>${ip}</code>
  `);

  res.send("IP di-unblock");
});

// ================= START =================
const PORT = 3000;
app.listen(PORT, () => {
  console.log("🚀 Server jalan di port", PORT);

  sendTelegram(`
🚀 <b>SERVER AKTIF</b>
Port: ${PORT}
Status: Anti-DDoS aktif
  `);
});
