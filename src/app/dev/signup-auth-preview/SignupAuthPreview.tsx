"use client";

import { useState } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { useRouter } from "next/navigation";

export function SignupAuthPreview() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [enterCode, setEnterCode] = useState(false);
  const valid = enterCode ? code.length === 6 : /^010\d{8}$/.test(phone);
  const displayPhone = phone.replace(/^(\d{3})(\d{1,4})(\d{1,4})$/, "$1-$2-$3");

  return <MobileFrame>
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F1E8] px-8 text-[#171714] md:min-h-[calc(100dvh-32px)]">
      <form className="w-full max-w-[340px]" onSubmit={event => {
        event.preventDefault();
        if (!valid) return;
        if (enterCode) router.push("/dev/profile-type-preview");
        else setEnterCode(true);
      }}>
        <h1 className="mb-14 break-keep text-[22px] font-semibold leading-[1.45] tracking-[-0.045em]">
          {enterCode ? "6자리 인증번호를 입력해 주세요." : <>마지막으로 휴대폰 번호를 인증하고,<br />나의 유형을 확인해 보세요.</>}
        </h1>
        <input key={String(enterCode)} aria-label={enterCode ? "인증번호" : "휴대폰 번호"}
          className="h-16 w-full border-b border-black/25 bg-transparent text-2xl outline-none focus:border-black"
          inputMode={enterCode ? "numeric" : "tel"} placeholder={enterCode ? "000000" : "010-0000-0000"}
          value={enterCode ? code : displayPhone}
          onChange={event => {
            const digits = event.target.value.replace(/\D/g, "");
            if (enterCode) setCode(digits.slice(0, 6));
            else setPhone(digits.slice(0, 11));
          }} />
        <button disabled={!valid} className="mt-9 w-full rounded-full bg-[#252320] py-4 font-semibold text-white disabled:opacity-35">
          {enterCode ? "인증하고 내 유형 보기" : "인증번호 받기"}
        </button>
      </form>
    </main>
  </MobileFrame>;
}
