import axios from "axios";

// ================= CONFIG =================
const TELEGRAM_TOKEN = "8785872128:AAGJApScDjRIjg1VorXB35OvrvtUDCtVr0M";
const CHAT_ID = "-1003853365342";

const RATE_LIMIT = 5; // max request per window
const WINDOW_TIME = 5000; // 10 detik

// ⚠️ NOTE: ini hanya sementara (akan reset tiap request baru instance)
let ipLogs = {};

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

// ================= HANDLER =================
export default async function handler(req, res) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown";

  const now = Date.now();

  if (!ipLogs[ip]) {
    ipLogs[ip] = {
      count: 1,
      start: now
    };
  } else {
    ipLogs[ip].count++;
  }

  const elapsed = now - ipLogs[ip].start;

  // reset window
  if (elapsed > WINDOW_TIME) {
    ipLogs[ip] = {
      count: 1,
      start: now
    };
  }

  // 🚫 DETEKSI DDoS
  if (ipLogs[ip].count > RATE_LIMIT) {
    await sendTelegram(`
🚫 <b>DDoS TERDETEKSI (VERCEL)</b>
IP: <code>${ip}</code>
Request: ${ipLogs[ip].count}
Waktu: ${new Date().toLocaleString()}
    `);

    return res.status(429).json({
      status: "blocked",
      message: "Too many requests"
    });
  }

  // normal response
  return res.status(200).json({
    status: "ok",
    ip,
    request_count: ipLogs[ip].count
  });
}
