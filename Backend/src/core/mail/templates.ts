import { currentLang, tr, type Lang, type MessageKey, type Params } from "../i18n";

/**
 * One look for every message the platform sends: the brand band, a title,
 * a few lines, at most one button, and the small print. In the reader's
 * language and direction, with a plain-text twin for mail apps that show no
 * HTML. Everything put in is escaped: a name is never markup — nor is what
 * the administration writes in «واجهة الموقع ← رسائل البريد»
 * (core/mail/mail-templates), which sets the words, the band's and the
 * button's colours, and the logos in the band: the university's at its start,
 * the faculty's at its end.
 *
 * Tables and inline styles only — what every mail app, old Outlook included,
 * draws the same way.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const LOCALE: Record<Lang, string> = { ar: "ar-DZ", en: "en-GB", fr: "fr-FR" };

/** A date and time as the reader says it, on the university's clock. */
export const mailTime = (d: Date = new Date(), lang: Lang = currentLang()) =>
  d.toLocaleString(LOCALE[lang], { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Algiers" });

/** The look the administration may change. */
export interface MailLook {
  /** The band at the top. */
  header: string;
  /** The line under the band, and the button. */
  accent: string;
  /** The university's logo before the platform's name: none, the platform's own, or an uploaded picture (core/mail/mail-images). */
  universityLogo: string | null;
  /** The faculty's logo at the other end of the band — the same three choices. */
  facultyLogo: string | null;
}

/** As the messages always looked: no logo. */
export const DEFAULT_LOOK: MailLook = { header: "#26423d", accent: "#c1965a", universityLogo: null, facultyLogo: null };

/** A logo as the band shows it: where it is read from (`cid:` sent, a data URL previewed), and its own size. */
export interface BandLogo {
  src: string;
  width: number;
  height: number;
}

/** What a message says: the catalogue's words — or the administration's, where it rewrote them. */
export type Say = (key: MessageKey, params?: Params) => string;

export interface MailContent {
  title: string;
  /** Paragraphs, in order. */
  lines: string[];
  /** Short facts set apart — a device, an address, a time. */
  facts?: string[];
  action?: { label: string; url: string };
  /** Small print under the button: how long the link works, what to do if it was not you. */
  notes?: string[];
}

export interface RenderOptions {
  say?: Say;
  look?: MailLook;
  /** The logos to show, already read — whatever the look says, none without them. */
  logos?: { university?: BandLogo | null; faculty?: BandLogo | null };
}

/** Logos stand 44 px high in the band; a wide one stops at 132. */
const LOGO_HEIGHT = 44;
const shown = (l: BandLogo) => {
  const width = Math.round((LOGO_HEIGHT * l.width) / Math.max(1, l.height));
  return width > 132
    ? { width: 132, height: Math.max(12, Math.round((132 * l.height) / Math.max(1, l.width))) }
    : { width: Math.max(16, width), height: LOGO_HEIGHT };
};

/** How light a colour is, 0 to 1 (WCAG's relative luminance). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const DARK_INK = "#1a312d";
const LIGHT_INK = "#f5edda";
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Text that reads on a background: the dark ink or the cream one, whichever stands out more (WCAG contrast). */
function inkOn(hex: string): string {
  const bg = luminance(hex);
  return contrast(bg, luminance(DARK_INK)) >= contrast(bg, luminance(LIGHT_INK)) ? DARK_INK : LIGHT_INK;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function renderMail(c: MailContent, lang: Lang = currentLang(), opts: RenderOptions = {}): { html: string; text: string } {
  const say: Say = opts.say ?? ((key, params) => tr(key, params, lang));
  const look = opts.look ?? DEFAULT_LOOK;
  const header = HEX.test(look.header) ? look.header : DEFAULT_LOOK.header;
  const accent = HEX.test(look.accent) ? look.accent : DEFAULT_LOOK.accent;
  // Links in the body take the band's colour while it reads on the cream page.
  const linkColour = luminance(header) < 0.25 ? header : DEFAULT_LOOK.header;
  const university = opts.logos?.university ?? null;
  const faculty = opts.logos?.faculty ?? null;

  const rtl = lang === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = rtl ? "Tahoma, 'Segoe UI', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif";
  // A line break written by the administration stays one.
  const para = (s: string) => esc(s).replace(/\r?\n/g, "<br>");
  const p = (s: string, style = "") => `<p style="margin:0 0 14px;line-height:1.8;${style}">${para(s)}</p>`;
  const brand = `<span style="font-size:18px;font-weight:bold;color:${inkOn(header)};">${esc(say("mail.brand"))}</span>`;
  // On a light tile, so a logo drawn for a white page reads on any band.
  const img = (l: BandLogo) => {
    const { width, height } = shown(l);
    return `<img src="${esc(l.src)}" width="${width}" height="${height}" alt="" style="display:block;width:${width}px;height:${height}px;border-radius:10px;background:#fbf6ea;padding:3px;">`;
  };
  const band =
    university || faculty
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}"><tr>
${university ? `<td style="padding-${rtl ? "left" : "right"}:12px;vertical-align:middle;width:1%;">${img(university)}</td>` : ""}
<td style="vertical-align:middle;">${brand}</td>
${faculty ? `<td align="${rtl ? "left" : "right"}" style="padding-${rtl ? "right" : "left"}:12px;vertical-align:middle;width:1%;">${img(faculty)}</td>` : ""}
</tr></table>`
      : brand;

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f0e6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;background:#fffaf2;border-radius:16px;overflow:hidden;font-family:${font};color:#26423d;text-align:${align};">
<tr><td style="background:${header};padding:${university || faculty ? "16px" : "20px"} 28px;border-bottom:4px solid ${accent};">
${band}
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 18px;font-size:20px;color:#1a312d;">${esc(c.title)}</h1>
${c.lines.map((l) => p(l, "font-size:15px;")).join("\n")}
${
  c.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#f1e8d6;border-radius:10px;"><tr><td style="padding:12px 16px;font-size:14px;line-height:1.9;">${c.facts
        .map((f) => `<div dir="auto">${esc(f)}</div>`)
        .join("")}</td></tr></table>`
    : ""
}
${
  c.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td style="background:${accent};border-radius:10px;">
<a href="${esc(c.action.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:${inkOn(accent)};text-decoration:none;">${esc(c.action.label)}</a>
</td></tr></table>
${p(say("mail.linkFallback"), "font-size:12px;color:#7b6f5c;margin-bottom:4px;")}
<p dir="ltr" style="margin:0 0 18px;font-size:12px;word-break:break-all;"><a href="${esc(c.action.url)}" style="color:${linkColour};">${esc(c.action.url)}</a></p>`
    : ""
}
${(c.notes ?? []).map((n) => p(n, "font-size:13px;color:#7b6f5c;")).join("\n")}
</td></tr>
<tr><td style="padding:16px 28px;background:#f1e8d6;font-size:12px;color:#7b6f5c;line-height:1.7;">${para(say("mail.footer"))}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    c.title,
    "",
    ...c.lines,
    ...(c.facts?.length ? ["", ...c.facts] : []),
    ...(c.action ? ["", `${c.action.label}: ${c.action.url}`] : []),
    ...(c.notes?.length ? ["", ...c.notes] : []),
    "",
    "—",
    say("mail.footer"),
  ].join("\n");

  return { html, text };
}
