import { NextResponse } from "next/server"

export function middleware(request) {
  const allowedIP = "114.5.104.228"

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.ip

  // Hanya proteksi route /ujicoba
  if (request.nextUrl.pathname.startsWith("/ujicoba")) {
    if (ip !== allowedIP) {
      return new NextResponse("403 - Access Denied", {
        status: 403,
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/ujicoba/:path*",
}
