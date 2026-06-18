import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketQuestionTemplate } from "@/types/question";

type TicketQuestionTemplateRow = {
  id: string;
  title: string;
  short_description: string | null;
  image_url: string | null;
  mood_tags: string[] | null;
  activity_type: string | null;
  recommendation_copy: string | null;
  default_region: string | null;
  default_time: string | null;
  question_order: number | null;
};

function toTicketQuestionTemplate(
  row: TicketQuestionTemplateRow,
): TicketQuestionTemplate | null {
  if (row.question_order == null) return null;

  return {
    id: row.id,
    title: row.title,
    shortDescription: row.short_description,
    imageUrl: row.image_url,
    moodTags: row.mood_tags ?? [],
    activityType: row.activity_type,
    recommendationCopy: row.recommendation_copy,
    defaultRegion: row.default_region,
    defaultTime: row.default_time?.slice(0, 5) ?? null,
    questionOrder: row.question_order,
  };
}

export async function loadTicketQuestionTemplates() {
  const { data, error } = await createAdminClient()
    .from("ticket_templates")
    .select(
      "id,title,short_description,image_url,mood_tags,activity_type,recommendation_copy,default_region,default_time,question_order",
    )
    .not("question_order", "is", null)
    .order("question_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to load ticket question templates:", error);
    return [];
  }

  const templates = ((data ?? []) as TicketQuestionTemplateRow[])
    .map(toTicketQuestionTemplate)
    .filter((template): template is TicketQuestionTemplate => Boolean(template));

  return Array.from(
    new Map(
      templates
        .filter(
          (template) =>
            template.questionOrder >= 1 && template.questionOrder <= 5,
        )
        .map((template) => [template.questionOrder, template]),
    ).values(),
  );
}
