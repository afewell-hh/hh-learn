export type TrackEventInput = {
  eventName:
    | 'learning_module_started'
    | 'learning_module_completed'
    | 'learning_pathway_enrolled'
    | 'learning_course_enrolled'
    | 'learning_page_viewed';
  contactIdentifier?: { email?: string; contactId?: string };
  payload?: Record<string, unknown>;
  enrollment_source?: string; // e.g., 'pathway_page', 'course_page', 'catalog'
  pathway_slug?: string;
  course_slug?: string;
};

// Progress state structure types
export type ModuleProgressState = {
  started?: boolean;
  started_at?: string;
  completed?: boolean;
  completed_at?: string;
};

export type CourseProgressState = {
  enrolled?: boolean;
  enrolled_at?: string;
  enrollment_source?: string;
  modules?: Record<string, ModuleProgressState>;
};

export type PathwayProgressState = {
  enrolled?: boolean;
  enrolled_at?: string;
  enrollment_source?: string;
  modules?: Record<string, ModuleProgressState>;
};

export type ProgressState = {
  courses?: Record<string, CourseProgressState>;
  [pathwaySlug: string]: PathwayProgressState | Record<string, CourseProgressState> | undefined;
};

export type QuizGradeInput = {
  module_slug: string;
  answers: Array<{ id: string; value: unknown }>;
};

export type QuizGradeResult = { score: number; pass: boolean; details?: unknown };

export type ModuleMedia = {
  type: 'image' | 'video';
  url: string;
  alt: string;
  caption?: string;
  credit?: string;
  thumbnail_url?: string;
};
