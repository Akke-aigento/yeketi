// Shared email layout for ALL Yeketi mails (Deno edge function side).
// Bulletproof table-based layout, inline styles, max-width ~600px,
// dark-mode-safe explicit colors. Mirrors src/lib/email-template.server.ts
// — keep both in sync when restyling.
//
// Palette
//   Cream       #F7F3EC    page background
//   Card        #FFFFFF    content
//   Charcoal    #221F1B    primary text
//   Soft        #4A453E    body / muted
//   Brass       #B0832C    accents + primary button
//   Hair        #EFE8DB    dividers

export type Locale = "nl" | "en";

export const COMPANY_LINE =
  "Yeketi Motorworks · Vredeplein 23, 3010 Kessel-Lo · info@yeketimotorworks.com · yeketimotorworks.com";

// Notice steering replies back into the portal (send-from address is not
// monitored). Shown above the company line in every CUSTOMER mail.
const DO_NOT_REPLY: Record<Locale, string> = {
  nl: "Antwoord niet op deze e-mail — reageren doe je veilig in je portaal via de knop hierboven.",
  en: "Please don't reply to this email — respond securely in your portal using the button above.",
};

const REPLY_FALLBACK_NOTE: Record<Locale, (addr: string) => string> = {
  nl: (a) => `Lukt het niet? Stuur ons dan een bericht via ${a}.`,
  en: (a) => `If that's not possible, you can reach us at ${a}.`,
};

export type EmailButton = { label: string; url: string };

export type EmailLayoutOpts = {
  preheader?: string;        // hidden inbox preview text
  eyebrow?: string;          // small uppercase label above headline
  headline: string;          // serif H1
  intro?: string;            // first paragraph (plain text — escaped)
  bodyHtml?: string;         // optional pre-built HTML body (must be safe)
  cta?: EmailButton;         // primary brass button
  secondaryCta?: EmailButton;// optional plain link below button
  footerNote?: string;       // optional extra small print
  replyTo?: string;
  // Customer mails: set to render the portal-reply notice + localized footer.
  // Admin mails (Baram): leave undefined → no portal notice, footer in NL.
  locale?: Locale;
  isCustomer?: boolean;
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderHeader(): string {
  // Pure-typography header. Sun glyph + wordmark in serif. Works in every
  // mail client and never breaks on image-blocking.
  return `
    <tr><td align="center" style="padding:36px 24px 8px;background:#F7F3EC;">
      <div style="font-family:Georgia,'Times New Roman',serif;color:#B0832C;font-size:22px;line-height:1;letter-spacing:0.02em;">&#9737;</div>
      <div style="font-family:Georgia,'Times New Roman',serif;color:#221F1B;font-size:22px;line-height:1.2;letter-spacing:0.32em;margin-top:10px;">YEKETI</div>
      <div style="font-family:Arial,Helvetica,sans-serif;color:#B0832C;font-size:10px;line-height:1;letter-spacing:0.42em;margin-top:6px;text-transform:uppercase;">Motorworks</div>
    </td></tr>
  `;
}

function renderButton(btn: EmailButton): string {
  // Bulletproof button: VML for Outlook, link for everyone else.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td align="center" bgcolor="#B0832C" style="border:1px solid #221F1B;">
        <!--[if mso]>&nbsp;&nbsp;&nbsp;&nbsp;<![endif]-->
        <a href="${escapeHtml(btn.url)}"
           style="display:inline-block;background:#B0832C;color:#FFFFFF;text-decoration:none;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;line-height:1;mso-padding-alt:0;">${escapeHtml(btn.label)}</a>
        <!--[if mso]>&nbsp;&nbsp;&nbsp;&nbsp;<![endif]-->
      </td></tr>
    </table>
  `;
}

export function renderEmail(opts: EmailLayoutOpts): string {
  const locale: Locale = opts.locale ?? "nl";
  const reply = opts.replyTo ?? "info@yeketimotorworks.com";
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(opts.preheader)}</div>` : "";
  const eyebrow = opts.eyebrow
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#B0832C;margin-bottom:14px;">${escapeHtml(opts.eyebrow)}</div>`
    : "";
  const intro = opts.intro
    ? `<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#4A453E;">${escapeHtml(opts.intro)}</p>`
    : "";
  const body = opts.bodyHtml
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#4A453E;">${opts.bodyHtml}</div>`
    : "";
  const cta = opts.cta
    ? `<div style="padding:22px 0 8px;text-align:center;">${renderButton(opts.cta)}</div>`
    : "";
  const secondary = opts.secondaryCta
    ? `<div style="text-align:center;padding:6px 0 4px;"><a href="${escapeHtml(opts.secondaryCta.url)}" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4A453E;text-decoration:underline;letter-spacing:0.04em;">${escapeHtml(opts.secondaryCta.label)}</a></div>`
    : "";
  const footerExtra = opts.footerNote
    ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#6B6459;">${escapeHtml(opts.footerNote)}</p>`
    : "";

  // Customer mails get the "don't reply, use portal" line. Admin mails skip it.
  const portalNotice = opts.isCustomer
    ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#6B6459;">${escapeHtml(DO_NOT_REPLY[locale])}</p>`
    : "";
  // Customer mails: no reply hint at all — the portal notice above is enough.
  // Admin mails (Baram): keep the inbound-reply note so he knows replies arrive.
  const replyLine = opts.isCustomer
    ? ""
    : `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#6B6459;">Antwoord op deze mail komt rechtstreeks bij ons binnen via ${escapeHtml(reply)}.</p>`;

  return `<!doctype html><html lang="${locale}"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light"/>
<title>${escapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EC;-webkit-text-size-adjust:100%;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F3EC;">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
      ${renderHeader()}
      <tr><td style="padding:8px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #221F1B;">
          <tr><td style="padding:34px 36px 28px;">
            ${eyebrow}
            <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:#221F1B;">${escapeHtml(opts.headline)}</h1>
            ${intro}
            ${body}
            ${cta}
            ${secondary}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 24px 36px;text-align:center;">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#6B6459;letter-spacing:0.02em;">${escapeHtml(COMPANY_LINE)}</p>
        ${footerExtra}
        ${portalNotice}
        ${replyLine}
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;line-height:1;color:#B0832C;font-style:italic;letter-spacing:0.06em;">unity in craftsmanship</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function renderPlainText(opts: EmailLayoutOpts): string {
  const parts: string[] = [];
  if (opts.eyebrow) parts.push(opts.eyebrow.toUpperCase());
  parts.push(opts.headline);
  parts.push("");
  if (opts.intro) parts.push(opts.intro);
  if (opts.bodyHtml) {
    const stripped = opts.bodyHtml
      .replace(/<br\s*\/?>(\n)?/gi, "\n")
      .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n").trim();
    if (stripped) parts.push(stripped);
  }
  if (opts.cta) parts.push("", `${opts.cta.label}: ${opts.cta.url}`);
  if (opts.secondaryCta) parts.push(`${opts.secondaryCta.label}: ${opts.secondaryCta.url}`);
  parts.push("", "—", COMPANY_LINE, "unity in craftsmanship");
  return parts.join("\n");
}