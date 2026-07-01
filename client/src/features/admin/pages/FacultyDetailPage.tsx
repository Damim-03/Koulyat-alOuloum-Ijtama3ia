import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useLangNavigate } from "../../../hooks/useLangNavigate";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Layers,
} from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useDeleteDepartment,
} from "../hooks/admin-hook";
import type { Department } from "../../../types/admin";
import { DepartmentFormDialog } from "../components/department.form";

/** يقرأ معرّف الكلية من القسم سواء كان facultyId أو faculty.id */
function getFacultyId(d: Department): string | undefined {
  const x = d as unknown as { facultyId?: string; faculty?: { id?: string } };
  return x.facultyId ?? x.faculty?.id;
}

/** يقرأ عدّاد علاقة فرعية من _count بأمان (يُرجع 0 إن لم تكن موجودة) */
function countOf(d: Department, key: string): number {
  const c = (d as unknown as { _count?: Record<string, number> })._count;
  return c?.[key] ?? 0;
}

export function FacultyDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments, isLoading } = useDepartments();
  const deleteDepartment = useDeleteDepartment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const faculty = useMemo(
    () => (faculties ?? []).find((f) => f.id === facultyId),
    [faculties, facultyId],
  );

  // نُصفّي الأقسام التابعة لهذه الكلية محلياً
  const list = useMemo(
    () => (departments ?? []).filter((d) => getFacultyId(d) === facultyId),
    [departments, facultyId],
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(d: Department) {
    setEditing(d);
    setDialogOpen(true);
  }
  function handleDelete(d: Department) {
    if (confirm(t("admin.confirmDeleteDepartment", { name: d.name })))
      deleteDepartment.mutate(d.id);
  }

  return (
    <div className="font-body">
      {/* Back */}
      <button
        onClick={() => navigate("/admin/faculties")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ChevronRight size={16} />
        {t("admin.backToFaculties")}
      </button>

      {!faculty && faculties ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.facultyNotFound")}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                {/* Breadcrumb */}
                <div className="mb-1 flex items-center gap-1.5">
                  <button
                    onClick={() => navigate("/admin/faculties")}
                    className="text-xs text-clay transition hover:text-forest"
                  >
                    {t("admin.facultiesBreadcrumb")}
                  </button>
                  <ChevronLeft size={12} className="text-clay/50" />
                  <span className="text-xs font-semibold text-sage">
                    {faculty?.name}
                  </span>
                </div>

                <h1 className="font-serif text-2xl font-bold text-forest">
                  {faculty?.name ?? "\u2026"}
                </h1>
                <p className="mt-1 text-sm text-clay">
                  {t("admin.facultyDepartmentsSubtitle")}
                </p>
              </div>

              {faculty?.code && (
                <span
                  className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                  dir="ltr"
                >
                  {faculty.code}
                </span>
              )}
            </div>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
            >
              <Plus size={18} />
              {t("admin.addDepartment")}
            </button>
          </div>

          {/* Departments */}
          {isLoading ? (
            <div className="py-20 text-center text-sm text-clay">
              {"\u2026"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
              {t("admin.noDepartments")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(d)}
                        className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(d)}
                        className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    <span
                      className="rounded-full bg-soft-sage/30 px-2.5 py-0.5 font-mono text-[10px] font-bold text-forest"
                      dir="ltr"
                    >
                      {d.code}
                    </span>
                  </div>

                  <h3
                    onClick={() =>
                      navigate(
                        `/admin/faculties/${facultyId}/departments/${d.id}`,
                      )
                    }
                    className="mb-2 cursor-pointer text-right font-serif text-base font-bold text-forest transition hover:text-sage"
                  >
                    {d.name}
                  </h3>

                  <div className="mb-4 flex items-center justify-end gap-1.5 text-clay">
                    {/* ميادين — يتطلب علاقة domains في الـ backend، يظهر 0 حالياً */}
                    <span className="text-xs">
                      {countOf(d, "domains")} {t("admin.domainsShort")}
                    </span>
                    <Layers size={14} />
                  </div>

                  <button
                    onClick={() =>
                      navigate(
                        `/admin/faculties/${facultyId}/departments/${d.id}`,
                      )
                    }
                    className="mt-auto flex items-center justify-end gap-1 border-t border-forest/10 pt-3 text-xs text-sage transition hover:text-forest"
                  >
                    {t("admin.viewDetails")}
                    <ChevronLeft size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <DepartmentFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        department={editing}
        facultyId={facultyId}
      />
    </div>
  );
}
