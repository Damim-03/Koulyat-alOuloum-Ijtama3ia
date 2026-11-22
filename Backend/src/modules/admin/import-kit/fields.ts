import { z } from "zod";
import { latinFirstName, latinLastName } from "../admin.validation";
import type { RawRow } from "./parser";
import { tr } from "../../../core/i18n";
import { latinDigits, loose, sep } from "./match";
import { required, type RowCheck } from "./report";

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
/**
 * أرقام الصفوف الأخرى التي تحمل القيمة نفسها. والمجموعة موجودةٌ دائماً: بُنيت
 * من صفوف الملف كلّها بالمفتاح نفسه، وفيها الصفّ السائل نفسه.
 */
export const others = (rows: RawRow[] | undefined, self: number) =>
  rows!.map((r) => r.row).filter((n) => n !== self);
export const oddChars = (s: string, allowed: RegExp) =>
  [...new Set([...s].filter((ch) => !allowed.test(ch)))].join(" ");
export const fullNameKey = (first: string, last: string) => `${loose(first)}|${loose(last)}`;
/** أرقامٌ لاتينية بلا مسافاتٍ ولا شرطات. */
export const compactDigits = (s: string) => latinDigits(s).replace(/[\s\-.]/g, "");

/** ما تحتاجه الحقول المشتركة عن الملف كلّه: ما يتكرّر فيه، وما سبق إلى المنصّة. */
export interface PersonContext {
  mailRows: Map<string, RawRow[]>;
  phoneRows: Map<string, RawRow[]>;
  /** الاسم واللقب باللاتينية — المطلوبان في كلّ صفّ. */
  latinNameRows: Map<string, RawRow[]>;
  /** بريدٌ شخصيّ مستعمَلٌ في المنصّة ← صاحبه. */
  takenMails: Map<string, { role: string; name: string }>;
}

export function personContext(rows: RawRow[]): Omit<PersonContext, "takenMails"> {
  const text = (r: RawRow, k: string) => r.cells[k]?.text ?? "";
  return {
    mailRows: groupBy(rows, (r) => text(r, "email").toLowerCase()),
    phoneRows: groupBy(rows, (r) => latinDigits(text(r, "phone")).replace(/\D/g, "")),
    latinNameRows: groupBy(rows, (r) =>
      text(r, "firstNameLatin") && text(r, "lastNameLatin")
        ? fullNameKey(text(r, "firstNameLatin"), text(r, "lastNameLatin"))
        : "",
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
  /** "" حين لا يُطلب العربيّ ويُترك فارغاً. */
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
 *
 * والاسم واللقب باللاتينية إلزاميّان للطلبة والأساتذة معاً، والعربيّان
 * اختياريّان. ومقارنة الأسماء (التكرار في الملف، ومن سبق إلى المنصّة)
 * باللاتينية، فهي الموجودة في كلّ صفّ.
 */
export function checkPerson<K extends string>(
  r: RowCheck<K | PersonKey>,
  ctx: PersonContext,
  opts: {
    headers: Record<"firstNameLatin" | "lastNameLatin", string>;
    namesakes: (key: string) => string[];
    /** Who the file lists — the messages name them in the request's language. */
    noun: "student" | "professor";
    /** What the password must not equal: a registration or an employee number. */
    identifier?: { value: string; kind: "registration" | "employee" };
  },
): PersonFields {
  const row = r.raw.row;

  /** الاسم واللقب نفسهما في صفٍّ آخر من الملف، أو لشخصٍ في المنصّة. */
  const compareNames = (
    first: string,
    last: string,
    rows: Map<string, RawRow[]>,
    at: { first: K | PersonKey; last: K | PersonKey },
  ) => {
    if (loose(first) === loose(last)) r.warn(at.last, tr("imp.person.sameAsFirst"));
    const key = fullNameKey(first, last);
    const dup = others(rows.get(key), row);
    if (dup.length) r.warn(at.first, tr("imp.person.sameInFile", { rows: dup.join(sep()), noun: opts.noun }));
    const same = opts.namesakes(key);
    if (same.length) r.warn(at.first, tr("imp.person.namesake", { noun: opts.noun, list: same.join(sep()) }));
  };

  // ── الاسم واللقب ──
  const checkName = (k: "firstName" | "lastName", latinCol: string) => {
    if (r.blocked(k)) return "";
    const v = r.value(k).replace(/\s+/g, " ");
    if (!v) return "";
    const odd = oddChars(v, NAME_CHAR);
    if (/[\d٠-٩۰-۹]/.test(v)) r.error(k, tr("imp.person.hasDigits"));
    else if (odd) r.error(k, tr("imp.person.oddChars", { odd }));
    else if (v.length > 60) r.error(k, tr("imp.person.tooLongName", { length: v.length }));
    else if (!ARABIC.test(v) && LATIN.test(v)) r.warn(k, tr("imp.person.latinInArabic", { column: latinCol }));
    else if (ARABIC.test(v) && LATIN.test(v)) r.warn(k, tr("imp.person.mixedScripts"));
    r.save(k, v);
    return r.blocked(k) ? "" : v;
  };
  const firstName = checkName("firstName", opts.headers.firstNameLatin);
  const lastName = checkName("lastName", opts.headers.lastNameLatin);
  // اختياريّان: لكن أحدهما دون الآخر نصفُ اسم.
  // The column names stay as the file has them: they are its language.
  if (r.value("firstName") && !r.value("lastName") && !r.blocked("firstName"))
    r.warn("lastName", tr("imp.person.emptyButOther", { column: "الاسم" }));
  if (r.value("lastName") && !r.value("firstName") && !r.blocked("lastName"))
    r.warn("firstName", tr("imp.person.emptyButOther", { column: "اللقب" }));

  // ── الاسم واللقب باللاتينية — القاعدة نفسها في نافذة الإضافة ──
  const checkLatin = (k: "firstNameLatin" | "lastNameLatin", schema: typeof latinFirstName, example: string) => {
    const v = r.value(k);
    if (r.blocked(k)) return undefined;
    if (!v) {
      r.error(k, required());
      return undefined;
    }
    const p = schema.safeParse(v);
    if (p.success) {
      r.save(k, p.data);
      return p.data;
    }
    const odd = oddChars(v.replace(/\s+/g, " "), LATIN_NAME_CHAR);
    if (v.trim().length > 60) r.error(k, tr("imp.person.latinTooLong", { length: v.trim().length }));
    else if (odd) r.error(k, tr("imp.person.latinOnlyOdd", { example, odd }));
    else r.error(k, tr("imp.person.latinOnly", { example }));
    return undefined;
  };
  const firstNameLatin = checkLatin("firstNameLatin", latinFirstName, "Youcef");
  const lastNameLatin = checkLatin("lastNameLatin", latinLastName, "HAMADI");
  if (firstNameLatin && lastNameLatin)
    compareNames(firstNameLatin, lastNameLatin, ctx.latinNameRows, { first: "firstNameLatin", last: "lastNameLatin" });

  // ── الجنس والتوثيق ──
  let gender: "male" | "female" | undefined;
  if (r.value("gender") && !r.blocked("gender")) {
    gender = GENDER[loose(r.value("gender"))];
    if (gender) r.save("gender", GENDER_LABEL[gender]);
    else r.error("gender", tr("imp.person.gender", { value: r.value("gender") }));
  }
  let isVerified = false;
  if (!r.blocked("verified")) {
    if (!r.value("verified")) r.cells.verified.saved = VERIFIED_LABEL(false);
    else {
      const v = VERIFIED[loose(r.value("verified"))];
      if (v === undefined) r.error("verified", tr("imp.person.verified", { value: r.value("verified") }));
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
      if (/\s/.test(v)) r.error("email", tr("imp.email.space"));
      else if (/[^\x21-\x7e]/.test(v)) r.error("email", tr("imp.email.oddChars", { odd: oddChars(v, /[\x21-\x7e]/) }));
      else if (!emailSchema.safeParse(lower).success) r.error("email", tr("imp.email.format", { example: "name@example.com" }));
      else if (dup.length) r.error("email", tr("imp.duplicateInFile", { rows: dup.join(sep()) }));
      else if (taken) r.error("email", tr("imp.email.taken", { role: taken.role, name: taken.name || "—" }));
      else if (MAIL_TYPOS[domain]) r.warn("email", tr("imp.email.typo", { fix: MAIL_TYPOS[domain], domain }));
      if (!r.blocked("email")) email = v;
    }
  }

  // ── الهاتف ──
  let phone: string | undefined;
  {
    const v = r.value("phone");
    if (v && !r.blocked("phone")) {
      const compact = latinDigits(v).replace(/[\s\-.()/]/g, "");
      if (!/^\+?\d+$/.test(compact)) r.error("phone", tr("imp.digitsOnly", { odd: oddChars(compact, /[\d+]/) }));
      else {
        let p = compact.replace(/^\+/, "");
        if (p.startsWith("00")) {
          p = p.slice(2);
          r.info("phone", tr("imp.phone.intlPrefix"));
        }
        // خانةٌ عدديّة تحذف الصفر الأوّل: 550000004 هو 0550000004.
        if (/^\d{9}$/.test(p) && !p.startsWith("0")) {
          p = `0${p}`;
          r.info("phone", tr("imp.phone.leadingZero"));
        }
        if (!/^\d{9,13}$/.test(p)) r.error("phone", tr("imp.phone.length", { length: p.length }));
        else {
          phone = p;
          r.save("phone", p);
          if (!ALGERIAN_PHONE.test(p)) r.warn("phone", tr("imp.phone.unusual"));
          const dup = others(ctx.phoneRows.get(compact.replace(/\D/g, "")), row);
          if (dup.length) r.warn("phone", tr("imp.phone.sameInFile", { rows: dup.join(sep()) }));
        }
      }
    }
  }

  // ── كلمة المرور — لا تُعاد إلى المتصفّح: نجومٌ بطولها ──
  let password: string | undefined;
  {
    const rc = r.raw.cells.password;
    if (!r.blocked("password")) {
      if (!rc?.raw) r.auto("password", tr("imp.autoGeneratedF"));
      else {
        const pw = rc.text;
        r.cells.password.value = "•".repeat(Math.min(rc.raw.length, 16));
        r.info("password", tr("imp.password.length", { length: pw.length }));
        if (rc.raw !== pw) r.warn("password", tr("imp.password.trimmed"));
        if (pw.length < 8 || pw.length > 72) r.error("password", tr("imp.password.range"));
        else {
          password = pw;
          const id = opts.identifier;
          if (id?.value && pw === id.value) r.warn("password", tr("imp.password.sameAsId", { id: id.kind }));
          else if (/^\d+$/.test(pw) || /^(.)\1+$/.test(pw)) r.warn("password", tr("imp.password.weak"));
          else if (
            [lastName, firstName, firstNameLatin, lastNameLatin]
              .filter((n): n is string => !!n)
              .some((n) => loose(n) === loose(pw))
          )
            r.warn("password", tr("imp.password.isName"));
        }
      }
    }
  }

  return { firstName, lastName, firstNameLatin, lastNameLatin, gender, isVerified, email, phone, password };
}
