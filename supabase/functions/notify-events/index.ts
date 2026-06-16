// Database webhook target. Sends Resend emails for new phase updates and new
// quote requests. NOT callable anonymously — caller must present the matching
// `x-webhook-secret` header. Configured to run with verify_jwt = false because
// the DB webhook fires without a JWT.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Yeketi Motorworks <onboarding@resend.dev>";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://yeketimotorworks.com";
const REPLY_TO = Deno.env.get("REPLY_TO_EMAIL") ?? "info@yeketimotorworks.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Verifies the caller-supplied secret against the value stored in Supabase
// Vault via a SECURITY DEFINER RPC. The edge function never holds the real
// secret in its environment — Vault is the single source of truth.
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

async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY not set; skipping send"); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      reply_to: REPLY_TO,
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

function stripHtml(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}

function emailTemplate(opts: { headline: string; intro: string; ctaLabel: string; ctaUrl: string }) {
  // Inline-styled, cream/charcoal/brass. Marcellus → web-safe serif fallback.
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F7F3EC;font-family:Georgia,'Times New Roman',serif;color:#221F1B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border:1px solid #221F1B;">
        <tr><td style="padding:28px 28px 0;">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#B0832C;font-family:Arial,Helvetica,sans-serif;">Yeketi Motorworks</div>
        </td></tr>
        <tr><td style="padding:18px 28px 4px;">
          <h1 style="margin:0;font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;color:#221F1B;">${opts.headline}</h1>
        </td></tr>
        <tr><td style="padding:14px 28px 24px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4A453E;">${opts.intro}</p>
        </td></tr>
        <tr><td style="padding:0 28px 36px;">
          <a href="${opts.ctaUrl}" style="display:inline-block;background:#B0832C;color:#F7F3EC;text-decoration:none;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;border:1px solid #B0832C;">${opts.ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #EFE8DB;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#4A453E;letter-spacing:0.04em;">Yeketi Motorworks · Antwerpen · Erbil<br/>Je ontvangt deze mail omdat je een lopend project of aanvraag hebt bij Yeketi Motorworks. Antwoord gerust op deze mail — die komt rechtstreeks bij ons binnen via ${REPLY_TO}.<br/><em style="font-family:Georgia,'Times New Roman',serif;color:#B0832C;">unity in craftsmanship</em></p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function plainText(opts: { headline: string; intro: string; ctaLabel: string; ctaUrl: string }) {
  return `${opts.headline}\n\n${stripHtml(opts.intro)}\n\n${opts.ctaLabel}: ${opts.ctaUrl}\n\n— Yeketi Motorworks · Antwerpen · Erbil\nAntwoord op deze mail komt binnen bij ${REPLY_TO}.`;
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

// Resolves Baram's personal alert address. Prefers the value stored in
// app_settings (key='admin_notify_email'); falls back to ADMIN_NOTIFY_EMAIL.
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

// Persist a delivery failure so admins can see what didn't go out.
// Best-effort — never throw from here, the trigger has already done its job.
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Shared-secret gate — required for any invocation.
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!(await verifyWebhookSecret(provided))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { type: string; table?: string; record?: Record<string, unknown> };
  try { body = await req.json(); } catch (e) {
    await logFailure("unknown", null, `Bad JSON body: ${(e as Error).message}`);
    return new Response("Bad Request", { status: 400 });
  }

  try {
    if (body.table === "phase_updates" && body.type === "INSERT" && body.record) {
      const phaseId = body.record.phase_id as string;
      const updateBody = (body.record.body as string) ?? "";
      const phases = await sbFetch(`project_phases?id=eq.${phaseId}&select=name,project_id`);
      const phase = phases[0];
      if (!phase) return new Response("ok");
      const projects = await sbFetch(`projects?id=eq.${phase.project_id}&select=title,vehicle_make,vehicle_model,customer_id`);
      const project = projects[0];
      if (!project) return new Response("ok");
      const profiles = await sbFetch(`profiles?id=eq.${project.customer_id}&select=email,full_name`);
      const profile = profiles[0];
      if (!profile?.email) return new Response("ok");
      const vehicle = [project.vehicle_make, project.vehicle_model].filter(Boolean).join(" ") || project.title;
      const portalUrl = `${PUBLIC_SITE_URL}/portaal/${project.customer_id ? project.customer_id : ""}`;
      const projectUrl = `${PUBLIC_SITE_URL}/portaal/${phase.project_id}`;
      void portalUrl;
      const preview = updateBody.length > 140 ? updateBody.slice(0, 140) + "…" : updateBody;
      try {
        await sendEmail({
          to: profile.email,
          subject: `Nieuwe update: ${vehicle}`,
          ...(() => {
            const tpl = {
              headline: `Een nieuwe update voor je ${vehicle}`,
              intro: `${profile.full_name ? `Hoi ${String(profile.full_name).split(" ")[0]}, ` : ""}er staat een nieuwe update klaar in het klantenportaal (fase: ${phase.name}).${preview ? `<br/><br/><em style="color:#4A453E;">${preview.replace(/</g, "&lt;")}</em>` : ""}`,
              ctaLabel: "Bekijk de update",
              ctaUrl: projectUrl,
            };
            return { html: emailTemplate(tpl), text: plainText(tpl) };
          })(),
        });
      } catch (e) {
        await logFailure("phase_updates", { phase_id: phaseId, project_id: phase.project_id, to: profile.email }, (e as Error).message);
      }
    }

    if (body.table === "quote_requests" && body.type === "INSERT" && body.record) {
      const adminTo = await resolveAdminNotifyEmail();
      if (!adminTo) return new Response("ok");
      const r = body.record;
      const vehicle = [r.merk, r.model, r.bouwjaar].filter(Boolean).join(" ") || (r.type_werk as string) || "onbekend voertuig";
      const rows: Array<[string, string]> = [
        ["Naam", String(r.naam ?? "")],
        ["E-mail", String(r.email ?? "")],
        ["Telefoon", String(r.telefoon ?? "—")],
        ["Merk", String(r.merk ?? "—")],
        ["Model", String(r.model ?? "—")],
        ["Bouwjaar", String(r.bouwjaar ?? "—")],
        ["Type werk", String(r.type_werk ?? "—")],
        ["Beschrijving", String(r.beschrijving ?? "—")],
      ];
      const detailsHtml = rows
        .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4A453E;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#221F1B;">${v.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</td></tr>`)
        .join("");
      try {
        await sendEmail({
          to: adminTo,
          subject: `Nieuwe offerteaanvraag — ${vehicle} (${r.naam})`,
          ...(() => {
            const tpl = {
              headline: `Nieuwe aanvraag van ${r.naam}`,
              intro: `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${detailsHtml}</table>`,
              ctaLabel: "Open in admin",
              ctaUrl: `${PUBLIC_SITE_URL}/admin/offertes`,
            };
            const textBody = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
            return {
              html: emailTemplate(tpl),
              text: `Nieuwe aanvraag van ${r.naam}\n\n${textBody}\n\nOpen in admin: ${PUBLIC_SITE_URL}/admin/offertes`,
            };
          })(),
        });
      } catch (e) {
        await logFailure("quote_requests", { id: r.id, naam: r.naam, email: r.email }, (e as Error).message);
      }
    }

    if (body.table === "quotes" && body.type === "UPDATE" && body.record) {
      const r = body.record as Record<string, unknown>;
      const status = String(r.status ?? "");
      const old = (body as { old_record?: Record<string, unknown> }).old_record ?? {};
      const prevStatus = String(old.status ?? "");
      const quoteNumber = String(r.quote_number ?? "");
      const title = String(r.title ?? "");
      const total = Number(r.total_amount ?? 0);
      const totalStr = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(total);
      const portalUrl = `${PUBLIC_SITE_URL}/portaal/offerte/${r.id}`;
      const adminUrl = `${PUBLIC_SITE_URL}/admin/quotes/${r.id}`;
      try {
        // Customer-facing "quote sent" is already covered by the in-app sendQuote
        // server fn (sends with PDF attachment). Here we notify the ADMIN on
        // customer responses (akkoord / afgewezen).
        const adminTo = await resolveAdminNotifyEmail();
        if (adminTo && prevStatus === "verstuurd" && (status === "akkoord" || status === "afgewezen")) {
          const accepted = status === "akkoord";
          const reason = String(r.response_reason ?? "").trim();
          const tpl = {
            headline: accepted
              ? `Offerte ${quoteNumber} geaccepteerd`
              : `Offerte ${quoteNumber} afgewezen`,
            intro: accepted
              ? `<strong>${title}</strong> (${totalStr}) is goedgekeurd door de klant. Tijd om een project aan te maken en de klant te bellen.`
              : `<strong>${title}</strong> (${totalStr}) werd afgewezen.${reason ? `<br/><br/><em style="color:#4A453E;">"${reason.replace(/</g,"&lt;")}"</em>` : ""}`,
            ctaLabel: "Open in admin",
            ctaUrl: adminUrl,
          };
          await sendEmail({
            to: adminTo,
            subject: accepted ? `Offerte ${quoteNumber} geaccepteerd — ${title}` : `Offerte ${quoteNumber} afgewezen — ${title}`,
            html: emailTemplate(tpl),
            text: plainText(tpl),
          });
        }
        // (Sending the quote itself happens from the in-app server function so
        // that the PDF attachment is included; no email needed here for the
        // 'verstuurd' transition.)
        void portalUrl;
      } catch (e) {
        await logFailure("quotes", { id: r.id, status, prev: prevStatus }, (e as Error).message);
      }
    }

    if (body.table === "update_reactions" && body.type === "INSERT" && body.record) {
      const adminTo = await resolveAdminNotifyEmail();
      if (!adminTo) return new Response("ok");
      const r = body.record as Record<string, unknown>;
      const phaseUpdateId = String(r.phase_update_id ?? "");
      const authorId = String(r.author_id ?? "");
      const reactionBody = String(r.body ?? "");
      try {
        // Skip notifying when Baram (admin) himself replies.
        const roles = await sbFetch(`user_roles?user_id=eq.${authorId}&role=eq.admin&select=user_id`);
        const authorIsAdmin = Array.isArray(roles) && roles.length > 0;
        if (authorIsAdmin) return new Response("ok");
        const updates = await sbFetch(`phase_updates?id=eq.${phaseUpdateId}&select=phase_id,body`);
        const update = updates[0];
        if (!update) return new Response("ok");
        const phases = await sbFetch(`project_phases?id=eq.${update.phase_id}&select=name,project_id`);
        const phase = phases[0];
        if (!phase) return new Response("ok");
        const projects = await sbFetch(`projects?id=eq.${phase.project_id}&select=id,title,vehicle_make,vehicle_model`);
        const project = projects[0];
        if (!project) return new Response("ok");
        const profiles = await sbFetch(`profiles?id=eq.${authorId}&select=full_name,email`);
        const profile = profiles[0] ?? {};
        const vehicle = [project.vehicle_make, project.vehicle_model].filter(Boolean).join(" ") || project.title;
        const projectUrl = `${PUBLIC_SITE_URL}/admin/projecten/${project.id}`;
        const preview = reactionBody.length > 220 ? reactionBody.slice(0, 220) + "…" : reactionBody;
        const who = profile.full_name || profile.email || "Een klant";
        const tpl = {
          headline: `${who} reageerde op ${vehicle}`,
          intro: `Een nieuwe reactie in fase <strong>${phase.name}</strong>.<br/><br/><em style="color:#4A453E;">"${preview.replace(/</g, "&lt;")}"</em>`,
          ctaLabel: "Antwoord in admin",
          ctaUrl: projectUrl,
        };
        await sendEmail({
          to: adminTo,
          subject: `Nieuwe reactie — ${vehicle}`,
          html: emailTemplate(tpl),
          text: plainText(tpl),
        });
      } catch (e) {
        await logFailure("update_reactions", { phase_update_id: phaseUpdateId, author_id: authorId }, (e as Error).message);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    await logFailure(body?.table ?? "unknown", body?.record ?? null, (e as Error).message);
    return new Response(`Error: ${(e as Error).message}`, { status: 500 });
  }
});