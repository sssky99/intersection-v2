import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  MeetingChatMember,
  MeetingChatRoom,
  MeetingChatRoomsResponse,
} from "@/types/chat";

export const dynamic = "force-dynamic";

type AssignmentRow = {
  ticket_instance_id: string;
  profile_id: string;
};

type InstanceRow = {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  region: string | null;
  place_name: string | null;
};

type WaitlistRow = {
  user_id: string;
  ticket_id: string;
  ticket_instance_id: string | null;
  status: string;
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

function waitlistInstanceId(row: WaitlistRow) {
  return row.ticket_instance_id ?? row.ticket_id;
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
    const { data: ownAssignmentData, error: ownAssignmentError } =
      await supabase
        .from("ticket_assignments")
        .select("ticket_instance_id,profile_id")
        .eq("profile_id", user.id)
        .returns<AssignmentRow[]>();
    if (ownAssignmentError) throw ownAssignmentError;

    const instanceIds = unique(
      (ownAssignmentData ?? []).map((row) => row.ticket_instance_id),
    );
    if (instanceIds.length === 0) {
      return NextResponse.json<MeetingChatRoomsResponse>({ rooms: [] });
    }

    const [instancesResult, assignmentsResult, waitlistResult] =
      await Promise.all([
        supabase
          .from("ticket_instances")
          .select("id,title,event_date,event_time,region,place_name")
          .in("id", instanceIds)
          .returns<InstanceRow[]>(),
        supabase
          .from("ticket_assignments")
          .select("ticket_instance_id,profile_id")
          .in("ticket_instance_id", instanceIds)
          .returns<AssignmentRow[]>(),
        supabase
          .from("meeting_waitlist")
          .select("user_id,ticket_id,ticket_instance_id,status")
          .or(
            `ticket_instance_id.in.(${instanceIds.join(",")}),ticket_id.in.(${instanceIds.join(",")})`,
          )
          .returns<WaitlistRow[]>(),
      ]);

    const error =
      instancesResult.error ??
      assignmentsResult.error ??
      waitlistResult.error;
    if (error) throw error;

    const assignments = assignmentsResult.data ?? [];
    const waitlistRows = waitlistResult.data ?? [];
    const activeWaitlistKeys = new Set(
      waitlistRows
        .filter((row) => CHAT_MEMBER_STATUSES.has(row.status))
        .map((row) => `${waitlistInstanceId(row)}:${row.user_id}`),
    );
    const activeAssignments = assignments.filter((assignment) =>
      activeWaitlistKeys.has(
        `${assignment.ticket_instance_id}:${assignment.profile_id}`,
      ),
    );
    const activeProfileIds = unique(
      activeAssignments.map((assignment) => assignment.profile_id),
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
    const memberIdsByInstance = activeAssignments.reduce((map, assignment) => {
      const current = map.get(assignment.ticket_instance_id) ?? [];
      current.push(assignment.profile_id);
      map.set(assignment.ticket_instance_id, current);
      return map;
    }, new Map<string, string[]>());
    const now = new Date();

    const rooms = (instancesResult.data ?? [])
      .map((instance): MeetingChatRoom | null => {
        const startAt = eventStartAt(instance);
        if (!startAt) return null;

        const opensAt = addHours(startAt, -3);
        const feedbackOpensAt = addHours(startAt, 3);
        const closesAt = addHours(feedbackOpensAt, 24);
        const memberIds = unique(memberIdsByInstance.get(instance.id) ?? []);
        if (
          now < opensAt ||
          now >= closesAt ||
          !memberIds.includes(user.id)
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
          };
        });

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
        };
      })
      .filter((room): room is MeetingChatRoom => Boolean(room))
      .sort((left, right) => left.closesAt.localeCompare(right.closesAt));

    return NextResponse.json<MeetingChatRoomsResponse>(
      { rooms },
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
