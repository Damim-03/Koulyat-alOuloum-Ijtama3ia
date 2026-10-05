import { importControllers } from "../import-kit/controller";
import { buildProfessorTemplate, importProfessors, validateProfessorImport } from "./service";

const c = importControllers({
  fileName: "professors-import.xlsx",
  template: buildProfessorTemplate,
  validate: validateProfessorImport,
  run: importProfessors,
});

export const professorImportTemplateController = c.template;
/** المعاينة: حكمٌ على كلّ صفّ، ولا كتابة. */
export const professorImportPreviewController = c.preview;
/** الاستيراد: الدفعة كلّها أو لا أحد. وملفٌّ فيه خطأٌ يُردّ بتقريره كاملاً. */
export const professorImportController = c.run;
