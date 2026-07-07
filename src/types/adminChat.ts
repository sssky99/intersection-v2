import type {
  MeetingChatMessage,
  MeetingChatRead,
  MeetingChatRoom,
} from "@/types/chat";

export type AdminChatRoomStatus = "active" | "upcoming";

export type AdminChatRoom = MeetingChatRoom & {
  status: AdminChatRoomStatus;
  participantCount: number;
  messageCount: number;
  lastMessage: MeetingChatMessage | null;
};

export type AdminChatRoomsResponse = {
  activeRooms: AdminChatRoom[];
  upcomingRooms: AdminChatRoom[];
  operatorConfigured: boolean;
};

export type AdminChatMessagesResponse = {
  room: AdminChatRoom;
  messages: MeetingChatMessage[];
  reads: MeetingChatRead[];
  operatorConfigured: boolean;
};
