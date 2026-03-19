import { NextResponse } from 'next/server';

export function middleware(req) {
  const url = req.nextUrl;

  // Ambil data request
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.ip ||
    '';

  const userAgent = req.headers.get('user-agent') || '';
  const referer = req.headers.get('referer') || '';
  const token = url.searchParams.get('token');

  // =========================
  // CONFIG
  // =========================
  const ALLOWED_IPS = [
    '123.123.123.123',
    '111.111.111.111'
  ];

  const SECRET_TOKEN = 'RAHASIA_BANGET_123';

  const ALLOWED_UA = [
    'Mozilla', // browser normal
  ];

  const ALLOWED_REFERER = [
    'https://shinedomain.my.id'
  ];

  // =========================
  // PROTECTION
  // =========================
  if (url.pathname.startsWith('/telegram')) {

    // 1. Cek IP
    if (!ALLOWED_IPS.includes(ip)) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }

    // 2. Cek token rahasia
    if (token !== SECRET_TOKEN) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }

    // 3. Cek User-Agent (hindari bot)
    const validUA = ALLOWED_UA.some(ua => userAgent.includes(ua));
    if (!validUA) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }

    // 4. Cek referer (opsional tapi kuat)
    const validReferer = ALLOWED_REFERER.some(r => referer.startsWith(r));
    if (!validReferer) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }
  }

  return NextResponse.next();
}
