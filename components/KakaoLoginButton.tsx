'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createOAuthRedirectUrl } from '@/lib/authRedirect';

export default function KakaoLoginButton({
  className,
}: {
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const supabase = createClient();
    const origin = window.location.origin;
    const redirectTo = createOAuthRedirectUrl(origin);
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
      style={{ backgroundColor: '#fee500' }}
      className={[
        'flex h-14 w-full items-center justify-center rounded-full bg-[#fee500] px-5 text-[15px] font-bold text-black shadow-[0_12px_36px_rgba(0,0,0,0.18)] transition active:scale-[0.98] disabled:opacity-60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? '카카오로 이동 중...' : '카카오로 시작하기'}
    </button>
  );
}
