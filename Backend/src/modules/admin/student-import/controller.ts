import { importControllers } from "../import-kit/controller";
import { buildStudentImportTemplate, importStudents, validateStudentImport } from "./service";

const c = importControllers({
  fileName: "students-import.xlsx",
  template: buildStudentImportTemplate,
  validate: validateStudentImport,
  run: importStudents,
});

export const studentImportTemplateController = c.template;
/** المعاينة: حكمٌ على كلّ صفّ، ولا كتابة. */
export const studentImportPreviewController = c.preview;
/** الاستيراد: الدفعة كلّها أو لا أحد. وملفٌّ فيه خطأٌ يُردّ بتقريره كاملاً. */
export const studentImportController = c.run;
