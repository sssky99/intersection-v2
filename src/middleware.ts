import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { nextUrl } = request;

  if (nextUrl.pathname === '/auth/callback') {
    const hasOAuthError =
      nextUrl.searchParams.has('error') ||
      nextUrl.searchParams.has('error_code') ||
      nextUrl.searchParams.has('error_description');

    if (hasOAuthError) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/auth/callback'],
};
