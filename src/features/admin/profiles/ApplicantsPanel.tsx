"use client";
import {
  AdminMemberName,
  formatAgeAndBirthYear,
  GenderBadge,
} from "@/features/admin/adminDisplay";
import { type AdminProfile } from "@/features/admin/adminProfile";
import {
  membershipStatusLabels,
  type MembershipStatus,
} from "@/features/membership/membershipTypes";
import { LayoutGrid, List, Search } from "lucide-react";

import {
  display,
  MembershipStatusSelect,
  PhotoBox,
  ProfileDetailPanel,
  ProfileDetailPatch,
} from "./ProfileDetailPanel";
import {
  adminProfileArchetypeLabel,
  membershipStatusValue,
} from "./ProfileExport";

export type ViewMode = "list" | "cards";

export type MembershipFilter = "all" | "active" | "inactive";

export type PaymentFilter = "all" | "paid" | "unpaid";

export type CompletionFilter = "all" | "complete" | "incomplete";

export type OperatorRatingFilter =
  | "all"
  | "0.5"
  | "0-0.9"
  | "1-1.9"
  | "2-2.4"
  | "2.5-2.9"
  | "3-3.4"
  | "3.5-3.9"
  | "4-plus";

export type BirthYearSort = "default" | "birth-asc" | "birth-desc";

export type ProfilesState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "timeout"
  | "error";

export type ProfilesPagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export function formatCreatedAtCompact(value: string | null) {
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

export function formatPhoneCompact(value: string | null | undefined) {
  if (!value) return "-";

  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;

  const tail = digits.slice(-8);
  return `${tail.slice(0, 4)} - ${tail.slice(4)}`;
}

export function ApplicantsPanel({
  profiles,
  pagination,
  selectedProfile,
  selectedProfileId,
  viewMode,
  loading,
  error,
  search,
  genderFilter,
  membershipFilter,
  paymentFilter,
  completionFilter,
  operatorRatingFilter,
  birthYearSort,
  profilesState,
  membershipSaveError,
  savingMembershipUserId,
  savingProfileUserId,
  profileSaveError,
  profileSaveNotice,
  onViewModeChange,
  onSearchChange,
  onGenderFilterChange,
  onMembershipFilterChange,
  onPaymentFilterChange,
  onCompletionFilterChange,
  onOperatorRatingFilterChange,
  onBirthYearSortChange,
  onSelectProfile,
  onCloseDetail,
  onReload,
  onPageChange,
  onMembershipStatusChange,
  onProfileDetailSave,
}: {
  profiles: AdminProfile[];
  pagination: ProfilesPagination;
  selectedProfile: AdminProfile | null;
  selectedProfileId: string | null;
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  search: string;
  genderFilter: string;
  membershipFilter: MembershipFilter;
  paymentFilter: PaymentFilter;
  completionFilter: CompletionFilter;
  operatorRatingFilter: OperatorRatingFilter;
  birthYearSort: BirthYearSort;
  profilesState: ProfilesState;
  membershipSaveError: string | null;
  savingMembershipUserId: string | null;
  savingProfileUserId: string | null;
  profileSaveError: string | null;
  profileSaveNotice: string | null;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (value: string) => void;
  onGenderFilterChange: (value: string) => void;
  onMembershipFilterChange: (value: MembershipFilter) => void;
  onPaymentFilterChange: (value: PaymentFilter) => void;
  onCompletionFilterChange: (value: CompletionFilter) => void;
  onOperatorRatingFilterChange: (value: OperatorRatingFilter) => void;
  onBirthYearSortChange: (value: BirthYearSort) => void;
  onSelectProfile: (profileId: string) => void;
  onCloseDetail: () => void;
  onReload: () => void;
  onPageChange: (page: number) => void;
  onMembershipStatusChange: (
    userId: string,
    status: MembershipStatus,
  ) => Promise<void>;
  onProfileDetailSave: (
    userId: string,
    patch: ProfileDetailPatch,
  ) => Promise<boolean>;
}) {
  return (
    <div className="grid h-[calc(100dvh-190px)] min-h-[620px] grid-cols-[minmax(0,1fr)_390px] gap-5">
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="shrink-0 border-b border-black/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">신청자 관리</h2>
              <p className="mt-1 text-xs text-black/45">
                검색 결과 {pagination.totalCount.toLocaleString()}명 · 현재{" "}
                {profiles.length.toLocaleString()}명 · {pagination.page}/
                {pagination.totalPages} 페이지
              </p>
              {loading && profiles.length > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-accent">
                  새로고침 중입니다.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex h-10 items-center rounded-xl border border-black/10 bg-[#f7f7f5] p-1"
                aria-label="신청자 보기 방식"
              >
                <button
                  type="button"
                  onClick={() => onViewModeChange("list")}
                  aria-label="목록 보기"
                  aria-pressed={viewMode === "list"}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition",
                    viewMode === "list"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/40 hover:text-black/70",
                  )}
                >
                  <List size={15} aria-hidden />
                  목록
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("cards")}
                  aria-label="사진 카드 보기"
                  aria-pressed={viewMode === "cards"}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition",
                    viewMode === "cards"
                      ? "bg-white text-black shadow-sm"
                      : "text-black/40 hover:text-black/70",
                  )}
                >
                  <LayoutGrid size={15} aria-hidden />
                  카드
                </button>
              </div>

              <button
                type="button"
                onClick={onReload}
                disabled={loading}
                className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black disabled:cursor-not-allowed disabled:text-black/25"
              >
                {loading ? "조회 중" : "새로고침"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <label className="relative block min-w-[220px] flex-1">
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
              className="h-10 w-[130px] rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
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
              className="h-10 w-[145px] rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
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
              className="h-10 w-[150px] rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="all">완성 여부 전체</option>
              <option value="complete">프로필 완성</option>
              <option value="incomplete">미완성 포함</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(event) =>
                onPaymentFilterChange(event.target.value as PaymentFilter)
              }
              className="h-10 w-[145px] rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="all">결제 전체</option>
              <option value="paid">결제 완료</option>
              <option value="unpaid">결제 없음</option>
            </select>

            <select
              value={operatorRatingFilter}
              aria-label="평점 필터"
              onChange={(event) =>
                onOperatorRatingFilterChange(
                  event.target.value as OperatorRatingFilter,
                )
              }
              className="h-10 w-[145px] rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="all">평점 전체</option>
              <option value="0.5">0.5점 · 판별 불가</option>
              <option value="0-0.9">0~0.9점</option>
              <option value="1-1.9">1~1.9점</option>
              <option value="2-2.4">2~2.4점</option>
              <option value="2.5-2.9">2.5~2.9점</option>
              <option value="3-3.4">3.0~3.4점</option>
              <option value="3.5-3.9">3.5~3.9점</option>
              <option value="4-plus">4.0점 이상</option>
            </select>

            <select
              value={birthYearSort}
              onChange={(event) =>
                onBirthYearSortChange(event.target.value as BirthYearSort)
              }
              className="h-10 w-[155px] rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-black/65 outline-none focus:border-accent"
            >
              <option value="default">기본 정렬</option>
              <option value="birth-asc">출생연도 빠른 순</option>
              <option value="birth-desc">출생연도 늦은 순</option>
            </select>
          </div>

          {membershipSaveError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {membershipSaveError}
            </p>
          )}
          {error && profiles.length > 0 && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {profilesState === "loading" && profiles.length === 0 ? (
            <StateMessage message="신청자 목록을 불러오는 중입니다." />
          ) : profilesState === "timeout" ? (
            <StateMessage
              tone="error"
              message="조회 시간이 10초를 초과했습니다."
              actionLabel="다시 시도"
              onAction={onReload}
            />
          ) : profilesState === "error" ? (
            <StateMessage
              tone="error"
              message={error ?? "신청자 목록을 불러오지 못했습니다."}
              actionLabel="다시 시도"
              onAction={onReload}
            />
          ) : profilesState === "empty" ? (
            <StateMessage message="조건에 맞는 신청자가 없습니다." />
          ) : viewMode === "cards" ? (
            <ApplicantCards
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelectProfile={onSelectProfile}
            />
          ) : (
            <ApplicantTable
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onSelectProfile={onSelectProfile}
              savingMembershipUserId={savingMembershipUserId}
              onMembershipStatusChange={onMembershipStatusChange}
            />
          )}
        </div>
        <div className="flex h-14 shrink-0 items-center justify-between border-t border-black/10 px-5 text-sm font-semibold text-black/55">
          <span>페이지당 최대 50명</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevious || loading}
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              className="h-9 rounded-lg border border-black/10 px-3 disabled:cursor-not-allowed disabled:opacity-30"
            >
              이전
            </button>
            <span className="min-w-20 text-center tabular-nums">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={!pagination.hasNext || loading}
              onClick={() => onPageChange(pagination.page + 1)}
              className="h-9 rounded-lg border border-black/10 px-3 disabled:cursor-not-allowed disabled:opacity-30"
            >
              다음
            </button>
          </div>
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

export function ApplicantTable({
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
      <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#f8f8f6] text-xs font-bold uppercase tracking-wide text-black/45">
          <tr>
            <TableHead className="w-[170px] px-3">이름</TableHead>
            <TableHead className="w-20 px-3">성별</TableHead>
            <TableHead className="w-24">출생연도</TableHead>
            <TableHead className="w-32">전화번호</TableHead>
            <TableHead className="w-28">프로필</TableHead>
            <TableHead className="w-24">결제</TableHead>
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
                <TableCell className="w-[170px] px-3">
                  <span className="block min-w-0 font-bold text-black">
                    <AdminMemberName
                      profile={profile}
                      oneTimePaid={profile.one_time_paid}
                    />
                  </span>
                </TableCell>
                <TableCell className="w-20 px-3">
                  {display(profile.gender)}
                </TableCell>
                <TableCell>{display(profile.birth_year)}</TableCell>
                <TableCell>{formatPhoneCompact(profile.phone)}</TableCell>
                <TableCell>
                  {profile.profile_completed && profile.questions_completed
                    ? "완성"
                    : "미완성"}
                </TableCell>
                <TableCell>{profile.has_payment ? "완료" : "없음"}</TableCell>
                <TableCell>
                  {formatCreatedAtCompact(profile.created_at)}
                </TableCell>
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

export function ApplicantCards({
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
                selected
                  ? "border-accent ring-4 ring-accent/15"
                  : "border-black/10",
              )}
            >
              <PhotoBox
                src={profile.photo_url}
                alt={`${profile.name ?? "신청자"} 프로필 사진`}
                className="h-64 w-full bg-[#f7f7f5]"
                fit="cover"
                loading="eager"
                thumbnail={{ width: 440, height: 512, quality: 70 }}
              />
              <div className="space-y-2 p-4">
                <h3 className="truncate text-base font-bold">
                  <AdminMemberName
                    profile={profile}
                    showOperatorRating
                    showRedFlagScore
                    oneTimePaid={profile.one_time_paid}
                  />
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-black/55">
                  <span>{formatAgeAndBirthYear(profile)}</span>
                  <GenderBadge gender={profile.gender} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-black/50">
                  <InfoPill label="MBTI" value={display(profile.mbti)} />
                  <InfoPill
                    label="성향 유형"
                    value={adminProfileArchetypeLabel(profile)}
                  />
                  <InfoPill
                    label="결제"
                    value={profile.has_payment ? "완료" : "없음"}
                  />
                  <InfoPill
                    label="멤버십"
                    value={
                      membershipStatusLabels[membershipStatusValue(profile)]
                    }
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn("border-b border-black/10 px-5 py-3 font-bold", className)}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-black/5 px-5 py-3 text-black/62",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f7f7f5] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-black/35">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-black/65">{value}</p>
    </div>
  );
}

export function StateMessage({
  message,
  tone = "default",
  actionLabel,
  onAction,
}: {
  message: string;
  tone?: "default" | "error";
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 text-sm font-semibold",
        tone === "error" ? "text-red-600" : "text-black/45",
      )}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-9 rounded-lg border border-current/20 bg-white px-4 text-xs font-bold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

import { cn } from "@/lib/cn";
