export default function handler(req, res) {
  const allowedIP = '114.8.218.23';
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  // Cek IP
  if (clientIP !== allowedIP) {
    return res.status(403).json({ 
      error: 'Akses ditolak, anjing!',
      ip: clientIP
    });
  }

  // Redirect ke /tidaktersedia/
  res.writeHead(302, {
    Location: '/tidaktersedia/'
  });
  res.end();
}
