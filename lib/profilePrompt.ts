import { profileQuestions } from "@/data/profileQuestions";
import { parseTicketRatingAnswer } from "@/features/onboarding/ticketRating";
import { isCorruptText } from "@/lib/textQuality";
import type { ProfileRow } from "@/types/profile";
import type { QuestionOption } from "@/types/question";

export type PromptAnswerRow = {
  question_order: number;
  answer_value: string | null;
  answer_values: string[] | null;
  answer_text: string | null;
  other_text: string | null;
};

function getOptionLabel(
  questionOrder: number,
  value: string,
): string | undefined {
  const question = profileQuestions.find(
    (item) => (item.order ?? item.id) === questionOrder,
  );
  const option = question?.options?.find((item) =>
    typeof item === "string" ? item === value : item.value === value,
  );

  return typeof option === "string"
    ? option
    : (option as QuestionOption | undefined)?.label;
}

function getAnswerText(
  answers: PromptAnswerRow[],
  questionOrder: number,
) {
  const row = answers.find(
    (answer) => answer.question_order === questionOrder,
  );
  if (!row) return "";

  const ticketRating = parseTicketRatingAnswer(row.answer_text);
  if (ticketRating) {
    return `${ticketRating.title.replace(/\n/g, " ")} · ${ticketRating.rating}점`;
  }

  const values = row.answer_values
    ? row.answer_values.map(
        (value) => getOptionLabel(questionOrder, value) ?? value,
      )
    : row.answer_value
      ? [getOptionLabel(questionOrder, row.answer_value) ?? row.answer_value]
      : [];

  return (
    row.answer_text?.trim() ||
    values.join(", ") ||
    row.other_text?.trim() ||
    ""
  );
}

function cleanSentence(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^저는\s*/, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function withObjectParticle(value: string) {
  const last = value.charCodeAt(value.length - 1);
  const hasBatchim =
    last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${value}${hasBatchim ? "을" : "를"}`;
}

function extractWorkDescription(answer: string) {
  const compact = answer
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\s*년(?:째|차|간|동안)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const roleMatch = compact.match(
    /([가-힣A-Za-z·]{2,20})(?:으)?로\s+(?:일|근무|활동|공부)/,
  );
  if (roleMatch) {
    return `${roleMatch[1]}로 일하며, 맡은 역할 안에서 의미를 찾고 있어요.`;
  }

  const roleAsMatch = compact.match(
    /([가-힣A-Za-z·]{2,20})(?:으)?로서/,
  );
  if (roleAsMatch) {
    return `${roleAsMatch[1]}로 일하며, 맡은 역할을 책임감 있게 이어가고 있어요.`;
  }

  const fieldMatch = compact.match(
    /([가-힣A-Za-z·]{2,20})\s*분야(?:에서|를|의)?/,
  );
  if (fieldMatch) {
    return `${fieldMatch[1]} 분야에서 일하며, 자신만의 경험을 쌓아가고 있어요.`;
  }

  const workMatch = compact.match(
    /([가-힣A-Za-z·\s]{2,24}(?:일|업무|공부|작업))(?:을|를)?\s*(?:하고|하며|배우며|이어가며)/,
  );
  if (workMatch) {
    return `${withObjectParticle(cleanSentence(workMatch[1]))} 하면서, 맡은 하루를 책임감 있게 보내고 있어요.`;
  }

  return "자신이 맡은 일과 배움의 분야에서 경험을 쌓으며 하루를 보내고 있어요.";
}

function buildConversationParagraph(answers: PromptAnswerRow[]) {
  const preferredOrders = [1, 2, 3, 4, 6, 5, 9, 10, 11];
  const details = preferredOrders
    .map((order) => cleanSentence(getAnswerText(answers, order)))
    .filter(Boolean)
    .slice(0, 2);

  if (details.length === 0) {
    return "대화에서는 상대의 이야기를 차분히 듣고, 서로의 속도를 존중하며 자연스럽게 공통점을 찾아가는 편이에요.";
  }

  return `대화에서는 ${details.join(". 또한 ")}. 서로의 이야기를 편안하게 나눌 수 있는 분위기를 중요하게 여겨요.`;
}

function buildInterestParagraph(answers: PromptAnswerRow[]) {
  const selfIntro = cleanSentence(getAnswerText(answers, 16));
  const recentThought = cleanSentence(getAnswerText(answers, 16)).replace(
    /^요즘은\s*/,
    "",
  );
  const labels = answers
    .filter((answer) => answer.question_order >= 10 && answer.question_order <= 15)
    .map((answer) => parseTicketRatingAnswer(answer.answer_text))
    .filter((answer): answer is NonNullable<typeof answer> => Boolean(answer))
    .filter((answer) => Number(answer.rating) >= 4)
    .map((answer) => answer.title.replace(/\n/g, " "))
    .slice(0, 3);

  if (selfIntro && labels.length > 0) {
    return `${selfIntro}. ${labels.join(", ")} 같은 자리에도 마음이 가는 편이에요.`;
  }

  if (recentThought && labels.length > 0) {
    return `요즘은 ${recentThought}. ${labels.join(", ")}에도 관심이 많고, 좋아하는 것을 편안하게 나누는 시간을 좋아해요.`;
  }

  if (recentThought) {
    return `요즘은 ${recentThought}. 관심이 가는 주제를 천천히 알아가고, 그 이야기를 다른 사람과 나누는 시간을 좋아해요.`;
  }

  if (labels.length > 0) {
    return `요즘은 ${labels.join(", ")}에 관심이 많아요. 좋아하는 것을 함께 이야기하며 새로운 취향을 발견하는 시간을 좋아해요.`;
  }

  return "요즘은 일상에서 새롭게 마음이 가는 것을 천천히 발견하고 있어요. 부담 없는 자리에서 서로의 관심사를 나누는 시간을 좋아해요.";
}

export function publicDisplayName(name: string | null) {
  const compact = name?.replace(/\s/g, "") ?? "";
  if (compact.length >= 3) return compact.slice(1, 3);
  return compact.slice(0, 2) || "회원";
}

export function buildProfileInput(
  profile: ProfileRow,
  answers: PromptAnswerRow[],
) {
  const ticketRatings = answers
    .filter((answer) => answer.question_order >= 10 && answer.question_order <= 15)
    .map((answer) => parseTicketRatingAnswer(answer.answer_text))
    .filter((answer): answer is NonNullable<typeof answer> => Boolean(answer));
  const resolvedAnswers = answers
    .filter((answer) => answer.question_order <= 16)
    .map((answer) => {
      const question = profileQuestions.find(
        (item) => (item.order ?? item.id) === answer.question_order,
      );
      const values = answer.answer_values
        ? answer.answer_values.map(
            (value) => getOptionLabel(answer.question_order, value) ?? value,
          )
        : answer.answer_value
          ? [
              getOptionLabel(answer.question_order, answer.answer_value) ??
                answer.answer_value,
            ]
          : [];

      return {
        order: answer.question_order,
        question: question?.question ?? "",
        answer:
          (answer.question_order >= 10 && answer.question_order <= 15
            ? getAnswerText(answers, answer.question_order)
            : answer.answer_text?.trim()) ||
          values.join(", ") ||
          answer.other_text?.trim() ||
          "",
        otherText: answer.other_text?.trim() || undefined,
      };
    });

  return {
    name: profile.name ?? "",
    publicDisplayName: publicDisplayName(profile.name),
    gender: profile.gender ?? "",
    birthYear:
      profile.birth_year == null ? "" : String(profile.birth_year),
    mbti: profile.mbti ?? "",
    workAnswer: null,
    conversationAnswers: resolvedAnswers.filter(
      (answer) => answer.order >= 1 && answer.order <= 9,
    ),
    recentInterestAnswers: resolvedAnswers.filter((answer) => answer.order === 16),
    ticketPreferences: {
      yes: ticketRatings
        .filter((result) => Number(result.rating) >= 4)
        .map((result) => result.title),
      no: ticketRatings
        .filter((result) => Number(result.rating) <= 2)
        .map((result) => result.title),
    },
  };
}

export const profileInstructions = `
다른 모임 참가자들이 읽을 공개 프로필을 한국어로 작성한다.

공개 프로필은 반드시 빈 줄로 구분된 정확히 3문단으로 작성한다.

1문단은 반드시 입력에 있는 publicDisplayName 값 뒤에 "님은"을 붙여 시작한다.
사용자가 직접 적은 자기소개와 기본정보를 바탕으로 이 사람의 전반적인 분위기를 자연스럽게 설명한다.
직업 또는 일하는 분야가 답변에 명확히 있을 때만 자연스럽게 언급한다.

2문단은 질문 1~9번 답변을 참고해 대화 스타일과 모임에서 편안함을 느끼는 조건을 설명한다.
사용자의 답변에 맞게 표현을 달리하며 예시 문장을 고정 템플릿처럼 반복하지 않는다.

3문단은 질문 10~15번의 티켓 1~5단계 반응과 질문 16번 자기소개를 참고해 좋아할 만한 자리와 관심사를 설명한다.
티켓 반응을 직접 점수처럼 나열하지 말고 자연스러운 취향으로 풀어쓴다.

사용자의 전체 실명 대신 publicDisplayName만 사용할 수 있다.

회사명, 근무지, 부서명, 정확한 경력 연차, 특정 가능한 사건이나 업무,
전화번호, 불필요한 신상 정보는 절대 포함하지 않는다.
답변에 없는 내용을 만들거나 사용자를 진단하지 않는다.

친구가 다른 사람에게 소개하듯 부드럽고 따뜻하게 쓴다.
"~예요", "~하고 있어요", "~하는 편이에요", "~에 관심이 많아요",
"~을 좋아해요", "~을 중요하게 여겨요" 같은 말투를 쓴다.
"~입니다", "~합니다", "~처럼 보여요", "~인 것 같아요", "분석 결과",
"~일 가능성이 있어요", "~이 느껴져요", "~해 보여요", "~와 어울려요",
"유형", "진단", "성향상"이라는 표현은 쓰지 않는다.
부정적인 답변도 과장 없이 긍정적이고 자연스럽게 표현하고,
연애나 이성 목적을 과하게 강조하지 않는다.

공백 포함 300~450자, 3문단으로 작성한다.
프로필 본문만 출력하고 제목, 목록, 따옴표, 설명은 붙이지 않는다.
`.trim();

export function isValidGeneratedIntro(
  intro: string,
  profile: ProfileRow,
) {
  const paragraphs = intro
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const forbidden =
    /입니다|합니다|보여요|인 것 같아요|일 가능성이 있어요|느껴져요|어울려요|분석 결과|성향상/;
  const conversationLanguage = /대화|이야기|말|소통/;
  const interestLanguage = /요즘|최근|관심|취미|즐겨|좋아/;

  return (
    !isCorruptText(intro) &&
    paragraphs.length === 3 &&
    paragraphs[0].startsWith(`${publicDisplayName(profile.name)}님은`) &&
    conversationLanguage.test(paragraphs[1]) &&
    interestLanguage.test(paragraphs[2]) &&
    !forbidden.test(intro)
  );
}

export function buildFallbackIntro(
  profile: ProfileRow,
  answers: PromptAnswerRow[],
) {
  const name = publicDisplayName(profile.name);
  const work = extractWorkDescription(getAnswerText(answers, 16));
  const conversation = buildConversationParagraph(answers);
  const interests = buildInterestParagraph(answers);

  return `${name}님은 ${work}

${conversation}

${interests}`;
}
