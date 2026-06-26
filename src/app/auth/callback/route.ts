import { NextResponse } from 'next/server';
import {
  postLoginPath,
  safeInternalPath,
  safeLocalOAuthOrigin,
} from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/server';
import { recordUserEvent } from '@/lib/userEvents';
import type { ProfileRow } from '@/types/profile';

function cleanRedirect(requestUrl: URL, path = '/', origin = requestUrl.origin) {
  const redirectUrl = new URL(path, origin);
  redirectUrl.search = '';
  redirectUrl.hash = '';

  return NextResponse.redirect(redirectUrl);
}

function withLoginSuccessParams(
  path: string,
  loginType: 'new' | 'existing',
  origin: string,
) {
  const url = new URL(path, origin);
  url.searchParams.set('login', 'success');
  url.searchParams.set('login_type', loginType);
  return `${url.pathname}${url.search}${url.hash}`;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.localhost')
  );
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
  let isNewProfile = false;

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
      isNewProfile = true;
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
    ? isNewProfile
      ? withLoginSuccessParams(
          '/onboarding/questions?start=1',
          'new',
          cleanOrigin,
        )
      : withLoginSuccessParams(
          '/meetings?tab=recommend',
          'existing',
          cleanOrigin,
        )
    : redirectPath;

  if (user && !isLocalHostname(requestUrl.hostname)) {
    await recordUserEvent({
      profileId: user.id,
      eventName: 'kakao_auth_return',
      path: requestUrl.pathname,
      referrer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
      metadata: {
        login_type: isNewProfile ? 'new' : 'existing',
        next_path: finalPath,
      },
    }).catch((eventError) => {
      console.warn(
        'Kakao auth return event could not be recorded:',
        eventError instanceof Error ? eventError.message : eventError,
      );
    });
  }

  return NextResponse.redirect(new URL(finalPath, cleanOrigin));
}
