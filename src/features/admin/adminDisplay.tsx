import {
  displayMembershipStatus,
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";

type NameLike = {
  name: string | null;
  active_membership?: boolean;
  expired_membership?: boolean;
  membership_status?: MembershipStatus | null;
  membership_end_date?: string | null;
  public_intro_model?: string | null;
};

type GenderLike = {
  gender?: string | null;
};

type BirthYearLike = {
  birth_year?: string | number | null;
};

export function profileName(profile: Pick<NameLike, "name">) {
  return profile.name?.trim() || "이름 없음";
}

export function membershipStatusForDisplay(profile: NameLike) {
  return (
    displayMembershipStatus({
      status: profile.membership_status,
      endDate: profile.membership_end_date,
    }) ?? profile.membership_status ?? "none"
  );
}

export function membershipLabel(profile: NameLike) {
  return membershipStatusLabels[membershipStatusForDisplay(profile)];
}

export function hasActiveMembershipForDisplay(profile: NameLike) {
  return profile.active_membership ?? membershipStatusForDisplay(profile) === "active";
}

export function hasExpiredMembershipForDisplay(profile: NameLike) {
  return profile.expired_membership ?? membershipStatusForDisplay(profile) === "expired";
}

function hasFallbackPublicIntro(profile: NameLike) {
  return (
    profile.public_intro_model === "fallback" ||
    profile.public_intro_model?.startsWith("fallback:") === true
  );
}

export function AdminMemberName({ profile }: { profile: NameLike }) {
  const active = hasActiveMembershipForDisplay(profile);
  const expired = hasExpiredMembershipForDisplay(profile);
  const fallbackIntro = hasFallbackPublicIntro(profile);

  return (
    <span className="inline-flex min-w-0 items-center gap-1 font-bold text-black">
      <span className="truncate">{profileName(profile)}</span>
      {fallbackIntro && <span aria-label="폴백 자기소개">❌</span>}
      {active && <span aria-label="멤버십 적용중">💎</span>}
      {expired && (
        <span
          className="shrink-0 text-sm font-black leading-none text-red-500"
          aria-label="멤버십 만료"
        >
          ♦
        </span>
      )}
    </span>
  );
}

export function GenderBadge({ gender }: GenderLike) {
  if (gender !== "남성" && gender !== "여성") return null;

  return (
    <span
      className={
        gender === "남성"
          ? "inline-flex shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700"
          : "inline-flex shrink-0 rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-700"
      }
    >
      {gender}
    </span>
  );
}

export function birthYearNumber(profile: BirthYearLike) {
  const value = Number(profile.birth_year);
  return Number.isFinite(value) ? value : null;
}

export function formatAgeAndBirthYear(profile: BirthYearLike) {
  const year = birthYearNumber(profile);
  if (!year) return "-";

  const age = new Date().getFullYear() - year + 1;
  return `${age}세 · ${year}년생`;
}
