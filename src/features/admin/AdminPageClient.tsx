"use client";

import {
  Image as ImageIcon,
  LogOut,
  Save,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VibeAxisBar } from "@/components/vibe/VibeGraph";
import type { VibeAxis } from "@/components/vibe/vibeGraphConfig";
import { BlindDateAdminPanel } from "@/features/admin/BlindDateAdminPanel";
import { FeedbackAdminPanel } from "@/features/admin/FeedbackAdminPanel";
import { MembershipAdminPanel } from "@/features/admin/MembershipAdminPanel";
import { ProposalAdminPanel } from "@/features/admin/ProposalAdminPanel";
import { TicketAdminPanel } from "@/features/admin/TicketAdminPanel";
import { WaitlistAdminPanel } from "@/features/admin/WaitlistAdminPanel";
import {
  AdminMemberName,
  GenderBadge,
  formatAgeAndBirthYear,
} from "@/features/admin/adminDisplay";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import {
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";

type AdminTab =
  | "applicants"
  | "membership"
  | "tickets"
  | "proposals"
  | "waitlist"
  | "rooms"
  | "feedback"
  | "blindDates";

type ViewMode = "list" | "cards";
type MembershipFilter = "all" | "active" | "inactive";
type CompletionFilter = "all" | "complete" | "incomplete";

const applicantMembershipStatuses: MembershipStatus[] = [
  "none",
  "pending",
  "active",
  "expired",
  "cancelled",
];

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "applicants", label: "신청자 관리" },
  { id: "membership", label: "멤버십 관리" },
  { id: "tickets", label: "티켓 관리" },
  { id: "proposals", label: "제안 관리" },
  { id: "waitlist", label: "대기열 관리" },
  { id: "rooms", label: "룸 관리" },
  { id: "feedback", label: "피드백 관리" },
  { id: "blindDates", label: "블라인드 데이트 관리" },
];

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatCreatedAt(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function formatCreatedAtCompact(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatPhoneCompact(value: string | null | undefined) {
  if (!value) return "-";

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;

  const tail = digits.slice(-8);
  return `${tail.slice(0, 4)} - ${tail.slice(4)}`;
}

function completionText(value: boolean | null) {
  return value ? "완료" : "미완료";
}

function membershipStatusValue(profile: AdminProfile): MembershipStatus {
  return profile.membership_status ?? "none";
}

const adminProfileAxes = [
  "temperature",
  "texture",
  "tone",
  "rhythm",
] as const satisfies readonly VibeAxis[];

type AdminProfileAxis = (typeof adminProfileAxes)[number];
type AdminProfileScoreColumn =
  | "score_temperature"
  | "score_texture"
  | "score_tone"
  | "score_rhythm";

type ProfileDetailPatch = {
  scores?: Partial<Record<AdminProfileScoreColumn, number | null>>;
  publicIntro?: string;
  publicEmoji?: string;
  isTestParticipant?: boolean;
  matchingPrecisionBonus?: number;
};

const adminProfileScoreColumns = {
  temperature: "score_temperature",
  texture: "score_texture",
  tone: "score_tone",
  rhythm: "score_rhythm",
} as const satisfies Record<AdminProfileAxis, AdminProfileScoreColumn>;

const defaultProfileEmoji = "💎";

function clampAdminScore(value: number) {
  return Math.min(100, Math.max(-100, Math.round(value)));
}

function clampMatchingPrecisionBonus(value: number) {
  return Math.min(5, Math.max(0, Math.round(value)));
}

function adminMatchingPrecisionBonus(profile: AdminProfile | null) {
  const value = profile?.matching_precision_bonus;
  return typeof value === "number" && Number.isFinite(value)
    ? clampMatchingPrecisionBonus(value)
    : 0;
}

function adminProfileScore(profile: AdminProfile, axis: AdminProfileAxis) {
  const value = profile[adminProfileScoreColumns[axis]];
  return typeof value === "number" && Number.isFinite(value)
    ? clampAdminScore(value)
    : 0;
}

function adminScoreDraft(profile: AdminProfile | null) {
  return Object.fromEntries(
    adminProfileAxes.map((axis) => [
      axis,
      profile ? adminProfileScore(profile, axis) : 0,
    ]),
  ) as Record<AdminProfileAxis, number>;
}

function profilePublicEmoji(profile: Pick<AdminProfile, "public_emoji">) {
  return profile.public_emoji?.trim() || defaultProfileEmoji;
}

export function AdminPageClient({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("applicants");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [membershipSaveError, setMembershipSaveError] = useState<string | null>(
    null,
  );
  const [savingMembershipUserId, setSavingMembershipUserId] = useState<
    string | null
  >(null);
  const [savingProfileUserId, setSavingProfileUserId] = useState<string | null>(
    null,
  );
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveNotice, setProfileSaveNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [membershipFilter, setMembershipFilter] =
    useState<MembershipFilter>("all");
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [visitedTabs, setVisitedTabs] = useState<
    Partial<Record<AdminTab, boolean>>
  >({ applicants: true });

  const loadProfiles = useCallback(async (force = false) => {
    if (!authenticated) return;
    if (profilesLoading) return;
    if (!force && profilesLoaded) return;

    setProfilesLoading(true);
    setProfilesError(null);

    try {
      const response = await fetch("/api/admin/profiles", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setSelectedProfileId(null);
        return;
      }

      if (!response.ok) {
        throw new Error("profiles-load-failed");
      }

      const data = (await response.json()) as { profiles?: AdminProfile[] };
      const nextProfiles = data.profiles ?? [];
      setProfiles(nextProfiles);
      setProfilesLoaded(true);
      setSelectedProfileId((current) => current ?? nextProfiles[0]?.user_id ?? null);
    } catch {
      setProfilesError("신청자 목록을 불러오지 못했습니다.");
    } finally {
      setProfilesLoading(false);
    }
  }, [authenticated, profilesLoaded, profilesLoading]);

  useEffect(() => {
    if (activeTab !== "applicants" || profilesLoaded || profilesLoading) return;
    void loadProfiles();
  }, [activeTab, loadProfiles, profilesLoaded, profilesLoading]);

  const selectTab = (tabId: AdminTab) => {
    setActiveTab(tabId);
    setVisitedTabs((current) =>
      current[tabId] ? current : { ...current, [tabId]: true },
    );
  };

  const changeMembershipStatus = async (
    userId: string,
    status: MembershipStatus,
  ) => {
    if (savingMembershipUserId === userId) return;

    const previousProfile = profiles.find(
      (profile) => profile.user_id === userId,
    );
    if (!previousProfile) return;

    const optimisticProfile = normalizeAdminProfile({
      ...previousProfile,
      membership_status: status,
      membership_updated_at: new Date().toISOString(),
    });

    setMembershipSaveError(null);
    setSavingMembershipUserId(userId);
    setProfiles((current) =>
      current.map((profile) =>
        profile.user_id === userId ? optimisticProfile : profile,
      ),
    );

    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        profile?: AdminProfile;
      } | null;

      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setSelectedProfileId(null);
        return;
      }

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error ?? "membership-save-failed");
      }

      setProfiles((current) =>
        current.map((profile) =>
          profile.user_id === userId ? data.profile! : profile,
        ),
      );
    } catch {
      setProfiles((current) =>
        current.map((profile) =>
          profile.user_id === userId ? previousProfile : profile,
        ),
      );
      setMembershipSaveError("멤버십 상태를 저장하지 못했습니다.");
    } finally {
      setSavingMembershipUserId(null);
    }
  };

  const saveProfileDetails = async (
    userId: string,
    patch: ProfileDetailPatch,
  ) => {
    if (savingProfileUserId === userId) return;

    setProfileSaveError(null);
    setProfileSaveNotice(null);
    setSavingProfileUserId(userId);

    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        profile?: AdminProfile;
      } | null;

      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setSelectedProfileId(null);
        return;
      }

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error ?? "profile-save-failed");
      }

      setProfiles((current) =>
        current.map((profile) =>
          profile.user_id === userId ? data.profile! : profile,
        ),
      );
      setProfileSaveNotice("프로필 상세 정보를 저장했어요.");
    } catch (error) {
      setProfileSaveError(
        error instanceof Error
          ? error.message
          : "프로필 상세 정보를 저장하지 못했어요.",
      );
    } finally {
      setSavingProfileUserId(null);
    }
  };

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesSearch =
        query.length === 0 ||
        `${profile.name ?? ""} ${profile.phone ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesGender =
        genderFilter === "all" || profile.gender === genderFilter;
      const matchesMembership =
        membershipFilter === "all" ||
        (membershipFilter === "active"
          ? Boolean(profile.active_membership)
          : !profile.active_membership);
      const completed =
        Boolean(profile.profile_completed) && Boolean(profile.questions_completed);
      const matchesCompletion =
        completionFilter === "all" ||
        (completionFilter === "complete" ? completed : !completed);

      return (
        matchesSearch &&
        matchesGender &&
        matchesMembership &&
        matchesCompletion
      );
    });
  }, [completionFilter, genderFilter, membershipFilter, profiles, search]);

  useEffect(() => {
    if (filteredProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    if (
      selectedProfileId &&
      filteredProfiles.some((profile) => profile.user_id === selectedProfileId)
    ) {
      return;
    }

    setSelectedProfileId(filteredProfiles[0].user_id);
  }, [filteredProfiles, selectedProfileId]);

  const selectedProfile =
    profiles.find((profile) => profile.user_id === selectedProfileId) ?? null;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setAuthError(data?.error ?? "관리자 키가 올바르지 않습니다.");
        return;
      }

      setAccessKey("");
      setAuthenticated(true);
      setActiveTab("applicants");
      setVisitedTabs({ applicants: true });
    } catch {
      setAuthError("관리자 인증 중 오류가 발생했습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => null);
    setAuthenticated(false);
    setProfiles([]);
    setProfilesLoaded(false);
    setSelectedProfileId(null);
    setActiveTab("applicants");
    setVisitedTabs({ applicants: true });
  };

  if (!authenticated) {
    return (
      <main className="min-h-dvh bg-[#f7f7f5] px-6 py-10 text-black">
        <section className="mx-auto mt-[12vh] w-full max-w-[420px] rounded-2xl border border-black/10 bg-white p-7 shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            admin
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            관리자 키를 입력해주세요
          </h1>
          <p className="mt-2 text-sm leading-6 text-black/55">
            전화번호와 신청자 정보가 포함된 페이지입니다. 관리자 인증 후
            브라우저 세션 동안 접근이 유지됩니다.
          </p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-black/55">
                관리자 키
              </span>
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                placeholder="ADMIN_ACCESS_KEY"
                className="mt-2 h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </label>

            {authError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading || accessKey.trim().length === 0}
              className="h-12 w-full rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/30"
            >
              {authLoading ? "확인 중..." : "관리자 페이지 열기"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f7f7f5] text-black">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1480px] flex-col px-7 py-6">
        <header className="shrink-0 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                intersection admin
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                운영 관리자
              </h1>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
            >
              <LogOut size={16} aria-hidden />
              로그아웃
            </button>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-semibold transition",
                  activeTab === tab.id
                    ? "bg-black text-white"
                    : "bg-[#f7f7f5] text-black/55 hover:bg-accent/15 hover:text-black",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <section className="mt-5 min-h-0 flex-1">
          {visitedTabs.applicants && (
            <div className={cn(activeTab === "applicants" ? "block" : "hidden")}>
              <ApplicantsPanel
                profiles={filteredProfiles}
                totalCount={profiles.length}
                selectedProfile={selectedProfile}
                selectedProfileId={selectedProfileId}
                viewMode={viewMode}
                loading={profilesLoading}
                error={profilesError}
                search={search}
                genderFilter={genderFilter}
                membershipFilter={membershipFilter}
                completionFilter={completionFilter}
                membershipSaveError={membershipSaveError}
                savingMembershipUserId={savingMembershipUserId}
                savingProfileUserId={savingProfileUserId}
                profileSaveError={profileSaveError}
                profileSaveNotice={profileSaveNotice}
                onViewModeChange={setViewMode}
                onSearchChange={setSearch}
                onGenderFilterChange={setGenderFilter}
                onMembershipFilterChange={setMembershipFilter}
                onCompletionFilterChange={setCompletionFilter}
                onSelectProfile={setSelectedProfileId}
                onCloseDetail={() => setSelectedProfileId(null)}
                onReload={() => void loadProfiles(true)}
                onMembershipStatusChange={changeMembershipStatus}
                onProfileDetailSave={saveProfileDetails}
              />
            </div>
          )}
          {visitedTabs.membership && (
            <div className={cn(activeTab === "membership" ? "block" : "hidden")}>
              <MembershipAdminPanel />
            </div>
          )}
          {visitedTabs.tickets && (
            <div className={cn(activeTab === "tickets" ? "block" : "hidden")}>
              <TicketAdminPanel />
            </div>
          )}
          {visitedTabs.proposals && (
            <div className={cn(activeTab === "proposals" ? "block" : "hidden")}>
              <ProposalAdminPanel />
            </div>
          )}
          {visitedTabs.waitlist && (
            <div className={cn(activeTab === "waitlist" ? "block" : "hidden")}>
              <WaitlistAdminPanel />
            </div>
          )}
          {activeTab === "rooms" && (
            <div className="flex h-[calc(100dvh-190px)] items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white text-sm font-semibold text-black/45">
              준비 중입니다.
            </div>
          )}
          {visitedTabs.feedback && (
            <div className={cn(activeTab === "feedback" ? "block" : "hidden")}>
              <FeedbackAdminPanel />
            </div>
          )}
          {visitedTabs.blindDates && (
            <div className={cn(activeTab === "blindDates" ? "block" : "hidden")}>
              <BlindDateAdminPanel />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ApplicantsPanel({
  profiles,
  totalCount,
  selectedProfile,
  selectedProfileId,
  viewMode,
  loading,
  error,
  search,
  genderFilter,
  membershipFilter,
  completionFilter,
  membershipSaveError,
  savingMembershipUserId,
  savingProfileUserId,
  profileSaveError,
  profileSaveNotice,
  onViewModeChange,
  onSearchChange,
  onGenderFilterChange,
  onMembershipFilterChange,
  onCompletionFilterChange,
  onSelectProfile,
  onCloseDetail,
  onReload,
  onMembershipStatusChange,
  onProfileDetailSave,
}: {
  profiles: AdminProfile[];
  totalCount: number;
  selectedProfile: AdminProfile | null;
  selectedProfileId: string | null;
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  search: string;
  genderFilter: string;
  membershipFilter: MembershipFilter;
  completionFilter: CompletionFilter;
  membershipSaveError: string | null;
  savingMembershipUserId: string | null;
  savingProfileUserId: string | null;
  profileSaveError: string | null;
  profileSaveNotice: string | null;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (value: string) => void;
  onGenderFilterChange: (value: string) => void;
  onMembershipFilterChange: (value: MembershipFilter) => void;
  onCompletionFilterChange: (value: CompletionFilter) => void;
  onSelectProfile: (profileId: string) => void;
  onCloseDetail: () => void;
  onReload: () => void;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
  onProfileDetailSave: (
    userId: string,
    patch: ProfileDetailPatch,
  ) => Promise<void>;
}) {
  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[620px] grid-cols-[minmax(0,1fr)_390px] gap-5">
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="shrink-0 border-b border-black/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">신청자 관리</h2>
              <p className="mt-1 text-xs text-black/45">
                전체 {totalCount.toLocaleString()}명 · 표시{" "}
                {profiles.length.toLocaleString()}명
              </p>
              {loading && totalCount > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-accent">
                  새로고침 중입니다.
                </p>
              )}
            </div>

            <div className="flex rounded-xl bg-[#f2f3f1] p-1">
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                className={cn(
                  "h-9 rounded-lg px-4 text-sm font-semibold transition",
                  viewMode === "list"
                    ? "bg-white text-black shadow-sm"
                    : "text-black/45 hover:text-black",
                )}
              >
                리스트 보기
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                className={cn(
                  "h-9 rounded-lg px-4 text-sm font-semibold transition",
                  viewMode === "cards"
                    ? "bg-white text-black shadow-sm"
                    : "text-black/45 hover:text-black",
                )}
              >
                카드 보기
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(260px,1fr)_150px_160px_170px_auto] gap-2">
            <label className="relative block">
              <Search
                size={16}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35"
              />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="이름 또는 전화번호 검색"
                className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </label>

            <select
              value={genderFilter}
              onChange={(event) => onGenderFilterChange(event.target.value)}
              className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="all">성별 전체</option>
              <option value="여성">여성</option>
              <option value="남성">남성</option>
              <option value="비공개">비공개</option>
            </select>

            <select
              value={membershipFilter}
              onChange={(event) =>
                onMembershipFilterChange(event.target.value as MembershipFilter)
              }
              className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="all">멤버십 전체</option>
              <option value="active">멤버십 보유</option>
              <option value="inactive">멤버십 없음</option>
            </select>

            <select
              value={completionFilter}
              onChange={(event) =>
                onCompletionFilterChange(event.target.value as CompletionFilter)
              }
              className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="all">완성 여부 전체</option>
              <option value="complete">프로필 완성</option>
              <option value="incomplete">미완성 포함</option>
            </select>

            <button
              type="button"
              onClick={onReload}
              className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
            >
              새로고침
            </button>
          </div>

          {membershipSaveError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {membershipSaveError}
            </p>
          )}
          {error && totalCount > 0 && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {loading && profiles.length === 0 ? (
            <StateMessage message="신청자 목록을 불러오는 중입니다." />
          ) : error && profiles.length === 0 ? (
            <StateMessage tone="error" message={error} />
          ) : profiles.length === 0 ? (
            <StateMessage message="아직 신청자가 없습니다." />
          ) : viewMode === "list" ? (
            <ApplicantTable
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelectProfile={onSelectProfile}
              savingMembershipUserId={savingMembershipUserId}
              onMembershipStatusChange={onMembershipStatusChange}
            />
          ) : (
            <ApplicantCards
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelectProfile={onSelectProfile}
            />
          )}
        </div>
      </section>

      <ProfileDetailPanel
        profile={selectedProfile}
        saving={
          selectedProfile !== null &&
          savingMembershipUserId === selectedProfile.user_id
        }
        profileSaving={
          selectedProfile !== null &&
          savingProfileUserId === selectedProfile.user_id
        }
        saveError={profileSaveError}
        saveNotice={profileSaveNotice}
        onClose={onCloseDetail}
        onMembershipStatusChange={onMembershipStatusChange}
        onProfileDetailSave={onProfileDetailSave}
      />
    </div>
  );
}

function ApplicantTable({
  profiles,
  selectedProfileId,
  onSelectProfile,
  savingMembershipUserId,
  onMembershipStatusChange,
}: {
  profiles: AdminProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  savingMembershipUserId: string | null;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
}) {
  return (
    <div className="h-full overflow-auto">
      <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
          <tr>
            <TableHead className="w-[120px] px-3">이름</TableHead>
            <TableHead className="w-20 px-3">성별</TableHead>
            <TableHead className="w-24">출생연도</TableHead>
            <TableHead className="w-20">MBTI</TableHead>
            <TableHead className="w-32">전화번호</TableHead>
            <TableHead className="w-28">가입일</TableHead>
            <TableHead className="w-44">멤버십 상태</TableHead>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => {
            const selected = selectedProfileId === profile.user_id;

            return (
              <tr
                key={profile.user_id}
                onClick={() => onSelectProfile(profile.user_id)}
                className={cn(
                  "cursor-pointer border-b border-black/5 transition hover:bg-accent/10",
                  selected && "bg-accent/15",
                )}
              >
                <TableCell className="w-[120px] px-3">
                  <span className="block min-w-0 font-bold text-black">
                    <AdminMemberName profile={profile} />
                  </span>
                </TableCell>
                <TableCell className="w-20 px-3">
                  {display(profile.gender)}
                </TableCell>
                <TableCell>{display(profile.birth_year)}</TableCell>
                <TableCell>{display(profile.mbti)}</TableCell>
                <TableCell>{formatPhoneCompact(profile.phone)}</TableCell>
                <TableCell>{formatCreatedAtCompact(profile.created_at)}</TableCell>
                <TableCell className="w-44">
                  <MembershipStatusSelect
                    value={membershipStatusValue(profile)}
                    disabled={savingMembershipUserId === profile.user_id}
                    onChange={(status) =>
                      void onMembershipStatusChange(profile.user_id, status)
                    }
                    onClick={(event) => event.stopPropagation()}
                  />
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ApplicantCards({
  profiles,
  selectedProfileId,
  onSelectProfile,
}: {
  profiles: AdminProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
}) {
  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {profiles.map((profile) => {
          const selected = selectedProfileId === profile.user_id;

          return (
            <button
              key={profile.user_id}
              type="button"
              onClick={() => onSelectProfile(profile.user_id)}
              className={cn(
                "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-md",
                selected ? "border-accent ring-4 ring-accent/15" : "border-black/10",
              )}
            >
              <PhotoBox
                src={profile.photo_url}
                alt={`${profile.name ?? "신청자"} 프로필 사진`}
                className="h-64 w-full bg-[#f7f7f5]"
              />
              <div className="space-y-2 p-4">
                <h3 className="truncate text-base font-bold">
                  <AdminMemberName profile={profile} />
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-black/55">
                  <span>{formatAgeAndBirthYear(profile)}</span>
                  <GenderBadge gender={profile.gender} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-black/50">
                  <InfoPill label="MBTI" value={display(profile.mbti)} />
                  <InfoPill label="전화" value={formatPhoneCompact(profile.phone)} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileDetailPanel({
  profile,
  saving,
  profileSaving,
  saveError,
  saveNotice,
  onClose,
  onMembershipStatusChange,
  onProfileDetailSave,
}: {
  profile: AdminProfile | null;
  saving: boolean;
  profileSaving: boolean;
  saveError: string | null;
  saveNotice: string | null;
  onClose: () => void;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
  onProfileDetailSave: (
    userId: string,
    patch: ProfileDetailPatch,
  ) => Promise<void>;
}) {
  const initialScoreDraft = useMemo(() => adminScoreDraft(profile), [profile]);
  const initialPrecisionBonusDraft = useMemo(
    () => adminMatchingPrecisionBonus(profile),
    [profile],
  );
  const [scoreDraft, setScoreDraft] = useState(initialScoreDraft);
  const [precisionBonusDraft, setPrecisionBonusDraft] = useState(
    initialPrecisionBonusDraft,
  );
  const [introDraft, setIntroDraft] = useState(profile?.public_intro ?? "");
  const [emojiDraft, setEmojiDraft] = useState(profile?.public_emoji ?? "");

  useEffect(() => {
    setScoreDraft(initialScoreDraft);
  }, [initialScoreDraft]);

  useEffect(() => {
    setPrecisionBonusDraft(initialPrecisionBonusDraft);
  }, [initialPrecisionBonusDraft]);

  useEffect(() => {
    setIntroDraft(profile?.public_intro ?? "");
    setEmojiDraft(profile?.public_emoji ?? "");
  }, [profile?.public_emoji, profile?.public_intro, profile?.user_id]);

  const scoresDirty = Boolean(
    profile &&
      adminProfileAxes.some(
        (axis) => scoreDraft[axis] !== adminProfileScore(profile, axis),
      ),
  );
  const introDirty = Boolean(
    profile &&
      (introDraft !== (profile.public_intro ?? "") ||
        emojiDraft !== (profile.public_emoji ?? "")),
  );
  const precisionBonusDirty = Boolean(
    profile &&
      precisionBonusDraft !== adminMatchingPrecisionBonus(profile),
  );
  const isTestParticipant = Boolean(profile?.is_test_participant);

  const updateScoreDraft = (axis: AdminProfileAxis, value: number) => {
    setScoreDraft((current) => ({
      ...current,
      [axis]: clampAdminScore(value),
    }));
  };

  const saveScores = () => {
    if (!profile || !scoresDirty || profileSaving) return;
    void onProfileDetailSave(profile.user_id, {
      scores: Object.fromEntries(
        adminProfileAxes.map((axis) => [
          adminProfileScoreColumns[axis],
          scoreDraft[axis],
        ]),
      ) as Record<AdminProfileScoreColumn, number>,
    });
  };

  const saveIntro = () => {
    if (!profile || !introDirty || profileSaving) return;
    void onProfileDetailSave(profile.user_id, {
      publicIntro: introDraft,
      publicEmoji: emojiDraft,
    });
  };

  const savePrecisionBonus = () => {
    if (!profile || !precisionBonusDirty || profileSaving) return;
    void onProfileDetailSave(profile.user_id, {
      matchingPrecisionBonus: precisionBonusDraft,
    });
  };

  const toggleTestParticipant = () => {
    if (!profile || profileSaving) return;
    void onProfileDetailSave(profile.user_id, {
      isTestParticipant: !isTestParticipant,
    });
  };

  if (!profile) {
    return (
      <aside className="flex min-h-0 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white px-6 text-center text-sm font-semibold text-black/45">
        <UserRound size={32} aria-hidden className="mb-3 text-black/25" />
        신청자를 선택하면 상세 정보가 표시됩니다.
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            applicant detail
          </p>
          <h2 className="mt-1 text-xl font-bold">
            <AdminMemberName profile={profile} />
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세패널 닫기"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-black/45 transition hover:border-black/20 hover:text-black"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <PhotoBox
          src={profile.photo_url}
          alt={`${profile.name ?? "신청자"} 프로필 사진`}
          className="h-[360px] w-full rounded-2xl border border-black/10 bg-[#f7f7f5]"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <DetailItem label="성별" value={display(profile.gender)} />
          <DetailItem label="출생연도" value={display(profile.birth_year)} />
          <DetailItem label="MBTI" value={display(profile.mbti)} />
          <DetailItem label="전화번호" value={display(profile.phone)} />
          <DetailItem label="가입일" value={formatCreatedAt(profile.created_at)} />
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-black/35">
              멤버십 상태
            </p>
            <MembershipStatusSelect
              value={membershipStatusValue(profile)}
              disabled={saving}
              className="mt-2 w-full"
              onChange={(status) =>
                void onMembershipStatusChange(profile.user_id, status)
              }
            />
          </div>
          <DetailItem
            label="기본정보 완료"
            value={completionText(profile.profile_completed)}
          />
          <DetailItem
            label="질문 완료"
            value={completionText(profile.questions_completed)}
          />
        </div>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold">운영자</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
                켜진 신청자에게만 운영자 전용 티켓과 질문 다시보기가 표시됩니다.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isTestParticipant}
              disabled={profileSaving}
              onClick={toggleTestParticipant}
              className={cn(
                "relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-45",
                isTestParticipant ? "bg-black" : "bg-black/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition",
                  isTestParticipant ? "left-7" : "left-1",
                )}
              />
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">추천 정교화 보정값</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-black/45">
                실제 참여 완료 횟수에 더해지는 값이에요. 별은 최대 5칸까지
                채워져요.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              +{precisionBonusDraft}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, value) => (
              <button
                key={value}
                type="button"
                disabled={profileSaving}
                aria-pressed={precisionBonusDraft === value}
                onClick={() => setPrecisionBonusDraft(value)}
                className={cn(
                  "h-10 rounded-xl border text-sm font-black transition disabled:cursor-wait disabled:opacity-45",
                  precisionBonusDraft === value
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-[#f7f7f5] text-black/50 hover:border-black/20 hover:text-black",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!precisionBonusDirty || profileSaving}
            onClick={savePrecisionBonus}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/25"
          >
            <Save size={15} aria-hidden />
            {profileSaving ? "저장 중..." : "보정값 저장"}
          </button>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">사람 지표</h3>
            <span className="text-[11px] font-semibold text-black/35">
              관리자 수정 가능
            </span>
          </div>
          <div className="mt-4 space-y-5">
            {adminProfileAxes.map((axis) => {
              const value = scoreDraft[axis];

              return (
                <div
                  key={axis}
                  className="rounded-2xl border border-black/8 bg-[#fbfbfa] px-3 py-4"
                >
                  <VibeAxisBar
                    axis={axis}
                    score={value}
                    scoreScale="internal"
                    animateBar={false}
                    valueLabel={`${value}점`}
                    input={{
                      value,
                      min: -100,
                      max: 100,
                      step: 1,
                      disabled: profileSaving,
                      onChange: (nextValue) => updateScoreDraft(axis, nextValue),
                    }}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      step={1}
                      value={value}
                      disabled={profileSaving}
                      onChange={(event) =>
                        updateScoreDraft(axis, Number(event.target.value))
                      }
                      className="h-9 w-24 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-black/5"
                    />
                    <span className="text-[11px] font-semibold text-black/40">
                      -100부터 100까지
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!scoresDirty || profileSaving}
            onClick={saveScores}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/25"
          >
            <Save size={15} aria-hidden />
            {profileSaving ? "저장 중..." : "사람 지표 저장"}
          </button>
        </section>

        <section className="mt-5 rounded-2xl border border-black/10 bg-[#fbfbfa] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">GPT 자기소개</h3>
            <span className="text-[11px] font-semibold text-black/35">
              이모지 포함 수정 가능
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              {emojiDraft.trim() || profilePublicEmoji(profile)}
            </div>
            <label className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-black/40">
                프로필 이모지
              </span>
              <input
                value={emojiDraft}
                maxLength={16}
                disabled={profileSaving}
                onChange={(event) => setEmojiDraft(event.target.value)}
                placeholder={defaultProfileEmoji}
                className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-bold outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-black/5"
              />
            </label>
          </div>
          <textarea
            value={introDraft}
            disabled={profileSaving}
            onChange={(event) => setIntroDraft(event.target.value)}
            rows={7}
            className="mt-4 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 text-black/70 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:bg-black/5"
            placeholder="GPT 자기소개를 입력해주세요."
          />
          <button
            type="button"
            disabled={!introDirty || profileSaving}
            onClick={saveIntro}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/25"
          >
            <Save size={15} aria-hidden />
            {profileSaving ? "저장 중..." : "자기소개 저장"}
          </button>
        </section>

        {(saveError || saveNotice) && (
          <p
            className={cn(
              "mt-4 rounded-2xl px-4 py-3 text-sm font-semibold leading-5",
              saveError
                ? "bg-red-50 text-red-600"
                : "bg-accent/12 text-black/65",
            )}
          >
            {saveError ?? saveNotice}
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t border-black/10 p-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-full rounded-xl bg-black text-sm font-bold text-white transition hover:bg-black/85"
        >
          닫기
        </button>
      </footer>
    </aside>
  );
}

function PhotoBox({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className: string;
}) {
  return (
    <div className={cn("flex items-center justify-center overflow-hidden", className)}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-xs font-semibold text-black/35">
          <ImageIcon size={28} aria-hidden />
          사진 없음
        </div>
      )}
    </div>
  );
}

function MembershipStatusSelect({
  value,
  disabled,
  className,
  onChange,
  onClick,
}: {
  value: MembershipStatus;
  disabled: boolean;
  className?: string;
  onChange: (status: MembershipStatus) => void;
  onClick?: (event: React.MouseEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={onClick}
      onChange={(event) => onChange(event.target.value as MembershipStatus)}
      className={cn(
        "h-10 w-40 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/72 outline-none transition focus:border-accent disabled:cursor-wait disabled:bg-black/5",
        className,
      )}
    >
      {applicantMembershipStatuses.map((status) => (
        <option key={status} value={status}>
          {membershipStatusLabels[status]}
        </option>
      ))}
    </select>
  );
}

function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("border-b border-black/10 px-5 py-3 font-bold", className)}>
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-black/5 px-5 py-3 text-black/62", className)}>
      {children}
    </td>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f7f7f5] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-black/65">{value}</p>
    </div>
  );
}

function DetailItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-semibold",
          highlight ? "text-accent" : "text-black/72",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StateMessage({
  message,
  tone = "default",
}: {
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-black/45",
      )}
    >
      {message}
    </div>
  );
}
