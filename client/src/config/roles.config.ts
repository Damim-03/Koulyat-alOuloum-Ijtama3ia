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

export interface RoleConfig {
  label: string;
  Icon: LucideIcon;
  /** Backend field name this role authenticates with. */
  fieldName: "registrationNumber" | "universityEmail" | "email";
  fieldLabel: string;
  FieldIcon: LucideIcon;
  placeholder: string;
  inputType: "text" | "email";
  subtitle: string;
}

export const ROLES: Record<LoginRole, RoleConfig> = {
  student: {
    label: "طالب",
    Icon: GraduationCap,
    fieldName: "registrationNumber",
    fieldLabel: "رقم التسجيل",
    FieldIcon: Hash,
    placeholder: "مثال: 202039012345",
    inputType: "text",
    subtitle: "أدخل بياناتك للوصول إلى حسابك الأكاديمي",
  },
  professor: {
    label: "أستاذ",
    Icon: Presentation,
    fieldName: "universityEmail",
    fieldLabel: "البريد الجامعي",
    FieldIcon: AtSign,
    placeholder: "nom@univ-eloued.dz",
    inputType: "email",
    subtitle: "أدخل بريدك الجامعي للوصول إلى لوحة الإشراف",
  },
  admin: {
    label: "مسؤول",
    Icon: Shield,
    fieldName: "email",
    fieldLabel: "البريد الإلكتروني",
    FieldIcon: Mail,
    placeholder: "admin@univ-eloued.dz",
    inputType: "email",
    subtitle: "دخول لوحة الإدارة",
  },
};

export interface HelpContent {
  title: string;
  items: { t: string; d: string }[];
}

export const HELP: Record<LoginRole, HelpContent> = {
  student: {
    title: "مساعدة — دخول الطالب",
    items: [
      {
        t: "رقم التسجيل",
        d: "هو رقمك الجامعي المكوّن غالباً من 12 رقماً (مثال: 202039012345). تجده على بطاقة الطالب أو في وثيقة التسجيل أو كشف النقاط.",
      },
      {
        t: "كلمة المرور",
        d: "تُسلَّم لك من طرف إدارة القسم عند بداية السنة الجامعية.",
      },
      {
        t: "نسيت كلمة المرور؟",
        d: "لا يوجد استرجاع إلكتروني. توجّه إلى مصلحة الأقسام لإعادة تعيينها.",
      },
    ],
  },
  professor: {
    title: "مساعدة — دخول الأستاذ",
    items: [
      {
        t: "البريد الجامعي",
        d: "استعمل بريدك الرسمي بصيغة nom@univ-eloued.dz.",
      },
      { t: "كلمة المرور", d: "تُمنح من طرف إدارة الكلية." },
      {
        t: "مشكلة في الدخول؟",
        d: "تواصل مع مصلحة المستخدمين أو الدعم التقني.",
      },
    ],
  },
  admin: {
    title: "مساعدة — دخول المسؤول",
    items: [
      { t: "البريد الإلكتروني", d: "البريد المهني المخصص لحسابك الإداري." },
      {
        t: "مشكلة في الدخول؟",
        d: "تواصل مع مسؤول النظام (Owner) لاستعادة الوصول.",
      },
    ],
  },
};
