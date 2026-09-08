type FriendInvitationMessageInput = {
  recipientName?: string | null;
  inviterName: string;
  eventDate: string;
  eventTime: string;
  eventTitle: string;
  invitationUrl: string;
};

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

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
