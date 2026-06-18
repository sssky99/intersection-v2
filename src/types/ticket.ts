export type GatheringTicket = {
  id: string;
  templateId: string;
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
  detailSummary?: string;
  detailActivities?: string[];
  detailGoodFor?: string[];
  detailNotice?: string;
  vibeScores?: {
    temperature?: number | null;
    texture?: number | null;
    tone?: number | null;
    rhythm?: number | null;
    alcohol?: number | null;
    romance?: number | null;
  };
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
