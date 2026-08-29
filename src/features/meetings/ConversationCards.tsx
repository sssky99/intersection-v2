"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ConversationCardType = "smalltalk" | "deeptalk";

const conversationCardGroups: Record<
  ConversationCardType,
  { label: string; description: string; questions: string[] }
> = {
  smalltalk: {
    label: "스몰토크 카드",
    description: "조금 더 편하게 서로를 알아가는 질문",
    questions: [
      "외모보다 먼저 눈에 들어오는 매력은 무엇인가요?",
      "이상형을 성격 중심으로 한 문장으로 표현한다면?",
      "누군가의 어떤 사소한 행동에 은근히 설레나요?",
      "연애할 때 연락 빈도와 만나는 빈도 중 더 중요한 것은 무엇인가요?",
      "함께해보고 싶은 데이트가 있다면 무엇인가요?",
      "친구 같은 연애와 설레는 연애 중 어느 쪽을 선호하나요?",
      "첫 만남 이후 다시 만나고 싶어지는 사람은 어떤 사람인가요?",
    ],
  },
  deeptalk: {
    label: "딥토크 카드",
    description: "생각과 경험을 조금 더 깊이 나누는 질문",
    questions: [
      "가족을 제외하고, 여러분의 성장에 유독 큰 영향을 준 사람이 있나요?",
      "사람들이 여러분을 처음 봤을 때와, 조금 알고 난 뒤에 다르게 느끼는 부분이 있나요?",
      "당시에는 별거 아니라고 생각했지만, 결과적으로 여러분의 삶에 큰 영향을 준 결정이 있나요?",
      "과거의 한 해를 아무것도 바꾸지 않고 다시 살아볼 수 있다면, 어느 해를 선택하고 싶나요? 그 이유는 무엇인가요?",
      "지금 당장 아무 준비 없이도 3시간 동안 이야기할 수 있는 주제가 있나요?",
      "여러분의 스크린타임은 어떤 편인가요? 가장 자주 사용하는 앱은 무엇인가요?",
      "앞으로 1년 안에, 여러분의 삶에서 가장 달라졌으면 하는 부분이 있나요?",
    ],
  },
};

export function ConversationCards() {
  const reduceMotion = useReducedMotion();
  const [type, setType] = useState<ConversationCardType | null>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const group = type ? conversationCardGroups[type] : null;

  useEffect(() => {
    setIndex(0);
    setDirection(1);
  }, [type]);

  const move = (nextDirection: -1 | 1) => {
    if (!group) return;
    setDirection(nextDirection);
    setIndex((current) => {
      const next = current + nextDirection;
      if (next < 0) return group.questions.length - 1;
      if (next >= group.questions.length) return 0;
      return next;
    });
  };

  return (
    <section className="border-t border-black/8 py-6">
      <AnimatePresence mode="wait" initial={false}>
        {!group ? (
          <motion.div
            key="card-selector"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.22 }}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#24211d] text-[#faf8f3]">
                <MessageCircle size={17} aria-hidden />
              </span>
              <div>
                <h2 className="text-[15px] font-black text-[#24211d]">대화 카드</h2>
                <p className="mt-1 break-keep text-xs font-semibold leading-5 text-black/45">
                  지금 분위기에 맞는 대화를 골라보세요.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2.5">
              {(Object.keys(conversationCardGroups) as ConversationCardType[]).map(
                (cardType, cardIndex) => {
                  const cardGroup = conversationCardGroups[cardType];
                  return (
                    <button
                      key={cardType}
                      type="button"
                      onClick={() => setType(cardType)}
                      className="group flex min-h-[92px] w-full items-center justify-between gap-4 rounded-[22px] border border-[#d8d1c3] bg-[#f3eee5] px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:border-[#aaa294] hover:bg-[#eee8dc]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-black text-[#24211d]">
                          {cardGroup.label}
                        </span>
                        <span className="mt-1.5 block break-keep text-xs font-semibold leading-5 text-black/42">
                          {cardGroup.description}
                        </span>
                      </span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/8 bg-[#faf8f3] text-[11px] font-black text-black/42 transition group-hover:bg-[#24211d] group-hover:text-[#faf8f3]">
                        0{cardIndex + 1}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            <p className="mt-3 text-center text-[11px] font-bold leading-5 text-black/35">
              부담스러운 질문은 가볍게 넘겨도 괜찮아요.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={`card-carousel-${type}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.24 }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-black text-[#24211d]">{group.label}</h2>
                <p className="mt-1 truncate text-xs font-semibold text-black/42">
                  {group.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setType(null)}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/9 bg-[#faf8f3] px-3 text-[11px] font-black text-black/48 transition hover:border-black/18 hover:text-black/72"
              >
                <ArrowLeft size={13} aria-hidden />
                다시 고르기
              </button>
            </div>

            <div className="relative mt-5 px-2 pb-2 pt-1">
              <div
                aria-hidden
                className="absolute inset-x-5 bottom-1 top-4 rotate-[1.5deg] rounded-[24px] border border-[#d6cebf] bg-[#ded7ca]"
              />
              <div
                aria-hidden
                className="absolute inset-x-4 bottom-2 top-2 -rotate-[1deg] rounded-[24px] border border-[#d7cfbf] bg-[#ebe5da] shadow-[0_12px_26px_rgba(36,33,29,0.07)]"
              />

              <div className="relative h-[252px] touch-pan-y overflow-hidden rounded-[24px] border border-[#d4ccbd] bg-[#f7f4ed] shadow-[0_16px_34px_rgba(36,33,29,0.11)]">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.article
                    key={`${type}-${index}`}
                    custom={direction}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 90 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -90 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                    drag="x"
                    dragConstraints={{ left: -90, right: 90 }}
                    dragElastic={0.08}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -36 || info.velocity.x < -300) move(1);
                      if (info.offset.x > 36 || info.velocity.x > 300) move(-1);
                    }}
                    className="absolute inset-0 flex cursor-grab flex-col px-7 py-6 active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.1em] text-black/38">
                        <Sparkles size={12} aria-hidden />
                        {group.label}
                      </span>
                      <span className="text-[11px] font-black tabular-nums text-black/32">
                        {index + 1} / {group.questions.length}
                      </span>
                    </div>
                    <p className="my-auto break-keep font-serif text-[21px] font-semibold leading-[1.6] tracking-[-0.025em] text-[#24211d]">
                      {group.questions[index]}
                    </p>
                    <p className="text-[10px] font-bold text-black/28">
                      좌우로 밀어 다음 카드를 확인하세요
                    </p>
                  </motion.article>
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5" aria-label={`${index + 1} / ${group.questions.length}`}>
              {group.questions.map((_, dotIndex) => (
                <span
                  key={dotIndex}
                  aria-hidden
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    dotIndex === index ? "w-5 bg-black/72" : "w-1.5 bg-black/16",
                  )}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
