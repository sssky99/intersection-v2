"use client";

export default function MeetingsError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5f1] px-6 text-center">
      <section className="w-full max-w-sm rounded-3xl bg-white px-6 py-10 shadow-sm">
        <h1 className="text-xl font-bold text-[#171717]">
          정보를 불러오지 못했어요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#666]">
          잠시 연결이 불안정했어요. 다시 시도하면 현재 화면부터 이어집니다.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-2xl bg-[#171717] px-4 py-3 text-sm font-semibold text-white"
        >
          다시 시도하기
        </button>
      </section>
    </main>
  );
}
