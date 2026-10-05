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
  /** What this role may change — the server enforces the same rules. */
  can: { edit: string[]; photo: boolean; email: boolean };
}

export type MyAccountPatch = Partial<
  Pick<MyAccount, "firstName" | "lastName" | "firstNameLatin" | "lastNameLatin" | "username" | "phone" | "gender" | "avatarUrl">
>;
