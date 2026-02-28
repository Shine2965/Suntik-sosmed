import { NextResponse } from 'next/server'

export function middleware(request) {
  const blockedIPs = [
    "114.8.222.128",
    "182.4.73.201"
  ]

  const ip =
    request.headers.get("x-forwarded-for") ||
    request.ip

  if (blockedIPs.includes(ip)) {
    return new NextResponse("Access Denied", { status: 403 })
  }

  return NextResponse.next()
}
