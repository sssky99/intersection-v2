import {
  meetingAtmosphereSummary,
  type MeetingAtmosphereGenderMood,
  type MeetingAtmosphereProfile,
} from "@/lib/meetingAtmosphere";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const moodCopy: Record<MeetingAtmosphereGenderMood, string> = {
  female: "현재 여성분들이 더 많은 관심을 보이고 있어요.",
  male: "현재 남성분들이 더 많은 관심을 보이고 있어요.",
  balanced: "현재 남녀 모두 고르게 관심을 보이고 있어요.",
};

const needlePosition: Record<MeetingAtmosphereGenderMood, string> = {
  male: "19%",
  balanced: "50%",
  female: "81%",
};

const seats = Array.from({ length: 6 }, (_, index) => index);

export function MeetingAtmospherePanel({
  profile,
  className,
}: {
  profile?: MeetingAtmosphereProfile | null;
  className?: string;
}) {
  const summary = meetingAtmosphereSummary(profile);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[12px] border border-black/[0.07] bg-[#f1ebe0] px-5 pb-5 pt-5",
        className,
      )}
    >
      <div className="relative flex items-center gap-4 border-b border-black/[0.07] pb-5">
        <div className="grid w-[74px] shrink-0 grid-cols-3 gap-1.5" aria-hidden>
          {seats.map((seat) => (
            <span
              key={seat}
              className={cn(
                "h-[18px] w-[18px] rounded-full border border-black",
                seat === 4 ? "bg-black" : "bg-[#e5dfd3]",
              )}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="break-keep text-[15px] font-black leading-[1.35] tracking-[-0.05em]">
            어떤 사람들이 함께하나요?
          </h3>
          <p className="mt-2 break-keep text-[11px] font-semibold leading-[1.65] text-black/45">
            제출한 답변을 운영자가 꼼꼼하게 확인하고 잘 어울릴 분들을 큐레이션해요.
            <span className="mt-1 block">나와 결이 잘 맞는 4~6명이 함께합니다.</span>
          </p>
        </div>
      </div>

      <div
        className="relative mt-4 flex items-center justify-between text-[9px] font-bold text-black/42"
        aria-label="성별 관심도 색상 안내"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#91a6b5]" aria-hidden />
          남성 선호
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#5f6952]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a8b596]" aria-hidden />
          모두 선호
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#bea0a9]" aria-hidden />
          여성 선호
        </span>
      </div>

      <div
        className="relative mx-auto mb-5 mt-7 w-full"
        role="img"
        aria-label={moodCopy[summary.genderMood]}
      >
        <div className="relative flex h-[13px] overflow-hidden rounded-full border border-black/[0.045] bg-black/[0.035] p-[2px] shadow-[inset_0_1px_3px_rgba(23,23,19,0.08)]">
          <span className="h-full w-[38%] rounded-l-full bg-[#91a6b5]" />
          <span className="h-full w-[24%] bg-[#a8b596]" />
          <span className="h-full w-[38%] rounded-r-full bg-[#bea0a9]" />
        </div>
        <span
          className="absolute top-1/2 h-[27px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#171713] shadow-[0_3px_8px_rgba(23,23,19,0.2)] transition-[left] duration-700"
          style={{ left: needlePosition[summary.genderMood] }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-[19px] flex justify-between px-0.5" aria-hidden>
          {Array.from({ length: 9 }, (_, index) => (
            <span
              key={index}
              className={cn("w-px bg-black/12", index === 4 ? "h-2" : "h-1")}
            />
          ))}
        </div>
      </div>

      <div className="relative border-t border-black/[0.07] pt-4 text-[11px] font-semibold leading-[1.65] text-black/55">
        <p>성비는 최대한 비슷하게 조정돼요.</p>
        <p className="mt-0.5">{moodCopy[summary.genderMood]}</p>
      </div>
    </div>
  );
}
