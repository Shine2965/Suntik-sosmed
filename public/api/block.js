let blocked = new Set();

export default function handler(req, res) {

  const ip =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    "unknown";

  blocked.add(ip);

  res.status(200).json({
    success: true,
    ip: ip
  });
}
