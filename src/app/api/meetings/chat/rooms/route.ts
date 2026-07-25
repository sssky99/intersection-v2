import { NextResponse } from "next/server";
import { chatOperatorMember } from "@/lib/chatOperator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  MeetingChatMember,
  MeetingChatMessage,
  MeetingChatRead,
  MeetingChatRoom,
  MeetingChatRoomsResponse,
} from "@/types/chat";

export const dynamic = "force-dynamic";

type ParticipationRow = {
  ticket_instance_id: string;
  user_id: string;
  ticket_snapshot: {
    previewSourceInstanceId?: string | null;
  } | null;
};

type InstanceRow = {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
  visibility: string | null;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  public_emoji: string | null;
};

const CHAT_MEMBER_STATUSES = new Set([
  "approved",
  "completed",
  "feedback_done",
]);

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function fallbackNickname(name: string | null | undefined) {
  const korean = (name ?? "").replace(/[^가-힣]/g, "");
  return korean.length >= 2 ? korean.slice(-2) : korean || "멤버";
}

function profileEmoji(userId: string) {
  const emojis = ["🌿", "☀️", "🌙", "🍀", "🌊", "⭐", "☕", "🎧"];
  const sum = Array.from(userId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return emojis[sum % emojis.length];
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

export async function GET() {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: ownParticipationData, error: ownParticipationError } =
      await supabase
        .from("ticket_participations")
        .select("ticket_instance_id,user_id,ticket_snapshot")
        .eq("user_id", user.id)
        .in("status", Array.from(CHAT_MEMBER_STATUSES))
        .returns<ParticipationRow[]>();
    if (ownParticipationError) throw ownParticipationError;

    const ownInstanceIds = unique(
      (ownParticipationData ?? []).map((row) => row.ticket_instance_id),
    );
    if (ownInstanceIds.length === 0) {
      return NextResponse.json<MeetingChatRoomsResponse>({ rooms: [] });
    }

    const [ownInstancesResult, profileResult, authResult] = await Promise.all([
      supabase
        .from("ticket_instances")
        .select("id,title,event_date,event_time,region,place_name,visibility")
        .in("id", ownInstanceIds)
        .returns<InstanceRow[]>(),
      supabase
        .from("profiles")
        .select("is_test_participant")
        .eq("user_id", user.id)
        .maybeSingle<{ is_test_participant: boolean | null }>(),
      supabase.auth.admin.getUserById(user.id),
    ]);
    if (ownInstancesResult.error) throw ownInstancesResult.error;
    if (profileResult.error) throw profileResult.error;
    if (authResult.error) throw authResult.error;

    const ownInstanceMap = new Map(
      (ownInstancesResult.data ?? []).map((instance) => [instance.id, instance]),
    );
    const previewAllowed =
      profileResult.data?.is_test_participant === true &&
      authResult.data.user?.user_metadata?.operator_switch_enabled === true;
    const previewLinks = previewAllowed
      ? (ownParticipationData ?? [])
          .map((participation) => {
            const ownInstance = ownInstanceMap.get(
              participation.ticket_instance_id,
            );
            const sourceId =
              ownInstance?.visibility === "test_only"
                ? participation.ticket_snapshot?.previewSourceInstanceId?.trim()
                : null;
            return sourceId
              ? { carrierId: participation.ticket_instance_id, sourceId }
              : null;
          })
          .filter(
            (
              link,
            ): link is {
              carrierId: string;
              sourceId: string;
            } => link !== null,
          )
      : [];
    const previewSourceIds = unique(previewLinks.map((link) => link.sourceId));
    const previewCarrierIds = new Set(
      previewLinks.map((link) => link.carrierId),
    );
    const instanceIds = unique([
      ...ownInstanceIds.filter((id) => !previewCarrierIds.has(id)),
      ...previewSourceIds,
    ]);
    const readOnlyRoomIds = new Set(previewSourceIds);

    const [instancesResult, participationsResult] = await Promise.all([
      supabase
        .from("ticket_instances")
        .select("id,title,event_date,event_time,region,place_name,visibility")
        .in("id", instanceIds)
        .returns<InstanceRow[]>(),
      supabase
        .from("ticket_participations")
        .select("ticket_instance_id,user_id,ticket_snapshot")
        .in("ticket_instance_id", instanceIds)
        .in("status", Array.from(CHAT_MEMBER_STATUSES))
        .returns<ParticipationRow[]>(),
    ]);

    const error = instancesResult.error ?? participationsResult.error;
    if (error) throw error;

    const activeParticipations = participationsResult.data ?? [];
    const activeProfileIds = unique(
      activeParticipations.map((participation) => participation.user_id),
    );

    let profiles: ProfileRow[] = [];
    if (activeProfileIds.length > 0) {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id,name,nickname,public_emoji")
        .in("user_id", activeProfileIds)
        .returns<ProfileRow[]>();
      if (profilesError) throw profilesError;
      profiles = data ?? [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.user_id, profile]),
    );
    const memberIdsByInstance = activeParticipations.reduce(
      (map, participation) => {
        const current = map.get(participation.ticket_instance_id) ?? [];
        current.push(participation.user_id);
        map.set(participation.ticket_instance_id, current);
        return map;
      },
      new Map<string, string[]>(),
    );
    const now = new Date();

    const rooms = (instancesResult.data ?? [])
      .map((instance): MeetingChatRoom | null => {
        const startAt = eventStartAt(instance);
        if (!startAt) return null;

        const opensAt = addHours(startAt, -3);
        const feedbackOpensAt = addHours(startAt, 3);
        const closesAt = addHours(feedbackOpensAt, 24);
        const memberIds = unique(memberIdsByInstance.get(instance.id) ?? []);
        const readOnly = readOnlyRoomIds.has(instance.id);
        if (
          now < opensAt ||
          now >= closesAt ||
          (!readOnly && !memberIds.includes(user.id))
        ) {
          return null;
        }

        const members: MeetingChatMember[] = memberIds.map((memberId) => {
          const profile = profileMap.get(memberId);
          return {
            id: memberId,
            nickname:
              profile?.nickname?.trim() || fallbackNickname(profile?.name),
            emoji: profile?.public_emoji?.trim() || profileEmoji(memberId),
            isSelf: memberId === user.id,
            role: "member",
          };
        });
        const operatorMember = chatOperatorMember(false);
        if (operatorMember) members.push(operatorMember);

        return {
          id: instance.id,
          title: instance.title,
          eventDate: instance.event_date!,
          eventTime: instance.event_time!.slice(0, 5),
          area: instance.region,
          placeName: instance.place_name,
          opensAt: opensAt.toISOString(),
          feedbackOpensAt: feedbackOpensAt.toISOString(),
          closesAt: closesAt.toISOString(),
          members,
          readOnly,
        };
      })
      .filter((room): room is MeetingChatRoom => Boolean(room))
      .sort((left, right) => left.closesAt.localeCompare(right.closesAt));

    const roomIds = rooms.map((room) => room.id);
    const [messagesResult, readsResult] = roomIds.length
      ? await Promise.all([
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
            .in("ticket_instance_id", roomIds)
            .returns<MeetingChatRead[]>(),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const chatDataError = messagesResult.error ?? readsResult.error;
    if (chatDataError) throw chatDataError;

    return NextResponse.json<MeetingChatRoomsResponse>(
      {
        rooms,
        messages: messagesResult.data ?? [],
        reads: readsResult.data ?? [],
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("[meeting chat rooms]", error);
    return NextResponse.json(
      { error: "채팅방을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
