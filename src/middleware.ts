import { NextResponse, type NextRequest } from 'next/server';
import {
  isNetlifyBranchDeploy,
  postLoginPath,
  productionOAuthOrigin,
  safeInternalPath,
} from '@/lib/authRedirect';
import {
  isNativeAndroidRequest,
  isNativeRestrictedPath,
  isProductionPreviewPath,
} from '@/lib/nativeAppRequest';
import { refreshSupabaseSession } from '@/lib/supabase/middleware';

const landingExperimentCookie = 'landing_ab_v1';
const landingExperimentMaxAge = 60 * 60 * 24 * 30;

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

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const origin = requestOrigin(request);
  const hasOAuthError =
    nextUrl.searchParams.has('error') ||
    nextUrl.searchParams.has('error_code') ||
    nextUrl.searchParams.has('error_description');

  const isApiRequest = nextUrl.pathname.startsWith('/api/');
  const isAdminViewExit =
    nextUrl.pathname === '/api/admin/user-view' && request.method === 'DELETE';
  const isAdminSessionLogin =
    nextUrl.pathname === '/api/admin/session' && request.method === 'POST';
  if (
    isApiRequest &&
    request.cookies.has('inter_admin_user_view') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    !isAdminViewExit &&
    !isAdminSessionLogin
  ) {
    return NextResponse.json(
      { error: '읽기 전용 보기에서는 정보를 변경할 수 없습니다.' },
      { status: 403 },
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    isProductionPreviewPath(nextUrl.pathname)
  ) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  if (
    isNativeAndroidRequest(request.headers.get('user-agent')) &&
    isNativeRestrictedPath(nextUrl.pathname)
  ) {
    if (nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.redirect(new URL('/', request.url));
  }

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
      if (nextUrl.searchParams.has('code')) {
        return redirectToAuthCallback(request);
      }

      return redirectWithoutOAuthParams(request);
    }

    return redirectToAuthCallback(request);
  }

  // API routes perform their own authentication. Middleware only stays in
  // front of selected API paths for preview/read-only safeguards above.
  if (isApiRequest) return NextResponse.next();

  // Static landing pages must not trigger an auth refresh (and therefore a
  // Supabase network call) on every anonymous visit.
  if (
    nextUrl.pathname === '/' ||
    nextUrl.pathname === '/instagram' ||
    nextUrl.pathname === '/onboarding/start' ||
    nextUrl.pathname === '/onboarding/import'
  ) {
    const response = NextResponse.next();

    if (nextUrl.pathname !== '/') return response;

    response.cookies.set(landingExperimentCookie, 'b', {
      path: '/',
      maxAge: landingExperimentMaxAge,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  }

  const { response } = await refreshSupabaseSession(request);

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images|videos|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|css|js|map|woff|woff2|ttf|otf|mp4|webm|mov)$).*)',
    '/api/admin/:path*',
    '/api/dev/:path*',
    {
      source: '/api/:path*',
      has: [{ type: 'cookie', key: 'inter_admin_user_view' }],
    },
  ],
};
