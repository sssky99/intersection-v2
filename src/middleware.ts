import { NextResponse, type NextRequest } from 'next/server';
import { postLoginPath } from '@/lib/authRedirect';

export function middleware(request: NextRequest) {
  const { nextUrl } = request;

  if (nextUrl.pathname === '/') {
    const hasCode = nextUrl.searchParams.has('code');
    const hasOAuthError =
      nextUrl.searchParams.has('error') ||
      nextUrl.searchParams.has('error_code') ||
      nextUrl.searchParams.has('error_description');

    if (hasOAuthError) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (hasCode) {
      const callbackUrl = new URL('/auth/callback', request.url);
      nextUrl.searchParams.forEach((value, key) => {
        callbackUrl.searchParams.append(key, value);
      });
      callbackUrl.searchParams.set('next', postLoginPath);
      return NextResponse.redirect(callbackUrl);
    }
  }

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
  matcher: ['/', '/auth/callback'],
};
