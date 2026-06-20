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

export type GeneratedProfileContent = {
  publicEmoji: string | null;
  publicIntro: string;
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

function isTicketRatingAnswer(
  answers: PromptAnswerRow[],
  questionOrder: number,
) {
  const answer = answers.find(
    (item) => item.question_order === questionOrder,
  );
  return Boolean(parseTicketRatingAnswer(answer?.answer_text));
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
  const preferredOrders = [6, 7, 8, 9, 10, 11, 12, 13, 14];
  const details = preferredOrders
    .map((order) =>
      isTicketRatingAnswer(answers, order)
        ? ""
        : cleanSentence(getAnswerText(answers, order)),
    )
    .filter(Boolean)
    .slice(0, 2);

  if (details.length === 0) {
    return "대화에서는 상대의 이야기를 차분히 듣고, 서로의 속도를 존중하며 자연스럽게 공통점을 찾아가는 편이에요.";
  }

  return `대화에서는 ${details.join(". 또한 ")}. 서로의 이야기를 편안하게 나눌 수 있는 분위기를 중요하게 여겨요.`;
}

function buildInterestParagraph(answers: PromptAnswerRow[]) {
  const interestAnswer = cleanSentence(getAnswerText(answers, 16));
  const recentThought = interestAnswer.replace(
    /^요즘은\s*/,
    "",
  );

  if (recentThought) {
    return `요즘은 ${recentThought}. 관심이 가는 주제를 천천히 알아가고, 그 이야기를 다른 사람과 나누는 시간을 좋아해요.`;
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
          getAnswerText(answers, answer.question_order) ||
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
    workAnswer:
      resolvedAnswers.find((answer) => answer.order === 15)?.answer ?? null,
    conversationAnswers: resolvedAnswers.filter(
      (answer) =>
        answer.order >= 6 &&
        answer.order <= 14 &&
        !isTicketRatingAnswer(answers, answer.order),
    ),
    recentInterestAnswers: resolvedAnswers.filter((answer) => answer.order === 16),
  };
}

export function parseGeneratedProfileContent(
  value: string | null | undefined,
): GeneratedProfileContent | null {
  const raw = value?.trim();
  if (!raw) return null;

  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const publicIntro = (parsed as { publicIntro?: unknown }).publicIntro;
    const publicEmoji = (parsed as { publicEmoji?: unknown }).publicEmoji;

    if (typeof publicIntro !== "string" || !publicIntro.trim()) return null;

    return {
      publicIntro: publicIntro.trim(),
      publicEmoji:
        typeof publicEmoji === "string" && publicEmoji.trim()
          ? publicEmoji.trim().slice(0, 16)
          : null,
    };
  } catch {
    return null;
  }
}

export const profileInstructions = `
다른 모임 참가자들이 읽을 공개 프로필을 한국어로 작성한다.

입력에는 publicDisplayName, workAnswer, conversationAnswers, recentInterestAnswers가 포함된다.

가장 중요한 개인화 정보는 workAnswer와 recentInterestAnswers다.
publicIntro는 반드시 이 두 답변에서 드러난 구체 표현, 관심사, 일하는 방식, 요즘 생각하는 주제를 중심으로 작성한다.
conversationAnswers는 대화 스타일과 편안한 분위기를 보정하는 데만 사용한다.
ticketPreferences나 티켓 취향 답변이 입력에 포함되더라도 publicIntro 작성에는 사용하지 않는다.

출력은 반드시 JSON만 사용한다. 마크다운, 설명문, 코드블록은 출력하지 않는다.

{
  "publicEmoji": "공개 프로필을 대표하는 이모지 1개",
  "publicIntro": "빈 줄로 구분된 정확히 3문단의 공개 프로필"
}

publicEmoji 규칙:
* workAnswer에 직업이나 요즘 하는 일이 분명하면 그 내용과 가장 직접적으로 연결되는 이모지를 우선 선택한다.
* 일이 모호할 때만 recentInterestAnswers의 구체 관심사와 연결되는 이모지를 선택한다.
* 💎은 시스템의 폴백 표시이므로 절대 출력하지 않는다.

publicIntro 작성 규칙:

1문단은 반드시 publicDisplayName 값 뒤에 "님은"을 붙여 시작한다.
workAnswer를 바탕으로 요즘 어떤 일을 하며 지내는지 자연스럽게 소개한다.
이 문단은 2문장 이상으로 작성하고, 사용자가 하는 일이나 일하는 방식이 어느 정도 느껴지게 쓴다.
workAnswer에 직업, 분야, 요즘 하는 일이 드러난 경우에는 그 범위 안에서 구체적으로 살려 쓴다.
다만 답변이 짧거나 모호하면 직업이나 분야를 새로 추측하지 않고, 사용자가 적은 표현 안에서 자연스럽게 풀어쓴다.
회사명, 근무지, 부서명, 정확한 직함, 정확한 경력 연차, 특정 가능한 업무나 사건은 포함하지 않는다.

2문단은 conversationAnswers를 참고해 대화 스타일, 편안함을 느끼는 분위기, 사람들과 가까워지는 방식을 설명한다.
단순히 "차분하다", "활기차다", "깊은 대화를 좋아한다"처럼 일반적인 말만 반복하지 않는다.
모임에서의 역할, 편하게 느끼는 상대 유형, 부담스럽게 느끼는 조건이 드러나면 자연스럽게 반영한다.
사용자를 진단하거나 유형화하지 말고, 답변에서 드러난 대화 방식만 부드럽게 표현한다.

3문단은 recentInterestAnswers를 중심으로 최근 관심사와 편하게 나눌 수 있는 대화 주제를 설명한다.
recentInterestAnswers에 들어 있는 구체 명사, 취미, 요즘 자주 생각하는 주제, 이야기하고 싶은 소재를 우선적으로 살린다.
관심사가 짧게 적혀 있어도 새로운 내용을 만들지 말고, 처음 만난 사람과 나눌 수 있는 대화 주제로 자연스럽게 풀어쓴다.

개인화 규칙:

* workAnswer와 recentInterestAnswers에 구체 명사나 표현이 있다면 최소 2개 이상 publicIntro에 반영한다.
* 여러 사용자에게 그대로 써도 어색하지 않은 문장은 줄이고, 이 사용자 답변에만 맞는 표현을 우선한다.
* "요즘 어떤 일을 하는 사람인지"와 "무슨 이야기를 꺼내면 자연스러울지"가 분명히 다르게 느껴져야 한다.
* 답변이 짧더라도 빈말로 늘리지 말고, 적힌 표현의 의미를 조심스럽게 확장한다.
* 답변에 없는 취미, 가치관, 성격, 직업, 관심사를 만들지 않는다.
* 답변에 없는 업무 과정, 능력, 태도, 감정도 덧붙이지 않는다. 예를 들어 "세심하게 살핀다", "감각이 있다", "균형을 맞춘다"처럼 해석이나 평가가 들어간 문장은 쓰지 않는다.
* conversationAnswers에 나온 장소, 활동, 취향은 2문단의 대화 방식 설명에만 사용한다. 3문단의 구체 소재는 recentInterestAnswers에서만 가져온다.

친구가 다른 사람에게 소개하듯 부드럽고 따뜻하게 쓴다.
문장 구조와 문단 흐름을 매번 같은 틀로 반복하지 않는다.
"대화에서는", "요즘은", "처음에는", "이야기할 때는" 같은 시작 표현을 반복하지 않는다.
각 문단의 마지막 문장이 비슷한 리듬으로 끝나지 않게 한다.
"~하는 편이에요"는 전체에서 최대 2번까지만 사용한다.
"~에 관심이 많아요"는 전체에서 최대 1번까지만 사용한다.
말투 예시는 참고용이며 그대로 반복하지 않는다:
"~예요", "~하고 있어요", "~을 좋아해요", "~을 중요하게 여겨요", "~을 편하게 느껴요", "~로 이야기가 이어질 때 자연스러워요"
"~입니다", "~합니다", "~처럼 보여요", "~인 것 같아요", "분석 결과",
"~일 가능성이 있어요", "~이 느껴져요", "~해 보여요", "~와 어울려요",
"유형", "진단", "성향상"이라는 표현은 쓰지 않는다.

개인정보 보호:
사용자의 전체 실명 대신 publicDisplayName만 사용할 수 있다.
전화번호, 회사명, 근무지, 부서명, 정확한 경력 연차, 특정 가능한 사건이나 업무, 불필요한 신상 정보는 절대 포함하지 않는다.
연애나 이성 목적을 과하게 강조하지 않는다.

출력 규칙:
publicIntro는 공백 포함 330~480자.
정확히 3문단.
각 문단은 빈 줄로 구분한다.
1문단은 반드시 2문장 이상으로 작성한다.
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
  const firstParagraphSentenceCount =
    paragraphs[0]?.split(/[.!?]+(?:\s|$)/).filter(Boolean).length ?? 0;

  return (
    !isCorruptText(intro) &&
    paragraphs.length === 3 &&
    paragraphs[0].startsWith(`${publicDisplayName(profile.name)}님은`) &&
    firstParagraphSentenceCount >= 2 &&
    !forbidden.test(intro)
  );
}

export function buildFallbackIntro(
  profile: ProfileRow,
  answers: PromptAnswerRow[],
) {
  const name = publicDisplayName(profile.name);
  const work = extractWorkDescription(getAnswerText(answers, 15));
  const conversation = buildConversationParagraph(answers);
  const interests = buildInterestParagraph(answers);

  return `${name}님은 ${work} 요즘 하는 일과 배움의 흐름을 차분히 이어가고 있어요.

${conversation}

${interests}`;
}
