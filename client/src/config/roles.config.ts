import {
  GraduationCap,
  Presentation,
  Shield,
  Hash,
  AtSign,
  Mail,
  type LucideIcon,
} from "lucide-react";
import type { LoginRole } from "../types/enums";

/**
 * Text here is stored as translation *keys*, not as finished strings: this
 * object is built once at import time, so a `t()` call would freeze the copy
 * in whatever language happened to load first. Consumers translate at render.
 */
export interface RoleConfig {
  labelKey: string;
  Icon: LucideIcon;
  /** Backend field name this role authenticates with. */
  fieldName: "registrationNumber" | "universityEmail" | "email";
  fieldLabelKey: string;
  FieldIcon: LucideIcon;
  placeholderKey: string;
  inputType: "text" | "email";
  subtitleKey: string;
}

export const ROLES: Record<LoginRole, RoleConfig> = {
  student: {
    labelKey: "roles.student",
    Icon: GraduationCap,
    fieldName: "registrationNumber",
    fieldLabelKey: "pro.regNumber",
    FieldIcon: Hash,
    placeholderKey: "auth.regNumberPlaceholder",
    inputType: "text",
    subtitleKey: "auth.studentSubtitle",
  },
  professor: {
    labelKey: "roles.professor",
    Icon: Presentation,
    fieldName: "universityEmail",
    fieldLabelKey: "admin.universityEmail",
    FieldIcon: AtSign,
    placeholderKey: "auth.professorEmailPlaceholder",
    inputType: "email",
    subtitleKey: "auth.professorSubtitle",
  },
  admin: {
    labelKey: "roles.admin",
    Icon: Shield,
    fieldName: "email",
    fieldLabelKey: "admin.email",
    FieldIcon: Mail,
    placeholderKey: "auth.adminEmailPlaceholder",
    inputType: "email",
    subtitleKey: "auth.adminSubtitle",
  },
};

/** Keys, not copy — same reason as RoleConfig above. */
export interface HelpContent {
  titleKey: string;
  items: { titleKey: string; bodyKey: string }[];
}

export const HELP: Record<LoginRole, HelpContent> = {
  student: {
    titleKey: "auth.helpStudentTitle",
    items: [
      { titleKey: "pro.regNumber", bodyKey: "auth.helpRegNumber" },
      { titleKey: "admin.password", bodyKey: "auth.helpStudentPassword" },
      { titleKey: "auth.forgotPassword", bodyKey: "auth.helpForgotPassword" },
    ],
  },
  professor: {
    titleKey: "auth.helpProfessorTitle",
    items: [
      { titleKey: "admin.universityEmail", bodyKey: "auth.helpProfessorEmail" },
      { titleKey: "admin.password", bodyKey: "auth.helpProfessorPassword" },
      { titleKey: "auth.signInProblem", bodyKey: "auth.helpProfessorProblem" },
    ],
  },
  admin: {
    titleKey: "auth.helpAdminTitle",
    items: [
      { titleKey: "admin.email", bodyKey: "auth.helpAdminEmail" },
      { titleKey: "auth.signInProblem", bodyKey: "auth.helpAdminProblem" },
    ],
  },
};
