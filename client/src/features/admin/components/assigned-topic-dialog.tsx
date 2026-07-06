import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  FileText,
  Save,
  Search,
  Star,
  UserPlus,
  Crown,
  Loader2,
} from "lucide-react";
import {
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
  useAcademicYears,
  useStudents,
  useCreateAssignedTopic,
} from "../hooks/admin-hook";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface PickedStudent {
  id: string;
  name: string;
  reg: string;
}

const inputCls =
  "w-full rounded-xl border border-forest/15 bg-cream px-3.5 py-2.5 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20";
const selectCls =
  "w-full rounded-xl border border-forest/15 bg-cream px-3.5 py-2.5 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20";

function initials(first?: string | null, last?: string | null) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || "\u061f";
}
function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ");
}

export function AssignedTopicDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const createTopic = useCreateAssignedTopic();

  // ── form fields ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState(1);
  const [professorId, setProfessorId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");

  // cascading specialization
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [specializationId, setSpecializationId] = useState("");

  // students
  const [studentSearch, setStudentSearch] = useState("");
  const [picked, setPicked] = useState<PickedStudent[]>([]);
  const [leaderId, setLeaderId] = useState("");

  const [error, setError] = useState<string | null>(null);

  // reset on open/close
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setDescription("");
      setMaxStudents(1);
      setProfessorId("");
      setAcademicYearId("");
      setFacultyId("");
      setDepartmentId("");
      setFiliereId("");
      setSpecializationId("");
      setStudentSearch("");
      setPicked([]);
      setLeaderId("");
      setError(null);
    }
  }, [open]);

  // ── lookups ──
  const { data: profsData } = useProfessors({ limit: 100 });
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  const professors = profsData?.items ?? [];

  // cascading option lists (mirrors the students page logic)
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d: any) => !facultyId || d.facultyId === facultyId,
      ),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter((f: any) => {
        if (departmentId && f.departmentId !== departmentId) return false;
        if (facultyId && !departmentId) {
          const d = (departments ?? []).find(
            (dd: any) => dd.id === f.departmentId,
          );
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [filieres, departmentId, facultyId, departments],
  );
  const specOptions = useMemo(
    () =>
      (specs ?? []).filter((sp: any) => {
        if (filiereId && sp.filiereId !== filiereId) return false;
        if (
          departmentId &&
          !filiereId &&
          sp.filiere?.departmentId !== departmentId
        )
          return false;
        if (facultyId && !departmentId && !filiereId) {
          const d = (departments ?? []).find(
            (dd: any) => dd.id === sp.filiere?.departmentId,
          );
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [specs, filiereId, departmentId, facultyId, departments],
  );

  // ── student search (scoped to the chosen specialization when set) ──
  const { data: studentsData, isFetching: searching } = useStudents({
    page: 1,
    limit: 8,
    search: studentSearch.trim() || undefined,
    specializationId: specializationId || undefined,
    unassigned: "true",
  });
  const searchResults = ((studentsData?.items ?? []) as any[]).filter(
    (s) => !picked.some((p) => p.id === s.id),
  );

  function addStudent(s: any) {
    if (picked.length >= maxStudents) {
      setError(t("admin.assignMaxReached", { count: maxStudents }));
      return;
    }
    const entry: PickedStudent = {
      id: s.id,
      name: fullName(s.user) || "\u2014",
      reg: s.registrationNumber ?? "",
    };
    const next = [...picked, entry];
    setPicked(next);
    if (!leaderId) setLeaderId(entry.id); // أول طالب = القائد افتراضياً
    setStudentSearch("");
    setError(null);
  }
  function removeStudent(id: string) {
    const next = picked.filter((p) => p.id !== id);
    setPicked(next);
    if (leaderId === id) setLeaderId(next[0]?.id ?? "");
  }

  const canSubmit =
    title.trim() &&
    description.trim() &&
    professorId &&
    specializationId &&
    academicYearId &&
    picked.length >= 1 &&
    picked.length <= maxStudents &&
    leaderId &&
    !createTopic.isPending;

  function submit() {
    setError(null);
    if (!canSubmit) return;
    createTopic.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        maxStudents,
        professorId,
        specializationId,
        academicYearId,
        memberStudentIds: picked.map((p) => p.id),
        leaderStudentId: leaderId,
      },
      {
        onSuccess: () => {
          onClose();
          onCreated?.();
        },
        onError: (e: any) => {
          setError(
            e?.response?.data?.message ??
              e?.message ??
              t("admin.assignCreateError"),
          );
        },
      },
    );
  }

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest-deep/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        dir="rtl"
        className="my-8 w-full max-w-2xl rounded-2xl bg-cream-card shadow-[0_20px_60px_rgba(38,66,61,0.25)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl bg-forest px-6 py-4 text-cream">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cream/10">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold">
                {t("admin.assignTopicTitle")}
              </h2>
              <p className="text-xs text-cream/70">
                {t("admin.assignTopicSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {/* Topic info */}
          <Field label={t("admin.topicTitle")}>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder={t("admin.assignTopicTitlePlaceholder")}
            />
          </Field>

          <Field label={t("admin.topicDescription")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder={t("admin.assignTopicDescPlaceholder")}
            />
          </Field>

          {/* professor + year + maxStudents */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("admin.supervisor")}>
              <select
                value={professorId}
                onChange={(e) => setProfessorId(e.target.value)}
                className={selectCls}
              >
                <option value="">{t("admin.selectProfessor")}</option>
                {professors.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {fullName(p.user) || p.universityEmail}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("admin.academicYear")}>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className={selectCls}
              >
                <option value="">{t("admin.selectYear")}</option>
                {(years ?? []).map((y: any) => (
                  <option key={y.id} value={y.id}>
                    {y.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("admin.maxStudents")}>
              <input
                type="number"
                min={1}
                max={10}
                value={maxStudents}
                onChange={(e) => {
                  const v = Math.max(
                    1,
                    Math.min(10, Number(e.target.value) || 1),
                  );
                  setMaxStudents(v);
                  if (picked.length > v) setPicked(picked.slice(0, v));
                }}
                className={inputCls}
                dir="ltr"
              />
            </Field>
          </div>

          {/* cascading specialization */}
          <div>
            <p className="mb-2 text-[11px] font-medium text-clay">
              {t("admin.specialization")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={facultyId}
                onChange={(e) => {
                  setFacultyId(e.target.value);
                  setDepartmentId("");
                  setFiliereId("");
                  setSpecializationId("");
                }}
                className={selectCls}
              >
                <option value="">{t("admin.allFaculties")}</option>
                {(faculties ?? []).map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setFiliereId("");
                  setSpecializationId("");
                }}
                className={selectCls}
              >
                <option value="">{t("admin.allDepartments")}</option>
                {deptOptions.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={filiereId}
                onChange={(e) => {
                  setFiliereId(e.target.value);
                  setSpecializationId("");
                }}
                className={selectCls}
              >
                <option value="">{t("admin.allFilieres")}</option>
                {filiereOptions.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                value={specializationId}
                onChange={(e) => setSpecializationId(e.target.value)}
                className={selectCls}
              >
                <option value="">{t("admin.selectSpecialization")}</option>
                {specOptions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* students assignment */}
          <div className="rounded-2xl border border-forest/10 bg-cream p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                <UserPlus size={16} />
                {t("admin.assignStudents")}
              </p>
              <span className="text-[11px] text-clay">
                {picked.length} / {maxStudents}
              </span>
            </div>

            {/* picked chips */}
            {picked.length > 0 && (
              <div className="mb-3 space-y-2">
                {picked.map((p) => {
                  const isLeader = leaderId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-forest/10 bg-cream-card px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setLeaderId(p.id)}
                          title={t("admin.setLeader")}
                          className={`grid size-7 place-items-center rounded-lg transition ${
                            isLeader
                              ? "bg-gold/20 text-gold"
                              : "text-clay hover:bg-forest/5 hover:text-gold"
                          }`}
                        >
                          {isLeader ? (
                            <Crown size={15} fill="currentColor" />
                          ) : (
                            <Star size={15} />
                          )}
                        </button>
                        <div>
                          <p className="text-sm font-medium text-forest">
                            {p.name}
                            {isLeader && (
                              <span className="ms-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                                {t("admin.leader")}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-clay" dir="ltr">
                            {p.reg}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStudent(p.id)}
                        className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-red-50 hover:text-red-500"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* search box */}
            {picked.length < maxStudents && (
              <div className="relative">
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
                  size={16}
                />
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder={t("admin.searchStudentToAssign")}
                  className="w-full rounded-xl border border-forest/15 bg-cream-card py-2 pr-9 pl-3 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
                />
                {/* results dropdown */}
                {studentSearch.trim() && (
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-forest/10 bg-cream-card">
                    {searching && (
                      <p className="px-3 py-3 text-center text-xs text-clay">
                        {"\u2026"}
                      </p>
                    )}
                    {!searching && searchResults.length === 0 && (
                      <p className="px-3 py-3 text-center text-xs text-clay">
                        {t("admin.noStudents")}
                      </p>
                    )}
                    {searchResults.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addStudent(s)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-right transition hover:bg-forest/5"
                      >
                        <div className="grid size-8 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-[10px] font-bold text-cream">
                          {initials(s.user?.firstName, s.user?.lastName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-forest">
                            {fullName(s.user) || "\u2014"}
                          </p>
                          <p className="text-[11px] text-clay" dir="ltr">
                            {s.registrationNumber}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="mt-2 flex items-center gap-1 text-[11px] text-clay">
              <Crown size={12} className="text-gold" />
              {t("admin.leaderHint")}
            </p>
          </div>

          {/* reserved notice */}
          <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs text-violet-700">
            <Star size={14} className="mt-0.5 shrink-0" />
            <p>{t("admin.assignReservedNotice")}</p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-start gap-2 rounded-b-2xl border-t border-forest/10 px-6 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createTopic.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t("admin.assignCreateBtn")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-medium text-clay transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-clay">
        {label}
      </span>
      {children}
    </label>
  );
}
