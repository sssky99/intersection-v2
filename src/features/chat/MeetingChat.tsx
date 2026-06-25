"use client";

import {
  ArrowLeft,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
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
import { createClient } from "@/lib/supabase/client";
import type {
  MeetingChatMessage,
  MeetingChatRead,
  MeetingChatRoom,
  MeetingChatRoomsResponse,
} from "@/types/chat";

type RoomActivity = {
  lastMessage: MeetingChatMessage | null;
  unreadCount: number;
};

const emptyActivity: RoomActivity = {
  lastMessage: null,
  unreadCount: 0,
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00+09:00`);
  if (!Number.isFinite(value.getTime())) return `${date} ${time}`;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(value);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatCloseTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatRemainingTime(closesAt: string, nowMs: number | null) {
  if (nowMs === null) return "--:--:--";

  const closeTime = new Date(closesAt).getTime();
  if (!Number.isFinite(closeTime)) return "00:00:00";

  const totalSeconds = Math.max(
    0,
    Math.floor((closeTime - nowMs) / 1000),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function memberName(room: MeetingChatRoom, userId: string) {
  return room.members.find((member) => member.id === userId)?.nickname ?? "멤버";
}

function memberEmoji(room: MeetingChatRoom, userId: string) {
  return room.members.find((member) => member.id === userId)?.emoji ?? "💬";
}

function latestMessageByRoom(messages: MeetingChatMessage[]) {
  const result = new Map<string, MeetingChatMessage>();
  for (const message of messages) {
    if (!result.has(message.ticket_instance_id)) {
      result.set(message.ticket_instance_id, message);
    }
  }
  return result;
}

function roomActivityMap(
  rooms: MeetingChatRoom[],
  messages: MeetingChatMessage[],
  reads: MeetingChatRead[],
  userId: string,
) {
  const latestByRoom = latestMessageByRoom(messages);
  const ownReadByRoom = new Map(
    reads
      .filter((read) => read.user_id === userId)
      .map((read) => [read.ticket_instance_id, read.last_read_at]),
  );

  return new Map(
    rooms.map((room) => {
      const lastReadAt = ownReadByRoom.get(room.id) ?? "";
      const unreadCount = messages.filter(
        (message) =>
          message.ticket_instance_id === room.id &&
          message.sender_id !== userId &&
          !message.deleted_at &&
          message.created_at > lastReadAt,
      ).length;

      return [
        room.id,
        {
          lastMessage: latestByRoom.get(room.id) ?? null,
          unreadCount,
        },
      ];
    }),
  );
}

function unreadMemberCount(
  room: MeetingChatRoom,
  message: MeetingChatMessage,
  reads: MeetingChatRead[],
) {
  const readAtByUser = new Map(
    reads.map((read) => [read.user_id, read.last_read_at]),
  );
  return room.members.filter(
    (member) =>
      member.id !== message.sender_id &&
      (readAtByUser.get(member.id) ?? "") < message.created_at,
  ).length;
}

export function MeetingChat({
  userId,
  active,
  onUnreadCountChange,
  onRoomOpenChange,
}: {
  userId: string;
  active: boolean;
  onUnreadCountChange: (count: number) => void;
  onRoomOpenChange: (open: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<MeetingChatRoom[]>([]);
  const [activityByRoom, setActivityByRoom] = useState<
    Map<string, RoomActivity>
  >(new Map());
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MeetingChatMessage[]>([]);
  const [reads, setReads] = useState<MeetingChatRead[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<
    string | null
  >(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const roomKey = rooms.map((room) => room.id).join(",");

  useEffect(() => {
    onRoomOpenChange(Boolean(selectedRoom));
    return () => onRoomOpenChange(false);
  }, [onRoomOpenChange, selectedRoom]);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const loadActivity = useCallback(
    async (nextRooms: MeetingChatRoom[]) => {
      if (nextRooms.length === 0) {
        setActivityByRoom(new Map());
        return;
      }

      const roomIds = nextRooms.map((room) => room.id);
      const [messagesResult, readsResult] = await Promise.all([
        supabase
          .from("meeting_chat_messages")
          .select(
            "id,ticket_instance_id,sender_id,body,deleted_at,created_at",
          )
          .in("ticket_instance_id", roomIds)
          .order("created_at", { ascending: false })
          .limit(500)
          .returns<MeetingChatMessage[]>(),
        supabase
          .from("meeting_chat_reads")
          .select("ticket_instance_id,user_id,last_read_at")
          .eq("user_id", userId)
          .in("ticket_instance_id", roomIds)
          .returns<MeetingChatRead[]>(),
      ]);

      if (messagesResult.error || readsResult.error) {
        setError("채팅 내역을 불러오지 못했어요.");
        return;
      }

      setActivityByRoom(
        roomActivityMap(
          nextRooms,
          messagesResult.data ?? [],
          readsResult.data ?? [],
          userId,
        ),
      );
    },
    [supabase, userId],
  );

  const loadRooms = useCallback(async () => {
    const response = await fetch("/api/meetings/chat/rooms", {
      cache: "no-store",
    }).catch(() => null);
    const data = response
      ? ((await response.json().catch(() => null)) as
          | MeetingChatRoomsResponse
          | { error?: string }
          | null)
      : null;

    if (!response?.ok || !data || !("rooms" in data)) {
      setError(
        (data && "error" in data && data.error) ||
          "채팅방을 불러오지 못했어요.",
      );
      setLoading(false);
      return;
    }

    setError(null);
    setRooms(data.rooms);
    setSelectedRoomId((current) =>
      current && data.rooms.some((room) => room.id === current)
        ? current
        : null,
    );
    await loadActivity(data.rooms);
    setLoading(false);
  }, [loadActivity]);

  const loadMessages = useCallback(
    async (roomId: string) => {
      setRoomLoading(true);
      const [messagesResult, readsResult] = await Promise.all([
        supabase
          .from("meeting_chat_messages")
          .select(
            "id,ticket_instance_id,sender_id,body,deleted_at,created_at",
          )
          .eq("ticket_instance_id", roomId)
          .order("created_at", { ascending: false })
          .limit(500)
          .returns<MeetingChatMessage[]>(),
        supabase
          .from("meeting_chat_reads")
          .select("ticket_instance_id,user_id,last_read_at")
          .eq("ticket_instance_id", roomId)
          .returns<MeetingChatRead[]>(),
      ]);

      if (messagesResult.error || readsResult.error) {
        setError("대화를 불러오지 못했어요.");
        setRoomLoading(false);
        return;
      }

      setMessages([...(messagesResult.data ?? [])].reverse());
      setReads(readsResult.data ?? []);
      setRoomLoading(false);
    },
    [supabase],
  );

  const loadReads = useCallback(
    async (roomId: string) => {
      const { data, error: readsError } = await supabase
        .from("meeting_chat_reads")
        .select("ticket_instance_id,user_id,last_read_at")
        .eq("ticket_instance_id", roomId)
        .returns<MeetingChatRead[]>();
      if (readsError) return;
      setReads(data ?? []);
    },
    [supabase],
  );

  const markRead = useCallback(
    async (roomId: string) => {
      const { data, error: readError } = await supabase.rpc(
        "mark_meeting_chat_read",
        {
          p_ticket_instance_id: roomId,
        },
      );
      if (readError) {
        await loadRooms();
        return;
      }

      if (typeof data === "string") {
        setReads((current) => [
          ...current.filter((read) => read.user_id !== userId),
          {
            ticket_instance_id: roomId,
            user_id: userId,
            last_read_at: data,
          },
        ]);
      }
      setActivityByRoom((current) => {
        const next = new Map(current);
        const activity = next.get(roomId);
        if (activity) {
          next.set(roomId, { ...activity, unreadCount: 0 });
        }
        return next;
      });
    },
    [loadRooms, supabase, userId],
  );

  useEffect(() => {
    void loadRooms();
    const intervalId = window.setInterval(() => void loadRooms(), 15_000);
    return () => window.clearInterval(intervalId);
  }, [loadRooms]);

  useEffect(() => {
    if (!active) return;
    void loadRooms();
  }, [active, loadRooms]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      setReads([]);
      return;
    }
    void (async () => {
      await loadMessages(selectedRoomId);
      if (active) await markRead(selectedRoomId);
    })();
  }, [active, loadMessages, markRead, selectedRoomId]);

  useEffect(() => {
    const total = [...activityByRoom.values()].reduce(
      (sum, activity) => sum + activity.unreadCount,
      0,
    );
    onUnreadCountChange(total);
  }, [activityByRoom, onUnreadCountChange]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!roomKey) return;

    const refreshMessages = () => {
      void loadActivity(rooms);
      if (!selectedRoomId) return;
      void (async () => {
        await loadMessages(selectedRoomId);
        if (active) await markRead(selectedRoomId);
      })();
    };
    const refreshReads = () => {
      void loadActivity(rooms);
      if (selectedRoomId) void loadReads(selectedRoomId);
    };
    const channel = supabase
      .channel(`meeting-chat:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_chat_messages",
        },
        refreshMessages,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_chat_reads",
        },
        refreshReads,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_assignments",
          filter: `profile_id=eq.${userId}`,
        },
        () => void loadRooms(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_waitlist",
          filter: `user_id=eq.${userId}`,
        },
        () => void loadRooms(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    loadActivity,
    loadMessages,
    loadReads,
    loadRooms,
    markRead,
    roomKey,
    rooms,
    active,
    selectedRoomId,
    supabase,
    userId,
  ]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!selectedRoom || !body || body.length > 100 || sending) return;

    setSending(true);
    setError(null);
    const { error: sendError } = await supabase
      .from("meeting_chat_messages")
      .insert({
        ticket_instance_id: selectedRoom.id,
        sender_id: userId,
        body,
      });

    if (sendError) {
      setError("메시지를 보내지 못했어요. 채팅 가능 시간을 확인해 주세요.");
      setSending(false);
      await loadRooms();
      return;
    }

    setDraft("");
    await Promise.all([
      loadMessages(selectedRoom.id),
      markRead(selectedRoom.id),
    ]);
    setSending(false);
  };

  const deleteMessage = async (messageId: string) => {
    if (!selectedRoom) return;
    setError(null);
    const { error: deleteError } = await supabase
      .from("meeting_chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("sender_id", userId);

    if (deleteError) {
      setError("메시지를 삭제하지 못했어요.");
      setPendingDeleteMessageId(null);
      await loadRooms();
      return;
    }

    setPendingDeleteMessageId(null);
    await loadMessages(selectedRoom.id);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendMessage();
  };

  if (selectedRoom) {
    return (
      <section className="relative flex h-full min-h-0 flex-col bg-white text-black">
        <header className="shrink-0 border-b border-black/[0.07] px-4 pb-3 pt-[calc(16px+env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedRoomId(null)}
              title="채팅 목록"
              aria-label="채팅 목록"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black/60 transition hover:bg-black/[0.05] hover:text-black"
            >
              <ArrowLeft size={20} aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-black">{selectedRoom.title}</h1>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-black/42">
                <Users size={12} aria-hidden />
                {selectedRoom.members.length}명
                <span aria-hidden>·</span>
                {formatDateTime(
                  selectedRoom.eventDate,
                  selectedRoom.eventTime,
                )}{" "}
                시작
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f8] px-4 py-5 scrollbar-none">
          <p className="mx-auto mb-5 max-w-[290px] text-center text-[11px] font-semibold leading-5 text-black/38">
            언제까지 도착할 예정인지, 어디서 모일지 이야기 나눠보세요.
            <br />
            {formatCloseTime(selectedRoom.closesAt)}까지 대화할 수 있어요.
          </p>

          {roomLoading ? (
            <div className="flex h-40 items-center justify-center text-black/35">
              <Loader2 size={20} className="animate-spin" aria-hidden />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-center">
              <p className="text-xs font-semibold leading-5 text-black/35">
                첫 메시지를 남겨보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const own = message.sender_id === userId;
                const deleted = Boolean(message.deleted_at);
                const unreadCount = unreadMemberCount(
                  selectedRoom,
                  message,
                  reads,
                );

                return (
                  <article
                    key={message.id}
                    className={cn("flex gap-2.5", own && "justify-end")}
                  >
                    {!own && (
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm shadow-sm"
                      >
                        {memberEmoji(selectedRoom, message.sender_id)}
                      </span>
                    )}
                    <div className={cn("max-w-[76%]", own && "text-right")}>
                      {!own && (
                        <p className="mb-1 px-1 text-[11px] font-bold text-black/48">
                          {memberName(selectedRoom, message.sender_id)}
                        </p>
                      )}
                      <div
                        className={cn(
                          "inline-block rounded-2xl px-3.5 py-2.5 text-left text-[15px] font-semibold leading-5 shadow-sm",
                          own
                            ? "rounded-tr-[5px] bg-[#e5e7ea] text-black/85"
                            : "rounded-tl-[5px] bg-white text-black/78",
                          deleted &&
                            "border border-dashed border-black/15 bg-transparent italic text-black/42 shadow-none",
                        )}
                      >
                        {deleted ? (
                          <span className="flex items-center gap-1.5 text-[13px]">
                            <Trash2 size={12} className="shrink-0" aria-hidden />
                            삭제된 메시지입니다.
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
                          own && "justify-end",
                        )}
                      >
                        {own && !deleted && unreadCount > 0 && (
                          <span
                            title={`${unreadCount}명이 아직 읽지 않았어요`}
                            className="text-accent"
                          >
                            {unreadCount}
                          </span>
                        )}
                        <time>{formatMessageTime(message.created_at)}</time>
                        {own && !deleted && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteMessageId(message.id)}
                            title="메시지 삭제"
                            aria-label="메시지 삭제"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-black/28 transition hover:bg-black/[0.05] hover:text-red-500"
                          >
                            <Trash2 size={12} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div ref={messageEndRef} />
        </div>

        <div className="shrink-0 border-t border-black/[0.07] bg-white px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
          {error && (
            <p className="mb-2 px-2 text-[11px] font-semibold text-red-500">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 rounded-[20px] border border-black/10 bg-black/[0.025] px-4 py-2">
              <textarea
                value={draft}
                maxLength={100}
                rows={1}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="메시지 입력"
                aria-label="메시지 입력"
                className="max-h-20 min-h-6 w-full resize-none bg-transparent text-base font-medium leading-6 text-black outline-none placeholder:text-black/28"
              />
              <p className="text-right text-[9px] font-semibold text-black/25">
                {draft.length}/100
              </p>
            </div>
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!draft.trim() || sending}
              title="메시지 보내기"
              aria-label="메시지 보내기"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white transition active:scale-95 disabled:bg-black/[0.08] disabled:text-black/25"
            >
              {sending ? (
                <Loader2 size={17} className="animate-spin" aria-hidden />
              ) : (
                <Send size={17} aria-hidden />
              )}
            </button>
          </div>
        </div>

        {pendingDeleteMessageId && (
          <div
            role="presentation"
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 px-6 backdrop-blur-[1px]"
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-message-title"
              aria-describedby="delete-message-description"
              className="w-full max-w-[310px] rounded-[20px] bg-white px-5 pb-4 pt-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
                <Trash2 size={17} aria-hidden />
              </div>
              <h2
                id="delete-message-title"
                className="mt-3 text-base font-black text-black"
              >
                정말 삭제하시겠습니까?
              </h2>
              <p
                id="delete-message-description"
                className="mt-1.5 text-xs font-semibold text-black/42"
              >
                해당 메시지는 모두에게 삭제됩니다.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteMessageId(null)}
                  className="h-11 rounded-xl bg-black/[0.055] text-sm font-bold text-black/58 transition hover:bg-black/[0.09]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void deleteMessage(pendingDeleteMessageId)}
                  className="h-11 rounded-xl bg-red-500 text-sm font-bold text-white transition hover:bg-red-600"
                >
                  삭제
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="h-full overflow-y-auto bg-white px-5 pb-7 pt-[calc(24px+env(safe-area-inset-top))] text-black scrollbar-none">
      <header className="pr-16">
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          chat
        </p>
        <h1 className="mt-2 text-[27px] font-bold leading-9">채팅</h1>
      </header>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center text-black/35">
          <Loader2 size={22} className="animate-spin" aria-hidden />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex min-h-[360px] items-center justify-center px-6 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/[0.045] text-black/[0.38]">
              <MessageCircle size={20} aria-hidden />
            </div>
            <h2 className="mt-5 text-lg font-bold">아직 열린 채팅이 없어요</h2>
            <p className="mt-2 text-xs leading-5 text-black/[0.42]">
              모임 3시간 전부터 피드백 오픈 24시간 후까지 열려요.
            </p>
            {error && (
              <p className="mt-4 text-xs font-semibold text-red-500">{error}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-7 divide-y divide-black/[0.07] border-y border-black/[0.07]">
          {rooms.map((room) => {
            const activity = activityByRoom.get(room.id) ?? emptyActivity;
            const lastMessage = activity.lastMessage;
            const lastMessageText = lastMessage
              ? lastMessage.deleted_at
                ? "삭제된 메시지입니다."
                : lastMessage.body
              : "대화를 시작해 보세요.";

            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                className="flex w-full items-center gap-3 py-5 text-left transition hover:bg-black/[0.015]"
              >
                <div className="flex -space-x-2">
                  {room.members.slice(0, 3).map((member) => (
                    <span
                      key={member.id}
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black/[0.045] text-base"
                    >
                      {member.emoji}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-sm font-black">
                      {room.title}
                    </h2>
                    <span className="shrink-0 text-[10px] font-semibold text-black/30">
                      {lastMessage
                        ? formatMessageTime(lastMessage.created_at)
                        : formatCloseTime(room.closesAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-black/42">
                    {lastMessageText}
                  </p>
                  <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[10px] font-semibold">
                    <span className="flex min-w-0 items-center gap-1 text-black/32">
                      <Clock3 size={11} className="shrink-0" aria-hidden />
                      <span className="truncate">
                        {formatDateTime(room.eventDate, room.eventTime)} 시작
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-black text-red-500 tabular-nums">
                      채팅방 종료까지 남은 시간{" "}
                      {formatRemainingTime(room.closesAt, nowMs)}
                    </span>
                  </div>
                  {(room.placeName || room.area) && (
                    <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] font-semibold text-black/32">
                      <MapPin size={11} className="shrink-0" aria-hidden />
                      <span className="truncate">
                        {room.placeName || room.area}
                      </span>
                    </p>
                  )}
                </div>
                {activity.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-black px-1.5 text-[10px] font-black text-white">
                    {activity.unreadCount > 99 ? "99+" : activity.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
