import { chatOperatorMember, chatOperatorUserId } from "@/lib/chatOperator";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminChatRoom } from "@/types/adminChat";
import type { MeetingChatMember, MeetingChatMessage } from "@/types/chat";

export const CHAT_MEMBER_STATUSES = [
  "approved",
  "completed",
  "feedback_done",
] as const;

type AdminSupabase = ReturnType<typeof createAdminClient>;

type InstanceRow = {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
};

type ParticipationRow = {
  ticket_instance_id: string;
  user_id: string;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  public_emoji: string | null;
};

const instanceSelect = [
  "id",
  "title",
  "event_date",
  "event_time",
  "region",
  "place_name",
].join(",");

const messageSelect = [
  "id",
  "ticket_instance_id",
  "sender_id",
  "body",
  "deleted_at",
  "created_at",
].join(",");

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function fallbackNickname(name: string | null | undefined) {
  const trimmed = name?.trim() ?? "";
  const korean = Array.from(trimmed)
    .filter((character) => /\p{Script=Hangul}/u.test(character))
    .join("");

  if (korean.length >= 2) return korean.slice(-2);
  if (trimmed) return trimmed.slice(0, 6);
  return "멤버";
}

function profileEmoji(userId: string) {
  const labels = ["봄", "별", "숲", "잔", "결", "빛"];
  const sum = Array.from(userId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return labels[sum % labels.length];
}

function eventStartAt(instance: InstanceRow) {
  if (!instance.event_date || !instance.event_time) return null;
  const date = new Date(
    `${instance.event_date}T${instance.event_time.slice(0, 8)}+09:00`,
  );
  return Number.isFinite(date.getTime()) ? date : null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function latestMessageByRoom(messages: MeetingChatMessage[]) {
  const result = new Map<string, MeetingChatMessage>();
  for (const message of messages) {
    const current = result.get(message.ticket_instance_id);
    if (!current || current.created_at < message.created_at) {
      result.set(message.ticket_instance_id, message);
    }
  }
  return result;
}

function messageCountsByRoom(messages: MeetingChatMessage[]) {
  return messages.reduce((map, message) => {
    map.set(message.ticket_instance_id, (map.get(message.ticket_instance_id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

export async function loadAdminChatRooms({
  roomId,
  supabase = createAdminClient(),
}: {
  roomId?: string;
  supabase?: AdminSupabase;
} = {}) {
  let instanceQuery = supabase
    .from("ticket_instances")
    .select(instanceSelect)
    .not("event_date", "is", null)
    .not("event_time", "is", null);

  if (roomId) {
    instanceQuery = instanceQuery.eq("id", roomId);
  }

  const { data: instanceData, error: instanceError } = await instanceQuery
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(roomId ? 1 : 500)
    .returns<InstanceRow[]>();
  if (instanceError) throw instanceError;

  const instanceRows = instanceData ?? [];
  const instanceIds = instanceRows.map((instance) => instance.id);
  if (instanceIds.length === 0) {
    return {
      rooms: [],
      operatorConfigured: Boolean(chatOperatorUserId()),
    };
  }

  const [participationsResult, messagesResult] = await Promise.all([
    supabase
      .from("ticket_participations")
      .select("ticket_instance_id,user_id")
      .in("ticket_instance_id", instanceIds)
      .in("status", [...CHAT_MEMBER_STATUSES])
      .returns<ParticipationRow[]>(),
    supabase
      .from("meeting_chat_messages")
      .select(messageSelect)
      .in("ticket_instance_id", instanceIds)
      .order("created_at", { ascending: false })
      .limit(roomId ? 500 : 5000)
      .returns<MeetingChatMessage[]>(),
  ]);

  const error = participationsResult.error ?? messagesResult.error;
  if (error) throw error;

  const participations = participationsResult.data ?? [];
  const profileIds = unique(participations.map((row) => row.user_id));

  let profiles: ProfileRow[] = [];
  if (profileIds.length > 0) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("user_id,name,nickname,public_emoji")
      .in("user_id", profileIds)
      .returns<ProfileRow[]>();
    if (profileError) throw profileError;
    profiles = data ?? [];
  }

  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const memberIdsByInstance = participations.reduce((map, participation) => {
    const current = map.get(participation.ticket_instance_id) ?? [];
    current.push(participation.user_id);
    map.set(participation.ticket_instance_id, current);
    return map;
  }, new Map<string, string[]>());
  const messages = messagesResult.data ?? [];
  const latestByRoom = latestMessageByRoom(messages);
  const countsByRoom = messageCountsByRoom(messages);
  const now = new Date();

  const rooms = instanceRows
    .map((instance): AdminChatRoom | null => {
      const startAt = eventStartAt(instance);
      if (!startAt || !instance.event_date || !instance.event_time) return null;

      const opensAt = addHours(startAt, -3);
      const feedbackOpensAt = addHours(startAt, 3);
      const closesAt = addHours(feedbackOpensAt, 24);
      if (now >= closesAt) return null;

      const status = now >= opensAt ? "active" : "upcoming";
      const memberIds = unique(memberIdsByInstance.get(instance.id) ?? []);
      if (status === "upcoming" && memberIds.length === 0) return null;

      const members: MeetingChatMember[] = memberIds.map((memberId) => {
        const profile = profileMap.get(memberId);
        return {
          id: memberId,
          nickname: profile?.nickname?.trim() || fallbackNickname(profile?.name),
          emoji: profile?.public_emoji?.trim() || profileEmoji(memberId),
          isSelf: false,
          role: "member",
        };
      });
      const operator = chatOperatorMember(false);
      if (operator) members.push(operator);

      return {
        id: instance.id,
        title: instance.title,
        eventDate: instance.event_date,
        eventTime: instance.event_time.slice(0, 5),
        area: instance.region,
        placeName: instance.place_name,
        opensAt: opensAt.toISOString(),
        feedbackOpensAt: feedbackOpensAt.toISOString(),
        closesAt: closesAt.toISOString(),
        members,
        status,
        participantCount: memberIds.length,
        messageCount: countsByRoom.get(instance.id) ?? 0,
        lastMessage: latestByRoom.get(instance.id) ?? null,
      };
    })
    .filter((room): room is AdminChatRoom => Boolean(room))
    .sort((left, right) => {
      const leftTime = left.status === "active" ? left.closesAt : left.opensAt;
      const rightTime = right.status === "active" ? right.closesAt : right.opensAt;
      return leftTime.localeCompare(rightTime);
    });

  return {
    rooms,
    operatorConfigured: Boolean(chatOperatorUserId()),
  };
}
