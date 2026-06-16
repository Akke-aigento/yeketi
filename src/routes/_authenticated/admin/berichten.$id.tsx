import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, timeAgo } from "@/components/AdminShell";
import {
  getConversation, adminReply, closeConversation, linkConversationToProject,
} from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/berichten/$id")({
  head: () => ({ meta: [{ title: "Gesprek — Admin" }, { name: "robots", content: "noindex" }] }),
  component: BerichtDetail,
});

type Loaded = Awaited<ReturnType<typeof getConversation>>;
type Msg = Loaded["messages"][number];

function BerichtDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const get = useServerFn(getConversation);
  const reply = useServerFn(adminReply);
  const close = useServerFn(closeConversation);
  const link = useServerFn(linkConversationToProject);

  const [data, setData] = useState<Loaded | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const scroller = useRef<HTMLDivElement>(null);

  async function load() {
    const r = await get({ data: { conversationId: id } });
    setData(r);
    setOptimistic([]);
    if (r.contact?.id) {
      const { data: pr } = await supabase
        .from("projects").select("id, title").eq("customer_id", r.contact.id).order("created_at", { ascending: false });
      setProjects(pr ?? []);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [data, optimistic]);

  const messages = useMemo(() => [...(data?.messages ?? []), ...optimistic], [data, optimistic]);

  async function onSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const ghost: Msg = {
      id: `tmp-${Date.now()}`, sender: "admin", author_id: null, body: text, created_at: new Date().toISOString(),
    } as Msg;
    setOptimistic((o) => [...o, ghost]);
    setBody("");
    try {
      await reply({ data: { conversationId: id, body: text } });
      await load();
    } catch (e) {
      setOptimistic((o) => o.filter((m) => m.id !== ghost.id));
      alert((e as Error).message || "Versturen mislukt");
    } finally {
      setSending(false);
    }
  }

  async function onClose(status: "open" | "gesloten") {
    if (status === "gesloten" && !confirm("Gesprek sluiten?")) return;
    setBusy(true);
    try { await close({ data: { conversationId: id, status } }); await load(); }
    finally { setBusy(false); }
  }

  async function onLink(projectId: string) {
    setBusy(true);
    try { await link({ data: { conversationId: id, projectId } }); await load(); }
    finally { setBusy(false); }
  }

  function startProject() {
    const c = data?.contact;
    if (!c) return;
    const params = new URLSearchParams({
      customer_id: c.id, full_name: c.full_name ?? "", email: c.email ?? "", phone: c.phone ?? "",
      from_conversation: id,
    });
    nav({ to: "/admin/projecten" as never, search: Object.fromEntries(params) as never });
  }

  if (!data) {
    return (
      <AdminShell title="Gesprek">
        <section className="container-edit pb-12">
          <div className="h-40" style={{ background: "var(--cream-deep)", border: "1px solid var(--charcoal)" }} />
        </section>
      </AdminShell>
    );
  }

  const c = data.conversation;
  const contact = data.contact;

  return (
    <AdminShell>
      <section className="container-edit" style={{ paddingBlock: "1rem" }}>
        <Link to="/admin/berichten" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--brass)" }}>
          ← Berichten
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-display)" }}>
              {contact?.full_name || contact?.email || "Onbekend contact"}
            </h1>
            <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
              {contact?.email}{contact?.phone ? ` · ${contact.phone}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={startProject} className="text-[11px] uppercase tracking-[0.18em] px-3 py-2" style={{ border: "1px solid var(--charcoal)", color: "var(--charcoal)" }}>
              + Project
            </button>
            {projects.length > 0 && !c.project_id && (
              <select
                onChange={(e) => e.target.value && onLink(e.target.value)}
                defaultValue=""
                disabled={busy}
                className="text-[11px] uppercase tracking-[0.15em] px-3 py-2"
                style={{ border: "1px solid var(--charcoal)", background: "var(--cream)" }}
              >
                <option value="">Koppel project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )}
            {c.project_id && (
              <Link to="/admin/projecten/$id" params={{ id: c.project_id }} className="text-[11px] uppercase tracking-[0.18em] px-3 py-2" style={{ border: "1px solid var(--brass)", color: "var(--brass)" }}>
                Open project
              </Link>
            )}
            {c.status === "open" ? (
              <button onClick={() => onClose("gesloten")} disabled={busy} className="text-[11px] uppercase tracking-[0.18em] px-3 py-2" style={{ border: "1px solid var(--oxide)", color: "var(--oxide)" }}>
                Sluiten
              </button>
            ) : (
              <button onClick={() => onClose("open")} disabled={busy} className="text-[11px] uppercase tracking-[0.18em] px-3 py-2" style={{ border: "1px solid var(--charcoal)", color: "var(--charcoal)" }}>
                Heropen
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="container-edit pb-6">
        <div
          ref={scroller}
          className="px-3 py-4 space-y-3"
          style={{ background: "var(--cream-deep)", border: "1px solid var(--charcoal)", maxHeight: "55vh", overflowY: "auto" }}
        >
          {messages.length === 0 && (
            <p className="text-sm text-center" style={{ color: "var(--charcoal-soft)" }}>Nog geen berichten.</p>
          )}
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
        </div>

        {c.status === "open" ? (
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSend(); }}
              rows={3}
              placeholder="Antwoord…"
              className="field-y flex-1"
              style={{ resize: "vertical" }}
            />
            <button onClick={onSend} disabled={sending || !body.trim()} className="btn-y-solid">
              {sending ? "…" : "Verstuur"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-center" style={{ color: "var(--charcoal-soft)" }}>
            Dit gesprek is gesloten.
          </p>
        )}
      </section>
    </AdminShell>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isAdmin = m.sender === "admin";
  const isSys = m.sender === "systeem";
  if (isSys) {
    return (
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-1" style={{ background: "var(--cream)", color: "var(--charcoal-soft)", border: "1px solid var(--charcoal-soft)" }}>
          {m.body}
        </span>
        <div className="text-[10px] mt-1" style={{ color: "var(--charcoal-soft)" }}>{timeAgo(m.created_at)}</div>
      </div>
    );
  }
  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: isAdmin ? "var(--brass)" : "var(--charcoal-soft)" }}>
          {isAdmin ? "Yeketi" : "Klant"} · {timeAgo(m.created_at)}
        </div>
        <div
          className="px-3 py-2 text-sm whitespace-pre-wrap"
          style={{
            background: isAdmin ? "var(--charcoal)" : "var(--cream)",
            color: isAdmin ? "var(--cream)" : "var(--charcoal)",
            border: `1px solid ${isAdmin ? "var(--brass)" : "var(--charcoal)"}`,
          }}
        >
          {m.body}
        </div>
      </div>
    </div>
  );
}