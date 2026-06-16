// Database webhook target. Sends Resend emails for app events.
// NOT callable anonymously — caller must present matching `x-webhook-secret`
// header (verified via SECURITY DEFINER RPC against Vault).
//
// Handles the following triggers:
//   phase_updates INSERT          → customer: new update
//   project_phases UPDATE status  → customer: phase started / phase done / project completed
//   projects INSERT               → customer: welcome to project
//   projects UPDATE status        → customer: project completed (delivered)
//   quote_requests INSERT         → customer: aanvraag ontvangen + admin: nieuwe aanvraag
//   quotes UPDATE status          → customer: bevestiging + admin: status update
//   messages INSERT (klant)       → admin: nieuw klantbericht
//   messages INSERT (baram)       → customer: nieuw bericht van Baram
//   update_reactions INSERT       → admin: nieuwe reactie
//   profiles INSERT               → admin: nieuwe klant geregistreerd
//
// Failures are logged to public.notify_event_failures.
import { renderEmail, renderPlainText, escapeHtml, type EmailLayoutOpts, type Locale } from "../_shared/email-template.ts";
import * as copy from "../_shared/email-copy.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Yeketi Motorworks <info@yeketimotorworks.com>";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://yeketimotorworks.com";
const REPLY_TO_FALLBACK = Deno.env.get("REPLY_TO_EMAIL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function verifyWebhookSecret(provided: string): Promise<boolean> {
  if (!provided) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_webhook_secret`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provided }),
    });
    if (!r.ok) { console.error("verify_webhook_secret RPC", r.status, await r.text()); return false; }
    return (await r.json()) === true;
  } catch (e) {
    console.error("verify_webhook_secret error", e);
    return false;
  }
}

async function sendEmail(opts: { to: string; subject: string; html: string; text?: string; replyTo?: string }) {
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY not set; skipping send"); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      reply_to: opts.replyTo || REPLY_TO_FALLBACK || "info@yeketimotorworks.com",
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Resend error", res.status, text);
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

// Admin/internal send — Dutch, no portal-reply notice.
function sendAdmin(to: string, subject: string, layout: EmailLayoutOpts) {
  const merged: EmailLayoutOpts = { ...layout, locale: "nl", isCustomer: false };
  return sendEmail({ to, subject, html: renderEmail(merged), text: renderPlainText(merged) });
}

// Customer send — uses a localized layout from email-copy and routes any
// stray reply to the admin notify address (kept out of the no-reply void).
async function sendCustomer(to: string, layout: { subject: string } & EmailLayoutOpts) {
  const replyTo = (await resolveAdminNotifyEmail()) || REPLY_TO_FALLBACK || "info@yeketimotorworks.com";
  const merged: EmailLayoutOpts = { ...layout, isCustomer: true };
  return sendEmail({ to, subject: layout.subject, replyTo, html: renderEmail(merged), text: renderPlainText(merged) });
}

async function fetchProfileLocale(profileId: string | null | undefined): Promise<Locale> {
  if (!profileId) return "nl";
  try {
    const rows = await sbFetch(`profiles?id=eq.${profileId}&select=locale`);
    const l = rows?.[0]?.locale;
    return l === "en" ? "en" : "nl";
  } catch { return "nl"; }
}
async function fetchLocaleByEmail(email: string): Promise<Locale> {
  if (!email) return "nl";
  try {
    const rows = await sbFetch(`profiles?email=eq.${encodeURIComponent(email.toLowerCase())}&select=locale`);
    const l = rows?.[0]?.locale;
    return l === "en" ? "en" : "nl";
  } catch { return "nl"; }
}

async function sbFetch(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function resolveAdminNotifyEmail(): Promise<string> {
  try {
    const rows = await sbFetch(`app_settings?key=eq.admin_notify_email&select=value`);
    const v = rows?.[0]?.value;
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch (e) {
    console.warn("resolveAdminNotifyEmail fallback", (e as Error).message);
  }
  return ADMIN_NOTIFY_EMAIL;
}

async function logFailure(eventType: string, payload: unknown, errorMessage: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/notify_event_failures`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: eventType,
        source: "edge",
        payload_summary: payload,
        error_message: errorMessage.slice(0, 2000),
      }),
    });
  } catch (e) {
    console.error("notify_event_failures insert failed", e);
  }
}

function firstName(full: string | null | undefined): string | null {
  if (!full) return null;
  const t = String(full).trim();
  if (!t) return null;
  return t.split(/\s+/)[0];
}

function vehicleLabel(p: { vehicle_make?: unknown; vehicle_model?: unknown; title?: unknown }): string {
  return [p.vehicle_make, p.vehicle_model].filter(Boolean).join(" ") || String(p.title ?? "");
}

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function projectPortalUrl(projectId: string): string {
  return `${PUBLIC_SITE_URL}/portaal/${projectId}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!(await verifyWebhookSecret(provided))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { type: string; table?: string; record?: Record<string, unknown>; old_record?: Record<string, unknown> };
  try { body = await req.json(); } catch (e) {
    await logFailure("unknown", null, `Bad JSON body: ${(e as Error).message}`);
    return new Response("Bad Request", { status: 400 });
  }

  try {
    // ===== phase_updates INSERT → customer: new update =====
    if (body.table === "phase_updates" && body.type === "INSERT" && body.record) {
      const phaseId = body.record.phase_id as string;
      const updateBody = (body.record.body as string) ?? "";
      const phases = await sbFetch(`project_phases?id=eq.${phaseId}&select=name,project_id`);
      const phase = phases[0]; if (!phase) return new Response("ok");
      const projects = await sbFetch(`projects?id=eq.${phase.project_id}&select=title,vehicle_make,vehicle_model,customer_id`);
      const project = projects[0]; if (!project) return new Response("ok");
      const profiles = await sbFetch(`profiles?id=eq.${project.customer_id}&select=email,full_name`);
      const profile = profiles[0]; if (!profile?.email) return new Response("ok");
      const vehicle = vehicleLabel(project);
      const first = firstName(profile.full_name);
      const preview = updateBody.length > 160 ? updateBody.slice(0, 160) + "…" : updateBody;
      try {
        await send(profile.email, `Nieuwe update — ${vehicle}`, {
          preheader: `Update in fase ${phase.name}`,
          eyebrow: `Update · ${phase.name}`,
          headline: `Een nieuwe update voor je ${vehicle}`,
          intro: `${first ? `Hoi ${first}, ` : ""}er staat een verse update klaar in je portaal.`,
          bodyHtml: preview ? `<p style="margin:0 0 18px;padding:14px 16px;background:#F7F3EC;border-left:3px solid #B0832C;font-style:italic;color:#221F1B;">${escapeHtml(preview)}</p>` : undefined,
          cta: { label: "Bekijk de update", url: projectPortalUrl(phase.project_id) },
        });
      } catch (e) {
        await logFailure("phase_updates", { phase_id: phaseId, to: profile.email }, (e as Error).message);
      }
    }

    // ===== project_phases UPDATE status → phase started / phase done =====
    if (body.table === "project_phases" && body.type === "UPDATE" && body.record) {
      const r = body.record; const old = body.old_record ?? {};
      const newStatus = String(r.status ?? ""); const prevStatus = String(old.status ?? "");
      if (newStatus !== prevStatus && (newStatus === "active" || newStatus === "done")) {
        const projects = await sbFetch(`projects?id=eq.${r.project_id}&select=title,vehicle_make,vehicle_model,customer_id`);
        const project = projects[0]; if (!project) return new Response("ok");
        const profiles = await sbFetch(`profiles?id=eq.${project.customer_id}&select=email,full_name`);
        const profile = profiles[0]; if (!profile?.email) return new Response("ok");
        const vehicle = vehicleLabel(project);
        const first = firstName(profile.full_name);
        const phaseName = String(r.name ?? "deze fase");
        try {
          if (newStatus === "active") {
            await send(profile.email, `Nieuwe fase gestart — ${vehicle}`, {
              preheader: `We zijn begonnen aan ${phaseName}`,
              eyebrow: "Volgende fase",
              headline: `We zijn begonnen aan ${phaseName}`,
              intro: `${first ? `Hoi ${first}, ` : ""}een nieuwe fase van je ${vehicle} is gestart. We houden je op de hoogte met updates en foto's vanuit de werkplaats.`,
              cta: { label: "Volg je project", url: projectPortalUrl(String(r.project_id)) },
            });
          } else {
            await send(profile.email, `${phaseName} is afgerond — ${vehicle}`, {
              preheader: `${phaseName} is afgerond`,
              eyebrow: "Fase voltooid",
              headline: `${phaseName} is afgerond`,
              intro: `${first ? `Hoi ${first}, ` : ""}we zijn klaar met ${phaseName} aan je ${vehicle}. De volgende stap wordt binnenkort opgestart — je leest het hier eerst.`,
              cta: { label: "Bekijk in je portaal", url: projectPortalUrl(String(r.project_id)) },
            });
          }
        } catch (e) {
          await logFailure("project_phases", { project_id: r.project_id, status: newStatus }, (e as Error).message);
        }
      }
    }

    // ===== projects INSERT → customer: welcome to project =====
    if (body.table === "projects" && body.type === "INSERT" && body.record) {
      const p = body.record;
      const profiles = await sbFetch(`profiles?id=eq.${p.customer_id}&select=email,full_name`);
      const profile = profiles[0]; if (!profile?.email) return new Response("ok");
      const vehicle = vehicleLabel(p);
      const first = firstName(profile.full_name);
      try {
        await send(profile.email, `Welkom op je project — ${vehicle}`, {
          preheader: `Je project ${vehicle} is aangemaakt`,
          eyebrow: "Welkom",
          headline: `Welkom op je project, ${first ?? "en bedankt voor je vertrouwen"}`,
          intro: `Je ${vehicle} heeft een eigen pagina in je portaal. Vanaf hier volg je elke fase van de restauratie — met foto's, updates en de mogelijkheid om rechtstreeks te reageren.`,
          bodyHtml: `<p style="margin:0 0 8px;">We nemen de tijd die het werk vraagt. Elk groot moment — een nieuwe fase, een voltooide stap, een vraag — komt hier binnen.</p>`,
          cta: { label: "Volg je restauratie", url: projectPortalUrl(String(p.id)) },
        });
      } catch (e) {
        await logFailure("projects_insert", { project_id: p.id, to: profile.email }, (e as Error).message);
      }
    }

    // ===== projects UPDATE status → delivered (project completed showcase) =====
    if (body.table === "projects" && body.type === "UPDATE" && body.record) {
      const p = body.record; const old = body.old_record ?? {};
      const newStatus = String(p.status ?? ""); const prevStatus = String(old.status ?? "");
      if (newStatus === "delivered" && prevStatus !== "delivered") {
        const profiles = await sbFetch(`profiles?id=eq.${p.customer_id}&select=email,full_name`);
        const profile = profiles[0]; if (!profile?.email) return new Response("ok");
        const vehicle = vehicleLabel(p);
        const first = firstName(profile.full_name);
        try {
          await send(profile.email, `Je ${vehicle} is klaar`, {
            preheader: `Een nieuw hoofdstuk voor je ${vehicle}`,
            eyebrow: "Project voltooid",
            headline: `Je ${vehicle} is klaar`,
            intro: `${first ? `${first}, ` : ""}vandaag sluiten we het werk af. Een lange reis van demontage, lassen, plamuren, lakken en honderden kleine beslissingen — en nu is hij van jou.`,
            bodyHtml: `
              <p style="margin:0 0 14px;">Je portaal blijft staan als een album: elke foto, elke update, elk moment uit de werkplaats. Geen project meer in uitvoering — een verhaal dat je kan herlezen wanneer je wil.</p>
              <p style="margin:0;color:#B0832C;font-family:Georgia,'Times New Roman',serif;font-style:italic;">Bedankt voor het vertrouwen.</p>`,
            cta: { label: "Bekijk je project", url: projectPortalUrl(String(p.id)) },
          });
        } catch (e) {
          await logFailure("project_completed", { project_id: p.id }, (e as Error).message);
        }
      }
    }

    // ===== quote_requests INSERT → admin alert + customer confirmation =====
    if (body.table === "quote_requests" && body.type === "INSERT" && body.record) {
      const r = body.record;
      const vehicle = [r.merk, r.model, r.bouwjaar].filter(Boolean).join(" ") || (r.type_werk as string) || "onbekend voertuig";
      const naam = String(r.naam ?? "");
      const email = String(r.email ?? "");

      // Customer confirmation (I #15)
      if (email) {
        try {
          await send(email, `Je aanvraag is binnen — ${vehicle}`, {
            preheader: "We hebben je offerteaanvraag goed ontvangen",
            eyebrow: "Aanvraag ontvangen",
            headline: `Bedankt ${firstName(naam) ?? "voor je aanvraag"}`,
            intro: `We hebben je aanvraag voor je ${vehicle} goed ontvangen. Baram bekijkt elk dossier persoonlijk en neemt binnen enkele werkdagen contact op met een voorstel — of een paar vragen om de scope scherp te krijgen.`,
            bodyHtml: `<p style="margin:0;">In tussentijd hoef je niets te doen. Een antwoord op deze mail komt rechtstreeks bij ons binnen.</p>`,
            secondaryCta: { label: "yeketimotorworks.com", url: PUBLIC_SITE_URL },
          });
        } catch (e) {
          await logFailure("quote_request_customer_ack", { id: r.id, to: email }, (e as Error).message);
        }
      }

      // Admin alert (M #19)
      const adminTo = await resolveAdminNotifyEmail();
      if (adminTo) {
        const rows: Array<[string, string]> = [
          ["Naam", naam], ["E-mail", email], ["Telefoon", String(r.telefoon ?? "—")],
          ["Merk", String(r.merk ?? "—")], ["Model", String(r.model ?? "—")], ["Bouwjaar", String(r.bouwjaar ?? "—")],
          ["Type werk", String(r.type_werk ?? "—")], ["Beschrijving", String(r.beschrijving ?? "—")],
        ];
        const detailsHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6B6459;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#221F1B;">${escapeHtml(v).replace(/\n/g, "<br/>")}</td></tr>`).join("")}</table>`;
        try {
          await send(adminTo, `Nieuwe offerteaanvraag — ${vehicle} (${naam})`, {
            eyebrow: "Admin · aanvraag",
            headline: `Nieuwe aanvraag van ${naam}`,
            bodyHtml: detailsHtml,
            cta: { label: "Open in admin", url: `${PUBLIC_SITE_URL}/admin/offertes` },
          });
        } catch (e) {
          await logFailure("quote_requests", { id: r.id, naam, email }, (e as Error).message);
        }
      }
    }

    // ===== quotes UPDATE → admin alert + customer confirmation on response =====
    if (body.table === "quotes" && body.type === "UPDATE" && body.record) {
      const r = body.record as Record<string, unknown>;
      const status = String(r.status ?? "");
      const old = (body.old_record ?? {}) as Record<string, unknown>;
      const prevStatus = String(old.status ?? "");
      const quoteNumber = String(r.quote_number ?? "");
      const title = String(r.title ?? "");
      const total = Number(r.total_amount ?? 0);
      const totalStr = eur(total);
      const portalUrl = `${PUBLIC_SITE_URL}/portaal/offerte/${r.id}`;
      const adminUrl = `${PUBLIC_SITE_URL}/admin/quotes/${r.id}`;
      try {
        if (prevStatus === "verstuurd" && (status === "akkoord" || status === "afgewezen")) {
          const accepted = status === "akkoord";

          // Admin alert
          const adminTo = await resolveAdminNotifyEmail();
          if (adminTo) {
            const reason = String(r.response_reason ?? "").trim();
            await send(adminTo, accepted
              ? `Offerte ${quoteNumber} geaccepteerd — ${title}`
              : `Offerte ${quoteNumber} afgewezen — ${title}`, {
              eyebrow: accepted ? "Admin · geaccepteerd" : "Admin · afgewezen",
              headline: accepted ? `Offerte ${quoteNumber} geaccepteerd` : `Offerte ${quoteNumber} afgewezen`,
              intro: accepted
                ? `${title} (${totalStr}) is goedgekeurd door de klant. Tijd om een project aan te maken en de klant te bellen.`
                : `${title} (${totalStr}) werd afgewezen.`,
              bodyHtml: !accepted && reason ? `<p style="margin:0;padding:14px 16px;background:#F7F3EC;border-left:3px solid #B0832C;font-style:italic;">${escapeHtml(reason)}</p>` : undefined,
              cta: { label: "Open in admin", url: adminUrl },
            });
          }

          // Customer confirmation (L #18)
          if (r.customer_id) {
            const profiles = await sbFetch(`profiles?id=eq.${r.customer_id}&select=email,full_name`);
            const profile = profiles[0];
            if (profile?.email) {
              const first = firstName(profile.full_name);
              await send(profile.email, accepted
                ? `Bevestiging — offerte ${quoteNumber} aanvaard`
                : `Bevestiging — offerte ${quoteNumber} geweigerd`, {
                eyebrow: accepted ? "Bevestiging" : "Bevestiging",
                headline: accepted
                  ? "Bedankt voor je akkoord"
                  : "We hebben je antwoord goed ontvangen",
                intro: accepted
                  ? `${first ? `${first}, ` : ""}we noteren je akkoord op offerte ${quoteNumber} (${totalStr}). Baram neemt binnen enkele dagen contact op om de planning en het transport vast te leggen.`
                  : `${first ? `${first}, ` : ""}geen probleem — we noteren je beslissing over offerte ${quoteNumber}. Als er iets verandert of als je over een ander voertuig wil praten, weet je ons te vinden.`,
                cta: { label: "Open in je portaal", url: portalUrl },
              });
            }
          }
        }
      } catch (e) {
        await logFailure("quotes", { id: r.id, status, prev: prevStatus }, (e as Error).message);
      }
    }

    // ===== update_reactions INSERT → admin alert (from customer) =====
    if (body.table === "update_reactions" && body.type === "INSERT" && body.record) {
      const adminTo = await resolveAdminNotifyEmail();
      if (!adminTo) return new Response("ok");
      const r = body.record as Record<string, unknown>;
      const phaseUpdateId = String(r.phase_update_id ?? "");
      const authorId = String(r.author_id ?? "");
      const reactionBody = String(r.body ?? "");
      try {
        const roles = await sbFetch(`user_roles?user_id=eq.${authorId}&role=eq.admin&select=user_id`);
        if (Array.isArray(roles) && roles.length > 0) return new Response("ok");
        const updates = await sbFetch(`phase_updates?id=eq.${phaseUpdateId}&select=phase_id,body`);
        const update = updates[0]; if (!update) return new Response("ok");
        const phases = await sbFetch(`project_phases?id=eq.${update.phase_id}&select=name,project_id`);
        const phase = phases[0]; if (!phase) return new Response("ok");
        const projects = await sbFetch(`projects?id=eq.${phase.project_id}&select=id,title,vehicle_make,vehicle_model`);
        const project = projects[0]; if (!project) return new Response("ok");
        const profiles = await sbFetch(`profiles?id=eq.${authorId}&select=full_name,email`);
        const profile = profiles[0] ?? {};
        const vehicle = vehicleLabel(project);
        const who = profile.full_name || profile.email || "Een klant";
        const preview = reactionBody.length > 240 ? reactionBody.slice(0, 240) + "…" : reactionBody;
        await send(adminTo, `Nieuwe reactie — ${vehicle}`, {
          eyebrow: "Admin · reactie",
          headline: `${who} reageerde op ${vehicle}`,
          intro: `Een nieuwe reactie in fase "${phase.name}".`,
          bodyHtml: `<p style="margin:0;padding:14px 16px;background:#F7F3EC;border-left:3px solid #B0832C;font-style:italic;">${escapeHtml(preview)}</p>`,
          cta: { label: "Antwoord in admin", url: `${PUBLIC_SITE_URL}/admin/projecten/${project.id}` },
        });
      } catch (e) {
        await logFailure("update_reactions", { phase_update_id: phaseUpdateId, author_id: authorId }, (e as Error).message);
      }
    }

    // ===== messages INSERT → admin (klant) OR customer (admin) =====
    if (body.table === "messages" && body.type === "INSERT" && body.record) {
      const r = body.record as Record<string, unknown>;
      const sender = String(r.sender ?? "");
      const conversationId = String(r.conversation_id ?? "");
      const msgBody = String(r.body ?? "");

      if (sender === "klant") {
        const adminTo = await resolveAdminNotifyEmail();
        if (!adminTo) return new Response("ok");
        const authorId = String(r.author_id ?? "");
        try {
          const convos = await sbFetch(`conversations?id=eq.${conversationId}&select=subject,contact_profile_id`);
          const conv = convos[0]; if (!conv) return new Response("ok");
          const profiles = await sbFetch(`profiles?id=eq.${authorId || conv.contact_profile_id}&select=full_name,email`);
          const profile = profiles[0] ?? {};
          const who = profile.full_name || profile.email || "Een klant";
          const subject = conv.subject || "Nieuw bericht";
          const preview = msgBody.length > 260 ? msgBody.slice(0, 260) + "…" : msgBody;
          await send(adminTo, `Nieuw bericht — ${who}`, {
            eyebrow: "Admin · bericht",
            headline: `Nieuw bericht van ${who}`,
            intro: subject,
            bodyHtml: `<p style="margin:0;padding:14px 16px;background:#F7F3EC;border-left:3px solid #B0832C;font-style:italic;">${escapeHtml(preview)}</p>`,
            cta: { label: "Antwoord in admin", url: `${PUBLIC_SITE_URL}/admin/berichten/${conversationId}` },
          });
        } catch (e) {
          await logFailure("conversation_message", { conversation_id: conversationId }, (e as Error).message);
        }
      } else if (sender === "baram") {
        // Notify the customer (H #13)
        try {
          const convos = await sbFetch(`conversations?id=eq.${conversationId}&select=subject,contact_profile_id`);
          const conv = convos[0]; if (!conv?.contact_profile_id) return new Response("ok");
          const profiles = await sbFetch(`profiles?id=eq.${conv.contact_profile_id}&select=full_name,email`);
          const profile = profiles[0]; if (!profile?.email) return new Response("ok");
          const first = firstName(profile.full_name);
          const subject = conv.subject || "Nieuw bericht";
          const preview = msgBody.length > 260 ? msgBody.slice(0, 260) + "…" : msgBody;
          await send(profile.email, `Nieuw bericht van Baram`, {
            preheader: subject,
            eyebrow: "Bericht",
            headline: `${first ? `${first}, ` : ""}Baram heeft je een bericht gestuurd`,
            intro: subject,
            bodyHtml: `<p style="margin:0 0 12px;padding:14px 16px;background:#F7F3EC;border-left:3px solid #B0832C;font-style:italic;color:#221F1B;">${escapeHtml(preview)}</p>`,
            cta: { label: "Reageren", url: `${PUBLIC_SITE_URL}/portaal/berichten` },
          });
        } catch (e) {
          await logFailure("conversation_message_to_customer", { conversation_id: conversationId }, (e as Error).message);
        }
      }
    }

    // ===== profiles INSERT → admin: nieuwe klant geregistreerd (M #22) =====
    if (body.table === "profiles" && body.type === "INSERT" && body.record) {
      const adminTo = await resolveAdminNotifyEmail();
      if (!adminTo) return new Response("ok");
      const p = body.record;
      const naam = String(p.full_name ?? p.email ?? "een nieuwe klant");
      const email = String(p.email ?? "—");
      try {
        await send(adminTo, `Nieuwe klant geregistreerd — ${naam}`, {
          eyebrow: "Admin · nieuwe klant",
          headline: `${naam} heeft een account aangemaakt`,
          intro: `Er is een nieuwe klant geregistreerd via het portaal.`,
          bodyHtml: `<p style="margin:0;"><strong>E-mail:</strong> ${escapeHtml(email)}</p>`,
          cta: { label: "Open klanten", url: `${PUBLIC_SITE_URL}/admin/klanten` },
        });
      } catch (e) {
        await logFailure("profiles_insert", { id: p.id, email }, (e as Error).message);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    await logFailure(body?.table ?? "unknown", body?.record ?? null, (e as Error).message);
    return new Response(`Error: ${(e as Error).message}`, { status: 500 });
  }
});
