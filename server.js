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

// =============================
// START SERVER
// =============================

app.listen(PORT, () => {

    console.log(`Server berjalan di http://localhost:${PORT}`);

});
