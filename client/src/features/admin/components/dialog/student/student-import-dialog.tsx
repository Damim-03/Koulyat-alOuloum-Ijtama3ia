import { useImportStudents, useStudentImportPreview } from "../../../hooks/admin-hook";
import { ImportDialog } from "../import/import-dialog";
import { STUDENT_IMPORT_CONFIG } from "./student-import.config";

/**
 * استيراد دفعةٍ من الطلبة من ملفّ Excel — نافذة الاستيراد المشتركة بملمح
 * الطلبة: رقم التسجيل، والسنة الجامعية، والتخصص وما يُشتقّ منه.
 */
export function StudentImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const previewM = useStudentImportPreview();
  const importM = useImportStudents();
  return (
    <ImportDialog open={open} onClose={onClose} config={STUDENT_IMPORT_CONFIG} previewM={previewM} importM={importM} />
  );
}
