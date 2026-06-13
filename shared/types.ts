export interface LessonRecord {
  id: string;
  title: string;
  desc: string;
}

export interface ClientMessage {
  type: "create_lesson" | "view_lessons" | "delete_lesson" | "update_lesson" | "sort_by_title";
  title?: string;
  description?: string;
  id?: string;
  sortBy?: "title";
  page?: number;
}

export interface ServerResponse {
  ok: boolean;
  status?: "success" | "error";
  message?: string;
  lessons?: LessonRecord[];
  hasNextPage?: boolean;
}