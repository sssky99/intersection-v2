"use client";
import { SafeImage } from "@/components/SafeImage";
import { fallbackNickname } from "@/lib/memberDisplayName";
import { ticketFeedbackBodyText, ticketStageText } from "@/lib/ticketStageCopy";
import type { UserTicket } from "@/types/ticket";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }

type MeetingRatingKey = "firstPlace" | "secondPlace" | "recommendation";
type MeetingRatings = Record<MeetingRatingKey, number | null>;
type MemberReflectionChoice = "interested" | "enough" | "no_show";
type ConnectionStrength = 1 | 2 | 3 | 4;

function memberRealName(member: UserTicket["members"][number]) {
  return member.name?.trim() || member.nickname?.trim() || "멤버";
}

function feedbackOwnerPossessive(member?: UserTicket["members"][number]) {
  return `${feedbackOwnerHonorific(member)}의`;
}

function feedbackOwnerHonorific(member?: UserTicket["members"][number]) {
  const displayName = member?.nickname?.trim() || member?.name?.trim() || "회원";
  return displayName.endsWith("님") ? displayName : `${displayName}님`;
}

export function TicketFeedbackForm({
  userTicket,
  previewMode = false,
}: {
  userTicket: UserTicket;
  previewMode?: boolean;
}) {
  const selfMember = useMemo(
    () => userTicket.members.find((member) => member.isSelf),
    [userTicket.members],
  );
  const feedbackOwner = feedbackOwnerPossessive(selfMember);
  const feedbackOwnerName = feedbackOwnerHonorific(selfMember);
  const feedbackTitle = ticketStageText(userTicket.ticket.stageCopy, "feedbackTitle");
  const feedbackBody = ticketFeedbackBodyText(
    userTicket.ticket.stageCopy,
    feedbackOwner,
  );
  const otherMembers = useMemo(
    () => userTicket.members.filter((member) => !member.isSelf),
    [userTicket.members],
  );
  const selfGender = selfMember?.gender ?? null;
  const overallMembers = useMemo(
    () =>
      (userTicket.feedbackMembers ?? userTicket.members).filter(
        (member) => !member.isSelf,
      ),
    [userTicket.feedbackMembers, userTicket.members],
  );
  const dateCandidateMembers = useMemo(
    () =>
      otherMembers
        .filter(
          (member) =>
            !selfGender || !member.gender || member.gender !== selfGender,
        )
        .slice(0, 3),
    [otherMembers, selfGender],
  );
  const joinsAtSecondActivity =
    (userTicket.ticket.startsFromStageSequence ?? 1) > 1;
  const feedbackStepOrder = joinsAtSecondActivity
    ? ([1, 3, 4, 5] as const)
    : ([0, 1, 2, 3, 4, 5] as const);
  const firstPlaceName =
    joinsAtSecondActivity
      ? null
      : userTicket.ticket.courseSteps?.[0]?.placeName?.trim() || "1차 장소";
  const secondPlaceName =
    (joinsAtSecondActivity
      ? userTicket.ticket.courseSteps?.[0]?.placeName?.trim()
      : userTicket.ticket.courseSteps?.[1]?.placeName?.trim()) || "2차 장소";
  const [meetingRatings, setMeetingRatings] = useState<MeetingRatings>({
    firstPlace: null,
    secondPlace: null,
    recommendation: null,
  });
  const [memberReflections, setMemberReflections] = useState<
    Record<string, MemberReflectionChoice>
  >({});
  const [connectionStrengths, setConnectionStrengths] = useState<
    Record<string, ConnectionStrength>
  >({});
  const [reflectionMemberIndex, setReflectionMemberIndex] = useState(0);
  const [vibeMemberIds, setVibeMemberIds] = useState<string[]>([]);
  const [vibeMembersUnsure, setVibeMembersUnsure] = useState(false);
  const [disruptiveMemberNote, setDisruptiveMemberNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedbackStepIndex, setFeedbackStepIndex] = useState(0);
  const [feedbackStepDirection, setFeedbackStepDirection] = useState(1);
  const [feedbackPhotoPreview, setFeedbackPhotoPreview] = useState<{
    url: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setMeetingRatings({ firstPlace: null, secondPlace: null, recommendation: null });
    setMemberReflections({});
    setConnectionStrengths({});
    setReflectionMemberIndex(0);
    setVibeMemberIds([]);
    setVibeMembersUnsure(false);
    setDisruptiveMemberNote("");
    setSubmitting(false);
    setSubmitted(false);
    setSubmitError(null);
    setFeedbackStepIndex(0);
    setFeedbackStepDirection(1);
    setFeedbackPhotoPreview(null);
  }, [joinsAtSecondActivity, otherMembers, overallMembers, userTicket.waitlistId]);

  useEffect(() => {
    if (!feedbackPhotoPreview) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFeedbackPhotoPreview(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [feedbackPhotoPreview]);

  const meetingRatingsComplete = joinsAtSecondActivity
    ? typeof meetingRatings.secondPlace === "number" &&
      typeof meetingRatings.recommendation === "number"
    : Object.values(meetingRatings).every(
        (value) => typeof value === "number",
      );
  const canSubmit = meetingRatingsComplete;
  const feedbackStepCount = feedbackStepOrder.length;
  const feedbackStep = feedbackStepOrder[feedbackStepIndex] ?? feedbackStepOrder[0];
  const dateMemberIds = dateCandidateMembers
    .filter((member) => memberReflections[member.id] === "interested")
    .map((member) => member.id);
  const noShowMemberIds = dateCandidateMembers
    .filter((member) => memberReflections[member.id] === "no_show")
    .map((member) => member.id);
  const dateMemberReflectionsComplete = dateCandidateMembers.every(
    (member) => memberReflections[member.id],
  );
  const activeReflectionMember =
    dateCandidateMembers[reflectionMemberIndex] ?? dateCandidateMembers[0];
  const overallCandidateMembers = overallMembers.filter(
    (member) =>
      !dateCandidateMembers.some((candidate) => candidate.id === member.id),
  );
  const canAdvanceFeedbackStep =
    (feedbackStep === 0 && dateMemberReflectionsComplete) ||
    (feedbackStep === 1 && (vibeMemberIds.length > 0 || vibeMembersUnsure)) ||
    (feedbackStep === 2 && meetingRatings.firstPlace !== null) ||
    (feedbackStep === 3 && meetingRatings.secondPlace !== null) ||
    (feedbackStep === 4 && meetingRatings.recommendation !== null);
  const selectedPositiveMemberIds = Array.from(
    new Set([...dateMemberIds, ...vibeMemberIds]),
  );

  const selectMemberReflection = (
    memberId: string,
    choice: MemberReflectionChoice,
  ) => {
    setMemberReflections((current) => ({ ...current, [memberId]: choice }));
    if (choice === "interested" || choice === "no_show") {
      setVibeMemberIds((current) => current.filter((id) => id !== memberId));
    }
  };

  const advanceReflectionMember = (memberId: string) => {
    const selectedIndex = dateCandidateMembers.findIndex(
      (member) => member.id === memberId,
    );
    if (selectedIndex < 0 || selectedIndex >= dateCandidateMembers.length - 1) return;
    window.setTimeout(() => {
      setReflectionMemberIndex((current) =>
        current === selectedIndex ? selectedIndex + 1 : current,
      );
    }, 220);
  };

  const selectConnectionStrength = (
    memberId: string,
    strength: ConnectionStrength,
  ) => {
    setConnectionStrengths((current) => ({ ...current, [memberId]: strength }));
    selectMemberReflection(memberId, strength >= 3 ? "interested" : "enough");
    advanceReflectionMember(memberId);
  };

  const selectNoShowMember = (memberId: string) => {
    setConnectionStrengths((current) => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });
    selectMemberReflection(memberId, "no_show");
    advanceReflectionMember(memberId);
  };

  const selectVibeMember = (memberId: string) => {
    setVibeMembersUnsure(false);
    setVibeMemberIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }
      return current.length >= 3 ? current : [...current, memberId];
    });
  };

  const moveFeedbackStep = (nextStepIndex: number) => {
    const boundedStep = Math.max(
      0,
      Math.min(feedbackStepCount - 1, nextStepIndex),
    );
    setFeedbackStepDirection(boundedStep >= feedbackStepIndex ? 1 : -1);
    setFeedbackStepIndex(boundedStep);
    setSubmitError(null);
  };

  const selectMeetingRating = (key: MeetingRatingKey, rating: number) => {
    const nextStepIndex = feedbackStepIndex + 1;
    setMeetingRatings((current) => ({ ...current, [key]: rating }));
    window.setTimeout(() => moveFeedbackStep(nextStepIndex), 220);
  };

  const autoAdvancesAfterChoice =
    feedbackStep === 2 || feedbackStep === 3 || feedbackStep === 4;

  const submitLabel = (() => {
    if (submitting) return "저장 중이에요";
    if (!meetingRatingsComplete) return "장소 별점을 남겨주세요";
    return "피드백 제출하기";
  })();

  const payloadMemberFeedback = () => {
    return Object.fromEntries(
      [
        ...dateCandidateMembers
          .filter((member) => memberReflections[member.id])
          .map((member) => [member.id, memberReflections[member.id]] as const),
        ...vibeMemberIds
          .filter((memberId) => !memberReflections[memberId])
          .map((memberId) => [memberId, "interested" as const] as const),
      ].map(([memberId, connectionIntent]) => [
        memberId,
        {
          status: "done",
          connection_intent: connectionIntent,
          connection_strength: connectionStrengths[memberId] ?? null,
          temperature: null,
          texture: null,
          tone: null,
          rhythm: null,
        },
      ]),
    );
  };

  const payloadMeetingFeedback = () => ({
    place_ratings: {
      first: joinsAtSecondActivity
        ? null
        : {
            name: firstPlaceName,
            rating: meetingRatings.firstPlace,
          },
      second: {
        name: secondPlaceName,
        rating: meetingRatings.secondPlace,
      },
    },
    recommendation_rating: meetingRatings.recommendation,
    dinner_member_ids: dateMemberIds,
    overall_member_ids: vibeMemberIds,
    dinner_member_unsure: false,
    overall_member_unsure: vibeMembersUnsure,
    negative_member_feedback: Object.fromEntries(
      noShowMemberIds.map((memberId) => [memberId, { reasons: ["no_show"] }]),
    ),
    disruptive_member_note: disruptiveMemberNote.trim() || null,
  });

  const submitFeedback = async () => {
    if (submitting || !canSubmit) return;
    if (previewMode) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/meetings/my-tickets/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waitlistId: userTicket.waitlistId,
          selectedMemberIds: selectedPositiveMemberIds,
          memberFeedback: payloadMemberFeedback(),
          placeFeedback: payloadMeetingFeedback(),
        }),
      });

      if (!response.ok) throw new Error("feedback-submit-failed");

      setSubmitted(true);
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setSubmitError("피드백을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  if (
    submitted ||
    userTicket.rawStatus === "feedback_done" ||
    userTicket.rawStatus === "completed"
  ) {
    return (
      <div className="py-5">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600">
            <Check size={20} aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-black text-emerald-950">
            피드백 작성을 완료했어요.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800/70">
            이 모임은 채팅이 닫힐 때까지 티켓 목록에 남아 있어요.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="py-5">
      <section>
        <h2 className="text-[22px] font-black text-black">{feedbackTitle}</h2>
        <div className="mt-2 space-y-1.5 text-sm leading-6">
          <p className="font-semibold text-black/52">{feedbackBody}</p>
          <p className="font-bold text-black/65">
            교집합이 {feedbackOwnerName}에게 잘 맞는 사람을 찾아가는 데에는{" "}
            <strong className="font-black text-black">평균 다섯 번</strong>의 참여와
            피드백이 필요해요.
          </p>
        </div>
      </section>

      <div className="mt-8 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={feedbackStepDirection}>
          <motion.section
            key={feedbackStep}
            custom={feedbackStepDirection}
            initial={{ opacity: 0, x: feedbackStepDirection * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: feedbackStepDirection * -20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-[340px] py-2"
          >
            {feedbackStep === 0 && (
              activeReflectionMember ? (
                <div className="pb-3 pt-1 text-[#24211d]">
                  <div className="flex items-center justify-end">
                    <span className="text-[11px] font-bold tabular-nums text-black/42">
                      {reflectionMemberIndex + 1} / {dateCandidateMembers.length}
                    </span>
                  </div>
                  <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-black/[0.09]">
                    <motion.div
                      className="h-full rounded-full bg-[#24211d]"
                      animate={{
                        width: `${((reflectionMemberIndex + 1) / dateCandidateMembers.length) * 100}%`,
                      }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    />
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeReflectionMember.id}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -14 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <h3 className="mt-8 break-keep font-serif text-[27px] font-semibold leading-[1.18] tracking-[-0.025em] text-[#24211d]">
                        {memberRealName(activeReflectionMember)}님을 조금 더 알아가고
                        싶은가요?
                      </h3>
                      <button
                        type="button"
                        disabled={!activeReflectionMember.photoUrl}
                        onClick={() => {
                          if (!activeReflectionMember.photoUrl) return;
                          setFeedbackPhotoPreview({
                            url: activeReflectionMember.photoUrl,
                            name: memberRealName(activeReflectionMember),
                          });
                        }}
                        className="mt-6 flex items-center gap-3 text-left disabled:cursor-default"
                      >
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.08] bg-[#e2dccf] text-[10px] font-black text-black/45">
                          {fallbackNickname(
                            activeReflectionMember.nickname || activeReflectionMember.name,
                          )}
                          {activeReflectionMember.photoUrl && (
                            <SafeImage
                              src={activeReflectionMember.photoUrl}
                              alt=""
                              draggable={false}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span>
                          <strong className="block font-serif text-[18px] font-semibold text-[#24211d]">
                            {memberRealName(activeReflectionMember)}
                          </strong>
                          <span className="mt-0.5 block text-[11px] font-semibold text-black/36">
                            {activeReflectionMember.photoUrl
                              ? "사진을 눌러 다시 보기"
                              : "오늘 함께한 멤버"}
                          </span>
                        </span>
                      </button>

                      <div className="mt-9 border-y border-black/[0.08] py-5">
                        <div className="grid grid-cols-4 gap-2">
                          {([1, 2, 3, 4] as const).map((strength) => {
                            const selected =
                              connectionStrengths[activeReflectionMember.id] ===
                              strength;
                            return (
                              <button
                                key={strength}
                                type="button"
                                aria-label={`다시 만나고 싶은 정도 ${strength}점`}
                                aria-pressed={selected}
                                onClick={() =>
                                  selectConnectionStrength(
                                    activeReflectionMember.id,
                                    strength,
                                  )
                                }
                                className={cn(
                                  "flex h-12 items-center justify-center rounded-xl border text-sm font-black transition-all",
                                  selected
                                    ? "border-[#24211d] bg-[#24211d] text-[#faf8f3] shadow-[0_8px_18px_rgba(36,33,29,0.16)]"
                                    : "border-[#d8d1c3] bg-[#f7f4ed] text-black/48 hover:border-[#aaa294] hover:bg-white hover:text-[#24211d]",
                                )}
                              >
                                {strength}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-5 text-[10px] font-bold leading-4 text-black/42">
                          <span className="max-w-[115px]">오늘 만남으로 충분해요</span>
                          <span className="max-w-[115px] text-right">
                            조금 더 알아가고 싶어요
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex gap-1.5">
                          {dateCandidateMembers.map((member, index) => (
                            <button
                              key={member.id}
                              type="button"
                              aria-label={`${index + 1}번째 멤버 응답으로 이동`}
                              onClick={() => setReflectionMemberIndex(index)}
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                index === reflectionMemberIndex
                                  ? "w-5 bg-[#24211d]"
                                  : memberReflections[member.id]
                                    ? "w-1.5 bg-black/45"
                                    : "w-1.5 bg-black/[0.12]",
                              )}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          aria-pressed={
                            memberReflections[activeReflectionMember.id] === "no_show"
                          }
                          onClick={() => selectNoShowMember(activeReflectionMember.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[10px] font-bold transition",
                            memberReflections[activeReflectionMember.id] === "no_show"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-black/[0.09] bg-white/45 text-black/50 hover:border-red-200 hover:bg-red-50 hover:text-red-600",
                          )}
                        >
                          노쇼했어요
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-[#cfc6b6] bg-[#e8e1d5] px-3 py-2.5 text-[11px] font-bold leading-[1.55] text-black/65">
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-[15px] shadow-sm"
                    >
                      💌
                    </span>
                    <p>
                      서로 3점 이상을 선택하면 교집합이 블라인드 데이트를
                      준비해드려요.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
                  선택 가능한 멤버가 없어요.
                </p>
              )
            )}

            {feedbackStep === 1 && (
              <>
                <h3 className="text-[17px] font-black leading-7 text-black">
                  전체 멤버 중에서 단 둘이 만나고 싶은 사람이 있나요?
                  <span className="block font-medium text-black/35">
                    (최대 3명까지 선택 가능)
                  </span>
                </h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-black/42">
                  서로 선택한 경우 1:1 만남 자리를 준비해드려요.
                </p>
                {overallCandidateMembers.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {overallCandidateMembers.map((member) => {
                      const selected = vibeMemberIds.includes(member.id);
                      return (
                        <div
                          key={member.id}
                          className={cn(
                            "inline-flex min-h-10 items-center gap-2 rounded-full border py-1.5 pl-2 text-sm font-bold transition",
                            selected
                              ? "border-black bg-black text-white"
                              : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/62 hover:border-[#aaa294] hover:text-[#24211d]",
                          )}
                        >
                          {member.photoUrl ? (
                            <button
                              type="button"
                              aria-label={`${memberRealName(member)} 사진 크게 보기`}
                              onClick={() =>
                                setFeedbackPhotoPreview({
                                  url: member.photoUrl!,
                                  name: memberRealName(member),
                                })
                              }
                              className={cn(
                                "relative h-7 w-7 shrink-0 overflow-hidden rounded-full border transition active:scale-95",
                                selected
                                  ? "border-white/20 bg-white/12"
                                  : "border-black/8 bg-[#e2dccf]",
                              )}
                            >
                              <SafeImage
                                src={member.photoUrl}
                                alt=""
                                draggable={false}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </button>
                          ) : (
                            <span
                              aria-hidden
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-black opacity-55",
                                selected
                                  ? "border-white/20 bg-white/12"
                                  : "border-black/8 bg-[#e2dccf]",
                              )}
                            >
                                {fallbackNickname(member.nickname || member.name)}
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={!selected && vibeMemberIds.length >= 3}
                            onClick={() => selectVibeMember(member.id)}
                            className="min-h-7 pr-4 text-left disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {memberRealName(member)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-6 bg-black/[0.03] px-4 py-4 text-sm font-semibold leading-6 text-black/50">
                    함께한 멤버 정보가 없어요.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setVibeMemberIds([]);
                    setVibeMembersUnsure(true);
                  }}
                  className={cn(
                    "mt-3 min-h-10 rounded-full border px-4 text-sm font-bold transition",
                    vibeMembersUnsure
                      ? "border-black bg-black text-white"
                      : "border-[#d8d1c3]/90 bg-[#eee9df] text-[#24211d]/62 hover:border-[#aaa294] hover:text-[#24211d]",
                  )}
                >
                  잘 모르겠어요
                </button>
              </>
            )}

            {feedbackStep === 2 && (
              <MeetingStarRating
                label={`1차 장소 평가 (${firstPlaceName})`}
                value={meetingRatings.firstPlace}
                onChange={(rating) => selectMeetingRating("firstPlace", rating)}
              />
            )}

            {feedbackStep === 3 && (
              <MeetingStarRating
                label={`2차 장소 평가 (${secondPlaceName})`}
                value={meetingRatings.secondPlace}
                onChange={(rating) => selectMeetingRating("secondPlace", rating)}
              />
            )}

            {feedbackStep === 4 && (
              <MeetingStarRating
                label="교집합을 친구에게 추천해주시겠어요?"
                lowLabel="추천하지 않아요"
                highLabel="추천하고 싶어요"
                value={meetingRatings.recommendation}
                onChange={(rating) => selectMeetingRating("recommendation", rating)}
              />
            )}

            {feedbackStep === 5 && (
              <>
                <h3 className="text-[17px] font-black leading-7 text-black">
                  불편 신고
                  <span className="ml-1 font-medium text-black/35">(선택)</span>
                </h3>
                <label
                  htmlFor={`disruptive-member-note-${userTicket.waitlistId}`}
                  className="mt-3 block text-sm font-semibold leading-6 text-black/55"
                >
                  모임 분위기를 해치거나, 주변 사람들의 기분을 상하게 하는 사람이
                  있다면 적어주세요.
                </label>
                <textarea
                  id={`disruptive-member-note-${userTicket.waitlistId}`}
                  value={disruptiveMemberNote}
                  maxLength={500}
                  rows={6}
                  placeholder="내용을 입력해주세요."
                  onChange={(event) => setDisruptiveMemberNote(event.target.value)}
                  className="mt-6 w-full resize-none rounded-2xl border border-[#d8d1c3]/90 bg-[#eee9df] px-4 py-3 text-sm font-semibold leading-6 text-[#24211d] outline-none placeholder:text-[#24211d]/28 focus:border-[#aaa294]"
                />
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {submitError && (
        <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="이전 질문"
          disabled={feedbackStepIndex === 0 || submitting}
          onClick={() => moveFeedbackStep(feedbackStepIndex - 1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d8d1c3] bg-[#eee9df] text-[#24211d] transition disabled:invisible"
        >
          <ChevronLeft size={19} aria-hidden />
        </button>
        {feedbackStepIndex < feedbackStepCount - 1 &&
        canAdvanceFeedbackStep &&
        !autoAdvancesAfterChoice ? (
          <button
            type="button"
            aria-label="다음 질문"
            onClick={() => moveFeedbackStep(feedbackStepIndex + 1)}
            className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#24211d] text-[#faf8f3] shadow-[0_10px_24px_rgba(36,33,29,0.18)] transition hover:bg-black"
          >
            <ArrowRight size={19} aria-hidden />
          </button>
        ) : feedbackStepIndex === feedbackStepCount - 1 ? (
          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={() => void submitFeedback()}
            className="h-12 flex-1 rounded-full bg-[#24211d] text-sm font-black text-[#faf8f3] shadow-[0_10px_24px_rgba(36,33,29,0.18)] transition hover:bg-black disabled:cursor-not-allowed disabled:bg-black/20 disabled:shadow-none"
          >
            {submitLabel}
          </button>
        ) : null}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {feedbackPhotoPreview && (
              <motion.div
                key="feedback-photo-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFeedbackPhotoPreview(null)}
                className="fixed inset-0 z-[150] flex items-center justify-center bg-black/58 px-6 backdrop-blur-[3px]"
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${feedbackPhotoPreview.name} 프로필 사진`}
                  initial={{ opacity: 0, scale: 0.92, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(event) => event.stopPropagation()}
                  className="relative w-[min(66vw,272px)] overflow-hidden rounded-[22px] border border-white/18 bg-[#eee9df] p-2.5 shadow-[0_28px_80px_rgba(0,0,0,0.34)]"
                >
                  <button
                    type="button"
                    aria-label="사진 닫기"
                    onClick={() => setFeedbackPhotoPreview(null)}
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/72 text-white shadow-sm backdrop-blur transition hover:bg-black"
                  >
                    <X size={17} aria-hidden />
                  </button>
                  <SafeImage
                    src={feedbackPhotoPreview.url}
                    alt={`${feedbackPhotoPreview.name} 프로필`}
                    className="max-h-[58vh] w-full rounded-[16px] object-contain"
                    onLoadError={() => setFeedbackPhotoPreview(null)}
                  />
                  <p className="px-1 pb-1 pt-3 text-center text-sm font-black text-[#24211d]">
                    {feedbackPhotoPreview.name}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function MeetingStarRating({
  highLabel = "좋았어요",
  label,
  lowLabel = "아쉬워요",
  onChange,
  value,
}: {
  highLabel?: string;
  label: string;
  lowLabel?: string;
  onChange: (rating: number) => void;
  value: number | null;
}) {
  return (
    <div>
      <p className="text-sm font-black leading-6 text-black">{label}</p>
      <div
        className="mt-3 grid"
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;

          return (
            <motion.button
              key={rating}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onChange(rating)}
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${rating}점`}
              className={cn(
                "relative flex h-12 min-w-0 items-center justify-center bg-transparent text-[22px] font-medium tabular-nums transition",
                selected
                  ? "scale-125 font-black text-black"
                  : "text-black/18 hover:text-black/50",
              )}
            >
              <span>{rating}</span>
              {selected && (
                <motion.span
                  layoutId={`meeting-rating-${label}`}
                  className="absolute bottom-0 h-0.5 w-5 rounded-full bg-black"
                />
              )}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold text-black/35">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
