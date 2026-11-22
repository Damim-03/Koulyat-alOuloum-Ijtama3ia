import { z } from "zod";
import { prisma } from "../prisma/client";
import { config } from "../config/app.config";
import { currentLang, LANGS, tr, type Lang, type MessageKey, type Params } from "../i18n";
import { DEFAULT_LOOK, mailTime, renderMail, type BandLogo, type MailLook, type Say } from "./templates";
import { logoImage, uploadedImage, UPLOADED_LOGO, type LogoSlot, type MailImage } from "./mail-images";
import type { Mail } from "./mailer";

/**
 * ============================================================
 * رسائل البريد كما تكتبها الإدارة — «واجهة الموقع ← رسائل البريد»
 * ============================================================
 *
 * الإدارة تعيد كتابة نصوص الرسائل الأربع (استعادة كلمة المرور، وتأكيد
 * البريد، وتغيّر كلمة المرور، والدخول من جهازٍ جديد) وما يتكرّر فيها (اسم
 * المنصة في الرأس، والتذييل…)، بكلّ لغة، وتختار لونَي الرأس والزرّ، وشعارَي
 * الجامعة والكلّية في الرأس — لا شيء، أو شعار المنصة، أو صورةً ترفعها
 * (core/mail/mail-images). وما لم تكتبه يبقى نصّ المنصة (catalog/mail).
 *
 * وما لا تملكه، عمداً:
 * - **الروابط**: رابط الزرّ يصنعه الخادم دائماً — رسالةٌ تحمل اسم الجامعة لا
 *   تصير بابَ تصيّد مهما كُتب فيها؛
 * - **الشيفرة**: كلّ ما يُكتب نصٌّ يُهرَّب عند العرض (core/mail/templates)،
 *   لا HTML — فلا يُكسر شكل الرسالة في برامج البريد، ولا يدخلها ما لا يصحّ؛
 * - **القيم**: `{{account}}` وأخواتها تُملأ من الحساب، وكلّ نصٍّ لا يقبل إلّا
 *   القيم التي يستعملها نصّه الأصليّ.
 *
 * والمعاينة في لوحة التحكم ترسم الرسالة بالدالّة نفسها التي ترسلها
 * (`composeMail`)، بقيمٍ مثالية — فما تراه الإدارة هو ما يصل.
 */

export const MAIL_SLUG = "mail-templates";

/** The texts the administration may rewrite, by where they are read. */
export const MAIL_GROUPS = {
  common: ["mail.brand", "mail.footer", "mail.linkFallback", "mail.ignore", "mail.notYou"],
  reset: ["mail.reset.subject", "mail.reset.title", "mail.reset.intro", "mail.reset.action", "mail.reset.expires"],
  verify: ["mail.verify.subject", "mail.verify.title", "mail.verify.intro", "mail.verify.action", "mail.verify.expires"],
  passwordChanged: [
    "mail.passwordChanged.subject",
    "mail.passwordChanged.title",
    "mail.passwordChanged.intro",
    "mail.passwordChanged.byAdmin",
  ],
  newDevice: [
    "mail.newDevice.subject",
    "mail.newDevice.title",
    "mail.newDevice.intro",
    "mail.newDevice.device",
    "mail.newDevice.ip",
    "mail.newDevice.when",
    "mail.newDevice.action",
    "mail.newDevice.notYou",
  ],
} as const satisfies Record<string, readonly MessageKey[]>;

export type MailGroup = keyof typeof MAIL_GROUPS;
export type MailKey = (typeof MAIL_GROUPS)[MailGroup][number];
export const MAIL_KEYS: readonly MailKey[] = Object.values(MAIL_GROUPS).flat();
const KEYS = new Set<string>(MAIL_KEYS);

/** The messages sent — each group but the shared one is a message. */
export const MAIL_KINDS = ["reset", "verify", "passwordChanged", "newDevice"] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

/** A title, a subject, a button: one line. The rest may run to a few. */
const ONE_LINE = /\.(subject|title|action)$|^mail\.brand$|\.(device|ip|when)$/;
export const isOneLine = (key: string) => ONE_LINE.test(key);
export const maxOf = (key: string) => (isOneLine(key) ? 160 : 700);

const VAR = /\{\{\s*(\w+)\s*\}\}/g;

/** The values a text may hold: those its own words use, in any language. */
export const varsOf = (key: MailKey): string[] => [
  ...new Set(LANGS.flatMap((lang) => [...tr(key, undefined, lang).matchAll(VAR)].map((m) => m[1]!))),
];

/** The texts of one language: only those rewritten — an empty one is the platform's again. */
const texts = z
  .record(z.string(), z.string())
  .default({})
  .superRefine((map, ctx) => {
    for (const [key, raw] of Object.entries(map)) {
      if (!KEYS.has(key)) {
        ctx.addIssue({ code: "custom", path: [key], message: tr("mailTemplates.unknownKey", { name: key }) });
        continue;
      }
      const value = raw.trim();
      if (value.length > maxOf(key))
        ctx.addIssue({ code: "custom", path: [key], message: tr("mailTemplates.tooLong", { max: maxOf(key) }) });
      if (isOneLine(key) && /[\r\n]/.test(value))
        ctx.addIssue({ code: "custom", path: [key], message: tr("mailTemplates.oneLine") });
      const allowed = varsOf(key as MailKey);
      for (const [, name] of value.matchAll(VAR))
        if (!allowed.includes(name!))
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: allowed.length
              ? tr("mailTemplates.unknownVar", { name: `{{${name}}}`, list: allowed.map((v) => `{{${v}}}`).join(" ") })
              : tr("mailTemplates.noVars", { name: `{{${name}}}` }),
          });
    }
  })
  .transform((map) =>
    Object.fromEntries(
      Object.entries(map)
        // `{{ account }}` is `{{account}}`; a line break is one, whatever the system wrote.
        .map(([key, value]) => [key, value.trim().replace(/\r\n?/g, "\n").replace(VAR, "{{$1}}")] as const)
        .filter(([, value]) => value),
    ) as Partial<Record<MailKey, string>>,
  );

// Said in the language of the request that broke it, not of the one that loaded this file.
const colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: () => tr("mailTemplates.colour") })
  .transform((c) => c.toLowerCase());

/** A logo: none, the platform's own, or a picture uploaded to this site. */
const logoChoice = z
  .string()
  .nullable()
  .refine((v) => v === null || v === "platform" || UPLOADED_LOGO.test(v), { error: () => tr("mailTemplates.logoFile") })
  .default(null);

export const mailTemplatesSchema = z.object({
  ar: texts,
  en: texts,
  fr: texts,
  look: z
    .preprocess(
      // Saved before the two logos: `logo` was the university's seal, on or off.
      (v) => {
        if (!v || typeof v !== "object" || !("logo" in v) || "universityLogo" in v) return v;
        const { logo, ...rest } = v as { logo?: unknown };
        return { ...rest, universityLogo: logo === true ? "platform" : null };
      },
      z.object({ header: colour, accent: colour, universityLogo: logoChoice, facultyLogo: logoChoice }),
    )
    .default(DEFAULT_LOOK),
});

export type MailTemplates = z.infer<typeof mailTemplatesSchema>;

export const EMPTY_TEMPLATES: MailTemplates = { ar: {}, en: {}, fr: {}, look: DEFAULT_LOOK };

/**
 * What the administration saved — read for every message: they are few, and
 * a change shows in the next one sent. A row that no longer passes the schema
 * is read as nothing, and the platform's own words go out instead.
 */
export async function savedMailTemplates(): Promise<MailTemplates | null> {
  const row = await prisma.siteContent.findUnique({ where: { slug: MAIL_SLUG } });
  if (!row) return null;
  const parsed = mailTemplatesSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
}

const fill = (text: string, params?: Params) =>
  params ? text.replace(/\{\{(\w+)\}\}/g, (all, name: string) => (name in params ? String(params[name]) : all)) : text;

/** The words of one language: the administration's where it wrote them, the platform's elsewhere. */
export function sayIn(doc: MailTemplates, lang: Lang): Say {
  const own = doc[lang] as Partial<Record<string, string>>;
  return (key, params) => {
    const text = own[key];
    return text ? fill(text, params) : tr(key, params, lang);
  };
}

/** What fills a message: who it is for, and its link and facts. */
export interface MailVars {
  account: string;
  /** The button's link — made here, by the server, always. */
  url?: string;
  minutes?: number;
  hours?: number;
  when?: string;
  /** «Your password was changed»: by the administration rather than its owner. */
  byAdmin?: boolean;
  device?: string;
  ip?: string;
}

/** Why the logos cannot go out as chosen — an uploaded picture gone, too heavy, or not a PNG or JPEG — or nothing. */
export function logoProblem(doc: MailTemplates): string | null {
  for (const choice of [doc.look.universityLogo, doc.look.facultyLogo])
    if (choice && choice !== "platform" && !uploadedImage(choice)) return tr("mailTemplates.logoFile");
  return null;
}

const CID: Record<LogoSlot, string> = { university: "seal@mudhakkirati", faculty: "faculty@mudhakkirati" };
const EXT = { "image/png": "png", "image/jpeg": "jpg" } as const;

/**
 * A message, as it is sent — or, with `preview`, as the administration sees
 * it before saving: the logos drawn in the page instead of attached.
 */
export function composeMail(
  kind: MailKind,
  v: MailVars,
  doc: MailTemplates,
  lang: Lang = currentLang(),
  preview = false,
): Omit<Mail, "to"> {
  const say = sayIn(doc, lang);
  const account = { account: v.account };
  const url = v.url ?? "";
  const content =
    kind === "reset"
      ? {
          title: say("mail.reset.title"),
          lines: [say("mail.reset.intro", account)],
          action: { label: say("mail.reset.action"), url },
          notes: [say("mail.reset.expires", { minutes: v.minutes ?? config.RESET_LINK_MINUTES }), say("mail.ignore")],
        }
      : kind === "verify"
        ? {
            title: say("mail.verify.title"),
            lines: [say("mail.verify.intro", account)],
            action: { label: say("mail.verify.action"), url },
            notes: [say("mail.verify.expires", { hours: v.hours ?? config.VERIFY_LINK_HOURS }), say("mail.ignore")],
          }
        : kind === "passwordChanged"
          ? {
              title: say("mail.passwordChanged.title"),
              lines: [say(v.byAdmin ? "mail.passwordChanged.byAdmin" : "mail.passwordChanged.intro", { ...account, when: v.when ?? "" })],
              notes: [say("mail.notYou")],
            }
          : {
              title: say("mail.newDevice.title"),
              lines: [say("mail.newDevice.intro", account)],
              facts: [
                say("mail.newDevice.device", { device: v.device ?? "?" }),
                say("mail.newDevice.ip", { ip: v.ip ?? "?" }),
                say("mail.newDevice.when", { when: v.when ?? "" }),
              ],
              action: { label: say("mail.newDevice.action"), url },
              notes: [say("mail.newDevice.notYou")],
            };
  const images: Record<LogoSlot, MailImage | null> = {
    university: logoImage("university", doc.look.universityLogo),
    faculty: logoImage("faculty", doc.look.facultyLogo),
  };
  const band = (slot: LogoSlot): BandLogo | null => {
    const img = images[slot];
    if (!img) return null;
    const src = preview ? `data:${img.contentType};base64,${img.content.toString("base64")}` : `cid:${CID[slot]}`;
    return { src, width: img.width, height: img.height };
  };
  const { html, text } = renderMail(content, lang, {
    say,
    look: doc.look,
    logos: { university: band("university"), faculty: band("faculty") },
  });
  const attachments = preview
    ? []
    : (Object.keys(images) as LogoSlot[]).flatMap((slot) => {
        const img = images[slot];
        return img ? [{ filename: `${slot}.${EXT[img.contentType]}`, content: img.content, cid: CID[slot], contentType: img.contentType }] : [];
      });
  return {
    // One line, whatever was saved before the rule.
    subject: say(`mail.${kind}.subject` as MessageKey).replace(/\s+/g, " ").trim(),
    html,
    text,
    ...(attachments.length ? { attachments } : {}),
  };
}

/** A message to send now, in the language of the request — with what the administration saved, if anything. */
export async function mailFor(kind: MailKind, v: MailVars, lang: Lang = currentLang()): Promise<Omit<Mail, "to">> {
  // A database that cannot answer must not hold back a reset link: the platform's words go instead.
  const doc = await savedMailTemplates().catch(() => null);
  return composeMail(kind, v, doc ?? EMPTY_TEMPLATES, lang);
}

/* ── For the editor: the values a preview is filled with ───────── */

const SAMPLE_ACCOUNT: Record<Lang, string> = {
  ar: "أمين حداد · 202012345678",
  en: "Amine Haddad · 202012345678",
  fr: "Amine Haddad · 202012345678",
};

/** Made-up values, shaped like the real ones: the link points nowhere. */
export function sampleVars(kind: MailKind, lang: Lang, byAdmin = false): MailVars {
  const origin = config.FRONTEND_ORIGIN.replace(/\/+$/, "");
  return {
    account: SAMPLE_ACCOUNT[lang],
    url:
      kind === "newDevice"
        ? `${origin}/${lang}/account?tab=security`
        : `${origin}/${lang}/${kind === "verify" ? "verify-email" : "reset-password"}?token=EXAMPLE`,
    minutes: config.RESET_LINK_MINUTES,
    hours: config.VERIFY_LINK_HOURS,
    when: mailTime(new Date(), lang),
    byAdmin,
    device: "Chrome · Windows",
    // An address kept for examples (RFC 5737): it is nobody's.
    ip: "192.0.2.10",
  };
}
