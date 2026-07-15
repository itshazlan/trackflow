import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value ||
    request.cookies.get('__secure-better-auth.session_token')?.value;

  const { pathname } = request.nextUrl;

  // Check if target is an authentication page
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/auth');

  if (!sessionToken && !isAuthPage) {
    // Redirect to login if user is not authenticated and trying to access dashboard/admin
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionToken && isAuthPage) {
    // Redirect to dashboard home if already authenticated and trying to access auth pages
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api routes (handled by backend or rewrite proxies)
     * 2. _next/static (static files)
     * 3. _next/image (image optimization files)
     * 4. favicon.ico (favicon file)
     * 5. public assets (png, svg, jpg)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg).*)',
  ],
};
