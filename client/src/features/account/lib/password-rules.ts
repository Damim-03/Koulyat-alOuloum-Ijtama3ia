/**
 * The password policy, as the person typing sees it.
 *
 * The server decides (Backend/src/core/auth/password-policy.ts); this copy of
 * its rules lets the form say *which* rule a password breaks while it is being
 * typed, rather than after a round trip. Keep the two in step.
 *
 * The owner's name is allowed; only the account's own id numbers are refused.
 */

import type { TFunction } from "i18next";
import type { MyAccount } from "../../../types/account";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;
export const PASSPHRASE_MIN = 14;

export type PasswordIssue = "tooShort" | "tooLong" | "needsMix" | "common" | "pattern" | "personal";

export interface PasswordOwner {
  registrationNumber?: string | null;
  employeeNumber?: string | null;
}

/** What a password may not contain, read from the account: its id numbers. */
export const ownerOf = (a: MyAccount): PasswordOwner => ({
  registrationNumber: a.student?.registrationNumber,
  employeeNumber: a.professor?.employeeNumber,
});

const COMMON = new Set([
  "password", "passwort", "passw", "pass", "motdepasse", "mdp", "secret", "secrets",
  "azerty", "azertyuiop", "qwerty", "qwertyuiop", "qwertz", "asdfgh", "asdfghjkl", "zxcvbn",
  "abc", "abcd", "abcde", "abcdef", "abcdefg", "abcdefgh", "abcabc", "aaaaaa",
  "admin", "administrator", "administrateur", "root", "user", "utilisateur", "login", "welcome",
  "bienvenue", "hello", "bonjour", "salut", "salam", "marhaba", "test", "testing", "demo", "guest",
  "iloveyou", "jetaime", "loveyou", "love", "amour", "princess", "princesse", "sunshine", "monkey",
  "dragon", "master", "shadow", "football", "soccer", "baseball", "superman", "batman", "pokemon",
  "starwars", "letmein", "trustno", "whatever", "freedom", "liberte", "computer", "ordinateur",
  "internet", "google", "facebook", "instagram", "youtube", "samsung", "iphone", "nokia",
  "algerie", "algeria", "algerien", "dzair", "djazair", "eloued", "oued", "souf", "elouedsouf",
  "univ", "universite", "university", "universitaire", "etudiant", "etudiante", "student", "students",
  "professeur", "professor", "prof", "enseignant", "memoire", "memoires", "mymemoire", "these",
  "licence", "doctorat", "faculte", "faculty", "sciences", "social", "sociales",
  "allah", "bismillah", "alhamdulillah", "subhanallah", "mashallah", "inshallah",
  "كلمةالسر", "كلمةالمرور", "كلمةسر", "الجزائر", "جامعة", "الجامعة", "الوادي", "طالب", "مذكرتي",
  "بسمالله", "الحمدلله", "سبحانالله", "ماشاءالله", "حبيبي",
]);

const RUNS = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "qwertyuiopasdfghjklzxcvbnm",
  "azertyuiopqsdfghjklmwxcvbn",
  "qwertzuiopasdfghjklyxcvbnm",
  "1qaz2wsx3edc4rfv5tgb6yhn",
  "ابتثجحخدذرزسشصضطظعغفقكلمنهوي",
];

const LEET: Record<string, string> = { "@": "a", "4": "a", "0": "o", "1": "i", "!": "i", "3": "e", "5": "s", "$": "s", "7": "t" };

export function normalizeForCompare(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC");
}

const isLetter = (ch: string) => /\p{L}/u.test(ch);
const core = (pw: string) => pw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
const deLeet = (s: string) => [...s].map((c) => LEET[c] ?? c).join("");
const isRun = (s: string) =>
  s.length >= 4 && RUNS.some((run) => run.includes(s) || [...run].reverse().join("").includes(s));
const repeats = (s: string) => s.length >= 4 && /^(.{1,4}?)\1+$/u.test(s);
const byteLength = (s: string) => new TextEncoder().encode(s).length;

function personalTokens(owner: PasswordOwner): string[] {
  return [owner.registrationNumber, owner.employeeNumber]
    .map((id) => id?.trim() ?? "")
    .filter((id) => id.length >= 4)
    .map(normalizeForCompare);
}

/** Each rule on its own — for the checklist under the field. */
export function passwordChecks(pw: string, owner: PasswordOwner = {}) {
  const chars = [...pw];
  const lower = normalizeForCompare(pw);
  const stripped = core(lower);
  const lettersOnly = lower.replace(/[^\p{L}]/gu, "");
  const rest = lower.replace(/\p{L}/gu, "");
  const letters = chars.filter(isLetter).length;

  const candidates = [lower, stripped, deLeet(stripped), core(deLeet(lower)), lower.replace(/\s+/g, "")];
  const common = candidates.some((c) => COMMON.has(c)) || (lettersOnly.length >= 4 && COMMON.has(lettersOnly));

  const letterCore = core(deLeet(lower));
  const plain = (s: string) => s.length === 0 || repeats(s) || isRun(s) || new Set(s).size < 3;
  const pattern =
    new Set(chars.map((c) => c.toLowerCase())).size < 4 ||
    isRun(letterCore) ||
    isRun(stripped) ||
    isRun(lettersOnly) ||
    repeats(lower) ||
    repeats(letterCore) ||
    (repeats(lettersOnly) && plain(rest)) ||
    (lettersOnly.length <= 2 && plain(rest));

  const flat = lower.replace(/[\s\-_.]+/g, "");
  const personal = personalTokens(owner).some((t) => flat.includes(t.replace(/[\s\-_.]+/g, "")));

  return {
    length: chars.length >= PASSWORD_MIN && byteLength(pw) <= PASSWORD_MAX_BYTES,
    mix: letters > 0 && (letters < chars.length || chars.length >= PASSPHRASE_MIN),
    notCommon: !!pw && !common && !pattern,
    notPersonal: !!pw && !personal,
    // Not required — what makes a good password better.
    long: chars.length >= 12,
    symbol: /[^\p{L}\p{N}\s]/u.test(pw),
    _common: common,
    _pattern: pattern,
  };
}

/** The first rule broken, in the order the server checks them — or null. */
export function passwordIssue(pw: string, owner: PasswordOwner = {}): PasswordIssue | null {
  const c = passwordChecks(pw, owner);
  if ([...pw].length < PASSWORD_MIN) return "tooShort";
  if (byteLength(pw) > PASSWORD_MAX_BYTES) return "tooLong";
  if (!c.mix) return "needsMix";
  if (c._common) return "common";
  if (c._pattern) return "pattern";
  if (!c.notPersonal) return "personal";
  return null;
}

/** Why a new password is refused, once it is long enough for that to be worth saying. */
export const passwordIssueText = (t: TFunction, value: string, issue: PasswordIssue | null) =>
  issue && issue !== "tooShort" && value.length >= PASSWORD_MIN ? t(`admin.account.password.issue.${issue}`) : undefined;

/** 0 nothing typed · 1 refused · 2 fair · 3 good · 4 strong. */
export function passwordLevel(pw: string, owner: PasswordOwner = {}): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  if (passwordIssue(pw, owner)) return 1;
  const c = passwordChecks(pw, owner);
  const cases = /\p{Ll}/u.test(pw) && /\p{Lu}/u.test(pw);
  const bonus = Number(c.long) + Number(c.symbol) + Number(cases);
  return bonus >= 2 ? 4 : bonus === 1 ? 3 : 2;
}
