const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ZONE_ID = "ff68faf37e1fcf258de1def5a8210848";

export default async function handler(req, res) {
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/access_rules/rules`,
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await r.json();

    res.status(200).json(data.result || []);
  } catch (e) {
    res.status(500).json({
      error: e.toString()
    });
  }
}
