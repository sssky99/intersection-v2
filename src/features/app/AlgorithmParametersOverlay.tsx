"use client";

import {
  profileSectionActivityQuestions,
  profileSectionBackgroundQuestions,
  profileSectionInterestQuestions,
  profileSectionPreferenceQuestions,
  profileSectionSelfQuestions,
  profileSectionTraitsQuestions,
  profileSectionValueQuestions,
  profileSectionValuesQuestions,
} from "@/data/profileDetailQuestions";
import type {
  ProfileQuestion,
  QuestionOption,
  StoredAnswerRow,
} from "@/types/question";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  Plus,
  SlidersHorizontal,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const parameterStorageKey = "intersection-algorithm-parameters-v1";
const maximumParameters = 3;

const questionSections = [
  { id: "background", label: "배경", questions: profileSectionBackgroundQuestions },
  { id: "activity", label: "활동성", questions: profileSectionActivityQuestions },
  { id: "interest", label: "흥미", questions: profileSectionInterestQuestions },
  { id: "values", label: "관점", questions: profileSectionValuesQuestions },
  { id: "preference", label: "선호", questions: profileSectionPreferenceQuestions },
  { id: "value", label: "가치", questions: profileSectionValueQuestions },
  { id: "traits", label: "성향", questions: profileSectionTraitsQuestions },
  { id: "self", label: "자기정보", questions: profileSectionSelfQuestions },
] as const;

type SectionId = (typeof questionSections)[number]["id"];
type ParameterMode = "similar" | "different";
type SavedParameter = { questionOrder: number; mode: ParameterMode };
type PickerStep = "main" | "categories" | "questions" | "direction";

function questionOrder(question: ProfileQuestion) {
  return question.order ?? question.id;
}

function oneLineQuestion(question: ProfileQuestion) {
  return question.question.replace(/\s*\n\s*/g, " ");
}

function optionLabel(
  options: Array<string | QuestionOption> | undefined,
  value: string,
) {
  const option = options?.find((item) =>
    typeof item === "string" ? item === value : item.value === value,
  );
  return typeof option === "string" ? option : option?.label ?? value;
}

function numericScaleRange(question: ProfileQuestion) {
  if (question.type !== "single_choice" || !question.options?.length) return null;
  const values = question.options.map((option) =>
    Number(typeof option === "string" ? option : option.value),
  );
  if (values.some((value) => !Number.isFinite(value))) return null;
  return `${Math.min(...values)}~${Math.max(...values)}`;
}

function answerSummary(question: ProfileQuestion, rows: StoredAnswerRow[]) {
  const row = rows.find(
    (item) => item.question_order === questionOrder(question),
  );
  if (!row) return "아직 답하지 않았어요";

  if (question.type === "text") {
    return row.answer_text ?? row.answer_value ?? "아직 답하지 않았어요";
  }

  const values = question.type === "multi_choice"
    ? row.answer_values ?? []
    : [row.answer_value ?? ""].filter(Boolean);
  const labels = values.map((value) => optionLabel(question.options, value));
  if (row.other_text?.trim()) labels.push(row.other_text.trim());
  const scaleRange = numericScaleRange(question);
  if (scaleRange && labels.length === 1) return `${labels[0]} (${scaleRange})`;
  return labels.length > 0 ? labels.join(" · ") : "아직 답하지 않았어요";
}

export function AlgorithmParametersOverlay({
  completionPercent,
  answeredCount,
  totalCount,
  answeredQuestionOrders,
  answerRows,
  unlocked,
  onClose,
  onAnswerMore,
}: {
  completionPercent: number;
  answeredCount: number;
  totalCount: number;
  answeredQuestionOrders: number[];
  answerRows: StoredAnswerRow[];
  unlocked: boolean;
  onClose: () => void;
  onAnswerMore: () => void;
}) {
  const [parameters, setParameters] = useState<SavedParameter[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [pickerStep, setPickerStep] = useState<PickerStep>("main");
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId | null>(null);
  const [selectedQuestionOrder, setSelectedQuestionOrder] = useState<number | null>(null);
  const answeredSet = useMemo(() => new Set(answeredQuestionOrders), [answeredQuestionOrders]);
  const allQuestions = useMemo(() => questionSections.flatMap((section) => section.questions), []);
  const questionByOrder = useMemo(
    () => new Map(allQuestions.map((question) => [questionOrder(question), question])),
    [allQuestions],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(parameterStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as SavedParameter[];
      if (!Array.isArray(parsed)) return;
      setParameters(
        parsed
          .filter(
            (item) =>
              Number.isFinite(item?.questionOrder) &&
              (item.mode === "similar" || item.mode === "different") &&
              questionByOrder.has(item.questionOrder),
          )
          .slice(0, maximumParameters),
      );
    } catch {
      // A malformed preview preference should never block the settings screen.
    } finally {
      setStorageReady(true);
    }
  }, [questionByOrder]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(parameterStorageKey, JSON.stringify(parameters));
    } catch {
      // Local preview persistence is optional.
    }
  }, [parameters, storageReady]);

  const selectedSection = questionSections.find((section) => section.id === selectedSectionId);
  const selectableQuestions = selectedSection?.questions.filter(
    (question) =>
      answeredSet.has(questionOrder(question)) &&
      !parameters.some((item) => item.questionOrder === questionOrder(question)),
  );
  const selectedQuestion = selectedQuestionOrder === null
    ? null
    : questionByOrder.get(selectedQuestionOrder) ?? null;

  function returnToMain() {
    setPickerStep("main");
    setSelectedSectionId(null);
    setSelectedQuestionOrder(null);
  }

  function addParameter(mode: ParameterMode) {
    if (selectedQuestionOrder === null) return;
    setParameters((current) => [
      ...current.filter((item) => item.questionOrder !== selectedQuestionOrder),
      { questionOrder: selectedQuestionOrder, mode },
    ].slice(0, maximumParameters));
    returnToMain();
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#f7f4ed] text-[#24211d] scrollbar-none"
      aria-label="알고리즘 파라미터 설정"
    >
      <div className="mx-auto min-h-full w-full max-w-[430px] px-5 pb-[calc(44px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={pickerStep === "main" ? onClose : returnToMain}
          aria-label={pickerStep === "main" ? "알고리즘 설정 닫기" : "파라미터 목록으로 돌아가기"}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-[#fbf8f1] text-black/48 shadow-sm"
        >
          {pickerStep === "main" ? (
            <ChevronDown size={22} strokeWidth={1.8} aria-hidden />
          ) : (
            <ArrowLeft size={20} strokeWidth={1.8} aria-hidden />
          )}
        </button>

        {pickerStep === "main" ? (
          <>
            <header className="mt-10 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d8d1c4] bg-[#fbf8f1] text-[#5f594f] shadow-[0_8px_24px_rgba(71,62,48,0.08)]">
                <WandSparkles size={29} strokeWidth={1.55} aria-hidden />
              </span>
              <p className="font-ticket-latin mt-6 text-[11px] font-bold italic uppercase tracking-[0.2em] text-black/32">DESIGN YOUR ALGORITHM</p>
              <h1 className="font-ticket-display mt-2 text-[30px] font-bold leading-[1.25] tracking-[-0.045em]">나만의 알고리즘</h1>
              <p className="mx-auto mt-3 max-w-[310px] break-keep text-[14px] font-semibold leading-6 text-black/48">
                새로운 사람을 만날 때 무엇이 중요한지<br />직접 조절해보세요.
              </p>
            </header>

            <section className="mt-10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black tracking-[0.08em] text-black/36">추가 질문 완성도</p>
                  <p className="mt-1 text-[12px] font-bold text-black/42">{answeredCount} / {totalCount}개 답변</p>
                </div>
                <strong className="font-ticket-latin text-[26px] font-bold tabular-nums text-black/72">{completionPercent}%</strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.08]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${completionPercent}%` }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-[#898173]" />
              </div>
              <p className="mt-2 text-right text-[11px] font-bold text-black/34">80%부터 파라미터 설정이 열려요.</p>
            </section>

            <section className="mt-9">
              <div className="flex items-end justify-between">
                <h2 className="font-ticket-display text-[22px] font-bold tracking-[-0.035em]">나의 파라미터</h2>
                {unlocked && <span className="font-ticket-latin text-[14px] font-bold text-black/36">{parameters.length}/{maximumParameters}</span>}
              </div>

              {unlocked ? (
                <div className="mt-4 space-y-3">
                  {parameters.map((parameter) => {
                    const question = questionByOrder.get(parameter.questionOrder);
                    if (!question) return null;
                    return (
                      <article key={parameter.questionOrder} className="rounded-[22px] border border-black/[0.08] bg-[#fbf8f1] px-4 py-4 shadow-[0_8px_24px_rgba(44,38,30,0.04)]">
                        <div className="flex items-start gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${parameter.mode === "similar" ? "bg-[#e8eadf] text-[#686f55]" : "bg-[#eee2df] text-[#8b625c]"}`}>
                            {parameter.mode === "similar" ? <ArrowUp size={17} strokeWidth={2} /> : <ArrowDown size={17} strokeWidth={2} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="break-keep text-[14px] font-black leading-5 tracking-[-0.025em] text-black/78">{oneLineQuestion(question)}</h3>
                            <p className="mt-1 break-keep text-[11px] font-bold leading-4 text-black/55">내 답변 · {answerSummary(question, answerRows)}</p>
                            <p className="mt-1 text-[11px] font-bold text-black/40">{parameter.mode === "similar" ? "나와 비슷한 답변을 우선해요" : "나와 다른 답변을 우선해요"}</p>
                          </div>
                          <button type="button" onClick={() => setParameters((current) => current.filter((item) => item.questionOrder !== parameter.questionOrder))} aria-label="파라미터 삭제" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/30 transition hover:bg-black/[0.05] hover:text-black/60">
                            <X size={16} strokeWidth={1.8} />
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {parameters.length < maximumParameters && (
                    <button type="button" onClick={() => setPickerStep("categories")} className="flex min-h-20 w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-black/[0.13] bg-black/[0.015] text-[13px] font-black text-black/48 transition active:scale-[0.99]">
                      <Plus size={18} strokeWidth={1.8} />새 파라미터 추가
                    </button>
                  )}
                  {parameters.length === 0 && <p className="px-4 text-center text-[11px] font-semibold leading-5 text-black/34">답변한 질문 중 중요한 항목을 직접 골라보세요.</p>}
                </div>
              ) : (
                <LockedParameters onAnswerMore={onAnswerMore} />
              )}
            </section>
          </>
        ) : (
          <ParameterPicker
            step={pickerStep}
            selectedSectionId={selectedSectionId}
            selectedQuestion={selectedQuestion}
            answerRows={answerRows}
            selectableQuestions={selectableQuestions ?? []}
            answeredSet={answeredSet}
            parameters={parameters}
            onStepChange={setPickerStep}
            onSectionSelect={(id) => { setSelectedSectionId(id); setPickerStep("questions"); }}
            onQuestionSelect={(order) => { setSelectedQuestionOrder(order); setPickerStep("direction"); }}
            onAdd={addParameter}
          />
        )}
      </div>
    </motion.section>
  );
}

function LockedParameters({ onAnswerMore }: { onAnswerMore: () => void }) {
  return (
    <div className="relative mt-4 overflow-hidden rounded-[26px] border border-dashed border-black/[0.12] bg-[#eee9df] px-5 py-8 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-35 blur-[3px]">
        <div className="mx-4 mt-5 h-16 rounded-2xl border border-black/10 bg-white/50" />
        <div className="mx-4 mt-3 h-16 rounded-2xl border border-black/10 bg-white/50" />
        <div className="mx-4 mt-3 h-16 rounded-2xl border border-black/10 bg-white/50" />
      </div>
      <div className="relative z-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-[#f8f4eb] text-black/48 shadow-sm"><LockKeyhole size={21} strokeWidth={1.8} /></span>
        <h3 className="mt-4 text-[18px] font-black tracking-[-0.035em]">아직 잠겨 있어요.</h3>
        <p className="mx-auto mt-2 max-w-[270px] break-keep text-[13px] font-semibold leading-6 text-black/48">추가 질문에 답해 잠금을 해제해보세요.</p>
        <button type="button" onClick={onAnswerMore} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#24211d] px-6 text-[13px] font-black text-[#faf6ed] shadow-[0_10px_24px_rgba(36,33,29,0.16)] transition active:scale-[0.98]">추가 질문에 답하기<ChevronRight size={16} strokeWidth={2.2} /></button>
      </div>
    </div>
  );
}

function ParameterPicker({
  step,
  selectedSectionId,
  selectedQuestion,
  answerRows,
  selectableQuestions,
  answeredSet,
  parameters,
  onStepChange,
  onSectionSelect,
  onQuestionSelect,
  onAdd,
}: {
  step: PickerStep;
  selectedSectionId: SectionId | null;
  selectedQuestion: ProfileQuestion | null;
  answerRows: StoredAnswerRow[];
  selectableQuestions: ProfileQuestion[];
  answeredSet: Set<number>;
  parameters: SavedParameter[];
  onStepChange: (step: PickerStep) => void;
  onSectionSelect: (id: SectionId) => void;
  onQuestionSelect: (order: number) => void;
  onAdd: (mode: ParameterMode) => void;
}) {
  if (step === "categories") {
    return (
      <section className="mt-8">
        <p className="font-ticket-latin text-[11px] font-bold italic uppercase tracking-[0.2em] text-black/32">CHOOSE A QUESTION</p>
        <h1 className="font-ticket-display mt-2 text-[28px] font-bold tracking-[-0.04em]">질문 분류를 선택하세요.</h1>
        <div className="mt-7 overflow-hidden rounded-[24px] border border-black/[0.09] bg-[#fbf8f1]">
          {questionSections.map((section) => {
            const availableCount = section.questions.filter((question) => answeredSet.has(questionOrder(question)) && !parameters.some((item) => item.questionOrder === questionOrder(question))).length;
            return (
              <button key={section.id} type="button" disabled={availableCount === 0} onClick={() => onSectionSelect(section.id)} className="flex min-h-[68px] w-full items-center justify-between border-b border-black/[0.07] px-5 text-left last:border-b-0 disabled:opacity-30">
                <span className="text-[16px] font-black">{section.label}</span>
                <span className="flex items-center gap-2 text-[12px] font-bold text-black/38">{availableCount}개 질문<ChevronRight size={17} strokeWidth={1.8} /></span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (step === "questions") {
    const section = questionSections.find((item) => item.id === selectedSectionId);
    return (
      <section className="mt-8">
        <button type="button" onClick={() => onStepChange("categories")} className="inline-flex items-center gap-1 text-[12px] font-bold text-black/38"><ArrowLeft size={15} />분류 다시 선택</button>
        <h1 className="font-ticket-display mt-4 text-[28px] font-bold tracking-[-0.04em]">{section?.label} 질문</h1>
        <p className="mt-2 text-[13px] font-semibold text-black/42">중요하게 생각하는 질문을 골라주세요.</p>
        <div className="mt-6 overflow-hidden rounded-[24px] border border-black/[0.09] bg-[#fbf8f1]">
          {selectableQuestions.map((question) => (
            <button key={questionOrder(question)} type="button" onClick={() => onQuestionSelect(questionOrder(question))} className="flex min-h-[76px] w-full items-center justify-between gap-4 border-b border-black/[0.07] px-5 py-4 text-left last:border-b-0">
              <span className="break-keep text-[13px] font-black leading-5">{oneLineQuestion(question)}</span>
              <ChevronRight size={17} strokeWidth={1.8} className="shrink-0 text-black/35" />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <button type="button" onClick={() => onStepChange("questions")} className="inline-flex items-center gap-1 text-[12px] font-bold text-black/38"><ArrowLeft size={15} />질문 다시 선택</button>
      <p className="font-ticket-latin mt-8 text-[11px] font-bold italic uppercase tracking-[0.2em] text-black/32">MAKE MY ALGORITHM</p>
      <h1 className="font-ticket-display mt-2 text-[27px] font-bold tracking-[-0.04em]">어떤 사람을 만나고 싶나요?</h1>
      <article className="mt-6 rounded-[24px] border border-black/[0.09] bg-[#fbf8f1] px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.045] text-black/48"><SlidersHorizontal size={17} strokeWidth={1.8} /></span>
        <p className="mt-4 break-keep text-[16px] font-black leading-6">{selectedQuestion ? oneLineQuestion(selectedQuestion) : "질문을 선택해주세요."}</p>
        {selectedQuestion && (
          <p className="mt-3 break-keep border-t border-black/[0.07] pt-3 text-[12px] font-bold leading-5 text-black/50">
            내 답변 · {answerSummary(selectedQuestion, answerRows)}
          </p>
        )}
      </article>
      <div className="mt-4 grid gap-3">
        <button type="button" onClick={() => onAdd("similar")} className="flex min-h-[78px] items-center gap-4 rounded-[22px] border border-[#cfd4c1] bg-[#f4f5ed] px-5 text-left transition active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dfe4d2] text-[#626c4e]"><ArrowUp size={20} strokeWidth={2.2} /></span>
          <span><strong className="block text-[15px] font-black">나와 비슷한 답변을 우선</strong><small className="mt-1 block text-[11px] font-bold text-black/38">공통점을 더 중요하게 봐요.</small></span>
          <Check size={17} className="ml-auto text-black/25" />
        </button>
        <button type="button" onClick={() => onAdd("different")} className="flex min-h-[78px] items-center gap-4 rounded-[22px] border border-[#dfcbc6] bg-[#f7efec] px-5 text-left transition active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eadbd7] text-[#8b625c]"><ArrowDown size={20} strokeWidth={2.2} /></span>
          <span><strong className="block text-[15px] font-black">나와 다른 답변을 우선</strong><small className="mt-1 block text-[11px] font-bold text-black/38">서로 다른 관점을 더 중요하게 봐요.</small></span>
          <Check size={17} className="ml-auto text-black/25" />
        </button>
      </div>
    </section>
  );
}
