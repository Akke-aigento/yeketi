import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfQuote = {
  quote_number: string;
  title: string;
  vehicle_label: string;
  intro_text: string;
  notes_text: string;
  total_amount: number;
  valid_until: string | null;
  sent_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  lines: Array<{ description: string; amount: number }>;
};

const CREAM = rgb(0.969, 0.953, 0.925);          // #F7F3EC
const CHARCOAL = rgb(0.133, 0.122, 0.106);       // #221F1B
const CHARCOAL_SOFT = rgb(0.29, 0.27, 0.24);     // #4A453E
const BRASS = rgb(0.690, 0.514, 0.173);          // #B0832C
const HAIR = rgb(0.85, 0.82, 0.76);

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function nlDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
}

// Wrap text by measuring character widths; pdf-lib has no built-in wrap.
function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) { out.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export async function renderQuotePdf(q: PdfQuote): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Offerte ${q.quote_number} — Yeketi Motorworks`);
  doc.setAuthor("Yeketi Motorworks");
  doc.setCreator("Yeketi Motorworks");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);   // Marcellus fallback
  const timesI = await doc.embedFont(StandardFonts.TimesItalic);

  const A4 = { w: 595.28, h: 841.89 };
  const margin = 48;
  const contentW = A4.w - margin * 2;
  const amountColW = 110;
  const descColW = contentW - amountColW;

  let page = doc.addPage([A4.w, A4.h]);
  // background
  page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: CREAM });
  // brass top bar
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: BRASS });

  let y = A4.h - 56;

  // Header: wordmark left, meta right
  page.drawText("YEKETI MOTORWORKS", {
    x: margin, y, font: helvB, size: 13, color: CHARCOAL,
  });
  page.drawText("unity in craftsmanship", {
    x: margin, y: y - 14, font: timesI, size: 10, color: BRASS,
  });

  // Right meta block
  const metaLines: Array<[string, string]> = [
    ["Offerte", q.quote_number],
    ["Datum", nlDate(q.sent_at ?? new Date().toISOString())],
    ["Geldig tot", nlDate(q.valid_until)],
  ];
  metaLines.forEach(([k, v], i) => {
    const lineY = y - i * 14;
    const kw = helv.widthOfTextAtSize(k.toUpperCase(), 8);
    const vw = helvB.widthOfTextAtSize(v, 10);
    page.drawText(k.toUpperCase(), {
      x: A4.w - margin - vw - 12 - kw, y: lineY, font: helv, size: 8, color: CHARCOAL_SOFT,
    });
    page.drawText(v, {
      x: A4.w - margin - vw, y: lineY - 1, font: helvB, size: 10, color: CHARCOAL,
    });
  });

  y -= 50;
  // Title (serif/Marcellus-style)
  const titleLines = wrap(q.title || "Offerte", times, 22, contentW);
  for (const ln of titleLines) {
    page.drawText(ln, { x: margin, y, font: times, size: 22, color: CHARCOAL });
    y -= 26;
  }

  if (q.vehicle_label) {
    page.drawText(q.vehicle_label.toUpperCase(), {
      x: margin, y: y - 4, font: helv, size: 9, color: BRASS,
    });
    y -= 14;
  }

  // Recipient
  if (q.customer_name || q.customer_email) {
    y -= 14;
    page.drawText("VOOR", { x: margin, y, font: helv, size: 8, color: CHARCOAL_SOFT });
    y -= 12;
    if (q.customer_name) {
      page.drawText(q.customer_name, { x: margin, y, font: helvB, size: 11, color: CHARCOAL });
      y -= 13;
    }
    if (q.customer_email) {
      page.drawText(q.customer_email, { x: margin, y, font: helv, size: 10, color: CHARCOAL_SOFT });
      y -= 13;
    }
  }

  // Intro
  if (q.intro_text.trim()) {
    y -= 12;
    const introLines = wrap(q.intro_text, helv, 10.5, contentW);
    for (const ln of introLines) {
      if (y < 160) { ({ page, y } = newPage(doc, A4, margin)); }
      page.drawText(ln, { x: margin, y, font: helv, size: 10.5, color: CHARCOAL_SOFT });
      y -= 15;
    }
  }

  // Lines header
  y -= 18;
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: A4.w - margin, y: y + 6 }, color: CHARCOAL, thickness: 0.8 });
  page.drawText("OMSCHRIJVING", { x: margin, y: y - 10, font: helv, size: 8, color: CHARCOAL_SOFT });
  const amtHdr = "BEDRAG";
  page.drawText(amtHdr, {
    x: A4.w - margin - helv.widthOfTextAtSize(amtHdr, 8),
    y: y - 10, font: helv, size: 8, color: CHARCOAL_SOFT,
  });
  y -= 22;

  // Lines
  for (const line of q.lines) {
    const descLines = wrap(line.description || "—", helv, 11, descColW - 12);
    const rowH = Math.max(descLines.length * 15, 18) + 8;
    if (y - rowH < 140) { ({ page, y } = newPage(doc, A4, margin)); }
    descLines.forEach((ln, i) => {
      page.drawText(ln, { x: margin, y: y - i * 15, font: helv, size: 11, color: CHARCOAL });
    });
    const amt = eur(line.amount);
    page.drawText(amt, {
      x: A4.w - margin - helvB.widthOfTextAtSize(amt, 11),
      y, font: helvB, size: 11, color: CHARCOAL,
    });
    y -= rowH;
    page.drawLine({
      start: { x: margin, y: y + 4 }, end: { x: A4.w - margin, y: y + 4 },
      color: HAIR, thickness: 0.5,
    });
  }

  // Total
  y -= 14;
  if (y < 140) ({ page, y } = newPage(doc, A4, margin));
  page.drawRectangle({
    x: margin, y: y - 10, width: contentW, height: 34, color: CHARCOAL,
  });
  page.drawText("TOTAAL", { x: margin + 14, y: y + 4, font: helvB, size: 11, color: CREAM });
  const totStr = eur(q.total_amount);
  page.drawText(totStr, {
    x: A4.w - margin - 14 - helvB.widthOfTextAtSize(totStr, 14),
    y: y + 2, font: helvB, size: 14, color: BRASS,
  });
  y -= 38;

  // Notes
  if (q.notes_text.trim()) {
    y -= 16;
    page.drawText("OPMERKINGEN", { x: margin, y, font: helv, size: 8, color: CHARCOAL_SOFT });
    y -= 14;
    const notesLines = wrap(q.notes_text, helv, 10, contentW);
    for (const ln of notesLines) {
      if (y < 90) ({ page, y } = newPage(doc, A4, margin));
      page.drawText(ln, { x: margin, y, font: helv, size: 10, color: CHARCOAL_SOFT });
      y -= 14;
    }
  }

  // Footer (every page)
  doc.getPages().forEach((p) => {
    p.drawLine({
      start: { x: margin, y: 56 }, end: { x: A4.w - margin, y: 56 },
      color: HAIR, thickness: 0.5,
    });
    p.drawText("Yeketi Motorworks  ·  Antwerpen & Erbil  ·  info@yeketimotorworks.com", {
      x: margin, y: 40, font: helv, size: 8, color: CHARCOAL_SOFT,
    });
    p.drawText("yeketimotorworks.com", {
      x: A4.w - margin - helv.widthOfTextAtSize("yeketimotorworks.com", 8),
      y: 40, font: helv, size: 8, color: BRASS,
    });
  });

  return doc.save();
}

function newPage(doc: PDFDocument, A4: { w: number; h: number }, margin: number) {
  const p = doc.addPage([A4.w, A4.h]);
  p.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: CREAM });
  p.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: BRASS });
  return { page: p, y: A4.h - margin };
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bytes).toString("base64");
}