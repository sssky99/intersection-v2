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

const movieSuggestions = [
  "인터스텔라", "리틀 포레스트", "라라랜드", "기생충",
  "어바웃 타임", "타짜", "주토피아", "부산행",
  "어벤져스: 엔드게임", "왕과 사는 남자", "극한직업", "괴물",
  "살인의 추억", "헤어질 결심", "올드보이", "아가씨",
  "밀양", "버닝", "곡성", "마더",
  "도둑들", "암살", "베테랑", "신세계",
  "범죄도시", "서울의 봄", "파묘", "광해, 왕이 된 남자",
  "왕의 남자", "관상", "건축학개론", "클래식",
  "너의 결혼식", "써니", "벌새", "윤희에게",
  "남매의 여름밤", "8월의 크리스마스", "인셉션", "다크 나이트",
  "듄", "매드맥스: 분노의 도로", "그래비티", "마션",
  "트루먼 쇼", "월터의 상상은 현실이 된다", "이터널 선샤인", "비포 선라이즈",
  "노팅 힐", "노트북", "악마는 프라다를 입는다", "그랜드 부다페스트 호텔",
  "위플래쉬", "비긴 어게인", "보헤미안 랩소디", "코코",
  "소울", "인사이드 아웃", "센과 치히로의 행방불명", "너의 이름은.",
];

const musicianSuggestions = [
  "한로로", "최유리", "우즈(WOODZ)", "아이유",
  "잔나비", "백예린", "혁오", "콜드플레이",
  "데이식스", "블랙핑크", "지드래곤", "아이브",
  "이무진", "태연", "성시경", "폴킴",
  "악뮤(AKMU)", "볼빨간사춘기", "윤하", "이하이",
  "헤이즈", "크러쉬", "자이언티", "딘(DEAN)",
  "태양", "박효신", "김동률", "이적",
  "김광석", "10CM", "검정치마", "새소년",
  "실리카겔", "카더가든", "치즈(CHEEZE)", "선우정아",
  "적재", "장범준", "루시(LUCY)", "엔플라잉",
  "넬(NELL)", "에픽하이", "다이나믹 듀오", "빈지노",
  "이센스", "방탄소년단", "세븐틴", "에스파",
  "트와이스", "레드벨벳", "르세라핌", "엔믹스",
  "투모로우바이투게더", "테일러 스위프트", "브루노 마스", "빌리 아일리시",
  "위켄드", "아델", "에드 시런", "올리비아 로드리고",
  "오아시스", "라디오헤드", "요네즈 켄시",
];

const jobSuggestions = [
  "기획자", "디자이너", "개발자", "마케터",
  "연구원", "경영지원 담당자", "영업 담당자", "매장 판매원",
  "간호사", "교사", "인사 담당자", "회계 담당자",
  "구매 담당자", "홍보 담당자", "상품기획자(MD)", "고객상담사",
  "데이터 분석가", "정보보안 전문가", "시스템 엔지니어", "프로덕트 매니저(PM)",
  "UX 리서처", "의사", "약사", "물리치료사",
  "임상병리사", "치과위생사", "심리상담사", "사회복지사",
  "요양보호사", "보육교사", "학원 강사", "교수",
  "사서", "공무원", "경찰관", "소방관",
  "은행원", "보험설계사", "회계사", "세무사",
  "변호사", "공인중개사", "건축가", "토목 엔지니어",
  "전기기사", "생산직 근로자", "품질관리 담당자", "자동차 정비사",
  "물류 담당자", "운전기사", "요리사", "바리스타",
  "제과제빵사", "미용사", "호텔리어", "운동 지도자",
  "영상 편집자", "사진작가", "방송 PD", "작가",
  "공연기획자", "농업인",
];

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
  question(19, "좋아하는 영화는 무엇인가요?", { type: "multi_choice", inputKind: "searchable_choices", maxSelections: 5, description: "최대 5개까지 골라주세요.", placeholder: "영화 제목 검색 또는 직접 입력", options: movieSuggestions }),
  question(20, "좋아하는 뮤지션은 누구인가요?", { type: "multi_choice", inputKind: "searchable_choices", maxSelections: 5, description: "최대 5명까지 골라주세요.", placeholder: "뮤지션 검색 또는 직접 입력", options: musicianSuggestions }),
  question(21, "현재 어떤 일을 하고 있나요?", { type: "multi_choice", inputKind: "searchable_choices", optional: true, description: "직무를 여러 개 입력할 수 있어요. 학생이거나 현재 일하지 않는다면 건너뛰어도 돼요.", placeholder: "직무 검색 또는 직접 입력", options: jobSuggestions }),
  question(22, "어느 쪽이 더 좋나요?", { type: "single_choice", options: ["클럽 가기", "낮에 피크닉하기"] }),
  question(23, "어떤 종류의 모임이나 활동에 초대받고 싶나요?", {
    type: "multi_choice", inputKind: "activity_choices",
    options: ["디너", "칵테일바", "볼링", "보드게임", "원데이 클래스", "맛집 탐방", "액티비티", "색깔수집", "퇴근 게더링"],
    legacyOptions: ["산책", "런치"],
  }),
  question(27, "현재 연애·결혼 상태는 어떤가요?", { type: "single_choice", options: ["싱글", "복잡함(애매한 관계)", "연애 중", "기혼"] }),
  question(29, "생년월일을 입력해 주세요.", { inputKind: "birthday" }),
  question(30, "성별은 무엇인가요?", { type: "single_choice", options: ["남자", "여자"] }),
];
