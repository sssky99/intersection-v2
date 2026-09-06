"use client";
import {
  normalizeAdminProfile,
  type AdminProfile,
} from "@/features/admin/adminProfile";
import { type MembershipStatus } from "@/features/membership/membershipTypes";
import { BookOpen, Flag, LogOut } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApplicantsPanel,
  BirthYearSort,
  CompletionFilter,
  MembershipFilter,
  OperatorRatingFilter,
  PaymentFilter,
  ProfilesPagination,
  ProfilesState,
  ViewMode,
} from "./profiles/ApplicantsPanel";
import {
  AssignmentCriteriaDialog,
  RedFlagCriteriaDialog,
} from "./profiles/ProfileAssessment";
import { ProfileDetailPatch } from "./profiles/ProfileDetailPanel";
function AdminPanelLoading() {
  return (
    <p role="status" className="p-6 text-sm text-black/50">
      관리 화면을 불러오는 중입니다.
    </p>
  );
}

const BlindDateAdminPanel = dynamic(
  () =>
    import("@/features/admin/BlindDateAdminPanel").then(
      (module) => module.BlindDateAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const CalendarAdminPanel = dynamic(
  () =>
    import("@/features/admin/CalendarAdminPanel").then(
      (module) => module.CalendarAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const FeedbackAdminPanel = dynamic(
  () =>
    import("@/features/admin/FeedbackAdminPanel").then(
      (module) => module.FeedbackAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const FunnelAdminPanel = dynamic(
  () =>
    import("@/features/admin/FunnelAdminPanel").then(
      (module) => module.FunnelAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const LoginBlocklistAdminPanel = dynamic(
  () =>
    import("@/features/admin/LoginBlocklistAdminPanel").then(
      (module) => module.LoginBlocklistAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const MeetingEventAdminPanel = dynamic(
  () =>
    import("@/features/admin/MeetingEventAdminPanel").then(
      (module) => module.MeetingEventAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const MembershipAdminPanel = dynamic(
  () =>
    import("@/features/admin/MembershipAdminPanel").then(
      (module) => module.MembershipAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const RoomChatAdminPanel = dynamic(
  () =>
    import("@/features/admin/RoomChatAdminPanel").then(
      (module) => module.RoomChatAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const TicketAdminPanel = dynamic(
  () =>
    import("@/features/admin/TicketAdminPanel").then(
      (module) => module.TicketAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const VisitorAdminPanel = dynamic(
  () =>
    import("@/features/admin/VisitorAdminPanel").then(
      (module) => module.VisitorAdminPanel,
    ),
  { loading: AdminPanelLoading },
);
const WaitlistAdminPanel = dynamic(
  () =>
    import("@/features/admin/WaitlistAdminPanel").then(
      (module) => module.WaitlistAdminPanel,
    ),
  { loading: AdminPanelLoading },
);

type AdminTab =
  | "applicants"
  | "visitors"
  | "membership"
  | "tickets"
  | "events"
  | "calendar"
  | "waitlist"
  | "rooms"
  | "feedback"
  | "blindDates"
  | "loginBlocklist"
  | "funnel";

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "applicants", label: "신청자 관리" },
  { id: "visitors", label: "방문자 관리" },
  { id: "membership", label: "멤버십 관리" },
  { id: "tickets", label: "프로그램 관리" },
  { id: "events", label: "행사 관리" },
  { id: "calendar", label: "달력 관리" },
  { id: "waitlist", label: "대기열 관리" },
  { id: "rooms", label: "룸 관리" },
  { id: "feedback", label: "피드백 관리" },
  { id: "blindDates", label: "블라인드 데이트 관리" },
  { id: "loginBlocklist", label: "로그인 차단" },
  { id: "funnel", label: "퍼널 관리" },
];

export function AdminPageClient({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("applicants");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesState, setProfilesState] = useState<ProfilesState>("idle");
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profilePage, setProfilePage] = useState(1);
  const [profilePagination, setProfilePagination] =
    useState<ProfilesPagination>({
      page: 1,
      limit: 50,
      totalCount: 0,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    });
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const profileRequestIdRef = useRef(0);
  const loadedProfileQueryRef = useRef("");
  const lastProfileRefreshRef = useRef(0);
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
  const [profileSaveNotice, setProfileSaveNotice] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [membershipFilter, setMembershipFilter] =
    useState<MembershipFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("complete");
  const [operatorRatingFilter, setOperatorRatingFilter] =
    useState<OperatorRatingFilter>("all");
  const [birthYearSort, setBirthYearSort] = useState<BirthYearSort>("default");
  const [ticketFocusId, setTicketFocusId] = useState<string | null>(null);
  const [assignmentCriteriaOpen, setAssignmentCriteriaOpen] = useState(false);
  const [redFlagCriteriaOpen, setRedFlagCriteriaOpen] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<
    Partial<Record<AdminTab, boolean>>
  >({ applicants: true });

  useEffect(() => {
    if (!assignmentCriteriaOpen && !redFlagCriteriaOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAssignmentCriteriaOpen(false);
      setRedFlagCriteriaOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [assignmentCriteriaOpen, redFlagCriteriaOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfilePage(1);
      setDebouncedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadProfiles = useCallback(async () => {
    if (!authenticated || activeTab !== "applicants") return;

    const querySignature = JSON.stringify({
      profilePage,
      debouncedSearch,
      genderFilter,
      membershipFilter,
      paymentFilter,
      completionFilter,
      operatorRatingFilter,
      birthYearSort,
      viewMode,
      profileRefreshKey,
    });
    if (loadedProfileQueryRef.current === querySignature) return;

    const requestId = ++profileRequestIdRef.current;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);
    const params = new URLSearchParams({
      page: String(profilePage),
      limit: "50",
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (genderFilter !== "all") params.set("gender", genderFilter);
    if (membershipFilter !== "all") params.set("membership", membershipFilter);
    if (paymentFilter !== "all") params.set("payment", paymentFilter);
    if (completionFilter !== "all") params.set("completion", completionFilter);
    if (operatorRatingFilter !== "all") {
      params.set("operatorRating", operatorRatingFilter);
    }
    if (birthYearSort !== "default") params.set("birthSort", birthYearSort);
    if (viewMode === "cards") params.set("includePhotos", "true");

    setProfilesLoading(true);
    setProfilesState("loading");
    setProfilesError(null);
    setSelectedProfileId(null);

    try {
      const response = await fetch(`/api/admin/profiles?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (requestId !== profileRequestIdRef.current) return;
      if (response.status === 401) {
        setAuthenticated(false);
        setProfiles([]);
        setProfilesLoaded(false);
        setProfilesState("idle");
        return;
      }
      if (!response.ok) throw new Error("profiles-load-failed");

      const data = (await response.json()) as {
        profiles?: AdminProfile[];
        pagination?: ProfilesPagination;
      };
      const nextProfiles = data.profiles ?? [];
      setProfiles(nextProfiles);
      if (data.pagination) setProfilePagination(data.pagination);
      setProfilesLoaded(true);
      setProfilesState(nextProfiles.length === 0 ? "empty" : "success");
      loadedProfileQueryRef.current = querySignature;
    } catch (error) {
      if (requestId !== profileRequestIdRef.current) return;
      if (
        timedOut ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        setProfiles([]);
        setProfilesState("timeout");
        setProfilesError("조회 시간이 10초를 초과했습니다.");
      } else {
        setProfiles([]);
        setProfilesState("error");
        setProfilesError("신청자 목록을 불러오지 못했습니다.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestId === profileRequestIdRef.current) setProfilesLoading(false);
    }
  }, [
    activeTab,
    authenticated,
    birthYearSort,
    completionFilter,
    debouncedSearch,
    genderFilter,
    membershipFilter,
    operatorRatingFilter,
    paymentFilter,
    profilePage,
    profileRefreshKey,
    viewMode,
  ]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const refreshProfiles = useCallback(() => {
    const now = Date.now();
    if (profilesLoading || now - lastProfileRefreshRef.current < 1000) return;
    lastProfileRefreshRef.current = now;
    setProfileRefreshKey((current) => current + 1);
  }, [profilesLoading]);

  useEffect(() => {
    if (!selectedProfileId) return;
    const selected = profiles.find(
      (profile) => profile.user_id === selectedProfileId,
    );
    if (!selected || selected.details_loaded) return;

    const controller = new AbortController();
    const loadProfileDetails = async () => {
      try {
        const response = await fetch(
          `/api/admin/profiles?userId=${encodeURIComponent(selectedProfileId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("profile-detail-load-failed");

        const data = (await response.json()) as { profile?: AdminProfile };
        if (!data.profile) throw new Error("profile-detail-missing");
        setProfiles((current) =>
          current.map((profile) =>
            profile.user_id === data.profile?.user_id ? data.profile : profile,
          ),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setProfileSaveError(
          "신청자 상세 정보를 불러오지 못했습니다. 잠시 후 다시 선택해주세요.",
        );
      }
    };

    void loadProfileDetails();
    return () => controller.abort();
  }, [profiles, selectedProfileId]);

  const selectTab = (tabId: AdminTab) => {
    setActiveTab(tabId);
    setVisitedTabs((current) =>
      current[tabId] ? current : { ...current, [tabId]: true },
    );
  };

  const openTicketFromCalendar = (ticketId: string) => {
    setTicketFocusId(ticketId);
    setActiveTab("tickets");
    setVisitedTabs((current) =>
      current.tickets ? current : { ...current, tickets: true },
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
    if (savingProfileUserId === userId) return false;

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
        return false;
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
      return true;
    } catch (error) {
      setProfileSaveError(
        error instanceof Error
          ? error.message
          : "프로필 상세 정보를 저장하지 못했어요.",
      );
      return false;
    } finally {
      setSavingProfileUserId(null);
    }
  };

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
    setAssignmentCriteriaOpen(false);
    setRedFlagCriteriaOpen(false);
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
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  운영 관리자
                </h1>
                <button
                  type="button"
                  onClick={() => setAssignmentCriteriaOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-[#f7f7f5] px-3 text-xs font-bold text-black/60 transition hover:border-accent/40 hover:bg-accent/10 hover:text-black"
                >
                  <BookOpen size={15} aria-hidden />
                  유형 배정 기준
                </button>
                <button
                  type="button"
                  onClick={() => setRedFlagCriteriaOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-[#f7f7f5] px-3 text-xs font-bold text-black/60 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Flag size={15} aria-hidden />
                  레드 플래그 산정 기준
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black"
              >
                <LogOut size={16} aria-hidden />
                로그아웃
              </button>
            </div>
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
            <div
              className={cn(activeTab === "applicants" ? "block" : "hidden")}
            >
              <ApplicantsPanel
                profiles={profiles}
                pagination={profilePagination}
                selectedProfile={selectedProfile}
                selectedProfileId={selectedProfileId}
                viewMode={viewMode}
                loading={profilesLoading}
                error={profilesError}
                search={search}
                genderFilter={genderFilter}
                membershipFilter={membershipFilter}
                paymentFilter={paymentFilter}
                completionFilter={completionFilter}
                operatorRatingFilter={operatorRatingFilter}
                birthYearSort={birthYearSort}
                profilesState={profilesState}
                membershipSaveError={membershipSaveError}
                savingMembershipUserId={savingMembershipUserId}
                savingProfileUserId={savingProfileUserId}
                profileSaveError={profileSaveError}
                profileSaveNotice={profileSaveNotice}
                onViewModeChange={setViewMode}
                onSearchChange={setSearch}
                onGenderFilterChange={(value) => {
                  setProfilePage(1);
                  setGenderFilter(value);
                }}
                onMembershipFilterChange={(value) => {
                  setProfilePage(1);
                  setMembershipFilter(value);
                }}
                onPaymentFilterChange={(value) => {
                  setProfilePage(1);
                  setPaymentFilter(value);
                }}
                onCompletionFilterChange={(value) => {
                  setProfilePage(1);
                  setCompletionFilter(value);
                }}
                onOperatorRatingFilterChange={(value) => {
                  setProfilePage(1);
                  setOperatorRatingFilter(value);
                }}
                onBirthYearSortChange={(value) => {
                  setProfilePage(1);
                  setBirthYearSort(value);
                }}
                onSelectProfile={setSelectedProfileId}
                onCloseDetail={() => setSelectedProfileId(null)}
                onReload={refreshProfiles}
                onPageChange={setProfilePage}
                onMembershipStatusChange={changeMembershipStatus}
                onProfileDetailSave={saveProfileDetails}
              />
            </div>
          )}
          {visitedTabs.membership && (
            <div
              className={cn(activeTab === "membership" ? "block" : "hidden")}
            >
              <MembershipAdminPanel />
            </div>
          )}
          {visitedTabs.visitors && (
            <div className={cn(activeTab === "visitors" ? "block" : "hidden")}>
              <VisitorAdminPanel />
            </div>
          )}
          {visitedTabs.tickets && (
            <div className={cn(activeTab === "tickets" ? "block" : "hidden")}>
              <TicketAdminPanel
                onOpenEvent={(eventId) => {
                  setFocusEventId(eventId);
                  setActiveTab("events");
                  setVisitedTabs((current) => ({ ...current, events: true }));
                }}
                focusTicketId={ticketFocusId}
                onFocusTicketHandled={() => setTicketFocusId(null)}
              />
            </div>
          )}
          {visitedTabs.events && (
            <div className={cn(activeTab === "events" ? "block" : "hidden")}>
              <MeetingEventAdminPanel
                focusEventId={focusEventId}
                onFocusEventHandled={() => setFocusEventId(null)}
                onOpenWaitlist={() => setActiveTab("waitlist")}
              />
            </div>
          )}
          {visitedTabs.calendar && (
            <div className={cn(activeTab === "calendar" ? "block" : "hidden")}>
              <CalendarAdminPanel onOpenTicket={openTicketFromCalendar} />
            </div>
          )}
          {visitedTabs.waitlist && (
            <div className={cn(activeTab === "waitlist" ? "block" : "hidden")}>
              <WaitlistAdminPanel />
            </div>
          )}
          {activeTab === "rooms" && <RoomChatAdminPanel />}
          {visitedTabs.feedback && (
            <div className={cn(activeTab === "feedback" ? "block" : "hidden")}>
              <FeedbackAdminPanel />
            </div>
          )}
          {visitedTabs.blindDates && (
            <div
              className={cn(activeTab === "blindDates" ? "block" : "hidden")}
            >
              <BlindDateAdminPanel />
            </div>
          )}
          {visitedTabs.loginBlocklist && (
            <div
              className={cn(
                activeTab === "loginBlocklist" ? "block" : "hidden",
              )}
            >
              <LoginBlocklistAdminPanel />
            </div>
          )}
          {visitedTabs.funnel && (
            <div className={cn(activeTab === "funnel" ? "block" : "hidden")}>
              <FunnelAdminPanel />
            </div>
          )}
        </section>
      </div>
      {assignmentCriteriaOpen && (
        <AssignmentCriteriaDialog
          onClose={() => setAssignmentCriteriaOpen(false)}
        />
      )}
      {redFlagCriteriaOpen && (
        <RedFlagCriteriaDialog onClose={() => setRedFlagCriteriaOpen(false)} />
      )}
    </main>
  );
}

import { cn } from "@/lib/cn";
