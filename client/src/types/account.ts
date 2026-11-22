/** The signed-in person's own account, as `GET /api/account` returns it. */
export interface MyAccount {
  id: string;
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  avatarUrl: string | null;
  gender: "male" | "female" | null;
  role: "admin" | "professor" | "student" | string;
  status: string;
  isVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    registrationNumber: string;
    academicYear: { title: string; isActive: boolean } | null;
    specialization: {
      name: string;
      level: string;
      filiere: { name: string; department: { name: string; faculty: { name: string } | null } | null } | null;
    } | null;
  } | null;
  professor: {
    id: string;
    employeeNumber: string;
    universityEmail: string;
    grade: unknown;
    department: { name: string; faculty: { name: string } | null } | null;
  } | null;
  /** Whether the account's own address (`email`) is proven: its owner opened a link sent to it. */
  emailVerified?: boolean;
  /**
   * Where reset links and security alerts go: the account's own address once
   * proven — a professor's university address until then. Null: nowhere yet.
   */
  recoveryEmail?: string | null;
  /** Whether this server sends mail at all. */
  mailEnabled?: boolean;
  /** What this role may change — the server enforces the same rules. */
  can: { edit: string[]; photo: boolean; email: boolean };
  /** The password was handed out by the administration: it must be replaced. */
  mustChangePassword: boolean;
  /** Two-step verification — never its secret, never its codes. */
  twoFactor: {
    /** Offered to this role (administrators). */
    available: boolean;
    required: boolean;
    enabled: boolean;
    enabledAt: string | null;
    recoveryCodesLeft: number;
  };
}

/** What setting up two-step verification shows: the QR code's content and the key in words. */
export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  account: string;
}

/** "A sign-in from a new device", until its owner says it was them. */
export interface SecurityAlert {
  id: string;
  title: string;
  message: string;
  i18n: Record<string, { title: string; message: string }> | null;
  link: string | null;
  createdAt: string;
}

export type MyAccountPatch = Partial<
  Pick<MyAccount, "firstName" | "lastName" | "firstNameLatin" | "lastNameLatin" | "username" | "phone" | "gender" | "avatarUrl">
>;

/** One device signed in to the account, as `GET /api/account/sessions` returns it. */
export interface AccountSession {
  id: string;
  device: {
    type: "mobile" | "tablet" | "desktop" | "unknown";
    os: string | null;
    browser: string | null;
  };
  ip: string | null;
  createdAt: string;
  lastActiveAt: string;
  /** The device making the request. */
  current: boolean;
  /** Has a live connection right now. */
  online: boolean;
}
