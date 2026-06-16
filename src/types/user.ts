export type Gender = "여성" | "남성" | "비공개" | "";

export type UserProfile = {
  id: string;
  name: string;
  phone: string;
  nickname: string;
  gender: Gender;
  birthYear: string;
  mbti: string;
  photoLabel: string;
  photoUrl: string;
  isExistingUser: boolean;
};
