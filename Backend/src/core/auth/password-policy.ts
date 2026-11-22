/**
 * ============================================================
 * PASSWORD POLICY — for the passwords people choose themselves
 * ============================================================
 *
 * The length was all that was checked, so "password1", "azerty123" or a
 * student's own registration number passed. A guessing attacker tries exactly
 * those first, and the per-account lock (core/auth/login-throttle) only slows
 * them down: five guesses every few minutes reach "azerty123" quickly.
 *
 * So a chosen password must also:
 *  - mix letters with digits or symbols — or be a long passphrase;
 *  - not be one of the passwords everyone tries (with its year or "!" removed,
 *    and "@" read as "a", "0" as "o"…);
 *  - not be a run of the keyboard or the alphabet, or one character repeated;
 *  - not contain its owner's registration or employee number.
 *
 * Its owner's name is allowed — a decision of the administration: people build
 * passwords they remember on their names, and the other rules still ask for
 * more than the name alone ("Benali" is refused, "Benali#2026" is not).
 *
 * A password the administration hands out (a birth date) is not judged here:
 * its owner must replace it before using the account anyway
 * (`User.mustChangePassword`), and the replacement is.
 *
 * The client mirrors these rules to guide the person typing
 * (client/src/features/account/lib/password-rules.ts); this file decides.
 */

export const PASSWORD_MIN = 8;
/** bcrypt reads 72 bytes and ignores the rest — an Arabic letter is two. */
export const PASSWORD_MAX_BYTES = 72;
/** A passphrase this long needs no digit or symbol. */
export const PASSPHRASE_MIN = 14;

export type PasswordIssue = "tooShort" | "tooLong" | "needsMix" | "common" | "pattern" | "personal";

/** What is known about the account — anything the password must not contain. */
export interface PasswordOwner {
  registrationNumber?: string | null;
  employeeNumber?: string | null;
}

/**
 * The passwords tried first, lower-case and without the digits or symbols
 * people add at either end ("Azerty2024!" is "azerty"). French and Arabic
 * habits included, and this university's own words.
 */
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

/** Rows and runs a finger or the alphabet produces without thinking. */
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

/**
 * One spelling for comparing: lower case, Arabic without its vowel marks and
 * tatweel, its alef forms, tāʾ marbūṭa and alif maqṣūra unified.
 */
export function normalizeForCompare(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // é → e
    .normalize("NFC");
}

const isLetter = (ch: string) => /\p{L}/u.test(ch);

/** The password without what people add at either end: digits, symbols, spaces. */
const core = (pw: string) => pw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

const deLeet = (s: string) => [...s].map((c) => LEET[c] ?? c).join("");

function isRun(s: string): boolean {
  if (s.length < 4) return false;
  return RUNS.some((run) => run.includes(s) || [...run].reverse().join("").includes(s));
}

const repeats = (s: string) => s.length >= 4 && /^(.{1,4}?)\1+$/u.test(s);

/**
 * The account's own numbers. Printed on a student card or a staff list, they
 * are the first thing anyone holding one would try. A name is not refused:
 * its owner may build a password on it.
 */
function personalTokens(owner: PasswordOwner): string[] {
  return [owner.registrationNumber, owner.employeeNumber]
    .map((id) => id?.trim() ?? "")
    .filter((id) => id.length >= 4)
    .map(normalizeForCompare);
}

/** The first rule this password breaks, or null when it may be used. */
export function passwordIssue(pw: string, owner: PasswordOwner = {}): PasswordIssue | null {
  const chars = [...pw];
  if (chars.length < PASSWORD_MIN) return "tooShort";
  if (Buffer.byteLength(pw, "utf8") > PASSWORD_MAX_BYTES) return "tooLong";

  const letters = chars.filter(isLetter).length;
  if (letters === 0 || (letters === chars.length && chars.length < PASSPHRASE_MIN)) return "needsMix";

  const lower = normalizeForCompare(pw);
  const stripped = core(lower);
  const candidates = [lower, stripped, deLeet(stripped), core(deLeet(lower)), lower.replace(/\s+/g, "")];
  // The letters alone, and the rest alone: "a1z2e3r4t5y6" is still azerty,
  // "12345678a" still a run of digits.
  const lettersOnly = lower.replace(/[^\p{L}]/gu, "");
  const rest = lower.replace(/\p{L}/gu, "");
  if (candidates.some((c) => COMMON.has(c)) || (lettersOnly.length >= 4 && COMMON.has(lettersOnly)))
    return "common";

  if (new Set(chars.map((c) => c.toLowerCase())).size < 4) return "pattern";
  const letterCore = core(deLeet(lower));
  if (isRun(letterCore) || isRun(stripped) || isRun(lettersOnly)) return "pattern";
  // "abcabcab", "abab1212": a short chunk said again and again.
  const plain = (s: string) => s.length === 0 || repeats(s) || isRun(s) || new Set(s).size < 3;
  if (repeats(lower) || repeats(letterCore) || (repeats(lettersOnly) && plain(rest))) return "pattern";
  if (lettersOnly.length <= 2 && plain(rest)) return "pattern";

  const flat = lower.replace(/[\s\-_.]+/g, "");
  if (personalTokens(owner).some((t) => flat.includes(t.replace(/[\s\-_.]+/g, "")))) return "personal";

  return null;
}
