"use client";

import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatTicketDateLabel,
  formatTicketTimeLabel,
} from "@/components/IntersectionTicketCard";
import {
  RecommendationCalendarSelector,
  type RecommendationCalendarDate,
} from "@/features/meetings/RecommendationCalendarSelector";
import {
  ticketVisibilityLabels,
  type AdminTicketTemplate,
  type TicketVisibility,
} from "@/features/admin/ticketAdminTypes";

type CalendarTicketData = {
  templates?: AdminTicketTemplate[];
  error?: string;
};

type AdminCalendarDetailTicket = {
  id: string;
  templateId: string;
  instanceId: string;
  detailLabel: string;
  title: string;
  date: string;
  time: string | null;
  region: string | null;
  imageUrl: string | null;
  visibility: TicketVisibility;
  participantCount: number;
  waitlistCount: number;
};

type AdminCalendarTemplateGroup = {
  id: string;
  templateId: string;
  title: string;
  date: string;
  imageUrl: string | null;
  detailTickets: AdminCalendarDetailTicket[];
  timeSummary: string;
  regionSummary: string;
  visibilitySummary: string;
  participantCount: number;
  waitlistCount: number;
};

type AdminCalendarDate = RecommendationCalendarDate<AdminCalendarTemplateGroup> & {
  label: string;
  detailTicketCount: number;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const detailTicketLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function detailTicketLabel(index: number) {
  const letter = detailTicketLetters[index] ?? String(index + 1);
  return `세부티켓 ${letter}`;
}

function uniqueFilledValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function summarizeTimes(tickets: AdminCalendarDetailTicket[]) {
  const times = uniqueFilledValues(
    tickets.map((ticket) => formatTicketTimeLabel(ticket.time)),
  );

  if (times.length === 0) return "시간 미정";
  if (times.length === 1) return times[0];
  return `${times.length}개 시간`;
}

function summarizeRegions(tickets: AdminCalendarDetailTicket[]) {
  const regions = uniqueFilledValues(tickets.map((ticket) => ticket.region));

  if (regions.length === 0) return "지역 미정";
  if (regions.length === 1) return regions[0];
  return `${regions.length}개 지역`;
}

function summarizeVisibility(tickets: AdminCalendarDetailTicket[]) {
  const visibilities = uniqueFilledValues(
    tickets.map((ticket) => ticket.visibility),
  );

  if (visibilities.length === 1) {
    return ticketVisibilityLabels[visibilities[0] as TicketVisibility];
  }

  return "상태 혼합";
}

function sortDetailTickets(
  left: AdminCalendarDetailTicket,
  right: AdminCalendarDetailTicket,
) {
  return `${left.time ?? ""}${left.detailLabel}${left.title}`.localeCompare(
    `${right.time ?? ""}${right.detailLabel}${right.title}`,
    "ko",
  );
}

function detailTicketsFromTemplate(template: AdminTicketTemplate) {
  if (template.template_kind === "question_sample") return [];

  const base = {
    templateId: template.id,
    imageUrl: template.image_url,
  };

  return template.instances
    .map((instance, index) => ({ instance, index }))
    .filter(({ instance }) => Boolean(instance.event_date))
    .map(
      ({ instance, index }): AdminCalendarDetailTicket => ({
        ...base,
        id: instance.id,
        instanceId: instance.id,
        detailLabel: detailTicketLabel(index),
        title: instance.title || template.title,
        date: instance.event_date!,
        time: instance.event_time ?? template.default_time,
        region: instance.region ?? template.default_region,
        visibility: instance.visibility,
        participantCount: instance.participant_count,
        waitlistCount: instance.waitlist_count,
      }),
    );
}

function calendarDatesFromTemplates(templates: AdminTicketTemplate[]) {
  const groupsByDate = new Map<string, AdminCalendarTemplateGroup[]>();

  for (const template of templates) {
    const ticketsByDate = new Map<string, AdminCalendarDetailTicket[]>();

    for (const ticket of detailTicketsFromTemplate(template)) {
      const current = ticketsByDate.get(ticket.date) ?? [];
      current.push(ticket);
      ticketsByDate.set(ticket.date, current);
    }

    for (const [date, tickets] of ticketsByDate.entries()) {
      const detailTickets = [...tickets].sort(sortDetailTickets);
      const current = groupsByDate.get(date) ?? [];
      current.push({
        id: `${template.id}:${date}`,
        templateId: template.id,
        title: template.title,
        date,
        imageUrl: template.image_url,
        detailTickets,
        timeSummary: summarizeTimes(detailTickets),
        regionSummary: summarizeRegions(detailTickets),
        visibilitySummary: summarizeVisibility(detailTickets),
        participantCount: detailTickets.reduce(
          (sum, ticket) => sum + ticket.participantCount,
          0,
        ),
        waitlistCount: detailTickets.reduce(
          (sum, ticket) => sum + ticket.waitlistCount,
          0,
        ),
      });
      groupsByDate.set(date, current);
    }
  }

  return [...groupsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, groups]): AdminCalendarDate => {
      const sortedGroups = groups.sort((left, right) =>
        `${left.detailTickets[0]?.time ?? ""}${left.title}`.localeCompare(
          `${right.detailTickets[0]?.time ?? ""}${right.title}`,
          "ko",
        ),
      );
      const detailTicketCount = sortedGroups.reduce(
        (sum, group) => sum + group.detailTickets.length,
        0,
      );

      return {
        date,
        label: formatTicketDateLabel(date),
        tickets: sortedGroups,
        ticketCount: sortedGroups.length,
        detailTicketCount,
      };
    });
}

export function CalendarAdminPanel({
  onOpenTicket,
}: {
  onOpenTicket: (ticketId: string) => void;
}) {
  const [templates, setTemplates] = useState<AdminTicketTemplate[]>([]);
  const [selectedDate, setSelectedDate] = useState<AdminCalendarDate | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calendarDates = useMemo(
    () => calendarDatesFromTemplates(templates),
    [templates],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/tickets", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | CalendarTicketData
        | null;

      if (!response.ok || !data) {
        throw new Error(data?.error ?? "calendar-tickets-load-failed");
      }

      setTemplates(data.templates ?? []);
    } catch {
      setError("달력에 표시할 티켓 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (calendarDates.length === 0) {
      setSelectedDate(null);
      return;
    }

    setSelectedDate((current) => {
      if (!current) return calendarDates[0];
      return (
        calendarDates.find((date) => date.date === current.date) ??
        calendarDates[0]
      );
    });
  }, [calendarDates]);

  return (
    <section className="flex h-[calc(100dvh-190px)] min-h-[720px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">달력 관리</h2>
            <p className="mt-1 text-xs font-semibold text-black/42">
              추천 탭 달력 기준으로 날짜별 운영 티켓을 확인합니다.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-black/58 transition hover:border-black/20 hover:text-black disabled:cursor-wait disabled:opacity-45"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
              aria-hidden
            />
            새로고침
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[430px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-black/10 bg-[#fbfbfa] p-5">
          <RecommendationCalendarSelector
            dates={calendarDates}
            loading={loading}
            marker="count"
            onSelect={setSelectedDate}
            className="mt-0"
            loadingText="운영 티켓 날짜를 불러오고 있습니다."
            helpText="* 숫자는 해당 날짜에 등록된 대표 템플릿 개수입니다."
            emptyText="날짜가 등록된 티켓이 없습니다."
          />
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#fbfbfa] p-5">
          <SelectedDateTicketList
            selectedDate={selectedDate}
            loading={loading}
            onOpenTicket={onOpenTicket}
          />
        </main>
      </div>
    </section>
  );
}

function SelectedDateTicketList({
  selectedDate,
  loading,
  onOpenTicket,
}: {
  selectedDate: AdminCalendarDate | null;
  loading: boolean;
  onOpenTicket: (ticketId: string) => void;
}) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setExpandedGroupIds(new Set());
  }, [selectedDate?.date]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (!selectedDate) {
    return (
      <PanelMessage>
        {loading
          ? "날짜별 티켓을 불러오는 중입니다."
          : "날짜를 선택하면 해당 날짜의 티켓이 표시됩니다."}
      </PanelMessage>
    );
  }

  return (
    <section className="mx-auto max-w-[760px]">
      <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          selected date
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-2xl font-black tracking-tight">
            {selectedDate.label}
          </h3>
          <span className="rounded-full bg-[#7eb3c7]/15 px-3 py-1 text-xs font-black text-[#347f9b]">
            대표 템플릿 {selectedDate.tickets.length}개 · 세부티켓{" "}
            {selectedDate.detailTicketCount}개
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {selectedDate.tickets.map((group) => (
          <AdminCalendarTemplateCard
            key={group.id}
            group={group}
            expanded={expandedGroupIds.has(group.id)}
            onOpen={() => onOpenTicket(group.templateId)}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
      </div>
    </section>
  );
}

function AdminCalendarTemplateCard({
  group,
  expanded,
  onOpen,
  onToggle,
}: {
  group: AdminCalendarTemplateGroup;
  expanded: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:border-black/20 hover:shadow-md">
      <div className="flex items-stretch gap-3 p-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 gap-4 rounded-xl text-left outline-none transition hover:bg-black/[0.02] focus-visible:ring-4 focus-visible:ring-accent/15 active:scale-[0.995]"
        >
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.04]">
            {group.imageUrl ? (
              <img
                src={group.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon size={24} className="text-black/25" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-black text-accent">
                대표 템플릿
              </span>
              <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-bold text-black/50">
                {group.visibilitySummary}
              </span>
            </div>
            <h4 className="mt-2 text-lg font-black leading-6 text-black">
              {group.title}
            </h4>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-black/50 sm:grid-cols-2">
              <InfoLine icon={Clock3} value={group.timeSummary} />
              <InfoLine icon={MapPin} value={group.regionSummary} />
              <InfoLine
                icon={CalendarDays}
                value={formatTicketDateLabel(group.date)}
              />
              <InfoLine
                icon={Users}
                value={`세부티켓 ${group.detailTickets.length}개 · 참여 ${group.participantCount}명 · 대기 ${group.waitlistCount}명`}
              />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${group.title} 세부티켓 ${expanded ? "접기" : "펼치기"}`}
          className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 text-black/45 transition hover:border-black/20 hover:bg-black/[0.03] hover:text-black focus-visible:ring-4 focus-visible:ring-accent/15"
        >
          <ChevronDown
            size={18}
            aria-hidden
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-black/8 bg-[#fbfbfa] px-4 pb-4 pt-3">
          <div className="space-y-2">
            {group.detailTickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={onOpen}
                className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-left transition hover:border-black/18 hover:bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-black text-black">
                      {ticket.detailLabel}
                    </span>
                    <span className="rounded-full bg-black/[0.05] px-2 py-1 text-[10px] font-bold text-black/45">
                      {ticketVisibilityLabels[ticket.visibility]}
                    </span>
                  </div>
                </div>
                <p className="mt-2 truncate text-sm font-bold text-black">
                  {ticket.title}
                </p>
                <div className="mt-2 grid gap-2 text-[11px] font-semibold text-black/48 sm:grid-cols-2">
                  <InfoLine
                    icon={Clock3}
                    value={formatTicketTimeLabel(ticket.time) || "시간 미정"}
                  />
                  <InfoLine
                    icon={MapPin}
                    value={ticket.region || "지역 미정"}
                  />
                  <InfoLine
                    icon={CalendarDays}
                    value={formatTicketDateLabel(ticket.date)}
                  />
                  <InfoLine
                    icon={RefreshCw}
                    value={`참여 ${ticket.participantCount}명 · 대기 ${ticket.waitlistCount}명`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function InfoLine({
  icon: Icon,
  value,
}: {
  icon: LucideIcon;
  value: string;
}) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      <Icon size={14} className="shrink-0 text-black/30" aria-hidden />
      <span className="truncate">{value}</span>
    </p>
  );
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white px-5 text-center text-sm font-semibold text-black/40">
      {children}
    </div>
  );
}
