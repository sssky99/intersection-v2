export type NaverPlaceSource = "naver";

export type NaverPlace = {
  source: NaverPlaceSource;
  name: string;
  category: string | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  mapx: number;
  mapy: number;
  link: string | null;
};

export type MeetingPlace = NaverPlace;
