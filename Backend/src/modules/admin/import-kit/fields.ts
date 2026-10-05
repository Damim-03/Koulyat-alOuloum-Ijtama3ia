import { z } from "zod";
import { latinFirstName, latinLastName } from "../admin.validation";
import type { RawRow } from "./parser";
import { latinDigits, loose } from "./match";
import { REQUIRED, type RowCheck } from "./report";

/**
 * الحقول الشخصية المشتركة بين الطلبة والأساتذة، بقاعدةٍ واحدة لكليهما:
 * الاسم واللقب (بالعربية واللاتينية)، والجنس، والتوثيق، والبريد الشخصي،
 * والهاتف، وكلمة المرور. ولكلّ استيرادٍ بعد ذلك حقوله هو.
 */

const GENDER: Record<string, "male" | "female"> = Object.fromEntries(
  (
    [
      ["ذكر", "male"],
      ["أنثى", "female"],
      ["male", "male"],
      ["female", "female"],
      ["m", "male"],
      ["f", "female"],
      ["h", "male"],
      ["homme", "male"],
      ["femme", "female"],
      ["masculin", "male"],
      ["féminin", "female"],
    ] as const
  ).map(([k, v]) => [loose(k), v]),
);
const GENDER_LABEL = { male: "ذكر", female: "أنثى" } as const;

const VERIFIED: Record<string, boolean> = Object.fromEntries(
  (
    [
      ["موثّق", true],
      ["غير موثّق", false],
      ["نعم", true],
      ["لا", false],
      ["oui", true],
      ["non", false],
      ["yes", true],
      ["no", false],
      ["true", true],
      ["false", false],
      ["1", true],
      ["0", false],
    ] as const
  ).map(([k, v]) => [loose(k), v]),
);
const VERIFIED_LABEL = (v: boolean) => (v ? "موثّق" : "غير موثّق");

export const ROLE_LABEL: Record<string, string> = { student: "طالب", professor: "أستاذ", admin: "مسؤول" };

/** نطاقات بريدٍ يُخطأ في كتابتها كثيراً ← صوابها. */
const MAIL_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.fr": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
};

/** جوّالٌ جزائري (05/06/07 وثمانية أرقام) أو ثابت (تسعة أرقام)، بالصفر أو بـ213. */
const ALGERIAN_PHONE = /^(0[5-7]\d{8}|0[1-49]\d{7}|213[5-7]\d{8}|213[1-49]\d{7})$/;
const NAME_CHAR = /[\p{L}\p{M}\s'’\-.]/u;
const LATIN_NAME_CHAR = /[A-Za-zÀ-ÖØ-öø-ÿ '\-]/;
const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
export const emailSchema = z.string().email();

// ── helpers ──

export const groupBy = <T>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const t of items) {
    const k = key(t);
    if (k) m.set(k, [...(m.get(k) ?? []), t]);
  }
  return m;
};
/** أرقام الصفوف الأخرى التي تحمل القيمة نفسها. */
export const others = (rows: RawRow[] | undefined, self: number) =>
  (rows ?? []).map((r) => r.row).filter((n) => n !== self);
export const oddChars = (s: string, allowed: RegExp) =>
  [...new Set([...s].filter((ch) => !allowed.test(ch)))].join(" ");
export const fullNameKey = (first: string, last: string) => `${loose(first)}|${loose(last)}`;
/** أرقامٌ لاتينية بلا مسافاتٍ ولا شرطات. */
export const compactDigits = (s: string) => latinDigits(s).replace(/[\s\-.]/g, "");

/** ما تحتاجه الحقول المشتركة عن الملف كلّه: ما يتكرّر فيه، وما سبق إلى المنصّة. */
export interface PersonContext {
  mailRows: Map<string, RawRow[]>;
  phoneRows: Map<string, RawRow[]>;
  nameRows: Map<string, RawRow[]>;
  /** بريدٌ شخصيّ مستعمَلٌ في المنصّة ← صاحبه. */
  takenMails: Map<string, { role: string; name: string }>;
}

export function personContext(rows: RawRow[]): Omit<PersonContext, "takenMails"> {
  const text = (r: RawRow, k: string) => r.cells[k]?.text ?? "";
  return {
    mailRows: groupBy(rows, (r) => text(r, "email").toLowerCase()),
    phoneRows: groupBy(rows, (r) => latinDigits(text(r, "phone")).replace(/\D/g, "")),
    nameRows: groupBy(rows, (r) =>
      text(r, "firstName") && text(r, "lastName") ? fullNameKey(text(r, "firstName"), text(r, "lastName")) : "",
    ),
  };
}

type PersonKey =
  | "firstName"
  | "lastName"
  | "firstNameLatin"
  | "lastNameLatin"
  | "gender"
  | "verified"
  | "email"
  | "phone"
  | "password";

export interface PersonFields {
  firstName: string;
  lastName: string;
  firstNameLatin?: string;
  lastNameLatin?: string;
  gender?: "male" | "female";
  isVerified: boolean;
  email?: string;
  phone?: string;
  password?: string;
}

/**
 * الحقول الشخصية كلّها لصفٍّ واحد.
 *
 * `namesakes(key)` مَن في المنصّة بالاسم واللقب نفسيهما (معرّفاتهم)، و`noun`
 * و`pair` للرسائل («طالبٌ…» / «طالبان أم تكرار؟»)، و`identifier` ما لا تكون
 * كلمة المرور مثله (رقم التسجيل، الرقم الوظيفي).
 */
export function checkPerson<K extends string>(
  r: RowCheck<K | PersonKey>,
  ctx: PersonContext,
  opts: {
    headers: Record<"firstNameLatin" | "lastNameLatin", string>;
    namesakes: (key: string) => string[];
    noun: string;
    pair: string;
    identifier?: { value: string; label: string };
  },
): PersonFields {
  const row = r.raw.row;

  // ── الاسم واللقب ──
  const checkName = (k: "firstName" | "lastName", latinCol: string) => {
    if (r.blocked(k)) return "";
    const v = r.value(k).replace(/\s+/g, " ");
    if (!v) {
      r.error(k, REQUIRED);
      return "";
    }
    const odd = oddChars(v, NAME_CHAR);
    if (/[\d٠-٩۰-۹]/.test(v)) r.error(k, "فيه أرقام — لعلّ الأعمدة انزاحت؟");
    else if (odd) r.error(k, `فيه رموزٌ لا تكون في الأسماء: «${odd}».`);
    else if (v.length > 60) r.error(k, `${v.length} حرفاً، والحدّ 60 — لعلّه أكثر من اسم؟`);
    else if (!ARABIC.test(v) && LATIN.test(v))
      r.warn(k, `مكتوبٌ بحروفٍ لاتينية — مكانه عمود «${latinCol}»؟ يُحفظ كما هو.`);
    else if (ARABIC.test(v) && LATIN.test(v)) r.warn(k, "خليطٌ من حروفٍ عربية ولاتينية.");
    r.save(k, v);
    return r.blocked(k) ? "" : v;
  };
  const firstName = checkName("firstName", opts.headers.firstNameLatin);
  const lastName = checkName("lastName", opts.headers.lastNameLatin);
  if (firstName && lastName) {
    if (loose(firstName) === loose(lastName)) r.warn("lastName", "مطابقٌ للاسم — تأكّد منهما.");
    const key = fullNameKey(firstName, lastName);
    const dup = others(ctx.nameRows.get(key), row);
    if (dup.length) r.warn("firstName", `الاسم واللقب نفسهما في الصفّ ${dup.join("، ")} — ${opts.pair} أم تكرار؟`);
    const same = opts.namesakes(key);
    if (same.length)
      r.warn(
        "firstName",
        `في المنصّة ${opts.noun} بالاسم واللقب نفسيهما (${same.join("، ")}) — تأكّد أنّه ليس هو.`,
      );
  }

  // ── الاسم واللقب باللاتينية — القاعدة نفسها في نافذة الإضافة ──
  const checkLatin = (k: "firstNameLatin" | "lastNameLatin", schema: typeof latinFirstName, example: string) => {
    const v = r.value(k);
    if (r.blocked(k) || !v) return undefined;
    const p = schema.safeParse(v);
    if (p.success) {
      r.save(k, p.data);
      return p.data;
    }
    const odd = oddChars(v.replace(/\s+/g, " "), LATIN_NAME_CHAR);
    if (v.trim().length > 60) r.error(k, `${v.trim().length} حرفاً، والحدّ 60.`);
    else if (odd) r.error(k, `حروفٌ لاتينية فقط، مثل ${example} — فيه «${odd}».`);
    else r.error(k, `حروفٌ لاتينية فقط، مثل ${example}.`);
    return undefined;
  };
  const firstNameLatin = checkLatin("firstNameLatin", latinFirstName, "Youcef");
  const lastNameLatin = checkLatin("lastNameLatin", latinLastName, "HAMADI");
  if (r.value("firstNameLatin") && !r.value("lastNameLatin") && !r.blocked("firstNameLatin"))
    r.warn("lastNameLatin", `فارغ، و«${opts.headers.firstNameLatin}» مملوء.`);
  if (r.value("lastNameLatin") && !r.value("firstNameLatin") && !r.blocked("lastNameLatin"))
    r.warn("firstNameLatin", `فارغ، و«${opts.headers.lastNameLatin}» مملوء.`);

  // ── الجنس والتوثيق ──
  let gender: "male" | "female" | undefined;
  if (r.value("gender") && !r.blocked("gender")) {
    gender = GENDER[loose(r.value("gender"))];
    if (gender) r.save("gender", GENDER_LABEL[gender]);
    else r.error("gender", `«${r.value("gender")}» ليست قيمةً للجنس — «ذكر» أو «أنثى».`);
  }
  let isVerified = false;
  if (!r.blocked("verified")) {
    if (!r.value("verified")) r.cells.verified.saved = VERIFIED_LABEL(false);
    else {
      const v = VERIFIED[loose(r.value("verified"))];
      if (v === undefined) r.error("verified", `«${r.value("verified")}» ليست قيمةً — «موثّق» أو «غير موثّق».`);
      else {
        isVerified = v;
        r.save("verified", VERIFIED_LABEL(v));
      }
    }
  }

  // ── البريد — يُقارَن بحروفٍ صغيرة، ويُحفظ كما كُتب، كما تحفظه نافذة الإضافة ──
  let email: string | undefined;
  {
    const v = r.value("email");
    if (v && !r.blocked("email")) {
      const lower = v.toLowerCase();
      const domain = lower.split("@")[1] ?? "";
      const dup = others(ctx.mailRows.get(lower), row);
      const taken = ctx.takenMails.get(lower);
      if (/\s/.test(v)) r.error("email", "فيه مسافة.");
      else if (/[^\x21-\x7e]/.test(v))
        r.error("email", `فيه حروفٌ لا تكون في البريد: «${oddChars(v, /[\x21-\x7e]/)}».`);
      else if (!emailSchema.safeParse(lower).success) r.error("email", "صيغة بريدٍ غير صحيحة، مثل name@example.com.");
      else if (dup.length) r.error("email", `مكرّر في الملف — في الصفّ ${dup.join("، ")} أيضاً.`);
      else if (taken)
        r.error("email", `مستعمَلٌ في المنصّة لحساب ${ROLE_LABEL[taken.role] ?? taken.role}: ${taken.name || "—"}.`);
      else if (MAIL_TYPOS[domain]) r.warn("email", `هل تقصد @${MAIL_TYPOS[domain]}؟ النطاق «${domain}» خطأٌ شائع.`);
      if (!r.blocked("email")) email = v;
    }
  }

  // ── الهاتف ──
  let phone: string | undefined;
  {
    const v = r.value("phone");
    if (v && !r.blocked("phone")) {
      const compact = latinDigits(v).replace(/[\s\-.()/]/g, "");
      if (!/^\+?\d+$/.test(compact)) r.error("phone", `أرقامٌ فقط — فيه «${oddChars(compact, /[\d+]/)}».`);
      else {
        let p = compact.replace(/^\+/, "");
        if (p.startsWith("00")) {
          p = p.slice(2);
          r.info("phone", "حُذف «00» الدوليّ من أوّله.");
        }
        // خانةٌ عدديّة تحذف الصفر الأوّل: 550000004 هو 0550000004.
        if (/^\d{9}$/.test(p) && !p.startsWith("0")) {
          p = `0${p}`;
          r.info("phone", "أُعيد الصفر الأوّل الذي حذفه Excel.");
        }
        if (!/^\d{9,13}$/.test(p)) r.error("phone", `فيه ${p.length} أرقام، والمقبول من 9 إلى 13.`);
        else {
          phone = p;
          r.save("phone", p);
          if (!ALGERIAN_PHONE.test(p)) r.warn("phone", "ليس بصيغة رقمٍ جزائري مألوفة (مثل 0661234567) — يُحفظ كما هو.");
          const dup = others(ctx.phoneRows.get(compact.replace(/\D/g, "")), row);
          if (dup.length) r.warn("phone", `الرقم نفسه في الصفّ ${dup.join("، ")}.`);
        }
      }
    }
  }

  // ── كلمة المرور — لا تُعاد إلى المتصفّح: نجومٌ بطولها ──
  let password: string | undefined;
  {
    const rc = r.raw.cells.password;
    if (!r.blocked("password")) {
      if (!rc?.raw) r.auto("password", "تُولَّد تلقائياً");
      else {
        const pw = rc.text;
        r.cells.password.value = "•".repeat(Math.min(rc.raw.length, 16));
        r.info("password", `طولها ${pw.length}.`);
        if (rc.raw !== pw) r.warn("password", "في طرفيها مسافةٌ حُذفت — كلمة المرور بدونها.");
        if (pw.length < 8 || pw.length > 72)
          r.error("password", "من 8 إلى 72 حرفاً — أو اتركها فارغة ليولّدها النظام.");
        else {
          password = pw;
          const id = opts.identifier;
          if (id?.value && pw === id.value) r.warn("password", `مطابقةٌ لـ${id.label} — سهلة التخمين.`);
          else if (/^\d+$/.test(pw) || /^(.)\1+$/.test(pw)) r.warn("password", "ضعيفة: أرقامٌ فقط أو حرفٌ واحدٌ مكرّر.");
          else if (
            [lastName, firstName, firstNameLatin, lastNameLatin]
              .filter((n): n is string => !!n)
              .some((n) => loose(n) === loose(pw))
          )
            r.warn("password", "هي اسم صاحبها أو لقبه — سهلة التخمين.");
        }
      }
    }
  }

  return { firstName, lastName, firstNameLatin, lastNameLatin, gender, isVerified, email, phone, password };
}
