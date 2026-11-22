/**
 * The registration number in whatever reached the desk's field:
 *
 * - typed by hand: `222239435819`, with spaces or dashes, or in Arabic-Indic
 *   digits (٢٢٢٢…);
 * - the card's QR code, read by the camera or pasted:
 *   `https://progres.mesrs.dz/check/222239435819`;
 * - the same code typed by a USB scanner. A scanner types as if the keyboard
 *   were English (QWERTY). On a French (AZERTY) keyboard the digit row then
 *   comes out as `à&é"'(-è_ç` and the link as `httpsM!!progres;…!check!éééé…`;
 *   on an Arabic one the letters become Arabic and the digits stay digits. So
 *   the number is read from the end, in either form.
 *
 * Registration numbers are 6 to 20 digits (the student import's own rule).
 */

/** The AZERTY digit row, typed by a scanner that thinks it is a QWERTY keyboard. */
const AZERTY_ROW: Record<string, string> = {
  "à": "0", "&": "1", "é": "2", '"': "3", "'": "4", "(": "5", "-": "6", "è": "7", "_": "8", "ç": "9",
};

const REG = /^\d{6,20}$/;

const latinDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export function readRegistration(input: string): string | null {
  const text = latinDigits(input).trim();
  if (!text) return null;

  // Typed by hand: the number alone, maybe spaced or dashed.
  const plain = text.replace(/[\s.-]/g, "");
  if (REG.test(plain)) return plain;

  // A link (pasted, from the camera, or from a scanner on an English or
  // Arabic keyboard): the digits it ends with.
  const flat = text.replace(/\s+/g, "");
  const tail = /\d+$/.exec(flat)?.[0];
  if (tail && REG.test(tail)) return tail;

  // From a scanner on a French keyboard: the digit row's other characters.
  const azerty = /[0-9à&é"'(è_ç-]+$/.exec(flat)?.[0];
  if (azerty) {
    const digits = [...azerty].map((c) => AZERTY_ROW[c] ?? c).join("");
    if (REG.test(digits)) return digits;
  }
  return null;
}

/**
 * A number typed by hand — digits, maybe spaced or dashed, maybe Arabic-Indic —
 * rather than a card's link (from the camera, a paste, or a QR reader).
 */
export function typedByHand(input: string): boolean {
  return /^[\d\s.\-٠-٩۰-۹]+$/.test(input.trim());
}

/** What a QR code read off a student card says about this account. */
export type CardQrVerdict = "match" | "other" | "foreign";

/**
 * The account's own number (`match`), another student's (`other`), or no
 * registration number at all — not a student card's code (`foreign`).
 */
export function cardQrVerdict(text: string, registration: string): CardQrVerdict {
  const read = readRegistration(text);
  return !read ? "foreign" : read === registration.trim() ? "match" : "other";
}
