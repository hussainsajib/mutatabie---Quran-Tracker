import type { Mark } from "../mushaf/types";

/** A study session: a run of marks with no gap longer than SESSION_GAP_MS. */
export interface Session {
  key: number; // epoch ms of the first mark (stable id)
  from: number; // epoch ms
  to: number; // epoch ms
  marks: Mark[];
}

/** Marks further apart than this start a new session. */
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Group marks into sessions by time gap (newest session first). */
export function groupMarksIntoSessions(marks: Mark[]): Session[] {
  const sorted = [...marks].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
  );

  const sessions: Session[] = [];
  for (const mark of sorted) {
    const t = new Date(mark.updated_at).getTime();
    const last = sessions[sessions.length - 1];
    if (last && t - last.to <= SESSION_GAP_MS) {
      last.to = Math.max(last.to, t);
      last.marks.push(mark);
    } else {
      sessions.push({ key: t, from: t, to: t, marks: [mark] });
    }
  }

  sessions.sort((a, b) => b.from - a.from);
  return sessions;
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const dayYearFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Human label for a session's time range, e.g. "Oct 18 · 7:30–8:15 PM". */
export function formatSessionRange(from: number, to: number): string {
  const f = new Date(from);
  const t = new Date(to);
  if (f.toDateString() === t.toDateString()) {
    return `${dayYearFmt.format(f)} · ${timeFmt.format(f)}–${timeFmt.format(t)}`;
  }
  return `${dayFmt.format(f)} – ${dayYearFmt.format(t)}`;
}
