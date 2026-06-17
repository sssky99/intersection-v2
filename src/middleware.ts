import { NextResponse, type NextRequest } from 'next/server';
import { postLoginPath, safeInternalPath } from '@/lib/authRedirect';

function hasOAuthParams(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  return (
    searchParams.has('code') ||
    searchParams.has('error') ||
    searchParams.has('error_code') ||
    searchParams.has('error_description')
  );
}

function redirectToAuthCallback(request: NextRequest) {
  const callbackUrl = new URL('/auth/callback', request.url);

  request.nextUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.append(key, value);
  });

  callbackUrl.searchParams.set(
    'next',
    safeInternalPath(
      request.nextUrl.searchParams.get('next'),
      postLoginPath,
    ),
  );

  return NextResponse.redirect(callbackUrl);
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const hasOAuthError =
    nextUrl.searchParams.has('error') ||
    nextUrl.searchParams.has('error_code') ||
    nextUrl.searchParams.has('error_description');

  if (nextUrl.pathname === '/auth/callback') {
    if (hasOAuthError) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  if (hasOAuthParams(request)) {
    return redirectToAuthCallback(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};
