import { adminApi } from "../../../api/admin.api";
import type { ImportDialogConfig } from "../import/import-dialog";
import { IMPORT_GUIDE } from "./import-columns";

/** ملمح استيراد الطلبة في نافذة الاستيراد المشتركة. */
export const STUDENT_IMPORT_CONFIG: ImportDialogConfig = {
  ns: "admin.import",
  files: {
    template: "students-import.xlsx",
    errors: "students-import-errors",
    accounts: "students-accounts",
  },
  fetchTemplate: () => adminApi.studentImportTemplate(),
  guide: IMPORT_GUIDE,
  mock: [
    ["رقم التسجيل", "req"],
    ["الاسم باللاتينية", "req"],
    ["الاسم", "opt"],
    ["الكلية", "auto"],
  ],
  accounts: [{ key: "registrationNumber", labelKey: "accReg" }],
  preview: {
    searchKeys: ["registrationNumber", "firstName", "lastName", "firstNameLatin", "lastNameLatin", "email"],
    searchPlaceholderKey: "searchPlaceholder",
    distribution: {
      main: "specialization",
      path: ["faculty", "department", "filiere"],
      badge: "level",
      mono: "academicYear",
      guard: ["academicYear", "faculty", "department", "filiere", "level", "specialization"],
      headers: ["distSpec", "distLevel", "distYear"],
    },
  },
};
