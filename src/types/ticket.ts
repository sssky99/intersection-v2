export type GatheringTicket = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  area: string;
  moodTags: string[];
  imageUrl?: string;
  remainingSeatCount?: number;
  peopleHint: string;
  reason: string;
};

export type AvailableDate = {
  id: string;
  date: string;
  label: string;
  tickets: GatheringTicket[];
};

export type WaitlistRegistration = {
  ticket: GatheringTicket;
  status: "waitlisted";
};
