type FriendInvitationMessageInput = {
  recipientName?: string | null;
  inviterName: string;
  eventDate: string;
  eventTime: string;
  eventTitle: string;
  invitationUrl: string;
};

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export function friendGivenName(value: string) {
  const name = oneLine(value);
  if (!/^[가-힣]{3,4}$/.test(name)) return name;
  return name.slice(/^(남궁|황보|제갈|선우|독고|서문|사공|동방)/.test(name) ? 2 : 1);
}

export function buildBoardInvitationMessage(input: FriendInvitationMessageInput) {
  const recipient = friendGivenName(input.recipientName ?? "친구");
  const inviter = friendGivenName(input.inviterName);
  return `[교집합 | 함께하기 초대]\n\n${recipient}님, ${inviter}님이 지난 교집합에서 ${recipient}님과 즐거운 시간을 보냈어서 다음 교집합도 함께하고 싶어 해요!\n\n수락하면 두 분이서 같은 조로 다음 교집합에 참여하실 수 있어요 :)\n\n${input.eventDate} · ${input.eventTime.slice(0,5)}\n${oneLine(input.eventTitle)}\n\n웹사이트에서 초대를 확인하고 모임을 신청해주세요.\n초대는 모임 시작 24시간 전에 마감돼요.\n\n${input.invitationUrl}`;
}

export function friendInvitationDeadline(eventDate: string, eventTime: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(eventTime)) {
    throw new Error("invalid-invitation-schedule");
  }
  const start = new Date(`${eventDate}T${eventTime.slice(0, 5)}:00+09:00`);
  if (!Number.isFinite(start.getTime())) throw new Error("invalid-invitation-schedule");
  return new Date(start.getTime() - 24 * 60 * 60 * 1000);
}

export function buildFriendInvitationMessage(input: FriendInvitationMessageInput) {
  const deadline = friendInvitationDeadline(input.eventDate, input.eventTime);
  const koreanDeadline = new Date(deadline.getTime() + 9 * 60 * 60 * 1000);
  const hour = koreanDeadline.getUTCHours();
  const minutes = koreanDeadline.getUTCMinutes();
  const deadlineLabel = `${koreanDeadline.getUTCMonth() + 1}/${koreanDeadline.getUTCDate()}일 ${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}시${minutes ? ` ${minutes}분` : ""}`;
  const [, month, day] = input.eventDate.split("-");
  const recipient = oneLine(input.recipientName ?? "");
  const inviter = oneLine(input.inviterName);
  const title = oneLine(input.eventTitle);
  if (!inviter || !title) throw new Error("invalid-invitation-copy");
  return `[교집합 초대장 도착]

안녕하세요${recipient ? ` ${recipient}님` : ""}, 친구 분이신 ${inviter}님의 초대가 도착했어요.

${Number(month)}/${Number(day)} [${title}]에 함께하여 ${inviter}님과 색다른 하루를 맞이할 수 있어요!

초대는 ${deadlineLabel}에 마감됩니다.

${input.invitationUrl}

위 링크를 눌러 초대를 수락하고 ${inviter}님과 함께 새로운 사람들을 만나보세요!`;
}
