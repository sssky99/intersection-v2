"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  MessageCircle,
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
  price: string;
  originalPrice?: string;
  monthlyPrice: string;
  discountLabel?: string;
  periodText: string;
  storeUrl: string;
};

const membershipPlanOptions: MembershipPlanOption[] = [
  {
    id: "one_month",
    title: "1개월 멤버십",
    shortTitle: "1개월",
    price: "20,000원",
    monthlyPrice: "20,000원",
    periodText: "첫 모임을 시작한 날로부터 한 달",
    storeUrl:
      "https://m.smartstore.naver.com/intersection_blinddate/products/13621427140",
  },
  {
    id: "three_months",
    title: "3개월 멤버십",
    shortTitle: "3개월",
    price: "50,000원",
    originalPrice: "60,000원",
    monthlyPrice: "16,667원",
    discountLabel: "16.7% 할인",
    periodText: "첫 모임을 시작한 날로부터 세 달",
    storeUrl:
      "https://m.smartstore.naver.com/intersection_blinddate/products/13621500025",
  },
  {
    id: "six_months",
    title: "6개월 멤버십",
    shortTitle: "6개월",
    price: "90,000원",
    originalPrice: "120,000원",
    monthlyPrice: "15,000원",
    discountLabel: "25% 할인",
    periodText: "첫 모임을 시작한 날로부터 여섯 달",
    storeUrl:
      "https://m.smartstore.naver.com/intersection_blinddate/products/13623599558",
  },
];

// TODO: set NEXT_PUBLIC_KAKAO_CHANNEL_URL to the real KakaoTalk channel URL.
const kakaoChannelUrl = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "#";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function selectedMembershipLabel(currentMembership: CurrentMembership) {
  if (!currentMembership) return "현재 이용 중인 멤버십이 없어요.";

  const plan = membershipPlanOptions.find(
    (membershipPlan) => membershipPlan.id === currentMembership.planId,
  );

  return plan ? `${plan.title} 이용 중` : "현재 이용 중인 멤버십이 있어요.";
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
      <span
        className="text-[20px] drop-shadow-[0_2px_4px_rgba(126,179,199,0.35)]"
        aria-hidden
      >
        💎
      </span>
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
    currentMembership?.planId ?? "one_month",
  );
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedPlanId(currentMembership?.planId ?? "one_month");
      setPurchaseError(null);
    }
  }, [currentMembership?.planId, open]);

  const selectedPlan = useMemo(
    () =>
      membershipPlanOptions.find((plan) => plan.id === selectedPlanId) ??
      membershipPlanOptions[0],
    [selectedPlanId],
  );

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
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/18"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-modal-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-x-3 bottom-3 top-[calc(68px+env(safe-area-inset-top))] z-50 flex flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white text-black shadow-[0_26px_80px_rgba(0,0,0,0.18)]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  membership
                </p>
                <h2
                  id="membership-modal-title"
                  className="mt-1 text-xl font-bold leading-7 text-black"
                >
                  원하는 멤버십을 선택해주세요
                </h2>
                <p className="mt-2 text-[11px] font-semibold text-black/45">
                  {selectedMembershipLabel(currentMembership)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
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

              <section className="mt-4 rounded-[18px] border border-black/10 bg-black/[0.02] px-4 py-3.5">
                <div className="space-y-2.5">
                  {[
                    "멤버십 기간은 결제일이 아니라 첫 모임이 시작된 날을 기준으로 적용돼요.",
                    "자동 결제는 발생하지 않아요.",
                    "스마트스토어가 열리지 않으면 아래 문의하기 버튼을 눌러주세요.",
                  ].map((message) => (
                    <p
                      key={message}
                      className="flex gap-2 text-[11px] leading-5 text-black/55"
                    >
                      <Check
                        size={13}
                        className="mt-0.5 shrink-0 text-accent"
                        aria-hidden
                      />
                      <span>{message}</span>
                    </p>
                  ))}
                </div>

                <a
                  href={kakaoChannelUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={
                    kakaoChannelUrl === "#"
                      ? "NEXT_PUBLIC_KAKAO_CHANNEL_URL 설정 필요"
                      : "카카오톡 채널로 문의하기"
                  }
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-[11px] font-bold text-black/65 transition hover:border-black/18 hover:text-black"
                >
                  <MessageCircle size={14} aria-hidden />
                  문의하기
                </a>
              </section>
            </div>

            <footer className="shrink-0 border-t border-black/10 bg-white/95 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              {purchaseError && (
                <p className="mb-2 rounded-2xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
                  {purchaseError}
                </p>
              )}
              <button
                type="button"
                onClick={startPurchase}
                disabled={purchaseSaving}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition hover:bg-black/88 disabled:cursor-not-allowed disabled:bg-black/35"
              >
                {purchaseSaving ? "신청 상태 저장 중..." : `${selectedPlan.title} 구매하기`}
                <ExternalLink size={15} aria-hidden />
              </button>
            </footer>
          </motion.section>
        </>
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
        "relative min-h-[118px] rounded-[18px] border px-2.5 py-3 text-left transition-all",
        selected
          ? "border-black bg-black/[0.035] text-black shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
          : "border-black/10 bg-white text-black/58 hover:border-black/20 hover:bg-black/[0.015]",
      )}
    >
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
      <span className="mt-1 block text-[11px] font-semibold text-black/50">
        {plan.price}
      </span>
      {plan.discountLabel && (
        <span className="mt-2 inline-flex rounded-full bg-accent/12 px-2 py-0.5 text-[9px] font-bold text-accent">
          {plan.discountLabel}
        </span>
      )}
      {current && (
        <span className="absolute right-2 top-2 rounded-full bg-black px-2 py-0.5 text-[9px] font-bold text-white">
          현재 이용 중
        </span>
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
        {plan.discountLabel && (
          <span className="shrink-0 rounded-full bg-accent/14 px-2.5 py-1 text-[10px] font-bold text-accent">
            {plan.discountLabel}
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-2.5">
        {plan.originalPrice && (
          <SummaryRow label="기존 요금" value={plan.originalPrice} muted />
        )}
        <SummaryRow
          label={plan.originalPrice ? "할인된 요금" : "월 요금"}
          value={plan.price}
        />
        {plan.originalPrice && (
          <SummaryRow label="월 요금" value={plan.monthlyPrice} />
        )}
        <SummaryRow label="멤버십 기간" value={plan.periodText} />
      </dl>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[11px] font-semibold text-black/42">
        {label}
      </dt>
      <dd
        className={cn(
          "text-right text-[12px] font-bold leading-5",
          muted ? "text-black/35 line-through" : "text-black/75",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
