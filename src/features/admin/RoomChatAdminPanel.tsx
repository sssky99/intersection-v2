"use client";

import {
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AdminChatMessagesResponse,
  AdminChatRoom,
  AdminChatRoomsResponse,
} from "@/types/adminChat";
import type { MeetingChatMessage } from "@/types/chat";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00+09:00`);
  if (!Number.isFinite(value.getTime())) return `${date} ${time}`;
  return dateTimeFormatter.format(value);
}

function formatIsoDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return dateTimeFormatter.format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return timeFormatter.format(date);
}

function messagePreview(message: MeetingChatMessage | null) {
  if (!message) return "아직 메시지가 없습니다.";
  return message.deleted_at ? "숨김 처리된 메시지입니다." : message.body;
}

function responseError(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return fallback;
  }

  const error = (value as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

function roomMatches(room: AdminChatRoom, query: string) {
  if (!query) return true;
  const haystack = [
    room.title,
    room.area,
    room.placeName,
    ...room.members.map((member) => member.nickname),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function senderMember(room: AdminChatRoom | null, senderId: string) {
  return room?.members.find((member) => member.id === senderId) ?? null;
}

function senderName(room: AdminChatRoom | null, senderId: string) {
  return senderMember(room, senderId)?.nickname ?? "알 수 없음";
}

function senderEmoji(room: AdminChatRoom | null, senderId: string) {
  return senderMember(room, senderId)?.emoji ?? "·";
}

function operatorId(room: AdminChatRoom | null) {
  return room?.members.find((member) => member.role === "operator")?.id ?? null;
}

function roomPath(roomId: string) {
  return `/api/admin/chat/rooms/${encodeURIComponent(roomId)}/messages`;
}

export function RoomChatAdminPanel() {
  const [data, setData] = useState<AdminChatRoomsResponse | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomSnapshot, setSelectedRoomSnapshot] =
    useState<AdminChatRoom | null>(null);
  const [messages, setMessages] = useState<MeetingChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const allRooms = useMemo(
    () => [...(data?.activeRooms ?? []), ...(data?.upcomingRooms ?? [])],
    [data],
  );

  const selectedRoom =
    allRooms.find((room) => room.id === selectedRoomId) ??
    selectedRoomSnapshot;

  const normalizedSearch = search.trim().toLowerCase();
  const activeRooms = useMemo(
    () =>
      (data?.activeRooms ?? []).filter((room) =>
        roomMatches(room, normalizedSearch),
      ),
    [data?.activeRooms, normalizedSearch],
  );
  const upcomingRooms = useMemo(
    () =>
      (data?.upcomingRooms ?? []).filter((room) =>
        roomMatches(room, normalizedSearch),
      ),
    [data?.upcomingRooms, normalizedSearch],
  );

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/chat/rooms", {
        cache: "no-store",
      });
      const nextData = (await response.json().catch(() => null)) as
        | AdminChatRoomsResponse
        | { error?: string }
        | null;

      if (!response.ok || !nextData || !("activeRooms" in nextData)) {
        throw new Error(responseError(nextData, "chat-rooms-load-failed"));
      }

      const nextRooms = [...nextData.activeRooms, ...nextData.upcomingRooms];
      setData(nextData);
      setSelectedRoomId((current) =>
        current && nextRooms.some((room) => room.id === current)
          ? current
          : nextData.activeRooms[0]?.id ?? nextData.upcomingRooms[0]?.id ?? null,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "채팅방 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    setComposerError(null);

    try {
      const response = await fetch(roomPath(roomId), { cache: "no-store" });
      const nextData = (await response.json().catch(() => null)) as
        | AdminChatMessagesResponse
        | { error?: string }
        | null;

      if (!response.ok || !nextData || !("messages" in nextData)) {
        throw new Error(responseError(nextData, "chat-messages-load-failed"));
      }

      setSelectedRoomSnapshot(nextData.room);
      setMessages(nextData.messages);
    } catch (error) {
      setComposerError(
        error instanceof Error
          ? error.message
          : "채팅 내역을 불러오지 못했습니다.",
      );
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    const intervalId = window.setInterval(() => void loadRooms(), 15_000);
    return () => window.clearInterval(intervalId);
  }, [loadRooms]);

  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoomSnapshot(null);
      setMessages([]);
      return;
    }

    void loadMessages(selectedRoomId);
    const intervalId = window.setInterval(
      () => void loadMessages(selectedRoomId, true),
      5_000,
    );
    return () => window.clearInterval(intervalId);
  }, [loadMessages, selectedRoomId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const selectRoom = (room: AdminChatRoom) => {
    setSelectedRoomId(room.id);
    setSelectedRoomSnapshot(room);
    setComposerError(null);
  };

  const sendMessage = async () => {
    const body = draft.trim();
    if (!selectedRoom || !body || body.length > 100 || sending) return;

    setSending(true);
    setComposerError(null);

    try {
      const response = await fetch(roomPath(selectedRoom.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "operator-message-send-failed");
      }

      setDraft("");
      await Promise.all([loadRooms(), loadMessages(selectedRoom.id)]);
    } catch (error) {
      setComposerError(
        error instanceof Error
          ? error.message
          : "운영자 메시지를 보내지 못했습니다.",
      );
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (message: MeetingChatMessage) => {
    if (!selectedRoom || deletingMessageId || message.deleted_at) return;

    setDeletingMessageId(message.id);
    setComposerError(null);

    try {
      const response = await fetch(`${roomPath(selectedRoom.id)}/${message.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "message-delete-failed");
      }

      await Promise.all([loadRooms(), loadMessages(selectedRoom.id)]);
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : "메시지를 숨기지 못했습니다.",
      );
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendMessage();
  };

  const canSend =
    Boolean(data?.operatorConfigured) &&
    selectedRoom?.status === "active" &&
    draft.trim().length > 0 &&
    draft.trim().length <= 100 &&
    !sending;
  const selectedOperatorId = operatorId(selectedRoom);

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <header className="shrink-0 border-b border-black/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">룸 관리</h2>
            <p className="mt-1 text-xs font-semibold text-black/45">
              활성 채팅방 {(data?.activeRooms.length ?? 0).toLocaleString()}개 ·
              예정 채팅방 {(data?.upcomingRooms.length ?? 0).toLocaleString()}개
            </p>
            {data && !data.operatorConfigured && (
              <p className="mt-2 text-[11px] font-bold text-red-500">
                CHAT_OPERATOR_USER_ID를 설정해야 교집합 명의로 메시지를 보낼 수 있습니다.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="relative block">
              <Search
                size={15}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/32"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="방, 장소, 멤버 검색"
                className="h-10 w-64 rounded-xl border border-black/10 bg-[#f7f7f5] pl-9 pr-3 text-sm font-semibold text-black/70 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadRooms()}
              disabled={loadingRooms}
              title="새로고침"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black/55 transition hover:border-black/20 hover:text-black disabled:opacity-45"
            >
              <RefreshCw
                size={15}
                aria-hidden
                className={loadingRooms ? "animate-spin" : ""}
              />
              새로고침
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-black/10 bg-[#fbfbfa]">
          {error && (
            <p className="mx-4 mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}

          <div className="h-full overflow-y-auto px-4 py-4">
            <RoomSection
              title="현재 활성화된 채팅방"
              emptyText="현재 열린 채팅방이 없습니다."
              rooms={activeRooms}
              selectedRoomId={selectedRoomId}
              onSelect={selectRoom}
            />
            <RoomSection
              title="활성 예정인 채팅방"
              emptyText="예정된 채팅방이 없습니다."
              rooms={upcomingRooms}
              selectedRoomId={selectedRoomId}
              onSelect={selectRoom}
            />
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          {!selectedRoom ? (
            <div className="flex h-full items-center justify-center text-center text-sm font-semibold text-black/40">
              <div>
                <MessageCircle
                  size={28}
                  aria-hidden
                  className="mx-auto mb-3 text-black/24"
                />
                채팅방을 선택해 주세요.
              </div>
            </div>
          ) : (
            <>
              <header className="shrink-0 border-b border-black/10 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-black",
                          selectedRoom.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {selectedRoom.status === "active" ? "활성" : "예정"}
                      </span>
                      <h3 className="truncate text-base font-black">
                        {selectedRoom.title}
                      </h3>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-black/45">
                      <span className="inline-flex items-center gap-1">
                        <Users size={13} aria-hidden />
                        참여자 {selectedRoom.participantCount}명
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={13} aria-hidden />
                        {formatDateTime(
                          selectedRoom.eventDate,
                          selectedRoom.eventTime,
                        )}
                      </span>
                      {(selectedRoom.placeName || selectedRoom.area) && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin size={13} aria-hidden />
                          <span className="truncate">
                            {selectedRoom.placeName || selectedRoom.area}
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-[11px] font-semibold text-black/40">
                    <p>오픈 {formatIsoDateTime(selectedRoom.opensAt)}</p>
                    <p>종료 {formatIsoDateTime(selectedRoom.closesAt)}</p>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f8] px-5 py-5">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-black/35">
                    <Loader2 size={20} className="animate-spin" aria-hidden />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm font-semibold text-black/35">
                    아직 채팅 내역이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const fromOperator =
                        Boolean(selectedOperatorId) &&
                        message.sender_id === selectedOperatorId;
                      const deleted = Boolean(message.deleted_at);

                      return (
                        <article
                          key={message.id}
                          className={cn(
                            "flex gap-2.5",
                            fromOperator && "justify-end",
                          )}
                        >
                          {!fromOperator && (
                            <span
                              aria-hidden
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm shadow-sm"
                            >
                              {senderEmoji(selectedRoom, message.sender_id)}
                            </span>
                          )}
                          <div
                            className={cn(
                              "max-w-[76%]",
                              fromOperator && "text-right",
                            )}
                          >
                            <p
                              className={cn(
                                "mb-1 px-1 text-[11px] font-bold text-black/48",
                                fromOperator && "text-right",
                              )}
                            >
                              {senderName(selectedRoom, message.sender_id)}
                            </p>
                            <div
                              className={cn(
                                "inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold leading-5 shadow-sm",
                                fromOperator
                                  ? "rounded-tr-[5px] bg-black text-white"
                                  : "rounded-tl-[5px] bg-white text-black/78",
                                deleted &&
                                  "border border-dashed border-black/15 bg-transparent italic text-black/42 shadow-none",
                              )}
                            >
                              {deleted ? (
                                <span className="inline-flex items-center gap-1.5 text-[13px]">
                                  <Trash2 size={12} aria-hidden />
                                  숨김 처리된 메시지입니다.
                                </span>
                              ) : (
                                <p className="whitespace-pre-wrap break-words">
                                  {message.body}
                                </p>
                              )}
                            </div>
                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold text-black/32",
                                fromOperator && "justify-end",
                              )}
                            >
                              <time>{formatTime(message.created_at)}</time>
                              {!deleted && (
                                <button
                                  type="button"
                                  onClick={() => void deleteMessage(message)}
                                  disabled={deletingMessageId === message.id}
                                  title="메시지 숨김"
                                  aria-label="메시지 숨김"
                                  className="flex h-6 w-6 items-center justify-center rounded-full text-black/28 transition hover:bg-black/[0.06] hover:text-red-500 disabled:cursor-wait disabled:opacity-45"
                                >
                                  {deletingMessageId === message.id ? (
                                    <Loader2
                                      size={12}
                                      className="animate-spin"
                                      aria-hidden
                                    />
                                  ) : (
                                    <Trash2 size={12} aria-hidden />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-black/10 bg-white px-4 py-4">
                {composerError && (
                  <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                    {composerError}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-2">
                    <textarea
                      value={draft}
                      maxLength={100}
                      rows={1}
                      disabled={
                        !data?.operatorConfigured ||
                        selectedRoom.status !== "active"
                      }
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={
                        !data?.operatorConfigured
                          ? "CHAT_OPERATOR_USER_ID 설정 필요"
                          : selectedRoom.status === "active"
                            ? "교집합 메시지 입력"
                            : "활성화된 채팅방에서만 발송 가능"
                      }
                      className="max-h-24 min-h-6 w-full resize-none bg-transparent text-sm font-semibold leading-6 text-black outline-none placeholder:text-black/30 disabled:cursor-not-allowed"
                    />
                    <p className="text-right text-[10px] font-semibold text-black/25">
                      {draft.length}/100
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={!canSend}
                    title="교집합 메시지 보내기"
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-black/35"
                  >
                    {sending ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : (
                      <Send size={16} aria-hidden />
                    )}
                    보내기
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function RoomSection({
  title,
  emptyText,
  rooms,
  selectedRoomId,
  onSelect,
}: {
  title: string;
  emptyText: string;
  rooms: AdminChatRoom[];
  selectedRoomId: string | null;
  onSelect: (room: AdminChatRoom) => void;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-black/55">{title}</h3>
        <span className="rounded-full bg-black/[0.055] px-2 py-0.5 text-[11px] font-black text-black/45">
          {rooms.length}
        </span>
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 bg-white px-4 py-6 text-center text-xs font-semibold text-black/35">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onSelect(room)}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition",
                selectedRoomId === room.id
                  ? "border-black bg-white shadow-sm"
                  : "border-black/8 bg-white/70 hover:border-black/18 hover:bg-white",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-black">
                    {room.title}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-black/42">
                    <Clock3 size={11} aria-hidden />
                    {formatDateTime(room.eventDate, room.eventTime)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black",
                    room.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {room.status === "active" ? "활성" : "예정"}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-black/45">
                {messagePreview(room.lastMessage)}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-black/35">
                <span className="inline-flex items-center gap-1">
                  <Users size={11} aria-hidden />
                  {room.participantCount}명
                </span>
                <span>메시지 {room.messageCount}개</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
