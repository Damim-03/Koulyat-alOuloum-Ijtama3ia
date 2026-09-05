import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, FilePlus2, Save, Loader2 } from "lucide-react";
import {
  useCreateTopic,
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
  useAcademicYears,
} from "../../../hooks/admin-hook";
import { statusChip } from "../../../utils/status-styles";
import { ProfessorPicker } from "../../ui/professor-picker";
import { ListInput } from "../../ui/list-input";
import { inputCls, SectionHead, Field } from "../../ui/form-bits";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Creating a topic on its own — no group, no members.
 *
 * The assign dialog next to it answers two questions (what the topic is, and
 * who it goes to) and needs two steps for them. This one answers only the
 * first, so it stays a single screen: forcing a wizard on a form that has no
 * second decision would add clicks and nothing else.
 *
 * The students arrive later through a group request, which is why this topic
 * starts on the board rather than reserved.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const selectCls = inputCls;

export function TopicDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const createTopic = useCreateTopic();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState(1);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [professorId, setProfessorId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setDescription("");
      setMaxStudents(1);
      setRequirements([]);
      setObjectives([]);
      setProfessorId("");
      setAcademicYearId("");
      setFacultyId("");
      setDepartmentId("");
      setFiliereId("");
      setSpecializationId("");
      setPublish(false);
      setError(null);
    }
  }, [open]);

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();
  // The picker searches server-side; this list only resolves the chosen
  // supervisor's name. 100 is the API's ceiling.
  const { data: profsData } = useProfessors({ limit: 100 });
  const professors = useMemo(() => profsData?.items ?? [], [profsData]);

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

  const professorName = useMemo(() => {
    const p = professors.find((x: any) => x.id === professorId);
    if (!p) return "";
    return [p.user?.firstName, p.user?.lastName].filter(Boolean).join(" ") ||
      p.universityEmail;
  }, [professors, professorId]);

  const canSubmit = Boolean(
    title.trim() &&
      description.trim() &&
      professorId &&
      specializationId &&
      academicYearId &&
      !createTopic.isPending,
  );

  function submit() {
    setError(null);
    if (!canSubmit) return;
    createTopic.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        maxStudents,
        requirements,
        objectives,
        professorId,
        specializationId,
        academicYearId,
        publish,
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
              t("admin.createTopicError"),
          );
        },
      },
    );
  }

  if (!open) return null;

  const resulting = publish ? "open" : "approved";

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest-deep/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-cream-card shadow-[0_20px_60px_rgba(38,66,61,0.25)]"
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between bg-forest px-6 py-4 text-cream">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cream/10">
              <FilePlus2 size={20} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold">
                {t("admin.createTopicTitle")}
              </h2>
              <p className="text-xs text-cream/70">
                {t("admin.createTopicSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("admin.cancel")}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-7">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr]">
            {/* ── what the topic says ── */}
            <section className="space-y-5">
              <SectionHead
                title={t("admin.sectionContent")}
                hint={t("admin.descriptionHint")}
              />

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
                  rows={7}
                  className={`${inputCls} resize-y`}
                  placeholder={t("admin.assignTopicDescPlaceholder")}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("admin.requirements")}
                  note={t("admin.optional")}
                  hint={t("admin.requirementsHint")}
                >
                  <ListInput
                    value={requirements}
                    onChange={setRequirements}
                    placeholder={t("admin.requirementItemPlaceholder")}
                  />
                </Field>
                <Field
                  label={t("admin.objectives")}
                  note={t("admin.optional")}
                  hint={t("admin.objectivesHint")}
                >
                  <ListInput
                    value={objectives}
                    onChange={setObjectives}
                    placeholder={t("admin.objectiveItemPlaceholder")}
                  />
                </Field>
              </div>
            </section>

            {/* ── where the topic sits ── */}
            <section className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-forest/10 bg-cream p-5">
                <SectionHead
                  title={t("admin.sectionPlacement")}
                  hint={t("admin.sectionPlacementHint")}
                />

                <Field label={t("admin.supervisor")}>
                  <ProfessorPicker value={professorId} onChange={setProfessorId} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
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
                      onChange={(e) =>
                        setMaxStudents(
                          Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                        )
                      }
                      className={inputCls}
                      dir="ltr"
                    />
                  </Field>
                </div>

                <div className="space-y-3 border-t border-forest/10 pt-4">
                  <Field label={t("admin.faculty")}>
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
                  </Field>

                  <Field label={t("admin.department")}>
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
                  </Field>

                  <Field label={t("admin.filiere")}>
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
                  </Field>

                  <Field label={t("admin.specialization")}>
                    <select
                      value={specializationId}
                      onChange={(e) => setSpecializationId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">{t("admin.selectSpecialization")}</option>
                      {specOptions.map((sp: any) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {/* ── where it lands ── */}
              <div className="rounded-2xl border border-forest/10 bg-cream p-5">
                <p className="mb-3 text-sm font-semibold text-forest">
                  {t("admin.resultingStatus")}
                </p>

                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(e) => setPublish(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-gold"
                  />
                  <span>
                    <span className="block text-sm font-medium text-forest">
                      {t("admin.publishNow")}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-clay">
                      {t("admin.publishNowHint")}
                    </span>
                  </span>
                </label>

                <div className="mt-3.5 flex items-center gap-2 border-t border-forest/10 pt-3.5">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${statusChip(resulting)}`}
                  >
                    {t(`status.${resulting}`)}
                  </span>
                  <span className="text-[11px] leading-relaxed text-clay">
                    {publish
                      ? t("admin.statusOpenNote")
                      : t("admin.statusApprovedNote")}
                  </span>
                </div>

                {professorName && (
                  <p className="mt-3 text-[11px] leading-relaxed text-clay">
                    {t("admin.supervisorNotifiedNote", { name: professorName })}
                  </p>
                )}
              </div>
            </section>
          </div>

          {error && (
            <p className="mt-5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-medium text-clay transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>

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
            {t("admin.createTopicBtn")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
