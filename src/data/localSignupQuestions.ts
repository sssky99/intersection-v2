import type { ProfileQuestion } from "@/types/question";

export const signupQuestionnaireVersion = "preferences-v17";

function question(number: number, title: string, fields: Partial<ProfileQuestion> = {}): ProfileQuestion {
  return { id: 2000 + number, category: "자기정보", question: title, type: "text", ...fields };
}

function scale(number: number, title: string, count: number, low = "전혀 그렇지 않다", high = "매우 그렇다") {
  return question(number, title, {
    type: "single_choice", options: Array.from({ length: count }, (_, i) => String(i + 1)),
    scaleMinLabel: low, scaleMaxLabel: high,
  });
}

// Keep the reference numbering; its three location questions (24–26) are omitted.
export const localSignupQuestions = [
  question(1, "이름을 입력해 주세요.", { inputKind: "name", placeholder: "이름" }),
  scale(2, "나는 조용하고 말을 아끼는 편이다.", 5),
  scale(3, "나는 다른 사람을 잘 믿는 편이다.", 5),
  scale(4, "나는 여유로운 편이고 스트레스에 잘 대처한다.", 5),
  scale(5, "나는 외향적이고 사교적인 편이다.", 5),
  scale(6, "나는 다른 사람의 단점을 잘 찾아내는 편이다.", 5),
  scale(7, "나는 상상력이 풍부한 편이다.", 5),
  scale(8, "모험을 위해 위험을 감수하는 건 내 삶의 중요한 부분이다.", 7),
  scale(9, "나는 친구와 불편한 이야기도 기꺼이 나눈다.", 7),
  scale(10, "명품 브랜드 옷을 입는 것을 중요하게 생각한다.", 7),
  scale(11, "나는 대체로 규칙을 따른다.", 7),
  scale(12, "나는 정치적 올바름(PC)에\n구애받지 않는 유머를 즐긴다", 7),
  scale(13, "사람은 태어날 때부터 삶의 목적을 타고난다.", 7),
  scale(14, "변화는 얼마나 중요한가요?", 4, "전혀 중요하지 않다", "매우 중요하다"),
  scale(15, "편안함은 얼마나 중요한가요?", 4, "전혀 중요하지 않다", "매우 중요하다"),
  scale(16, "남들의 기준에 얽매이지 않는 것은 얼마나 중요한가요?", 4, "전혀 중요하지 않다", "매우 중요하다"),
  scale(17, "얼마나 외향적인 편인가요?", 7, "내향적", "외향적"),
  scale(18, "여럿이 모인 자리에서 얼마나 자주 말하는 편인가요?", 7, "듣기만 한다", "주로 내가 말한다"),
  question(19, "좋아하는 영화는 무엇인가요?", { type: "multi_choice", inputKind: "searchable_choices", maxSelections: 5, description: "최대 5개까지 골라주세요.", placeholder: "영화 제목 검색 또는 직접 입력", options: ["인터스텔라", "리틀 포레스트", "라라랜드", "기생충", "어바웃 타임", "타짜", "주토피아", "부산행", "어벤져스: 엔드게임", "왕과 사는 남자"] }),
  question(20, "좋아하는 뮤지션은 누구인가요?", { type: "multi_choice", inputKind: "searchable_choices", maxSelections: 5, description: "최대 5명까지 골라주세요.", placeholder: "뮤지션 검색 또는 직접 입력", options: ["한로로", "최유리", "우즈(WOODZ)", "아이유", "잔나비", "백예린", "혁오", "콜드플레이", "데이식스", "블랙핑크", "지드래곤", "아이브", "이무진"] }),
  question(21, "현재 어떤 일을 하고 있나요?", { type: "multi_choice", inputKind: "searchable_choices", optional: true, description: "직무를 여러 개 입력할 수 있어요. 학생이거나 현재 일하지 않는다면 건너뛰어도 돼요.", placeholder: "직무 검색 또는 직접 입력", options: ["기획자", "디자이너", "개발자", "마케터", "연구원", "경영지원 담당자", "영업 담당자", "매장 판매원", "간호사", "교사"] }),
  question(22, "어느 쪽이 더 좋나요?", { type: "single_choice", options: ["클럽 가기", "낮에 피크닉하기"] }),
  question(23, "어떤 종류의 모임이나 활동에 초대받고 싶나요?", { type: "multi_choice", options: ["디너", "칵테일바", "산책", "색깔수집", "런치", "퇴근 게더링"] }),
  question(27, "현재 연애·결혼 상태는 어떤가요?", { type: "single_choice", options: ["싱글", "복잡함(애매한 관계)", "연애 중", "기혼"] }),
  question(29, "생년월일을 입력해 주세요.", { inputKind: "birthday" }),
  question(30, "성별은 무엇인가요?", { type: "single_choice", options: ["남자", "여자"] }),
];
