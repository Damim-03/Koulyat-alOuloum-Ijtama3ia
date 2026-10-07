import { adminApi } from "../../../api/admin.api";
import type { ImportDialogConfig } from "../import/import-dialog";
import { PROFESSOR_GUIDE } from "./professor-import-columns";

/**
 * ملمح استيراد الأساتذة في نافذة الاستيراد المشتركة: البريد الجامعي (به
 * يدخل الأستاذ) والرقم الوظيفي، والتوزيع على الأقسام والرتب.
 */
export const PROFESSOR_IMPORT_CONFIG: ImportDialogConfig = {
  ns: "admin.importProf",
  files: {
    template: "professors-import.xlsx",
    errors: "professors-import-errors",
    accounts: "professors-accounts",
  },
  fetchTemplate: () => adminApi.professorImportTemplate(),
  guide: PROFESSOR_GUIDE,
  mock: [
    ["الاسم باللاتينية", "req"],
    ["البريد الجامعي", "req"],
    ["الرتبة", "opt"],
    ["الكلية", "auto"],
  ],
  accounts: [
    { key: "employeeNumber", labelKey: "accEmployee" },
    { key: "universityEmail", labelKey: "accUniEmail" },
  ],
  preview: {
    searchKeys: ["universityEmail", "employeeNumber", "firstName", "lastName", "firstNameLatin", "lastNameLatin", "email"],
    searchPlaceholderKey: "searchPlaceholderProf",
    distribution: {
      main: "department",
      path: ["faculty"],
      badge: "grade",
      guard: ["faculty", "department"],
      headers: ["distDepartment", "distRank", null],
    },
    extraFacts: [{ labelKey: "factEmployeeAuto", count: (r) => r.cells.employeeNumber?.state === "auto" }],
  },
};
