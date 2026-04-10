// index.js // Backend SMM Panel (Vercel / Node.js)

export default async function handler(req, res) { if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

const { action, service, link, quantity, order } = req.body;

const API_KEY = process.env.SMM_API_KEY; const API_URL = "https://lollipop-smm.com/api/v2";

try { let params = { key: API_KEY, action };

if (action === "add") {
  params.service = service;
  params.link = link;
  params.quantity = quantity;
}

if (action === "status") {
  params.order = order;
}

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams(params)
});

const data = await response.json();

res.status(200).json(data);

} catch (err) { res.status(500).json({ error: err.message }); } }

// =============================== // FRONTEND (connect ke backend) // ===============================

/* Ganti API_URL di frontend jadi endpoint vercel kamu Contoh: https://namaproject.vercel.app/api */

// contoh fetch frontend:

async function createOrder() { const res = await fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", service: "1", link: "https://instagram.com/test", quantity: "100" }) });

const data = await res.json(); console.log(data); }

// =============================== // VERCEL CONFIG (optional) // ===============================

/* vercel.json

{ "functions": { "api/index.js": { "memory": 1024, "maxDuration": 10 } } } */

// =============================== // ENV VARIABLE (WAJIB) // ===============================

/* Di Vercel tambahkan:

SMM_API_KEY = e32a329fec8ca101c3638e463e908fee */
