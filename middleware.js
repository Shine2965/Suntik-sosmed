import { NextResponse } from 'next/server'

const WHITELIST_IPS = [
  '1.2.3.4', // ganti dengan IP kamu
  '5.6.7.8'
]

export function middleware(req) {
  const url = req.nextUrl

  if (url.pathname.startsWith('/telegram')) {

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown'

    // jika IP tidak ada di whitelist
    if (!WHITELIST_IPS.includes(ip)) {
      return NextResponse.redirect(new URL('/tidaktersedia/', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/telegram/:path*'],
}
