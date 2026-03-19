import { NextResponse } from 'next/server';

export function middleware(req) {
  const url = req.nextUrl;

  // =========================
  // AMBIL DATA REQUEST (SAFE)
  // =========================
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '';

  const userAgent = req.headers.get('user-agent') || '';
  const referer = req.headers.get('referer') || '';
  const token = url.searchParams.get('token') || '';

  // =========================
  // CONFIG
  // =========================
  const ALLOWED_IPS = [
    '123.123.123.123',
    '111.111.111.111'
  ];

  const SECRET_TOKEN = 'RAHASIA_BANGET_123';

  const ALLOWED_UA = [
    'Mozilla'
  ];

  const ALLOWED_REFERER = [
    'https://shinedomain.my.id'
  ];

  // =========================
  // PROTECTION
  // =========================
  if (url.pathname.startsWith('/telegram')) {

    // 1. IP CHECK
    if (!ALLOWED_IPS.includes(ip)) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }

    // 2. TOKEN CHECK
    if (token !== SECRET_TOKEN) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }

    // 3. USER AGENT CHECK
    const validUA = ALLOWED_UA.some(ua => userAgent.includes(ua));
    if (!validUA) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }

    // 4. REFERER CHECK (SAFE)
    if (referer) {
      const validReferer = ALLOWED_REFERER.some(r => referer.startsWith(r));
      if (!validReferer) {
        return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
      }
    } else {
      // kalau tidak ada referer → blok (opsional, bisa kamu ubah)
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url));
    }
  }

  return NextResponse.next();
}

// =========================
// BATASI HANYA KE ROUTE INI
// =========================
export const config = {
  matcher: ['/telegram/:path*'],
};
