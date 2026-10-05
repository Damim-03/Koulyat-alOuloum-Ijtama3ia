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

/** Keys, not copy — same reason as RoleConfig above. The steps themselves
 *  are drawn by the help dialog, which shows each field as it looks. */
export interface HelpContent {
  titleKey: string;
}

export const HELP: Record<LoginRole, HelpContent> = {
  student: { titleKey: "auth.helpStudentTitle" },
  professor: { titleKey: "auth.helpProfessorTitle" },
  admin: { titleKey: "auth.helpAdminTitle" },
};
