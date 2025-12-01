// server.js
const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const TELEGRAM_API_KEY = "7430992455:AAEbBWWfV9peNcN5m8mfAImCkbT2CowFnbg";
const ADMIN_CHAT_ID = "6845141887";

// H2H config
const H2H_API = "https://h2h.okeconnect.com/trx";
const H2H_USER = "OK1996720";
const H2H_PASS = "Alvino11";
const H2H_PIN  = "2011";

// Produk ID
const PRODUCTS = {
    dana: { "10000":"D10", "20000":"D20", "30000":"D30", "50000":"D50", "100000":"D100" },
    gopay: { "10000":"GJK10", "20000":"GJK20", "30000":"GJK30", "50000":"GJK50", "100000":"GJK100" }
};

// Endpoint menerima pencairan dari frontend
app.post("/sendWithdraw", async (req, res) => {
    const { nama, rekening, nominal, metode, tanggal } = req.body;
    if (!nama || !rekening || !nominal || !metode) return res.status(400).send("Data kurang lengkap");

    // Kirim pesan ke admin Telegram dengan inline button
    const message = 
`Halo admin ada penarikan saldo baru nih!

📅 Tanggal: ${tanggal}
👤 Nama: ${nama}
🏦 No Rekening: ${rekening}
💰 Jumlah Pencairan: Rp ${Number(nominal).toLocaleString("id-ID")}
Metode: ${metode.toUpperCase()}`;

    const inline_keyboard = [
        [
            { text: "Konfirmasi Dana", callback_data: JSON.stringify({ metode:"dana", nama, rekening, nominal }) },
            { text: "Konfirmasi Gopay", callback_data: JSON.stringify({ metode:"gopay", nama, rekening, nominal }) }
        ]
    ];

    await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: message,
            reply_markup: { inline_keyboard }
        })
    });

    res.send("OK");
});

// Endpoint untuk handle callback inline button
app.post("/callback", async (req, res) => {
    const data = req.body.callback_query;
    if (!data) return res.sendStatus(400);

    const cb = JSON.parse(data.data);
    const { metode, nama, rekening, nominal } = cb;

    // Panggil API H2H
    const product_id = PRODUCTS[metode][String(nominal)];
    const payload = {
        user: H2H_USER,
        pass: H2H_PASS,
        pin: H2H_PIN,
        idproduk: product_id,
        target: rekening
    };

    try {
        const h2hRes = await fetch(H2H_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await h2hRes.json();

        let replyText = "";
        if (result.status === "success") {
            replyText = `✅ Konfirmasi berhasil!\nDana Rp ${nominal.toLocaleString("id-ID")} berhasil dikirim ke ${rekening}`;
        } else {
            replyText = `❌ Gagal melakukan pencairan.\n${result.message || "Cek log H2H"}`
        }

        // Kirim balasan ke admin Telegram
        await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: data.id,
                text: replyText,
                show_alert: true
            })
        });

        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
