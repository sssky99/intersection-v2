"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { QuestionFlow } from "@/features/onboarding/QuestionFlow";
import type {
  ProfileQuestion,
  QuestionOption,
  StoredAnswerRow,
} from "@/types/question";

function optionLabel(
  options: Array<string | QuestionOption> | undefined,
  value: string,
) {
  const option = options?.find((item) =>
    typeof item === "string" ? item === value : item.value === value,
  );
  return typeof option === "string" ? option : option?.label ?? value;
}

function answerValues(question: ProfileQuestion, rows: StoredAnswerRow[]) {
  const row = rows.find(
    (item) => item.question_order === (question.order ?? question.id),
  );
  if (!row) return [];

  if (question.type === "text") {
    return [row.answer_text ?? row.answer_value ?? ""].filter(Boolean);
  }

  const values =
    question.type === "multi_choice"
      ? row.answer_values ?? []
      : [row.answer_value ?? ""].filter(Boolean);
  return values.map((value) => optionLabel(question.options, value));
}

function answerSummary(question: ProfileQuestion, rows: StoredAnswerRow[]) {
  const values = answerValues(question, rows);
  return values.length > 0 ? values.join(" · ") : "아직 답하지 않았어요";
}

export function ProfileQuestionSectionOverlay({
  userId,
  title,
  questions,
  answerRows,
  onClose,
  onAnswersChanged,
}: {
  userId: string;
  title: string;
  questions: ProfileQuestion[];
  answerRows: StoredAnswerRow[];
  onClose: () => void;
  onAnswersChanged: () => void | Promise<void>;
}) {
  const [selectedQuestion, setSelectedQuestion] =
    useState<ProfileQuestion | null>(null);
  const questionListScrollRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef(0);
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => answerValues(question, answerRows).length > 0)
        .length,
    [answerRows, questions],
  );
  const completionPercent = Math.round(
    (answeredCount / Math.max(questions.length, 1)) * 100,
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 18 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="absolute inset-0 z-50 overflow-hidden bg-[#f7f4ed]"
    >
      <AnimatePresence mode="wait" initial={false}>
        {selectedQuestion ? (
          <motion.div
            key={`edit-${selectedQuestion.id}`}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full overflow-y-auto bg-[#f7f4ed]"
          >
            <button
              type="button"
              aria-label={`${title} 질문 목록으로 돌아가기`}
              onClick={() => setSelectedQuestion(null)}
              className="absolute left-4 top-[calc(22px+env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-[#faf8f2]/95 text-black/65 shadow-sm backdrop-blur"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <QuestionFlow
              userId={userId}
              mode="preview"
              questionSet={[selectedQuestion]}
              hideProgressHeader
              initialRows={answerRows}
              onPreviewComplete={() =>
                Promise.resolve(onAnswersChanged()).then(() =>
                  setSelectedQuestion(null),
                )
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="question-list"
            ref={(node) => {
              questionListScrollRef.current = node;
              if (node) node.scrollTop = savedScrollTopRef.current;
            }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full overflow-y-auto pb-[calc(36px+env(safe-area-inset-bottom))]"
          >
            <header className="sticky top-0 z-10 grid grid-cols-[52px_1fr_64px] items-center border-b border-black/[0.07] bg-[#f7f4ed]/94 px-3 pb-4 pt-[calc(16px+env(safe-area-inset-top))] backdrop-blur-xl">
              <button
                type="button"
                aria-label="프로필로 돌아가기"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-black/55 transition hover:bg-black/[0.04] hover:text-black"
              >
                <ChevronLeft size={22} aria-hidden />
              </button>
              <h1 className="text-center text-[20px] font-semibold tracking-[-0.03em] text-black">
                {title}
              </h1>
              <span className="text-right text-[15px] font-black text-black">
                {completionPercent}%
              </span>
            </header>

            <main className="px-5 pt-10">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.16em] text-black/34">
                    profile section
                  </p>
                  <h2 className="mt-2 text-[27px] font-black tracking-[-0.05em] text-black">
                    질문
                  </h2>
                </div>
                <p className="pb-1 text-[11px] font-semibold text-black/36">
                  {answeredCount}/{questions.length} 완료
                </p>
              </div>

              <section className="overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#faf8f2] shadow-[0_18px_50px_rgba(24,24,20,0.05)]">
                {questions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => {
                      savedScrollTopRef.current =
                        questionListScrollRef.current?.scrollTop ?? 0;
                      setSelectedQuestion(question);
                    }}
                    className="flex w-full items-center gap-4 border-b border-black/[0.06] px-5 py-5 text-left transition last:border-b-0 hover:bg-[#f1eee6]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-extrabold leading-6 tracking-[-0.025em] text-black/78">
                        {question.question.replace(/\s+/g, " ")}
                      </span>
                      <span className="mt-1 block truncate text-[12px] font-semibold text-black/38">
                        {answerSummary(question, answerRows)}
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      aria-hidden
                      className="shrink-0 text-black/36"
                    />
                  </button>
                ))}
              </section>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
