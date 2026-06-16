import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PortalHeader } from "@/components/PortalHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getMyConversation, sendCustomerMessage } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/portaal/berichten")({
  head: () => ({
    meta: [
      { title: "Berichten — Yeketi Motorworks" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalBerichten,
});

type Msg = { id: string; sender: string; author_id: string | null; body: string; created_at: string };

function fmtTime(s: string) {
  const d = new Date(s);
  return new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

function PortalBerichten() {
  const load = useServerFn(getMyConversation);
  const send = useServerFn(sendCustomerMessage);
  const [data, setData] = useState<{ conversation: { id: string; status: string; subject: string | null } | null; messages: Msg[] } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  async function reload() {
    const r = await load();
    setData(r);
    setOptimistic([]);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [data, optimistic]);

  const messages = useMemo(() => [...(data?.messages ?? []), ...optimistic], [data, optimistic]);
  const closed = data?.conversation?.status === "gesloten";

  async function onSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const ghost: Msg = { id: `tmp-${Date.now()}`, sender: "klant", author_id: null, body: text, created_at: new Date().toISOString() };
    setOptimistic((o) => [...o, ghost]);
    setBody("");
    try {
      await send({ data: { body: text } });
      await reload();
    } catch (e) {
      setOptimistic((o) => o.filter((m) => m.id !== ghost.id));
      alert((e as Error).message || "Versturen mislukt");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PortalHeader />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(2rem,5vw,4rem)" }}>
          <Link to="/portaal" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--brass)" }}>
            ← Portaal
          </Link>
          <h1 className="mt-3" style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", fontFamily: "var(--font-display)" }}>
            Berichten
          </h1>
          <p className="mt-2 max-w-xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
            Een directe lijn met Baram en het Yeketi-atelier. Reageer hier en je krijgt persoonlijk antwoord.
          </p>

          {data === null ? (
            <div className="mt-8 h-40" style={{ background: "var(--cream-deep)", border: "1px solid var(--charcoal)" }} />
          ) : (
            <>
              <div
                ref={scroller}
                className="mt-8 px-3 py-4 space-y-3"
                style={{
                  background: "var(--cream-deep)",
                  border: "1px solid var(--charcoal)",
                  maxHeight: "55vh",
                  overflowY: "auto",
                }}
              >
                {messages.length === 0 && (
                  <p className="text-sm text-center" style={{ color: "var(--charcoal-soft)" }}>
                    Nog geen berichten — stuur je eerste bericht hieronder.
                  </p>
                )}
                {messages.map((m) => <Bubble key={m.id} m={m} />)}
              </div>

              {closed ? (
                <p className="mt-3 text-sm text-center" style={{ color: "var(--charcoal-soft)" }}>
                  Dit gesprek is gesloten. Wil je een nieuw onderwerp aankaarten?{" "}
                  <a href="mailto:info@yeketimotorworks.com" style={{ color: "var(--brass)" }}>Mail ons direct</a>.
                </p>
              ) : (
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSend(); }}
                    rows={3}
                    placeholder="Schrijf een bericht…"
                    className="field-y flex-1"
                    style={{ resize: "vertical" }}
                  />
                  <button onClick={onSend} disabled={sending || !body.trim()} className="btn-y-solid">
                    {sending ? "…" : "Verstuur"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isCustomer = m.sender === "klant";
  const isSys = m.sender === "systeem";
  if (isSys) {
    return (
      <div className="text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-1" style={{ background: "var(--cream)", color: "var(--charcoal-soft)", border: "1px solid var(--charcoal-soft)" }}>
          {m.body}
        </span>
        <div className="text-[10px] mt-1" style={{ color: "var(--charcoal-soft)" }}>{fmtTime(m.created_at)}</div>
      </div>
    );
  }
  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        <div
          className="text-[10px] uppercase tracking-[0.2em] mb-1"
          style={{ color: isCustomer ? "var(--charcoal-soft)" : "var(--brass)" }}
        >
          {isCustomer ? "Jij" : "Yeketi"} · {fmtTime(m.created_at)}
        </div>
        <div
          className="px-3 py-2 text-sm whitespace-pre-wrap"
          style={{
            background: isCustomer ? "var(--cream)" : "var(--charcoal)",
            color: isCustomer ? "var(--charcoal)" : "var(--cream)",
            border: `1px solid ${isCustomer ? "var(--charcoal)" : "var(--brass)"}`,
          }}
        >
          {m.body}
        </div>
      </div>
    </div>
  );
}