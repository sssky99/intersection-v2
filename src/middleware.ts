import { NextResponse, type NextRequest } from 'next/server';
import {
  isNetlifyBranchDeploy,
  postLoginPath,
  productionOAuthOrigin,
  safeInternalPath,
} from '@/lib/authRedirect';

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

function redirectWithoutOAuthParams(request: NextRequest, path = request.nextUrl.pathname) {
  const cleanUrl = new URL(path, request.url);

  return NextResponse.redirect(cleanUrl);
}

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');

  if (!host) {
    return request.nextUrl.origin;
  }

  const forwardedProtocol = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProtocol ?? request.nextUrl.protocol.replace(':', '');

  return `${protocol}://${host}`;
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const origin = requestOrigin(request);
  const hasOAuthError =
    nextUrl.searchParams.has('error') ||
    nextUrl.searchParams.has('error_code') ||
    nextUrl.searchParams.has('error_description');

  const isAdminPreviewPath =
    nextUrl.pathname === '/admin' ||
    nextUrl.pathname.startsWith('/admin/') ||
    nextUrl.pathname.startsWith('/api/admin/');

  if (isNetlifyBranchDeploy(origin) && !isAdminPreviewPath) {
    const productionUrl = new URL(
      `${nextUrl.pathname}${nextUrl.search}`,
      productionOAuthOrigin(),
    );

    return NextResponse.redirect(productionUrl);
  }

  if (nextUrl.pathname === '/auth/callback') {
    if (hasOAuthError) {
      return redirectWithoutOAuthParams(request, '/');
    }

    return NextResponse.next();
  }

  if (hasOAuthParams(request)) {
    if (nextUrl.pathname === '/') {
      return redirectWithoutOAuthParams(request);
    }

    return redirectToAuthCallback(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};
