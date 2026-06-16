// Customer-facing email copy in NL + EN. Single source per template.
// Admin mails are not in here — they stay Dutch and live inline.
import { escapeHtml, type EmailLayoutOpts, type Locale } from "./email-template.ts";

type Out = { subject: string } & EmailLayoutOpts;
const PORTAL_LABEL: Record<Locale, string> = { nl: "Open in je portaal", en: "Open your portal" };

function hi(locale: Locale, first: string | null): string {
  if (!first) return locale === "nl" ? "" : "";
  return locale === "nl" ? `Hoi ${first}, ` : `Hi ${first}, `;
}
function quote(htmlText: string): string {
  return `<p style="margin:0 0 18px;padding:14px 16px;background:#F7F3EC;border-left:3px solid #B0832C;font-style:italic;color:#221F1B;">${escapeHtml(htmlText)}</p>`;
}

// ── A · #5 — welcome after invite is sent from TS side (see email-copy.server.ts mirror) ──

// G · #7 — new project welcome
export function projectWelcome(locale: Locale, p: { first: string | null; vehicle: string; portalUrl: string }): Out {
  if (locale === "en") return {
    subject: `Welcome to your project — ${p.vehicle}`,
    preheader: `Your ${p.vehicle} project page is ready`,
    eyebrow: "Welcome", isCustomer: true, locale,
    headline: `Welcome, ${p.first ?? "and thank you for trusting us"}`,
    intro: `Your ${p.vehicle} now has its own page in your portal. From here you'll follow every stage of the restoration — photos, updates, and a way to respond directly.`,
    bodyHtml: `<p style="margin:0;">We take the time the work demands. Every milestone — a new phase, a finished step, a question — lands here.</p>`,
    cta: { label: "Follow your restoration", url: p.portalUrl },
  };
  return {
    subject: `Welkom op je project — ${p.vehicle}`,
    preheader: `Je project ${p.vehicle} is aangemaakt`,
    eyebrow: "Welkom", isCustomer: true, locale,
    headline: `Welkom op je project, ${p.first ?? "en bedankt voor je vertrouwen"}`,
    intro: `Je ${p.vehicle} heeft een eigen pagina in je portaal. Vanaf hier volg je elke fase van de restauratie — met foto's, updates en de mogelijkheid om rechtstreeks te reageren.`,
    bodyHtml: `<p style="margin:0;">We nemen de tijd die het werk vraagt. Elk groot moment — een nieuwe fase, een voltooide stap, een vraag — komt hier binnen.</p>`,
    cta: { label: "Volg je restauratie", url: p.portalUrl },
  };
}

// G · #6 — new phase update
export function phaseUpdate(locale: Locale, p: { first: string | null; vehicle: string; phaseName: string; preview: string; portalUrl: string }): Out {
  const previewHtml = p.preview ? quote(p.preview) : undefined;
  if (locale === "en") return {
    subject: `New update — ${p.vehicle}`,
    preheader: `Update in phase ${p.phaseName}`,
    eyebrow: `Update · ${p.phaseName}`, isCustomer: true, locale,
    headline: `A new update for your ${p.vehicle}`,
    intro: `${hi(locale, p.first)}a fresh update is waiting in your portal.`,
    bodyHtml: previewHtml,
    cta: { label: "View the update", url: p.portalUrl },
  };
  return {
    subject: `Nieuwe update — ${p.vehicle}`,
    preheader: `Update in fase ${p.phaseName}`,
    eyebrow: `Update · ${p.phaseName}`, isCustomer: true, locale,
    headline: `Een nieuwe update voor je ${p.vehicle}`,
    intro: `${hi(locale, p.first)}er staat een verse update klaar in je portaal.`,
    bodyHtml: previewHtml,
    cta: { label: "Bekijk de update", url: p.portalUrl },
  };
}

// G · #8 / #10 — phase started / done
export function phaseStatus(locale: Locale, kind: "started" | "done", p: { first: string | null; vehicle: string; phaseName: string; portalUrl: string }): Out {
  if (kind === "started") {
    if (locale === "en") return {
      subject: `New phase started — ${p.vehicle}`,
      preheader: `We've started ${p.phaseName}`,
      eyebrow: "Next phase", isCustomer: true, locale,
      headline: `We've started ${p.phaseName}`,
      intro: `${hi(locale, p.first)}a new phase of your ${p.vehicle} is underway. We'll keep you posted with updates and photos from the workshop.`,
      cta: { label: "Follow your project", url: p.portalUrl },
    };
    return {
      subject: `Nieuwe fase gestart — ${p.vehicle}`,
      preheader: `We zijn begonnen aan ${p.phaseName}`,
      eyebrow: "Volgende fase", isCustomer: true, locale,
      headline: `We zijn begonnen aan ${p.phaseName}`,
      intro: `${hi(locale, p.first)}een nieuwe fase van je ${p.vehicle} is gestart. We houden je op de hoogte met updates en foto's vanuit de werkplaats.`,
      cta: { label: "Volg je project", url: p.portalUrl },
    };
  }
  if (locale === "en") return {
    subject: `${p.phaseName} is complete — ${p.vehicle}`,
    preheader: `${p.phaseName} is complete`,
    eyebrow: "Phase complete", isCustomer: true, locale,
    headline: `${p.phaseName} is complete`,
    intro: `${hi(locale, p.first)}we've finished ${p.phaseName} on your ${p.vehicle}. The next step starts soon — you'll read it here first.`,
    cta: { label: "Open your portal", url: p.portalUrl },
  };
  return {
    subject: `${p.phaseName} is afgerond — ${p.vehicle}`,
    preheader: `${p.phaseName} is afgerond`,
    eyebrow: "Fase voltooid", isCustomer: true, locale,
    headline: `${p.phaseName} is afgerond`,
    intro: `${hi(locale, p.first)}we zijn klaar met ${p.phaseName} aan je ${p.vehicle}. De volgende stap wordt binnenkort opgestart — je leest het hier eerst.`,
    cta: { label: "Bekijk in je portaal", url: p.portalUrl },
  };
}

// G · #11 — project completed (delivered)
export function projectCompleted(locale: Locale, p: { first: string | null; vehicle: string; portalUrl: string }): Out {
  if (locale === "en") return {
    subject: `Your ${p.vehicle} is ready`,
    preheader: `A new chapter for your ${p.vehicle}`,
    eyebrow: "Project completed", isCustomer: true, locale,
    headline: `Your ${p.vehicle} is ready`,
    intro: `${p.first ? `${p.first}, ` : ""}today we close the work. A long road of stripping, welding, filling, painting and hundreds of small decisions — and now she's yours.`,
    bodyHtml: `
      <p style="margin:0 0 14px;">Your portal stays online as an album: every photo, every update, every moment from the workshop. No longer a project in progress — a story you can revisit whenever you like.</p>
      <p style="margin:0;color:#B0832C;font-family:Georgia,'Times New Roman',serif;font-style:italic;">Thank you for your trust.</p>`,
    cta: { label: "View your project", url: p.portalUrl },
  };
  return {
    subject: `Je ${p.vehicle} is klaar`,
    preheader: `Een nieuw hoofdstuk voor je ${p.vehicle}`,
    eyebrow: "Project voltooid", isCustomer: true, locale,
    headline: `Je ${p.vehicle} is klaar`,
    intro: `${p.first ? `${p.first}, ` : ""}vandaag sluiten we het werk af. Een lange reis van demontage, lassen, plamuren, lakken en honderden kleine beslissingen — en nu is hij van jou.`,
    bodyHtml: `
      <p style="margin:0 0 14px;">Je portaal blijft staan als een album: elke foto, elke update, elk moment uit de werkplaats. Geen project meer in uitvoering — een verhaal dat je kan herlezen wanneer je wil.</p>
      <p style="margin:0;color:#B0832C;font-family:Georgia,'Times New Roman',serif;font-style:italic;">Bedankt voor het vertrouwen.</p>`,
    cta: { label: "Bekijk je project", url: p.portalUrl },
  };
}

// I · #15 — quote request received (acknowledgment)
export function quoteRequestAck(locale: Locale, p: { first: string | null; vehicle: string; siteUrl: string }): Out {
  if (locale === "en") return {
    subject: `Your request has arrived — ${p.vehicle}`,
    preheader: "We've received your quote request",
    eyebrow: "Request received", isCustomer: true, locale,
    headline: `Thanks ${p.first ?? "for your request"}`,
    intro: `We've received your request for your ${p.vehicle}. Baram reviews every file personally and will get back to you within a few business days with a proposal — or a few questions to sharpen the scope.`,
    bodyHtml: `<p style="margin:0;">No further action is needed for now.</p>`,
    secondaryCta: { label: "yeketimotorworks.com", url: p.siteUrl },
  };
  return {
    subject: `Je aanvraag is binnen — ${p.vehicle}`,
    preheader: "We hebben je offerteaanvraag goed ontvangen",
    eyebrow: "Aanvraag ontvangen", isCustomer: true, locale,
    headline: `Bedankt ${p.first ?? "voor je aanvraag"}`,
    intro: `We hebben je aanvraag voor je ${p.vehicle} goed ontvangen. Baram bekijkt elk dossier persoonlijk en neemt binnen enkele werkdagen contact op met een voorstel — of een paar vragen om de scope scherp te krijgen.`,
    bodyHtml: `<p style="margin:0;">In tussentijd hoef je niets te doen.</p>`,
    secondaryCta: { label: "yeketimotorworks.com", url: p.siteUrl },
  };
}

// L · #18 — quote accepted / declined confirmation
export function quoteResponseConfirm(locale: Locale, p: { first: string | null; accepted: boolean; quoteNumber: string; totalStr: string; portalUrl: string }): Out {
  const { first, accepted, quoteNumber, totalStr, portalUrl } = p;
  if (locale === "en") return {
    subject: accepted ? `Confirmation — quote ${quoteNumber} accepted` : `Confirmation — quote ${quoteNumber} declined`,
    eyebrow: "Confirmation", isCustomer: true, locale,
    headline: accepted ? "Thank you for your approval" : "We've received your response",
    intro: accepted
      ? `${first ? `${first}, ` : ""}we've noted your approval of quote ${quoteNumber} (${totalStr}). Baram will be in touch within a few days to lock in scheduling and transport.`
      : `${first ? `${first}, ` : ""}no problem — we've noted your decision on quote ${quoteNumber}. If anything changes or you'd like to talk about another vehicle, you know where to find us.`,
    cta: { label: PORTAL_LABEL[locale], url: portalUrl },
  };
  return {
    subject: accepted ? `Bevestiging — offerte ${quoteNumber} aanvaard` : `Bevestiging — offerte ${quoteNumber} geweigerd`,
    eyebrow: "Bevestiging", isCustomer: true, locale,
    headline: accepted ? "Bedankt voor je akkoord" : "We hebben je antwoord goed ontvangen",
    intro: accepted
      ? `${first ? `${first}, ` : ""}we noteren je akkoord op offerte ${quoteNumber} (${totalStr}). Baram neemt binnen enkele dagen contact op om de planning en het transport vast te leggen.`
      : `${first ? `${first}, ` : ""}geen probleem — we noteren je beslissing over offerte ${quoteNumber}. Als er iets verandert of als je over een ander voertuig wil praten, weet je ons te vinden.`,
    cta: { label: PORTAL_LABEL[locale], url: portalUrl },
  };
}

// H · #13 — new message from Baram
export function newMessageFromBaram(locale: Locale, p: { first: string | null; subject: string; preview: string; portalUrl: string }): Out {
  const body = quote(p.preview);
  if (locale === "en") return {
    subject: "A new message from Baram",
    preheader: p.subject,
    eyebrow: "Message", isCustomer: true, locale,
    headline: `${p.first ? `${p.first}, ` : ""}Baram sent you a message`,
    intro: p.subject,
    bodyHtml: body,
    cta: { label: "Reply in your portal", url: p.portalUrl },
  };
  return {
    subject: "Nieuw bericht van Baram",
    preheader: p.subject,
    eyebrow: "Bericht", isCustomer: true, locale,
    headline: `${p.first ? `${p.first}, ` : ""}Baram heeft je een bericht gestuurd`,
    intro: p.subject,
    bodyHtml: body,
    cta: { label: "Reageren in je portaal", url: p.portalUrl },
  };
}
