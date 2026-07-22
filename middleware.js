// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             request.ip || 
             '0.0.0.0';
  
  const allowedIP = '114.8.218.239';
  const { pathname } = request.nextUrl;

  // Proteksi buat /ujicoba/ dan /ujicoba2/
  if (pathname.startsWith('/ujicoba') || pathname.startsWith('/ujicoba2')) {
    if (ip !== allowedIP) {
      return NextResponse.redirect(new URL('/tidaktersedia/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ujicoba/:path*', '/ujicoba2/:path*'],
};
