import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, timeAgo } from "@/components/AdminShell";
import { listConversations } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/admin/berichten/")({
  head: () => ({ meta: [{ title: "Berichten — Admin" }, { name: "robots", content: "noindex" }] }),
  component: BerichtenIndex,
});

type Row = Awaited<ReturnType<typeof listConversations>>[number];

const sourceLabel: Record<string, string> = {
  contact_form: "Contactformulier",
  quote_request: "Offerteaanvraag",
  manual: "Handmatig",
};

function BerichtenIndex() {
  const list = useServerFn(listConversations);
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let alive = true;
    list({ data: {} as never }).then((r) => { if (alive) setRows(r); }).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [list]);

  return (
    <AdminShell title="Berichten">
      <section className="container-edit pb-12">
        {rows === null && (
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="px-3 py-4" style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
                <div className="h-4 w-1/3 mb-2" style={{ background: "color-mix(in oklab, var(--charcoal) 10%, transparent)" }} />
                <div className="h-3 w-2/3" style={{ background: "color-mix(in oklab, var(--charcoal) 8%, transparent)" }} />
              </li>
            ))}
          </ul>
        )}
        {rows !== null && rows.length === 0 && (
          <div className="mt-6 px-6 py-10 text-center" style={{ border: "1px dashed var(--charcoal)", background: "var(--cream-deep)" }}>
            <p className="italic-quote" style={{ color: "var(--brass)", fontSize: "1.2rem" }}>Nog geen berichten</p>
            <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)" }}>
              Zodra iemand het contact- of offerteformulier invult, verschijnt het gesprek hier.
            </p>
          </div>
        )}
        {rows && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  to="/admin/berichten/$id" params={{ id: c.id }}
                  className="block px-4 py-3"
                  style={{ border: "1px solid var(--charcoal)", background: c.unread ? "var(--cream)" : "var(--cream-deep)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {c.unread && (
                          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brass)" }} />
                        )}
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                          {c.contact.full_name || c.contact.email || "Onbekend contact"}
                        </span>
                        {c.project_id && (
                          <span className="text-[10px] uppercase tracking-[0.15em] px-2 py-0.5" style={{ background: "var(--charcoal)", color: "var(--gold)" }}>
                            Project
                          </span>
                        )}
                        {c.status === "gesloten" && (
                          <span className="text-[10px] uppercase tracking-[0.15em] px-2 py-0.5" style={{ background: "var(--cream-deep)", color: "var(--charcoal-soft)", border: "1px solid var(--charcoal-soft)" }}>
                            Gesloten
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm truncate" style={{ color: "var(--charcoal-soft)" }}>
                        {c.last_sender === "admin" ? "Jij: " : c.last_sender === "systeem" ? "" : ""}{c.last_snippet || c.subject || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--brass)" }}>
                        {sourceLabel[c.source] ?? c.source}
                      </div>
                      <div className="text-xs mt-1" style={{ color: "var(--charcoal-soft)" }}>{timeAgo(c.last_message_at)}</div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}