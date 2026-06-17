import { NextResponse } from 'next/server';
import { postLoginPath, safeInternalPath } from '@/lib/authRedirect';
import { createClient } from '@/lib/supabase/server';

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
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Supabase auth callback error:', error.message);
    return NextResponse.redirect(new URL('/', requestUrl.origin));
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
