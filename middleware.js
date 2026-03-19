import { NextResponse } from 'next/server'

export function middleware(req) {
  const ip = req.headers.get('x-forwarded-for') || ''

  if (req.nextUrl.pathname.startsWith('/telegram')) {
    if (!ip.includes('114.5.223.240')) {
      return NextResponse.redirect(new URL('/tidaktersedia', req.url))
    }
  }

  return NextResponse.next()
}
