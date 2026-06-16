import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendQuoteToCustomer, downloadQuotePdf } from "@/lib/quotes.functions";
import { convertQuoteToProject } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/AdminModals";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/admin/quotes/$id")({
  head: () => ({ meta: [{ title: "Offerte — Admin" }, { name: "robots", content: "noindex" }] }),
  component: QuoteEditor,
});

type Quote = {
  id: string; quote_number: string | null; title: string; vehicle_label: string;
  intro_text: string; notes_text: string; valid_until: string | null;
  status: "concept" | "verstuurd" | "akkoord" | "afgewezen";
  total_amount: number; customer_id: string | null; sent_at: string | null;
  responded_at: string | null; response_reason: string | null;
  quote_request_id: string | null;
};
type Line = { id: string; description: string; amount: number; sort_order: number };
type Profile = { id: string; full_name: string | null; email: string };

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function QuoteEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const send = useServerFn(sendQuoteToCustomer);
  const dl = useServerFn(downloadQuotePdf);
  const convertProject = useServerFn(convertQuoteToProject);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => Promise<void> } | null>(null);

  const editable = quote?.status === "concept";

  const load = useCallback(async () => {
    const [{ data: q }, { data: ls }, { data: profs }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
      supabase.from("quote_lines").select("*").eq("quote_id", id).order("sort_order"),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);
    setQuote(q as Quote | null);
    setLines((ls as Line[] | null) ?? []);
    setCustomers((profs as Profile[] | null) ?? []);
    const custId = (q as Quote | null)?.customer_id ?? null;
    if (custId) {
      const { data: p } = await supabase.from("projects")
        .select("id").eq("customer_id", custId).maybeSingle();
      setProjectId(p?.id ?? null);
    } else {
      setProjectId(null);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => lines.reduce((s, l) => s + Number(l.amount || 0), 0), [lines]);

  function patchQuote(p: Partial<Quote>) {
    if (!quote) return;
    setQuote({ ...quote, ...p });
    setDirty(true);
  }

  function addLine() {
    const tempId = `tmp-${crypto.randomUUID()}`;
    setLines([...lines, { id: tempId, description: "", amount: 0, sort_order: lines.length }]);
    setDirty(true);
  }
  function updateLine(i: number, p: Partial<Line>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
    setDirty(true);
  }
  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = lines.findIndex((l) => l.id === e.active.id);
    const newIdx = lines.findIndex((l) => l.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setLines(arrayMove(lines, oldIdx, newIdx).map((l, i) => ({ ...l, sort_order: i })));
    setDirty(true);
  }

  async function save() {
    if (!quote) return;
    if (saving) return;
    setSaving(true);
    try {
      const { error: qe } = await supabase.from("quotes").update({
        title: quote.title, vehicle_label: quote.vehicle_label,
        intro_text: quote.intro_text, notes_text: quote.notes_text,
        valid_until: quote.valid_until || null, customer_id: quote.customer_id,
      }).eq("id", quote.id);
      if (qe) throw qe;

      // Sync lines: delete removed, upsert kept (clean tmp ids), reassign sort_order
      const { data: existing } = await supabase.from("quote_lines").select("id").eq("quote_id", quote.id);
      const existingIds = new Set((existing ?? []).map((r) => r.id));
      const keepIds = new Set(lines.filter((l) => !l.id.startsWith("tmp-")).map((l) => l.id));
      const removeIds = [...existingIds].filter((id) => !keepIds.has(id));
      if (removeIds.length > 0) {
        await supabase.from("quote_lines").delete().in("id", removeIds);
      }
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.id.startsWith("tmp-")) {
          const { data: ins, error } = await supabase.from("quote_lines").insert({
            quote_id: quote.id, description: l.description, amount: l.amount, sort_order: i,
          }).select("id").maybeSingle();
          if (error) throw error;
          if (ins) l.id = ins.id;
        } else {
          const { error } = await supabase.from("quote_lines").update({
            description: l.description, amount: l.amount, sort_order: i,
          }).eq("id", l.id);
          if (error) throw error;
        }
      }
      setLines([...lines]);
      setDirty(false);
      toast.success("Bewaard");
      await load();
    } catch (e) {
      toast.error("Bewaren mislukt", { description: (e as Error).message });
    } finally { setSaving(false); }
  }

  function askSend() {
    if (!quote) return;
    if (!quote.customer_id) { toast.error("Koppel eerst een klant"); return; }
    if (lines.length === 0) { toast.error("Voeg minstens één regel toe"); return; }
    setConfirm({
      title: "Offerte versturen",
      message: "Verstuur deze offerte naar de klant? Hij krijgt een e-mail met PDF en kan in zijn portaal akkoord of afwijzen.",
      onConfirm: async () => {
        if (dirty) await save();
        setSending(true);
        try {
          const res = await send({ data: { quoteId: quote.id } });
          toast.success(`Verstuurd als ${res.quoteNumber}`);
          await load();
        } catch (e) {
          toast.error("Versturen mislukt", { description: (e as Error).message });
        } finally { setSending(false); }
      },
    });
  }

  async function download() {
    if (!quote) return;
    try {
      const { filename, base64 } = await dl({ data: { quoteId: quote.id } });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("PDF mislukt", { description: (e as Error).message });
    }
  }

  function askCreateProject() {
    if (!quote) return;
    if (!quote.customer_id) { toast.error("Koppel eerst een klant"); return; }
    setConfirm({
      title: "Project aanmaken",
      message: "Maak het projectdossier aan voor deze klant en start de werkfases. De klant ziet het meteen in het portaal.",
      onConfirm: async () => {
        setCreatingProject(true);
        try {
          const res = await convertProject({ data: { quoteId: quote.id } });
          toast.success(res.existed ? "Project bestond al — geopend" : "Project aangemaakt");
          navigate({ to: "/admin/projecten/$id", params: { id: res.projectId } });
        } catch (e) {
          toast.error("Aanmaken mislukt", { description: (e as Error).message });
        } finally { setCreatingProject(false); }
      },
    });
  }

  if (!quote) {
    return (
      <AdminShell title="Offerte">
        <section className="container-edit" style={{ paddingTop: "1rem" }}>
          <div className="skeleton-y" style={{ height: 240 }} />
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <section className="container-edit" style={{ paddingBottom: "5rem" }}>
        <div className="flex items-center justify-between pt-3">
          {quote.quote_request_id ? (
            <Link to="/admin/aanvragen/$id" params={{ id: quote.quote_request_id }}
                  className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>
              ← Terug naar aanvraag
            </Link>
          ) : (
            <Link to="/admin/aanvragen"
                  className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>
              ← Pipeline
            </Link>
          )}
          <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-1"
                style={{
                  background: quote.status === "akkoord" ? "var(--charcoal)" : quote.status === "afgewezen" ? "var(--cream-deep)" : quote.status === "verstuurd" ? "var(--gold)" : "var(--cream-deep)",
                  color: quote.status === "akkoord" ? "var(--gold)" : quote.status === "afgewezen" ? "var(--oxide)" : "var(--charcoal)",
                }}>
            {quote.status === "concept" ? "Concept" : quote.status === "verstuurd" ? "Verstuurd" : quote.status === "akkoord" ? "Akkoord" : "Afgewezen"}
          </span>
        </div>

        <h1 className="mt-2" style={{ fontSize: "1.5rem", fontFamily: "var(--font-display)" }}>
          {quote.quote_number ?? "Concept"}
        </h1>
        {quote.sent_at && (
          <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
            Verstuurd op {new Date(quote.sent_at).toLocaleDateString("nl-BE")}
            {quote.responded_at && ` · ${quote.status === "akkoord" ? "geaccepteerd" : "afgewezen"} ${new Date(quote.responded_at).toLocaleDateString("nl-BE")}`}
          </p>
        )}
        {quote.response_reason && (
          <p className="mt-2 text-sm italic" style={{ color: "var(--charcoal-soft)" }}>
            Reden klant: "{quote.response_reason}"
          </p>
        )}

        {!editable && (
          <div className="mt-3 px-3 py-2 text-xs"
               style={{ border: "1px solid var(--brass)", background: "var(--cream)", color: "var(--charcoal-soft)" }}>
            Deze offerte is verstuurd en kan niet meer bewerkt worden.
          </div>
        )}

        {/* Klant + titel + voertuig */}
        <div className="mt-5 space-y-3">
          <Field label="Klant">
            <select
              disabled={!editable}
              value={quote.customer_id ?? ""}
              onChange={(e) => patchQuote({ customer_id: e.target.value || null })}
              className="form-y"
            >
              <option value="">— Geen klant —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name ?? c.email} · {c.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titel">
            <input disabled={!editable} className="form-y" value={quote.title}
                   onChange={(e) => patchQuote({ title: e.target.value })} />
          </Field>
          <Field label="Voertuig">
            <input disabled={!editable} className="form-y" value={quote.vehicle_label}
                   onChange={(e) => patchQuote({ vehicle_label: e.target.value })}
                   placeholder="bv. VW T2 Westfalia 1972" />
          </Field>
          <Field label="Intro">
            <textarea disabled={!editable} className="form-y" rows={3} value={quote.intro_text}
                      onChange={(e) => patchQuote({ intro_text: e.target.value })} />
          </Field>
        </div>

        {/* Lines */}
        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>Regels</h2>
            {editable && (
              <button onClick={addLine} className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--brass)" }}>
                + Regel
              </button>
            )}
          </div>

          {lines.length === 0 && (
            <p className="mt-3 text-sm" style={{ color: "var(--charcoal-soft)" }}>
              Nog geen regels. Voeg er één toe.
            </p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="mt-3 space-y-2">
                {lines.map((l, i) => (
                  <SortableLine
                    key={l.id} line={l} editable={!!editable}
                    onChange={(p) => updateLine(i, p)}
                    onRemove={() => removeLine(i)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-4 flex items-center justify-between px-3 py-3"
               style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
            <span className="text-[11px] uppercase tracking-[0.22em]">Totaal</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--gold)" }}>
              {eur(total)}
            </span>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          <Field label="Opmerkingen">
            <textarea disabled={!editable} className="form-y" rows={3} value={quote.notes_text}
                      onChange={(e) => patchQuote({ notes_text: e.target.value })}
                      placeholder="bv. Betaling in schijven, doorlooptijd…" />
          </Field>
          <Field label="Geldig tot (optioneel)">
            <input disabled={!editable} type="date" className="form-y" value={quote.valid_until ?? ""}
                   onChange={(e) => patchQuote({ valid_until: e.target.value || null })} />
          </Field>
        </div>

        {/* Sticky actions */}
        <div className="mt-8 sticky bottom-0 -mx-4 px-4 py-3 grid grid-cols-2 gap-2"
             style={{ background: "var(--cream)", borderTop: "1px solid var(--charcoal)" }}>
          {editable ? (
            <>
              <button disabled={saving || !dirty} aria-busy={saving} onClick={save} className="btn-y">
                {saving ? "Bewaren…" : dirty ? "Bewaar concept" : "Bewaard"}
              </button>
              <button disabled={sending} aria-busy={sending} onClick={askSend} className="btn-y-solid">
                {sending ? "Versturen…" : "Verstuur naar klant"}
              </button>
            </>
          ) : (
            <>
              <button onClick={download} className="btn-y">PDF downloaden</button>
              <button
                onClick={() => quote.quote_request_id
                  ? navigate({ to: "/admin/aanvragen/$id", params: { id: quote.quote_request_id } })
                  : navigate({ to: "/admin/aanvragen" })}
                className="btn-y-solid"
              >
                Terug
              </button>
            </>
          )}
        </div>
      </section>
      <ConfirmModal
        open={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel="Verstuur"
        onConfirm={async () => { await confirm?.onConfirm(); }}
        onClose={() => setConfirm(null)}
      />
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SortableLine({
  line, editable, onChange, onRemove,
}: {
  line: Line; editable: boolean;
  onChange: (p: Partial<Line>) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: "1px solid var(--charcoal)",
    background: "var(--cream-deep)",
  };
  return (
    <li ref={setNodeRef} style={style} className="px-2 py-2">
      <div className="flex items-start gap-2">
        {editable && (
          <button {...attributes} {...listeners} aria-label="Versleep"
                  className="px-2 py-2 cursor-grab touch-none"
                  style={{ color: "var(--charcoal-soft)" }}>
            ⋮⋮
          </button>
        )}
        <textarea
          disabled={!editable}
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="form-y flex-1"
          placeholder="Omschrijving"
        />
        <input
          disabled={!editable}
          type="number"
          step="0.01"
          value={line.amount}
          onChange={(e) => onChange({ amount: Number(e.target.value) })}
          className="form-y"
          style={{ width: 110, textAlign: "right" }}
          placeholder="0,00"
        />
        {editable && (
          <button onClick={onRemove} aria-label="Verwijder regel"
                  className="px-2 py-2 text-[11px] uppercase tracking-[0.15em]"
                  style={{ color: "var(--oxide)" }}>
            ✕
          </button>
        )}
      </div>
    </li>
  );
}