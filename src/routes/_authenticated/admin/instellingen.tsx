import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { getAdminNotifySettings, setAdminNotifyEmail } from "@/lib/messages.functions";
import { inviteAdmin, listAdmins, removeAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/instellingen")({
  head: () => ({ meta: [{ title: "Instellingen — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Instellingen,
});

function Instellingen() {
  const load = useServerFn(getAdminNotifySettings);
  const save = useServerFn(setAdminNotifyEmail);
  const [email, setEmail] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  useEffect(() => {
    load().then((r) => {
      setEmail(r.notifyEmail ?? "");
      setFallback(r.fallback);
      setLoading(false);
    });
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(null);
    try {
      await save({ data: { email: email.trim() ? email.trim() : null } });
      setSaved("ok");
    } catch {
      setSaved("err");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(null), 3000);
    }
  }

  return (
    <AdminShell title="Instellingen">
      <section className="container-edit pb-12 max-w-xl">
        <p className="eyebrow" style={{ color: "var(--brass)" }}>Persoonlijke alerts</p>
        <h2 className="mt-3" style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
          Notificatie-e-mail
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
          Het adres waarop je persoonlijke meldingen wilt ontvangen — nieuwe berichten, offerteaanvragen
          en reacties van klanten. Dit is gescheiden van het publieke <code>info@</code>-adres dat klanten
          zien.
        </p>

        {loading ? (
          <div className="mt-6 h-24" style={{ background: "var(--cream-deep)", border: "1px solid var(--charcoal)" }} />
        ) : (
          <form onSubmit={onSave} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>
                Alert-adres
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={fallback || "baram@…"}
                className="field-y mt-2 w-full"
              />
              {fallback && !email && (
                <span className="block mt-2 text-[11px]" style={{ color: "var(--charcoal-soft)" }}>
                  Standaard wordt <strong>{fallback}</strong> gebruikt.
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-y-solid">
                {saving ? "Opslaan…" : "Opslaan"}
              </button>
              {saved === "ok" && (
                <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--brass)" }}>
                  Opgeslagen
                </span>
              )}
              {saved === "err" && (
                <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--oxide)" }}>
                  Mislukt
                </span>
              )}
            </div>
          </form>
        )}
      </section>
      <AdminInviteSection />
    </AdminShell>
  );
}

const CONFIRM_PHRASE = "IK WIL EEN ADMIN UITNODIGEN";

function AdminInviteSection() {
  const invite = useServerFn(inviteAdmin);
  const load = useServerFn(listAdmins);
  const remove = useServerFn(removeAdmin);
  const [admins, setAdmins] = useState<{ id: string; email: string | null; full_name: string | null }[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    load().then((r) => { setAdmins(r.admins); setMe(r.currentUserId); }).catch(() => {});
  }, [load]);

  function refresh() {
    load().then((r) => { setAdmins(r.admins); setMe(r.currentUserId); }).catch(() => {});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirm.trim().toUpperCase() !== CONFIRM_PHRASE) {
      setMsg({ kind: "err", text: `Typ exact: ${CONFIRM_PHRASE}` });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await invite({ data: { email: email.trim(), full_name: name.trim() || undefined, confirm: CONFIRM_PHRASE } });
      setMsg({ kind: "ok", text: `Admin-uitnodiging verstuurd naar ${r.email} (${r.channel === "reset" ? "wachtwoord-reset" : "nieuwe uitnodiging"})` });
      setEmail(""); setName(""); setConfirm(""); setOpen(false);
      refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Mislukt" });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!removing) return;
    if (removeConfirm.trim().toUpperCase() !== "VERWIJDER ADMIN") {
      setMsg({ kind: "err", text: "Typ exact: VERWIJDER ADMIN" });
      return;
    }
    setRemoveBusy(true);
    setMsg(null);
    try {
      await remove({ data: { userId: removing.id, confirm: "VERWIJDER ADMIN" } });
      setMsg({ kind: "ok", text: `Admin-toegang ingetrokken voor ${removing.label}` });
      setRemoving(null); setRemoveConfirm("");
      refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Mislukt" });
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <section className="container-edit pb-16 max-w-xl">
      <p className="eyebrow" style={{ color: "var(--brass)" }}>Team</p>
      <h2 className="mt-3" style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
        Admins
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
        Mensen met admin-toegang kunnen <strong>alles</strong> zien en bewerken — klanten, projecten, offertes
        en berichten. Nodig hier dus alléén echte teamleden uit, nooit klanten. Klanten nodig je uit via de
        pagina <em>Klanten</em>.
      </p>

      <ul className="mt-5 divide-y" style={{ borderTop: "1px solid var(--charcoal)", borderBottom: "1px solid var(--charcoal)" }}>
        {admins.map((a) => (
          <li key={a.id} className="py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm" style={{ color: "var(--charcoal)" }}>{a.full_name || "—"}</div>
              <div className="text-[11px]" style={{ color: "var(--charcoal-soft)" }}>{a.email || a.id}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {a.id === me ? (
                <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>Jij</span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setRemoving({ id: a.id, label: a.full_name || a.email || a.id }); setRemoveConfirm(""); setMsg(null); }}
                  className="text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: "var(--oxide)" }}
                >
                  Verwijder
                </button>
              )}
              <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-1" style={{ color: "var(--brass)", border: "1px solid var(--brass)" }}>Admin</span>
            </div>
          </li>
        ))}
        {admins.length === 0 && (
          <li className="py-3 text-sm" style={{ color: "var(--charcoal-soft)" }}>Nog geen admins geladen.</li>
        )}
      </ul>

      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setMsg(null); }}
          className="btn-y-ghost mt-6"
        >
          + Admin uitnodigen
        </button>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4 p-5" style={{ background: "var(--cream-deep)", border: "2px solid var(--oxide)" }}>
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-xl leading-none" style={{ color: "var(--oxide)" }}>⚠</span>
            <div className="text-sm" style={{ color: "var(--charcoal)", lineHeight: 1.6 }}>
              <strong>Let op — admin, geen klant.</strong> Deze persoon krijgt volledige toegang tot
              alle gegevens van Yeketi Motorworks. Gebruik dit formulier <strong>nooit</strong> voor
              klanten. Voor klanten ga je naar <em>Klanten → Klant uitnodigen</em>.
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>Naam (optioneel)</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="field-y mt-2 w-full" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>E-mailadres admin</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field-y mt-2 w-full" placeholder="naam@yeketimotorworks.com" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--oxide)" }}>
              Typ ter bevestiging: <strong>{CONFIRM_PHRASE}</strong>
            </span>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field-y mt-2 w-full"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={busy || confirm.trim().toUpperCase() !== CONFIRM_PHRASE || !email.trim()}
              className="btn-y-solid"
              style={{ background: "var(--oxide)", borderColor: "var(--oxide)" }}
            >
              {busy ? "Versturen…" : "Admin uitnodigen"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setConfirm(""); setMsg(null); }} className="btn-y-ghost">
              Annuleren
            </button>
          </div>
        </form>
      )}

      {msg && (
        <p className="mt-3 text-[12px]" style={{ color: msg.kind === "ok" ? "var(--brass)" : "var(--oxide)" }}>
          {msg.text}
        </p>
      )}

      {removing && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-20 lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
          <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "var(--cream)", border: "2px solid var(--oxide)" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--oxide)", color: "var(--cream)" }}>
              <span style={{ fontFamily: "var(--font-display)" }}>Admin volledig verwijderen</span>
              <button onClick={() => { setRemoving(null); setRemoveConfirm(""); }} style={{ color: "var(--cream)" }}>✕</button>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="text-xl leading-none" style={{ color: "var(--oxide)" }}>⚠</span>
                <div className="text-sm" style={{ color: "var(--charcoal)", lineHeight: 1.6 }}>
                  Je staat op het punt om <strong>{removing.label}</strong> volledig uit het systeem te verwijderen.
                  Dit verwijdert: het volledige account (login), het profiel,
                  alle admin-rollen en alle actieve sessies. Deze actie is
                  <strong> definitief en onomkeerbaar</strong>.
                  <div className="mt-2 text-[12px]" style={{ color: "var(--oxide)" }}>
                    Veiligheid: als deze gebruiker ook projecten of offertes op
                    naam heeft, weigert het systeem de verwijdering – ruim die
                    dan eerst op.
                  </div>
                </div>
              </div>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--oxide)" }}>
                  Typ ter bevestiging: <strong>VERWIJDER ADMIN</strong>
                </span>
                <input
                  type="text"
                  value={removeConfirm}
                  onChange={(e) => setRemoveConfirm(e.target.value)}
                  className="field-y mt-2 w-full"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={removeBusy || removeConfirm.trim().toUpperCase() !== "VERWIJDER ADMIN"}
                  className="btn-y-solid"
                  style={{ background: "var(--oxide)", borderColor: "var(--oxide)" }}
                >
                  {removeBusy ? "Bezig…" : "Definitief verwijderen"}
                </button>
                <button type="button" onClick={() => { setRemoving(null); setRemoveConfirm(""); }} className="btn-y-ghost">
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}