import { z } from "zod";
import { imageUrl } from "../../core/validation/image-url";
import { latinFirstName, latinLastName } from "../admin/admin.validation";
import { zmsg } from "../../core/i18n/zod";

/**
 * What each role may change about its own account.
 *
 * The administration edits other people's accounts on its own routes; these
 * are the only ones where someone edits their own, and each role reaches a
 * different part of it:
 *
 *   admin     — everything about themselves: names, username, phone, gender,
 *               photo, the sign-in email (with the password) and the password.
 *   professor — their names (Arabic and Latin), gender, phone and photo, and
 *               their password. The university email, department and rank
 *               stay the administration's record.
 *   student   — their first and last name in Arabic (to correct, or to fill
 *               in when the administration left them empty), their email (with
 *               the password) and their password — nothing else (the user's
 *               decision, 2026-11-18). The Latin name, the gender and the whole
 *               record of their studies stay the administration's.
 *
 * Unknown keys are dropped by zod, so a `role` slipped into the body is simply
 * ignored. `null` clears a field.
 */

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ]{5,19}$/, zmsg("account.phoneInvalid"))
  .nullable()
  .optional();

export const adminProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  firstNameLatin: latinFirstName.nullable().optional(),
  lastNameLatin: latinLastName.nullable().optional(),
  username: z
    .string()
    .trim()
    .min(3, zmsg("account.usernameShort"))
    .max(30)
    .regex(/^[A-Za-z0-9._-]+$/, zmsg("account.usernameChars"))
    .nullable()
    .optional(),
  phone,
  gender: z.enum(["male", "female"]).nullable().optional(),
  avatarUrl: imageUrl.nullable().optional(),
});
export type AdminProfileDTO = z.infer<typeof adminProfileSchema>;

/**
 * The same fields as the administrator's, less the username — and a photo is
 * set only by uploading one (`POST /account/avatar`): here it can only be
 * removed, never pointed at an arbitrary address.
 */
// The Latin name is required for professors: it changes here, it never
// empties. The Arabic one is optional: `null` clears it.
export const professorProfileSchema = adminProfileSchema
  .pick({ gender: true, phone: true })
  .extend({
    firstNameLatin: latinFirstName.optional(),
    lastNameLatin: latinLastName.optional(),
    firstName: z.string().trim().min(1).max(60).nullable().optional(),
    lastName: z.string().trim().min(1).max(60).nullable().optional(),
    avatarUrl: z.null().optional(),
  });
export type ProfessorProfileDTO = z.infer<typeof professorProfileSchema>;

/**
 * A name in Arabic letters: words of them, with a space, a hyphen or an
 * apostrophe between — no Latin letter, no digit. Spaces squashed to one.
 */
const ARABIC_NAME = /^[\u0620-\u0652\u0670-\u06D3\s'-]+$/;
const ARABIC_LETTER = /[\u0620-\u064A\u0671-\u06D3]/;
const arabicNamePart = z
  .string()
  .trim()
  .min(2, zmsg("account.arabicName"))
  .max(60)
  .regex(ARABIC_NAME, zmsg("account.arabicName"))
  .refine((s) => ARABIC_LETTER.test(s), zmsg("account.arabicName"))
  .transform((s) => s.replace(/\s+/g, " "));

/** A student: the Arabic first and last name — never emptied once given. */
export const studentProfileSchema = z.object({
  firstName: arabicNamePart.optional(),
  lastName: arabicNamePart.optional(),
});
export type StudentProfileDTO = z.infer<typeof studentProfileSchema>;

/** The sign-in address changes only with the current password. */
export const changeEmailSchema = z.object({
  email: z.string().trim().email(zmsg("account.emailInvalid")).max(190),
  currentPassword: z.string().min(1).max(200),
});
export type ChangeEmailDTO = z.infer<typeof changeEmailSchema>;

// The rest of the policy — no common password, no name or number in it — is
// checked against the account itself (core/auth/password-policy).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, zmsg("password.tooShort")).max(72, zmsg("password.tooLong")),
});
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;


/** The first code from the authenticator app, which turns it on. */
export const twoFactorEnableSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, zmsg("twoFactor.badCode")),
});
export type TwoFactorEnableDTO = z.infer<typeof twoFactorEnableSchema>;

/** Turning it off takes the password and a current code (or a recovery code). */
export const twoFactorDisableSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  code: z.string().trim().min(6).max(32),
});
export type TwoFactorDisableDTO = z.infer<typeof twoFactorDisableSchema>;

export const passwordOnlySchema = z.object({
  currentPassword: z.string().min(1).max(200),
});
export type PasswordOnlyDTO = z.infer<typeof passwordOnlySchema>;
