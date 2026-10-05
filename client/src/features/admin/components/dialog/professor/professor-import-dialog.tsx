import { useImportProfessors, useProfessorImportPreview } from "../../../hooks/admin-hook";
import { ImportDialog } from "../import/import-dialog";
import { PROFESSOR_IMPORT_CONFIG } from "./professor-import.config";

/**
 * استيراد دفعةٍ من الأساتذة من ملفّ Excel — نافذة الاستيراد المشتركة بملمح
 * الأساتذة: البريد الجامعي بنطاقٍ مسجَّل، والرقم الوظيفي المولَّد، والقسم.
 */
export function ProfessorImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const previewM = useProfessorImportPreview();
  const importM = useImportProfessors();
  return (
    <ImportDialog open={open} onClose={onClose} config={PROFESSOR_IMPORT_CONFIG} previewM={previewM} importM={importM} />
  );
}
