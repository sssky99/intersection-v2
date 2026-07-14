'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createOAuthRedirectUrl, postLoginPath } from '@/lib/authRedirect';
import { trackEvent } from '@/lib/analytics';

export default function KakaoLoginButton({
  className,
  nextPath = postLoginPath,
  loadingLabel = '카카오로 이동 중...',
  variant = 'primary',
  children,
}: {
  className?: string;
  nextPath?: string;
  loadingLabel?: string;
  variant?: 'primary' | 'text';
  children?: ReactNode | ((loading: boolean) => ReactNode);
}) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const supabase = createClient();
    const origin = window.location.origin;
    const redirectTo = createOAuthRedirectUrl(origin, nextPath);
    trackEvent('kakao_login_click', {
      next_path: nextPath,
      provider: 'kakao',
    });
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo,
        // Supabase's Kakao provider injects profile/email scopes by default.
        // Keep Kakao login identifier-only by explicitly clearing provider scope.
        queryParams: {
          scope: '',
        },
      },
    });

    if (error) {
      console.error('Kakao login error:', error.message);
      alert('카카오 로그인 중 문제가 발생했어요.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      style={variant === 'primary' ? { backgroundColor: '#fee500' } : undefined}
      className={[
        variant === 'primary'
          ? 'flex h-14 w-full items-center justify-center rounded-full bg-[#fee500] px-5 text-[16px] font-extrabold text-black shadow-[0_12px_36px_rgba(0,0,0,0.18)] transition active:scale-[0.98] disabled:opacity-60'
          : 'inline-flex items-center justify-center bg-transparent text-inherit underline underline-offset-2 transition hover:opacity-70 disabled:opacity-40',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {typeof children === 'function'
        ? children(loading)
        : children || (loading ? loadingLabel : '카카오로 시작하기')}
    </button>
  );
}
