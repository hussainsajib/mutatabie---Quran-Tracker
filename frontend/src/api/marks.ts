import { apiFetch } from "./client";
import type { Mark, MistakeType } from "../mushaf/types";

export async function listMarks(): Promise<Mark[]> {
  return apiFetch<Mark[]>("/api/marks");
}

export async function upsertMark(
  wordId: number,
  mistakeType: MistakeType,
  note: string | null,
): Promise<Mark> {
  return apiFetch<Mark>(`/api/marks/${wordId}`, {
    method: "PUT",
    body: JSON.stringify({ mistake_type: mistakeType, note }),
  });
}

export async function deleteMark(
  wordId: number,
  mistakeType?: MistakeType,
): Promise<void> {
  const query = mistakeType ? `?mistake_type=${mistakeType}` : "";
  await apiFetch<{ message: string }>(`/api/marks/${wordId}${query}`, {
    method: "DELETE",
  });
}
