export type MeetingChatMember = {
  id: string;
  nickname: string;
  emoji: string;
  isSelf: boolean;
  role: "member" | "operator";
};

export type MeetingChatRoom = {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string;
  area: string | null;
  placeName: string | null;
  opensAt: string;
  feedbackOpensAt: string;
  closesAt: string;
  members: MeetingChatMember[];
};

export type MeetingChatRoomsResponse = {
  rooms: MeetingChatRoom[];
};

export type MeetingChatMessage = {
  id: string;
  ticket_instance_id: string;
  sender_id: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
};

export type MeetingChatRead = {
  ticket_instance_id: string;
  user_id: string;
  last_read_at: string;
};
