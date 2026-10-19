import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMark, upsertMark } from "../api/marks";
import type { Mark, MistakeType, Word } from "../mushaf/types";

interface Props {
  word: Word;
  marks: Mark[]; // marks for this word
  onClose: () => void;
}

export function MarkModal({ word, marks, onClose }: Props) {
  const queryClient = useQueryClient();
  const markFor = (t: MistakeType) => marks.find((m) => m.mistake_type === t);

  const [type, setType] = useState<MistakeType>(
    () => (markFor("hifdh") ? "hifdh" : markFor("tajweed") ? "tajweed" : "hifdh"),
  );
  const [note, setNote] = useState(() => markFor(type)?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const current = markFor(type);

  useEffect(() => {
    setNote(markFor(type)?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const save = useMutation({
    mutationFn: () => upsertMark(word.id, type, note.trim() || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marks"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: () => deleteMark(word.id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marks"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to delete"),
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="modal-word">{word.text}</div>
        <div className="modal-loc">
          Surah {word.s} · Ayah {word.a} · Word {word.n} <span dir="ltr">({word.loc})</span>
        </div>

        <div className="modal-types">
          {(["hifdh", "tajweed"] as const).map((t) => {
            const marked = markFor(t);
            return (
              <button
                key={t}
                className={`type-btn ${t} ${type === t ? "active" : ""}`}
                onClick={() => setType(t)}
              >
                {t === "hifdh" ? "Hifdh" : "Tajweed"}
                {marked ? <span className="repeat-badge">{marked.repeat_count}×</span> : null}
              </button>
            );
          })}
        </div>

        <label className="field">
          <span>Note (optional)</span>
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="What went wrong, what to focus on…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {current && (
          <div className="modal-meta">
            Marked {current.repeat_count} time{current.repeat_count === 1 ? "" : "s"} · last
            updated {new Date(current.updated_at).toLocaleDateString()}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="modal-actions">
          {current && (
            <button
              className="btn btn-danger"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove mark
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending
              ? "Saving…"
              : current
                ? "Record again (+1)"
                : "Mark mistake"}
          </button>
        </div>
      </div>
    </div>
  );
}
