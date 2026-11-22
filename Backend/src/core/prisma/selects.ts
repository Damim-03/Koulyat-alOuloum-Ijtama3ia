/**
 * ============================================================
 * SAFE FIELD SELECTIONS
 * ============================================================
 *
 * Prisma's `include: { user: true }` selects every scalar column on User —
 * including `password`, the bcrypt hash. Ten queries across the professor and
 * student modules did exactly that and serialised the result straight to the
 * client, so any authenticated student could read the password hash of their
 * supervisor, their group mates, and every user reachable through those
 * relations, then crack it offline at leisure.
 *
 * `publicUserSelect` is the only shape that may be sent outward. It is
 * deliberately an allowlist: a column added to User later is invisible here
 * until someone consciously adds it.
 */
export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  email: true,
  username: true,
  phone: true,
  avatarUrl: true,
  gender: true,
  role: true,
  status: true,
  isVerified: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** Minimal shape for name badges and pickers. */
export const userBadgeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  firstNameLatin: true,
  lastNameLatin: true,
  avatarUrl: true,
  gender: true,
} as const;

/** Ready-made relation include, so call sites read as `user: publicUser`. */
export const publicUser = { select: publicUserSelect } as const;

/**
 * A person as another student sees them: a name and a face, nothing to reach
 * them by outside the platform.
 *
 * `publicUser` carries the personal email, the phone and the last sign-in —
 * right for the administration, wrong for every student browsing topics, who
 * used to receive all three for each supervisor (and, through
 * `include: { user }` on Professor, the employee number too).
 */
export const badgeUser = { select: userBadgeSelect } as const;

/** A supervisor on a student's screen: the profile id and the badge. */
export const professorBadge = { select: { id: true, user: badgeUser } } as const;
