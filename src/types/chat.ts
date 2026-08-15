export type MeetingChatMember = {
  id: string;
  participationId?: string;
  name?: string | null;
  nickname: string;
  avatarText: string;
  photoUrl?: string | null;
  isSelf: boolean;
  role: "member" | "operator";
  arrivalStatus?: import("@/types/ticket").TicketArrivalStatus | null;
  arrivalStatusUpdatedAt?: string | null;
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
  readOnly?: boolean;
};

export type MeetingChatRoomsResponse = {
  rooms: MeetingChatRoom[];
  messages?: MeetingChatMessage[];
  reads?: MeetingChatRead[];
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
