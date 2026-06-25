"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MembershipPlan } from "@/features/membership/membershipTypes";

export type CurrentMembership = {
  planId: MembershipPlan;
  startedAt?: string | null;
  expiresAt?: string | null;
} | null;

type MembershipPlanOption = {
  id: MembershipPlan;
  title: string;
  shortTitle: string;
  months: number;
  price: string;
  originalPrice?: string;
  monthlyPrice: string;
  discountRateLabel?: string;
  savingsLabel?: string;
  recommended?: boolean;
  periodText: string;
  storeUrl: string;
};

const membershipPlanOptions: MembershipPlanOption[] = [
  {
    id: "one_month",
    title: "1개월 멤버십",
    shortTitle: "1개월",
    months: 1,
    price: "20,000원",
    monthlyPrice: "20,000원",
    periodText: "첫 모임을 시작한 날로부터 한 달",
    storeUrl:
      "https://smartstore.naver.com/intersection_blinddate/products/13643025427",
  },
  {
    id: "three_months",
    title: "3개월 멤버십",
    shortTitle: "3개월",
    months: 3,
    price: "50,000원",
    originalPrice: "60,000원",
    monthlyPrice: "16,667원",
    discountRateLabel: "16.7% 할인",
    savingsLabel: "10,000원 절약",
    recommended: true,
    periodText: "첫 모임을 시작한 날로부터 세 달",
    storeUrl:
      "https://m.smartstore.naver.com/intersection_blinddate/products/13621500025",
  },
  {
    id: "six_months",
    title: "6개월 멤버십",
    shortTitle: "6개월",
    months: 6,
    price: "90,000원",
    originalPrice: "120,000원",
    monthlyPrice: "15,000원",
    discountRateLabel: "25% 할인",
    savingsLabel: "30,000원 절약",
    periodText: "첫 모임을 시작한 날로부터 여섯 달",
    storeUrl:
      "https://m.smartstore.naver.com/intersection_blinddate/products/13623599558",
  },
];

const defaultSelectedPlanId: MembershipPlan = "three_months";

const membershipBenefitTexts = [
  "이용 기간 동안 교집합 초대장에 무제한으로 신청할 수 있어요.",
  "참여할수록 알고리즘이 정교화되어, 나에게 더 맞는 사람을 추천해줘요.",
  "서로 마음이 통했다면 1:1 데이트 자리를 준비해드려요.",
  "멤버십 기간은 결제일이 아니라 첫 모임 시작일 기준으로 적용돼요.",
  "자동 결제는 발생하지 않아요.",
] as const;

const membershipPurchaseNoticeParagraphGroups = [
  [
    "교집합은 단순한 선착순 모임이 아니라, 서로의 결이 잘 맞을 수 있는 조합과 구성을 중요하게 생각해요.",
    "따라서 신청하신 일정이나 초대장에 따라 참여가 확정되지 않을 수 있어요.",
    "만약 참여가 확정되지 않아 실제로 모임에 참여하지 못하게 되는 경우, 결제하신 금액은 100% 환불돼요.",
  ],
  [
    "교집합은 모든 참가자가 편안하고 안전하게 만날 수 있는 자리를 지향해요.",
    "노쇼, 불쾌한 언행, 노골적인 이성 목적의 접근 등은 강력하게 금해요.",
    "위 기준을 위반하여 다른 참가자에게 부담 혹은 피해를 주는 경우, 이후 교집합이 진행하는 모든 콘텐츠 참여가 제한돼요.",
  ],
] as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function MembershipFloatingButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="멤버십 선택"
      aria-label="멤버십 선택"
      className="absolute right-[68px] top-[calc(14px+env(safe-area-inset-top))] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <img
        src="/images/icons/membership-diamond-v2.png"
        alt=""
        draggable={false}
        className="h-5 w-5 object-contain"
        aria-hidden
      />
    </button>
  );
}

export function MembershipModal({
  open,
  currentMembership,
  onClose,
}: {
  open: boolean;
  currentMembership: CurrentMembership;
  onClose: () => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<MembershipPlan>(
    defaultSelectedPlanId,
  );
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPlanId(defaultSelectedPlanId);
      setPurchaseError(null);
      setNoticeOpen(false);
    }
  }, [open]);

  const selectedPlan = useMemo(
    () =>
      membershipPlanOptions.find((plan) => plan.id === selectedPlanId) ??
      membershipPlanOptions.find((plan) => plan.id === defaultSelectedPlanId) ??
      membershipPlanOptions[0],
    [selectedPlanId],
  );

  const openPurchaseNotice = () => {
    if (purchaseSaving) return;

    setPurchaseError(null);
    setNoticeOpen(true);
  };

  const closePurchaseNotice = () => {
    if (purchaseSaving) return;

    setNoticeOpen(false);
  };

  const closeMembershipModal = () => {
    if (purchaseSaving) return;

    setNoticeOpen(false);
    onClose();
  };

  const startPurchase = async () => {
    if (purchaseSaving) return;

    setPurchaseSaving(true);
    setPurchaseError(null);

    try {
      const response = await fetch("/api/membership/purchase-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan.id }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setPurchaseError(
          data?.error ?? "멤버십 신청 상태를 저장하지 못했습니다.",
        );
        return;
      }

      window.location.assign(selectedPlan.storeUrl);
    } catch {
      setPurchaseError("멤버십 신청 상태를 저장하지 못했습니다.");
    } finally {
      setPurchaseSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="멤버십 모달 닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMembershipModal}
            className="absolute inset-0 z-40 bg-black/18"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="멤버십 선택"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-x-3 bottom-3 top-[calc(68px+env(safe-area-inset-top))] z-50 flex flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white text-black shadow-[0_26px_80px_rgba(0,0,0,0.18)]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  membership
                </p>
              </div>
              <button
                type="button"
                onClick={closeMembershipModal}
                title="닫기"
                aria-label="닫기"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.035] text-black/45 transition hover:bg-black/[0.06] hover:text-black/70"
              >
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 scrollbar-none">
              <div className="grid grid-cols-3 gap-2">
                {membershipPlanOptions.map((plan) => (
                  <MembershipPlanCard
                    key={plan.id}
                    plan={plan}
                    selected={plan.id === selectedPlan.id}
                    current={currentMembership?.planId === plan.id}
                    onSelect={() => setSelectedPlanId(plan.id)}
                  />
                ))}
              </div>

              <MembershipSummaryPanel plan={selectedPlan} />
            </div>

            <footer className="shrink-0 border-t border-black/10 bg-white/95 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              {purchaseError && (
                <p className="mb-2 rounded-2xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
                  {purchaseError}
                </p>
              )}
              <button
                type="button"
                onClick={openPurchaseNotice}
                disabled={purchaseSaving}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition hover:bg-black/88 disabled:cursor-not-allowed disabled:bg-black/35"
              >
                {purchaseSaving
                  ? "신청 상태 저장 중..."
                  : `${selectedPlan.months}개월 멤버십 시작하기`}
              </button>
            </footer>
          </motion.section>

          <MembershipPurchaseNoticeModal
            open={noticeOpen}
            purchaseSaving={purchaseSaving}
            onClose={closePurchaseNotice}
            onConfirm={startPurchase}
          />
        </>
      )}
    </AnimatePresence>
  );
}

function MembershipPurchaseNoticeModal({
  open,
  purchaseSaving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  purchaseSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center px-5 py-8">
          <motion.button
            type="button"
            aria-label="결제 전 안내 닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/28 backdrop-blur-[2px]"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-purchase-notice-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 flex max-h-[calc(100vh-96px)] w-full max-w-[370px] flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white text-black shadow-[0_28px_90px_rgba(0,0,0,0.22)]"
          >
            <header className="shrink-0 border-b border-black/8 bg-white px-5 pb-5 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[21px] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.08)]"
                    aria-hidden
                  >
                    🚨
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3
                      id="membership-purchase-notice-title"
                      className="text-[21px] font-black leading-[1.18] tracking-[-0.03em] text-black"
                    >
                      결제 전 마지막으로
                      <br />
                      꼭 확인해주세요.
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  title="닫기"
                  aria-label="닫기"
                  disabled={purchaseSaving}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.035] text-black/45 transition hover:bg-black/[0.06] hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-none">
              <ol className="space-y-4">
                {membershipPurchaseNoticeParagraphGroups.map((paragraphs, index) => (
                  <li
                    key={paragraphs.join("\n")}
                    className="flex gap-3 border-b border-black/8 pb-4 last:border-b-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                        index === 0
                          ? "bg-accent text-white"
                          : "bg-black/[0.055] text-black/52",
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 space-y-2.5">
                      {paragraphs.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-[13px] font-semibold leading-6 text-black/72"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <footer className="shrink-0 border-t border-black/8 bg-white px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
              <button
                type="button"
                onClick={onConfirm}
                disabled={purchaseSaving}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition hover:bg-black/88 disabled:cursor-not-allowed disabled:bg-black/35"
              >
                {purchaseSaving ? "결제 페이지 준비 중..." : "확인했어요"}
                <ExternalLink size={15} aria-hidden />
              </button>
            </footer>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

function MembershipPlanCard({
  plan,
  selected,
  current,
  onSelect,
}: {
  plan: MembershipPlanOption;
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative min-h-[132px] rounded-[18px] border px-2.5 py-3 text-left transition-all",
        selected
          ? "border-black bg-black/[0.035] text-black shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
          : "border-black/10 bg-white text-black/58 hover:border-black/20 hover:bg-black/[0.015]",
      )}
    >
      {current ? (
        <span className="absolute right-2 top-2 rounded-full bg-black px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
          현재 이용 중
        </span>
      ) : plan.recommended ? (
        <span className="absolute right-2 top-2 rounded-full bg-black px-2 py-0.5 text-[9px] font-black text-white shadow-sm">
          가장 많이 선택
        </span>
      ) : null}
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border transition",
          selected
            ? "border-black bg-black text-white"
            : "border-black/12 text-transparent",
        )}
      >
        <Check size={13} strokeWidth={3} aria-hidden />
      </span>
      <strong className="mt-3 block text-xs font-bold leading-4">
        {plan.title}
      </strong>
      <span className="mt-1.5 block text-sm font-black text-black">
        {plan.price}
      </span>
      <span className="mt-0.5 block text-[10px] font-bold text-black/45">
        월 {plan.monthlyPrice}
      </span>
      {plan.discountRateLabel && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-[9px] font-black text-white">
            {plan.discountRateLabel}
          </span>
        </div>
      )}
    </button>
  );
}

function MembershipSummaryPanel({ plan }: { plan: MembershipPlanOption }) {
  return (
    <section className="mt-4 rounded-[20px] border border-black/10 bg-black/[0.025] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            selected
          </p>
          <h3 className="mt-1 text-base font-bold text-black">{plan.title}</h3>
        </div>
        {plan.discountRateLabel && (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-black text-white">
            {plan.discountRateLabel}
          </span>
        )}
        {plan.recommended && !plan.discountRateLabel && (
          <span className="shrink-0 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">
            가장 많이 선택
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3.5 rounded-[18px] bg-white px-4 py-4">
        {membershipBenefitTexts.map((benefit) => (
          <p
            key={benefit}
            className="flex gap-3 text-[15px] font-medium leading-[1.78] tracking-[-0.015em] text-black/72"
          >
            <Check
              size={14}
              className="mt-1.5 shrink-0 text-accent"
              strokeWidth={3}
              aria-hidden
            />
            <BenefitText text={benefit} />
          </p>
        ))}
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-black/8 pt-4">
        {plan.originalPrice && (
          <SummaryRow label="기존 금액" value={plan.originalPrice} muted />
        )}
        <SummaryRow label="총 결제 금액" value={plan.price} />
        <SummaryRow label="월 기준 금액" value={plan.monthlyPrice} />
        {plan.discountRateLabel && (
          <SummaryRow label="할인율" value={plan.discountRateLabel} accent />
        )}
        {plan.savingsLabel && (
          <SummaryRow label="1개월권 대비" value={plan.savingsLabel} accent />
        )}
        <SummaryRow label="멤버십 시작" value="첫 모임 시작일 기준" />
      </dl>
    </section>
  );
}

function BenefitText({ text }: { text: string }) {
  const highlights = [
    "무제한으로 신청",
    "참여할수록 알고리즘이 정교화",
    "1:1 데이트 자리를 준비",
    "첫 모임 시작일 기준으로 적용",
    "자동 결제는 발생하지 않아요.",
  ];
  const highlight = highlights.find((item) => text.includes(item));

  if (!highlight) return <span>{text}</span>;

  const [before, after] = text.split(highlight);

  return (
    <span>
      {before}
      <strong className="font-extrabold text-black/88">{highlight}</strong>
      {after}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
  accent = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[11px] font-semibold text-black/42">
        {label}
      </dt>
      <dd
        className={cn(
          "text-right text-[12px] font-bold leading-5",
          muted
            ? "text-black/35 line-through"
            : accent
              ? "text-accent"
              : "text-black/75",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
