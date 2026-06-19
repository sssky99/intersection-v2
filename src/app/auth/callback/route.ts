import { NextResponse } from 'next/server';
import {
  postLoginPath,
  safeInternalPath,
  safeLocalOAuthOrigin,
} from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/server';

function cleanRedirect(requestUrl: URL, path = '/') {
  const redirectUrl = new URL(path, requestUrl.origin);
  redirectUrl.search = '';
  redirectUrl.hash = '';

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const oauthError =
    requestUrl.searchParams.get('error') ??
    requestUrl.searchParams.get('error_code');
  const code = requestUrl.searchParams.get('code');
  const redirectPath = safeInternalPath(
    requestUrl.searchParams.get('next'),
    postLoginPath,
  );

  if (oauthError) {
    return cleanRedirect(requestUrl);
  }

  if (!code) {
    return cleanRedirect(requestUrl);
  }

  const returnOrigin = safeLocalOAuthOrigin(
    requestUrl.searchParams.get('return_origin'),
  );

  if (returnOrigin && returnOrigin !== requestUrl.origin) {
    const localCallbackUrl = new URL('/auth/callback', returnOrigin);
    localCallbackUrl.searchParams.set('code', code);
    localCallbackUrl.searchParams.set('next', redirectPath);

    return NextResponse.redirect(localCallbackUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Supabase auth callback error:', error.message);
    return cleanRedirect(requestUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const kakaoIdentity = user.identities?.find(
      (identity) => identity.provider === 'kakao',
    );

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingProfile) {
      await supabase
        .from('profiles')
        .update({
          provider: 'kakao',
          kakao_id: kakaoIdentity?.id ?? null,
        })
        .eq('user_id', user.id);
    } else {
      await supabase.from('profiles').insert({
        user_id: user.id,
        provider: 'kakao',
        kakao_id: kakaoIdentity?.id ?? null,
        profile_completed: false,
        questions_completed: false,
        meeting_guidelines_agreed: false,
      });
    }
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
