// Reviewed wording: docs/cs-response-guide-2026-09-08.md.
// Deliberately answers only explicit FAQ selections; no customer lookup or mutations.
const answers = [
  {
    label: "구독 해지 방법",
    questions: ["구독 해지 방법", "구독 해지는 어디서 해요", "자동결제 해지 방법"],
    answer: "안녕하세요, 교집합입니다.\n카카오톡으로 받으신 그로블 결제 알림의 ‘구매 내역 확인하기’를 확인해주세요.\n\n이번 결제 환불과 다음 자동결제 해지는 별도로 확인이 필요합니다.",
  },
  {
    label: "취소와 환불 차이",
    questions: ["취소와 환불 차이", "모임 취소하면 자동 환불되나요"],
    answer: "모임 신청 취소와 결제 환불은 별도로 확인이 필요합니다.\n신청만 취소하시는지, 결제 환불도 원하시는지 운영진 상담에서 말씀해주세요. 실제 내역을 확인한 뒤 처리 여부를 안내드립니다.",
  },
  {
    label: "탈퇴와 자동결제",
    questions: ["탈퇴와 자동결제", "탈퇴하면 자동결제도 해지되나요"],
    answer: "교집합 회원 탈퇴와 그로블 자동결제 해지는 별도입니다.\n카카오톡으로 받으신 그로블 결제 알림의 ‘구매 내역 확인하기’에서 구독 해지 상태도 확인해주세요.",
  },
];

function normalize(value: string) {
  return value.normalize("NFKC").replace(/[\s?？.!！]+/gu, "").toLowerCase();
}

export function kakaoCsResponse(utterance: string) {
  const query = normalize(utterance);
  const answer = answers.find((item) => item.questions.some((question) => normalize(question) === query));
  const greeting = ["", "안녕", "안녕하세요", "도움말", "메뉴", "시작"].includes(query);
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: answer?.answer ?? (greeting
        ? "안녕하세요, 교집합 자동 안내입니다.\n아래에서 궁금한 내용을 선택해주세요.\n개인 신청 확인이나 취소·환불 처리는 운영진 상담이 필요합니다."
        : "자동 안내로 확인하기 어려운 문의예요.\n개인 신청 확인이나 취소·환불 처리는 운영진 상담이 필요합니다.\n이 답변만으로 요청이 접수되거나 처리되지는 않습니다.") } }],
      quickReplies: answers.map(({ label }) => ({ label, action: "message", messageText: label })),
    },
  };
}
