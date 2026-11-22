import { useAssignedTopicImportPreview, useImportAssignedTopics } from "../../../hooks/admin-hook";
import { ImportDialog } from "../import/import-dialog";
import { ASSIGNED_TOPIC_IMPORT_CONFIG } from "./assigned-topic-import.config";

/**
 * استيراد مواضيع مُسنَدة بطلبتها من ملفّ Excel — «إنشاء موضوع وإسناده» دفعةً،
 * بنموذجٍ مستقلّ عن استيراد المواضيع.
 */
export function AssignedTopicImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const previewM = useAssignedTopicImportPreview();
  const importM = useImportAssignedTopics();
  return (
    <ImportDialog open={open} onClose={onClose} config={ASSIGNED_TOPIC_IMPORT_CONFIG} previewM={previewM} importM={importM} />
  );
}
