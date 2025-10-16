export type TrackEventInput = {
  eventName:
    | 'learning_module_started'
    | 'learning_module_completed'
    | 'learning_pathway_enrolled'
    | 'learning_page_viewed';
  contactIdentifier?: { email?: string; contactId?: string };
  payload?: Record<string, unknown>;
};

export type QuizGradeInput = {
  module_slug: string;
  answers: Array<{ id: string; value: unknown }>;
};

export type QuizGradeResult = { score: number; pass: boolean; details?: unknown };
