import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addReaction, deleteReaction, type ReactionView } from "@/lib/portal";

function timeAgoShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "zojuist";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} u`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

export function ReactionThread({
  updateId,
  initial,
  canDelete = false,
  placeholder = "Schrijf een reactie…",
}: {
  updateId: string;
  initial: ReactionView[];
  canDelete?: boolean;
  placeholder?: string;
}) {
  const [items, setItems] = useState<ReactionView[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => setItems(initial), [initial]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    // Optimistic
    const tempId = `tmp-${Date.now()}`;
    const optimistic: ReactionView = {
      id: tempId,
      phase_update_id: updateId,
      author_id: "me",
      author_name: "…",
      is_admin: false,
      body,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const saved = await addReaction(updateId, body);
      setItems((prev) => prev.map((r) => (r.id === tempId ? saved : r)));
    } catch (e) {
      setItems((prev) => prev.filter((r) => r.id !== tempId));
      setDraft(body);
      toast.error("Reactie versturen mislukt", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Reactie verwijderen?")) return;
    const prev = items;
    setItems((p) => p.filter((r) => r.id !== id));
    try {
      await deleteReaction(id);
    } catch (e) {
      setItems(prev);
      toast.error("Verwijderen mislukt", { description: (e as Error).message });
    }
  }

  return (
    <div className="mt-4" style={{ borderTop: "1px dashed var(--cream-deep)", paddingTop: "0.75rem" }}>
      {items.length > 0 && (
        <ul className="space-y-3 mb-3">
          {items.map((r) => (
            <li key={r.id} className="flex gap-2 items-start text-sm">
              <span
                className="text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 flex-shrink-0"
                style={{
                  border: "1px solid " + (r.is_admin ? "var(--brass)" : "var(--cream-deep)"),
                  background: r.is_admin ? "var(--brass)" : "transparent",
                  color: r.is_admin ? "var(--cream)" : "var(--charcoal-soft)",
                  fontFamily: "var(--font-display)",
                  letterSpacing: r.is_admin ? "0.18em" : "0.1em",
                  marginTop: 2,
                }}
              >
                {r.author_name}
              </span>
              <div className="flex-1 min-w-0">
                <p className="whitespace-pre-wrap" style={{ lineHeight: 1.55, color: "var(--charcoal)" }}>{r.body}</p>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--charcoal-soft)" }}>
                  {timeAgoShort(r.created_at)}
                </div>
              </div>
              {canDelete && !r.id.startsWith("tmp-") && (
                <button
                  onClick={() => remove(r.id)}
                  aria-label="Reactie verwijderen"
                  className="text-xs px-1"
                  style={{ color: "var(--oxide)" }}
                >✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          rows={1}
          className="flex-1 field-y"
          style={{ resize: "none", minHeight: "2.5rem", padding: "0.5rem 0.75rem", fontSize: "0.95rem" }}
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="text-[10px] tracking-[0.18em] uppercase px-3 py-2 flex-shrink-0"
          style={{
            border: "1px solid var(--brass)",
            background: draft.trim() ? "var(--brass)" : "transparent",
            color: draft.trim() ? "var(--cream)" : "var(--brass)",
            opacity: sending ? 0.6 : 1,
            transition: "background .2s ease, color .2s ease",
          }}
        >
          {sending ? "…" : "Stuur"}
        </button>
      </div>
    </div>
  );
}