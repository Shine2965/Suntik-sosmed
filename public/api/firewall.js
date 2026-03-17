let blocked = new Set();

export default function handler(req, res) {

  const ip =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    "unknown";

  if(blocked.has(ip)){
    return res.status(403).json({
      blocked:true
    });
  }

  res.status(200).json({
    blocked:false
  });
}
