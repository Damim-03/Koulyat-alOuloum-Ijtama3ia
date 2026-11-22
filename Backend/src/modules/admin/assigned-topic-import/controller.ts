import { importControllers } from "../import-kit/controller";
import { buildAssignedTopicTemplate, importAssignedTopics, validateAssignedTopicImport } from "./service";

const c = importControllers({
  fileName: "assigned-topics-import.xlsx",
  template: buildAssignedTopicTemplate,
  validate: validateAssignedTopicImport,
  run: importAssignedTopics,
  rejected: "imp.rejected.assigned",
});

export const assignedTopicImportTemplateController = c.template;
/** المعاينة: حكمٌ على كلّ صفّ، ولا كتابة. */
export const assignedTopicImportPreviewController = c.preview;
/** الاستيراد: الدفعة كلّها أو لا شيء. وملفٌّ فيه خطأٌ يُردّ بتقريره كاملاً. */
export const assignedTopicImportController = c.run;
