// Customer-facing email copy in NL + EN — server function side.
// Used by createServerFn-based senders (welcome, quote send, quote reminders).
// Mirror of supabase/functions/_shared/email-copy.ts for the templates we send
// from outside the notify-events edge function.
import { escapeHtml, type EmailLayoutOpts, type Locale } from "./email-template.server";

type Out = { subject: string } & EmailLayoutOpts;

// A · #5 — welcome after invitation accepted
export function welcomeAfterInvite(locale: Locale, p: { first: string | null; portalUrl: string }): Out {
  if (locale === "en") return {
    subject: "Welcome to Yeketi Motorworks — your portal is ready",
    preheader: "Your portal is ready — follow your restoration up close.",
    eyebrow: "Welcome", isCustomer: true, locale,
    headline: p.first ? `Welcome to Yeketi, ${p.first}` : "Welcome to Yeketi Motorworks",
    intro: "Your access to the customer portal is activated. From now on, every update about your restoration lands here — phase by phase, with photos from the workshop.",
    bodyHtml: `<p style="margin:0;">You can respond directly under every update and send messages to Baram. No intermediate step, no form — just contact.</p>`,
    cta: { label: "Open your portal", url: p.portalUrl },
  };
  return {
    subject: "Welkom bij Yeketi Motorworks — je portaal staat klaar",
    preheader: "Je portaal staat klaar — volg je restauratie van dichtbij.",
    eyebrow: "Welkom", isCustomer: true, locale,
    headline: p.first ? `Welkom bij Yeketi, ${p.first}` : "Welkom bij Yeketi Motorworks",
    intro: "Je toegang tot het klantenportaal is geactiveerd. Vanaf nu zie je hier elke update over je restauratie — fase per fase, met foto's vanuit de werkplaats.",
    bodyHtml: `<p style="margin:0;">Je kan rechtstreeks reageren onder elke update en berichten sturen naar Baram. Geen tussenstap, geen formulier — gewoon contact.</p>`,
    cta: { label: "Open je portaal", url: p.portalUrl },
  };
}

// K · #16 — quote sent (PDF attached)
export function quoteSent(locale: Locale, p: { first: string | null; quoteNumber: string; portalUrl: string; intro: string; totalStr: string; vehicle: string | null }): Out {
  const introPreview = (p.intro || "")
    .split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 2).join(" ");
  const totalsRow = (label: string) => `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;border:1px solid #EFE8DB;background:#F7F3EC;width:100%;">
      <tr>
        <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6B6459;letter-spacing:0.18em;text-transform:uppercase;">${label}</td>
        <td style="padding:14px 18px;text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#221F1B;">${escapeHtml(p.totalStr)}</td>
      </tr>
    </table>`;
  if (locale === "en") return {
    subject: `Quote ${p.quoteNumber} — Yeketi Motorworks`,
    preheader: `Quote ${p.quoteNumber} · ${p.totalStr}`,
    eyebrow: `Quote ${p.quoteNumber}`, isCustomer: true, locale,
    headline: p.vehicle ? `Your quote for ${p.vehicle}` : "Your quote is ready",
    intro: `${p.first ? `Hi ${p.first}, ` : ""}we've prepared your quote. The full PDF is attached; you can also open it in your portal to accept or decline.`,
    bodyHtml: `
      ${introPreview ? `<p style="margin:0 0 18px;color:#4A453E;">${escapeHtml(introPreview)}</p>` : ""}
      ${totalsRow("Total")}
    `,
    cta: { label: "View your quote", url: p.portalUrl },
    footerNote: "The quote PDF is attached to this email.",
  };
  return {
    subject: `Offerte ${p.quoteNumber} — Yeketi Motorworks`,
    preheader: `Offerte ${p.quoteNumber} · ${p.totalStr}`,
    eyebrow: `Offerte ${p.quoteNumber}`, isCustomer: true, locale,
    headline: p.vehicle ? `Je offerte voor ${p.vehicle}` : "Je offerte staat klaar",
    intro: `${p.first ? `Hoi ${p.first}, ` : ""}we hebben je offerte uitgewerkt. De volledige PDF zit in bijlage; je kan ze ook in je portaal openen om te aanvaarden of te weigeren.`,
    bodyHtml: `
      ${introPreview ? `<p style="margin:0 0 18px;color:#4A453E;">${escapeHtml(introPreview)}</p>` : ""}
      ${totalsRow("Totaal")}
    `,
    cta: { label: "Bekijk je offerte", url: p.portalUrl },
    footerNote: "De PDF van de offerte zit als bijlage bij deze mail.",
  };
}

// K · #17 — quote reminder
export function quoteReminder(locale: Locale, p: { first: string | null; quoteNumber: string; title: string; portalUrl: string }): Out {
  if (locale === "en") return {
    subject: `Reminder — quote ${p.quoteNumber}`,
    preheader: `Quote ${p.quoteNumber} is still waiting for your reply`,
    eyebrow: `Quote ${p.quoteNumber}`, isCustomer: true, locale,
    headline: "A friendly reminder",
    intro: `${p.first ? `Hi ${p.first}, ` : ""}just checking in — your quote for ${p.title} is still open. No rush, but if you have any questions or want to discuss it, open your portal to reply.`,
    cta: { label: "View your quote", url: p.portalUrl },
  };
  return {
    subject: `Herinnering — offerte ${p.quoteNumber}`,
    preheader: `Offerte ${p.quoteNumber} wacht nog op je antwoord`,
    eyebrow: `Offerte ${p.quoteNumber}`, isCustomer: true, locale,
    headline: "Een vriendelijke herinnering",
    intro: `${p.first ? `Hoi ${p.first}, ` : ""}we wilden even checken — je offerte voor ${p.title} staat nog open. Geen haast, maar mocht je vragen hebben of de offerte willen bespreken, open je portaal om te reageren.`,
    cta: { label: "Bekijk je offerte", url: p.portalUrl },
  };
}
