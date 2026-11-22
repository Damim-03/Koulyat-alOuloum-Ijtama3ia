import { importControllers } from "../import-kit/controller";
import { buildTopicTemplate, importTopics, validateTopicImport } from "./service";

const c = importControllers({
  fileName: "topics-import.xlsx",
  template: buildTopicTemplate,
  validate: validateTopicImport,
  run: importTopics,
  rejected: "imp.rejected.topics",
});

export const topicImportTemplateController = c.template;
/** المعاينة: حكمٌ على كلّ صفّ، ولا كتابة. */
export const topicImportPreviewController = c.preview;
/** الاستيراد: الدفعة كلّها أو لا شيء. وملفٌّ فيه خطأٌ يُردّ بتقريره كاملاً. */
export const topicImportController = c.run;
