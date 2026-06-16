import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell, statusBadge } from "@/components/AdminShell";
import { listCustomers, inviteCustomer, resendInvite, deleteCustomer } from "@/lib/admin.functions";
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
  const remove = useServerFn(deleteCustomer);
  const openConv = useServerFn(findOrCreateConversationForContact);
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);
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

  async function onRemove() {
    if (!removing) return;
    if (removeConfirm.trim().toUpperCase() !== "VERWIJDER KLANT") {
      alert("Typ exact: VERWIJDER KLANT");
      return;
    }
    setRemoveBusy(true);
    try {
      await remove({ data: { userId: removing.id, confirm: "VERWIJDER KLANT" } });
      setRemoving(null); setRemoveConfirm(""); load();
    } catch (e: unknown) { alert((e as Error).message ?? "Fout"); }
    finally { setRemoveBusy(false); }
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
              <li key={p.id} style={{ border: "1px solid var(--charcoal)", background: "var(--cream)" }}>
                <div className="px-4 pt-4 pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                        {p.full_name || p.email}
                      </div>
                      <div className="mt-1 text-xs truncate" style={{ color: "var(--charcoal-soft)", letterSpacing: "0.04em" }}>
                        {p.email}{p.phone ? ` · ${p.phone}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:shrink-0">
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
                        style={{ color: "var(--brass)" }}
                      >
                        Bewerken
                      </button>
                      {p.email && (
                        <button
                          onClick={() => onResend(p.email!)}
                          disabled={busy === p.email}
                          className="text-[11px] uppercase tracking-[0.18em] whitespace-nowrap"
                          style={{ color: "var(--charcoal-soft)" }}
                        >
                          {busy === p.email ? "…" : "Stuur link"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {pr.length > 0 && (
                  <>
                    <div className="hairline opacity-40" />
                    <ul className="px-4 py-3 space-y-1.5">
                      {pr.map((x) => {
                        const b = statusBadge(x.status);
                        return (
                          <li key={x.id}>
                            <Link
                              to="/admin/projecten/$id" params={{ id: x.id }}
                              className="flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors"
                              style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSave={onInvite} busy={busy === "invite"} />}
      {editing && (
        <EditCustomerModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSave={onEditSave}
          onDelete={(p) => { setEditing(null); setRemoving(p); setRemoveConfirm(""); }}
          busy={busy === "edit"}
        />
      )}
      {removing && (
        <DeleteCustomerModal
          profile={removing}
          projectCount={projects.filter((x) => x.customer_id === removing.id).length}
          confirm={removeConfirm}
          setConfirm={setRemoveConfirm}
          busy={removeBusy}
          onClose={() => { setRemoving(null); setRemoveConfirm(""); }}
          onConfirm={onRemove}
        />
      )}
    </AdminShell>
  );
}

function InviteModal({ onClose, onSave, busy }: { onClose: () => void; onSave: (f: { email: string; full_name: string; phone: string }) => void; busy: boolean }) {
  const [email, setEmail] = useState("");
  const [full_name, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-20 lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
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

function DeleteCustomerModal({ profile, projectCount, confirm, setConfirm, busy, onClose, onConfirm }: {
  profile: Profile;
  projectCount: number;
  confirm: string;
  setConfirm: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ok = confirm.trim().toUpperCase() === "VERWIJDER KLANT";
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-20 lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "var(--cream)", border: "2px solid var(--oxide)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--oxide)", color: "var(--cream)" }}>
          <span style={{ fontFamily: "var(--font-display)" }}>Klant volledig verwijderen</span>
          <button onClick={onClose} style={{ color: "var(--cream)" }}>✕</button>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-xl leading-none" style={{ color: "var(--oxide)" }}>⚠</span>
            <div className="text-sm" style={{ color: "var(--charcoal)", lineHeight: 1.6 }}>
              Je staat op het punt om <strong>{profile.full_name || profile.email}</strong> volledig uit het systeem te verwijderen.
              Dit verwijdert: het account (login), het profiel,
              {projectCount > 0 ? <> <strong>{projectCount} project{projectCount === 1 ? "" : "en"}</strong> met alle fasen, updates en foto's,</> : null}
              {" "}alle conversaties en berichten, en alle reacties.
              Verzonden offertes blijven bewaard zonder klantkoppeling voor de boekhouding.
              Deze actie is <strong>definitief en onomkeerbaar</strong>.
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--oxide)" }}>
              Typ ter bevestiging: <strong>VERWIJDER KLANT</strong>
            </span>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field-y mt-2 w-full"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || !ok}
              className="btn-y-solid"
              style={{ background: "var(--oxide)", borderColor: "var(--oxide)" }}
            >
              {busy ? "Bezig…" : "Definitief verwijderen"}
            </button>
            <button type="button" onClick={onClose} className="btn-y-ghost">Annuleren</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({ profile, onClose, onSave, onDelete, busy }: {
  profile: Profile;
  onClose: () => void;
  onSave: (f: { full_name: string; phone: string; email: string }) => void;
  onDelete: (p: Profile) => void;
  busy: boolean;
}) {
  const [full_name, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-20 lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
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
          <div className="hairline opacity-25" />
          <button
            type="button"
            onClick={() => onDelete(profile)}
            className="w-full text-[11px] uppercase tracking-[0.2em] text-center py-2"
            style={{ color: "var(--oxide)" }}
          >
            Verwijder klant
          </button>
        </div>
      </div>
    </div>
  );
}