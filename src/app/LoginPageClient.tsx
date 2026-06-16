'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import KakaoLoginButton from '@/components/KakaoLoginButton';
import { createClient } from '@/lib/supabase/client';

export default function LoginPageClient() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        router.replace('/details');
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh justify-center bg-outer text-foreground">
      <main className="relative h-dvh min-h-dvh w-full max-w-[430px] overflow-hidden bg-background md:my-4 md:h-[calc(100dvh-32px)] md:min-h-0 md:rounded-[32px] md:shadow-frame">
        <section className="absolute inset-0 flex h-full min-h-full w-full flex-col overflow-hidden px-6 pb-7 pt-7 text-white">
          <Image
            src="/images/landing-cinematic.png"
            alt="교집합 시작 화면"
            fill
            priority
            sizes="430px"
            className="object-cover object-center saturate-[0.92]"
          />
          <div className="absolute inset-0 bg-black/72" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/90" />
          <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black via-black/86 to-transparent" />

          <header className="relative z-10 flex items-center justify-between">
            <span className="text-lg font-bold tracking-[0] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              교집합
            </span>
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
              beta
            </span>
          </header>

          <div className="relative z-10 mt-auto pb-7">
            <p className="text-xs font-semibold tracking-wider text-white/60">
              LOGIN REQUIRED
            </p>
            <h1 className="mt-3 text-balance text-[32px] font-bold leading-[1.12] tracking-tight text-white">
              교집합을 시작하려면
              <br />
              로그인이 필요해요.
            </h1>
            <p className="mt-4 max-w-[320px] text-[14px] leading-6 text-white/70">
              카카오로 로그인하면 내 프로필과 초대장 상태를 이어서 확인할 수 있어요.
            </p>
          </div>

          <div className="relative z-10">
            <KakaoLoginButton />
          </div>
        </section>
      </main>
    </div>
  );
}
