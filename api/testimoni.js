let STORE = []; // in-memory store (ephemeral). Will reset on cold-start.

/**
 * Simple Vercel serverless handler.
 * - POST /api/testimoni  -> accepts { nama, rating, testimoni } and pushes to STORE + sends to Telegram
 * - GET  /api/testimoni  -> returns JSON array of saved items
 *
 * NOTE: STORE is in-memory and ephemeral. For persistent storage use a database or external storage.
 */

// Replace with your real token & chat id (the deployer can also set via environment variables)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8401312586:AAGivV7zgVWlFTKpCroRGC6sTEZxLbqG_ug";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "@ShineShopOfficial";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { nama, rating, testimoni } = req.body || {};
      if (!nama || !testimoni || !rating) {
        return res.status(400).json({ status: 'error', error: 'nama, rating, testimoni required' });
      }
      const item = { nama: String(nama).slice(0,120), rating: Number(rating), testimoni: String(testimoni).slice(0,1000), timestamp: new Date().toISOString() };
      // push to in-memory store
      STORE.push(item);

      // send to Telegram (best effort)
      try {
        const text = `🌟 *Testimoni Baru!*
👤 ${item.nama}
⭐ ${item.rating}/5
💬 ${item.testimoni}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
        });
      } catch (tgErr) {
        console.error('Telegram error', tgErr);
      }

      return res.status(200).json({ status: 'success', item });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: 'error', error: err.message || String(err) });
    }
  }

  if (req.method === 'GET') {
    // return store (copy)
    return res.status(200).json(STORE);
  }

  return res.status(405).json({ status: 'error', error: 'Method not allowed' });
}
