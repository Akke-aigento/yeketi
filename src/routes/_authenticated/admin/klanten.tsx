import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, statusBadge } from "@/components/AdminShell";
import { listCustomers, inviteCustomer, resendInvite } from "@/lib/admin.functions";
import { updateCustomer, findOrCreateConversationForContact } from "@/lib/messages.functions";
import { t } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/admin/klanten")({
  head: () => ({ meta: [{ title: "Klanten — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Klanten,
});

type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null };
type Project = { id: string; customer_id: string; title: string; status: keyof typeof t.portal.statusLabels };

function Klanten() {
  const list = useServerFn(listCustomers);
  const invite = useServerFn(inviteCustomer);
  const resend = useServerFn(resendInvite);
  const update = useServerFn(updateCustomer);
  const openConv = useServerFn(findOrCreateConversationForContact);
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await list({ data: {} as never });
    setProfiles(r.profiles as Profile[]);
    setProjects(r.projects as Project[]);
  }
  useEffect(() => { load(); }, []);

  async function onInvite(form: { email: string; full_name: string; phone: string }) {
    setBusy("invite");
    try { await invite({ data: form }); setShowInvite(false); load(); }
    catch (e: unknown) { alert((e as Error).message ?? "Fout"); }
    finally { setBusy(null); }
  }
  async function onResend(email: string) {
    setBusy(email);
    try { await resend({ data: { email } }); alert("Uitnodiging opnieuw gestuurd."); }
    catch (e: unknown) { alert((e as Error).message ?? "Fout"); }
    finally { setBusy(null); }
  }

  async function onMessage(p: Profile) {
    setBusy(`msg-${p.id}`);
    try {
      const r = await openConv({ data: { profileId: p.id } });
      nav({ to: "/admin/berichten/$id", params: { id: r.conversationId } });
    } catch (e) { alert((e as Error).message ?? "Fout"); }
    finally { setBusy(null); }
  }

  async function onEditSave(form: { full_name: string; phone: string; email: string }) {
    if (!editing) return;
    setBusy("edit");
    try {
      await update({ data: { profileId: editing.id, full_name: form.full_name, phone: form.phone, email: form.email } });
      setEditing(null); load();
    } catch (e: unknown) { alert((e as Error).message ?? "Fout"); }
    finally { setBusy(null); }
  }

  return (
    <AdminShell title="Klanten">
      <section className="container-edit pb-3">
        <button onClick={() => setShowInvite(true)} className="btn-y-solid w-full">+ Nodig klant uit</button>
      </section>
      <section className="container-edit pb-12">
        {profiles === null && <p className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>Laden…</p>}
        <ul className="space-y-2">
          {profiles?.map((p) => {
            const pr = projects.filter((x) => x.customer_id === p.id);
            return (
              <li key={p.id} className="px-3 py-3" style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                      {p.full_name || p.email}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                      {p.email}{p.phone ? ` · ${p.phone}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end sm:shrink-0">
                    <button
                      onClick={() => onMessage(p)}
                      disabled={busy === `msg-${p.id}`}
                      className="text-[11px] uppercase tracking-[0.18em] whitespace-nowrap"
                      style={{ color: "var(--charcoal)" }}
                    >
                      {busy === `msg-${p.id}` ? "…" : "Bericht sturen"}
                    </button>
                    <button
                      onClick={() => setEditing(p)}
                      className="text-[11px] uppercase tracking-[0.18em] whitespace-nowrap"
                      style={{ color: "var(--charcoal-soft)" }}
                    >
                      Bewerken
                    </button>
                    {p.email && (
                      <button
                        onClick={() => onResend(p.email!)}
                        disabled={busy === p.email}
                        className="text-[11px] uppercase tracking-[0.18em] whitespace-nowrap"
                        style={{ color: "var(--brass)" }}
                      >
                        {busy === p.email ? "…" : "Stuur link"}
                      </button>
                    )}
                  </div>
                </div>
                {pr.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {pr.map((x) => {
                      const b = statusBadge(x.status);
                      return (
                        <li key={x.id}>
                          <Link
                            to="/admin/projecten/$id" params={{ id: x.id }}
                            className="flex items-center justify-between gap-2 px-2 py-2 text-sm"
                            style={{ border: "1px solid var(--charcoal)", background: "var(--cream)" }}
                          >
                            <span className="truncate">{x.title}</span>
                            <span className="text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 whitespace-nowrap" style={{ background: b.bg, color: b.fg }}>
                              {t.portal.statusLabels[x.status] ?? x.status}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSave={onInvite} busy={busy === "invite"} />}
      {editing && <EditCustomerModal profile={editing} onClose={() => setEditing(null)} onSave={onEditSave} busy={busy === "edit"} />}
    </AdminShell>
  );
}

function InviteModal({ onClose, onSave, busy }: { onClose: () => void; onSave: (f: { email: string; full_name: string; phone: string }) => void; busy: boolean }) {
  const [email, setEmail] = useState("");
  const [full_name, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-md" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
          <span style={{ fontFamily: "var(--font-display)" }}>Nieuwe klant</span>
          <button onClick={onClose} style={{ color: "var(--gold)" }}>✕</button>
        </div>
        <div className="px-4 py-4 space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>E-mail</span>
            <input className="field-y" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Volledige naam</span>
            <input className="field-y" value={full_name} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Telefoon</span>
            <input className="field-y" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <button onClick={() => onSave({ email, full_name, phone })} disabled={busy || !email} className="btn-y-solid w-full mt-2">
            {busy ? "Versturen…" : "Stuur inloglink"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({ profile, onClose, onSave, busy }: {
  profile: Profile;
  onClose: () => void;
  onSave: (f: { full_name: string; phone: string; email: string }) => void;
  busy: boolean;
}) {
  const [full_name, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-md" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
          <span style={{ fontFamily: "var(--font-display)" }}>Klant bewerken</span>
          <button onClick={onClose} style={{ color: "var(--gold)" }}>✕</button>
        </div>
        <div className="px-4 py-4 space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Volledige naam</span>
            <input className="field-y" value={full_name} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Telefoon</span>
            <input className="field-y" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>E-mail</span>
            <input className="field-y" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button onClick={() => onSave({ full_name, phone, email })} disabled={busy} className="btn-y-solid w-full mt-2">
            {busy ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}