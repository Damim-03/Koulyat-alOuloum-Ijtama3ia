import { z } from "zod";
import { imageUrl } from "../../core/validation/image-url";
import { latinFirstName, latinLastName } from "../admin/admin.validation";

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
 *   student   — their password, nothing else.
 *
 * Unknown keys are dropped by zod, so a `role` slipped into the body is simply
 * ignored. `null` clears a field.
 */

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ]{5,19}$/, "رقم الهاتف غير صالح")
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
    .min(3, "اسم المستخدم: 3 أحرف على الأقل")
    .max(30)
    .regex(/^[A-Za-z0-9._-]+$/, "اسم المستخدم: حروف لاتينية وأرقام و . _ - فقط")
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

/** The sign-in address changes only with the current password. */
export const changeEmailSchema = z.object({
  email: z.string().trim().email("البريد الإلكتروني غير صالح").max(190),
  currentPassword: z.string().min(1).max(200),
});
export type ChangeEmailDTO = z.infer<typeof changeEmailSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
});
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
