# Testimoni Shine Shop (Vercel)

This project contains a minimal frontend and a Vercel serverless function to collect customer testimonials,
send them to a Telegram channel, and display them with average rating and a horizontal bar chart.

## Files
- `index.html` — frontend (form, chart, list)
- `api/testimoni.js` — Vercel serverless function (in-memory store + Telegram sender)
- `vercel.json` — Vercel configuration
- `README.md` — this file

## Notes
- The server stores testimonials **in-memory** (variable `STORE`). This means data is ephemeral and will reset on cold starts or redeploys.
- For production persistence, replace the in-memory store with a database or external storage.
- Telegram token and chat id are read from environment variables `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID` if set. Otherwise, defaults are embedded in the function.
- To deploy:
  1. Push this repo to GitHub.
  2. Connect the repo to Vercel (https://vercel.com).
  3. Set environment variables in Vercel dashboard (RECOMMENDED):
     - `TELEGRAM_TOKEN` = your bot token
     - `TELEGRAM_CHAT_ID` = your channel (e.g. @ShineShopOfficial)
  4. Deploy. After deployment, open the site and use the form.

## Security
- Avoid committing sensitive tokens in public repos. Use Vercel environment variables.
- The simple example here includes defaults for quick testing but you should override them.

