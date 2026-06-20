import { NextResponse } from 'next/server';
import {
  postLoginPath,
  safeInternalPath,
  safeLocalOAuthOrigin,
} from '@/lib/authRedirect';
import { nextOnboardingPath } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/types/profile';

function cleanRedirect(requestUrl: URL, path = '/', origin = requestUrl.origin) {
  const redirectUrl = new URL(path, origin);
  redirectUrl.search = '';
  redirectUrl.hash = '';

  return NextResponse.redirect(redirectUrl);
}

function shouldStartQuestions(path: string) {
  try {
    const url = new URL(path, 'https://intersection.local');
    return (
      url.pathname === '/onboarding/questions' &&
      url.searchParams.get('start') === '1'
    );
  } catch {
    return false;
  }
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
  const returnOrigin = safeLocalOAuthOrigin(
    requestUrl.searchParams.get('return_origin'),
  );
  const cleanOrigin =
    returnOrigin && returnOrigin !== requestUrl.origin
      ? returnOrigin
      : requestUrl.origin;

  if (oauthError) {
    return cleanRedirect(requestUrl, '/', cleanOrigin);
  }

  if (!code) {
    return cleanRedirect(requestUrl, '/', cleanOrigin);
  }

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
  let profile: ProfileRow | null = null;

  if (user) {
    const kakaoIdentity = user.identities?.find(
      (identity) => identity.provider === 'kakao',
    );

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle<ProfileRow>();

    if (existingProfile) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          provider: 'kakao',
          kakao_id: kakaoIdentity?.id ?? null,
        })
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle<ProfileRow>();

      if (updateError) {
        console.error('Profile OAuth update error:', updateError.message);
      }

      profile = updatedProfile ?? existingProfile;
    } else {
      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          provider: 'kakao',
          kakao_id: kakaoIdentity?.id ?? null,
          profile_completed: false,
          questions_completed: false,
          meeting_guidelines_agreed: false,
        })
        .select('*')
        .single<ProfileRow>();

      if (insertError) {
        console.error('Profile OAuth bootstrap error:', insertError.message);
      }

      profile = createdProfile ?? null;
    }
  }

  const finalPath = profile
    ? nextOnboardingPath(profile, {
        startQuestions: shouldStartQuestions(redirectPath),
      })
    : redirectPath;

  return NextResponse.redirect(new URL(finalPath, cleanOrigin));
}
