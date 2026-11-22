import { useImportTopics, useTopicImportPreview } from "../../../hooks/admin-hook";
import { ImportDialog } from "../import/import-dialog";
import { TOPIC_IMPORT_CONFIG } from "./topic-import.config";

/**
 * استيراد مواضيع الأساتذة من ملفّ Excel — نافذة الاستيراد المشتركة بملمح
 * المواضيع: الأستاذ والتخصص وقرار الإدارة، وبعد الاستيراد قائمةُ ما أُنشئ.
 */
export function TopicImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const previewM = useTopicImportPreview();
  const importM = useImportTopics();
  return <ImportDialog open={open} onClose={onClose} config={TOPIC_IMPORT_CONFIG} previewM={previewM} importM={importM} />;
}
