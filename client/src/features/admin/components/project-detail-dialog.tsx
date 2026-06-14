import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban, UserCog, UserPlus, Check } from "lucide-react";
import { FormDialog } from "./form-dialog";
import {
  useProject,
  useProfessors,
  useStudents,
  useChangeSupervisor,
  useAssignStudent,
} from "../hooks/admin-hook";

interface Props {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
}

const MS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
};

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function ProjectDetailDialog({ projectId, open, onClose }: Props) {
  const { t } = useTranslation();
  const { data: project, isLoading } = useProject(projectId);
  const { data: profsData } = useProfessors({ limit: 100 });
  const { data: studentsData } = useStudents({ limit: 100 });
  const changeSupervisor = useChangeSupervisor();
  const assignStudent = useAssignStudent();

  const [newProf, setNewProf] = useState("");
  const [newStudent, setNewStudent] = useState("");

  const professors = profsData?.items ?? [];
  const students = studentsData?.items ?? [];
  const members = project?.members ?? [];

  function doChangeSupervisor() {
    if (newProf && projectId) {
      changeSupervisor.mutate({ id: projectId, professorId: newProf });
      setNewProf("");
    }
  }
  function doAssignStudent() {
    if (newStudent && projectId) {
      assignStudent.mutate({ id: projectId, studentId: newStudent });
      setNewStudent("");
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("admin.projectDetails")}
      subtitle={project?.topic?.title ?? ""}
      icon={FolderKanban}
    >
      {isLoading ? (
        <div className="py-10 text-center text-sm text-clay">{"\u2026"}</div>
      ) : !project ? (
        <div className="py-10 text-center text-sm text-clay">{"\u2014"}</div>
      ) : (
        <div className="space-y-5">
          {/* Members */}
          <section>
            <h4 className="mb-2 text-xs font-bold text-forest">{t("admin.members")}</h4>
            <div className="flex flex-wrap gap-2">
              {members.length === 0 && <p className="text-xs text-clay">{t("admin.noMembers")}</p>}
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-full bg-cream-2 px-3 py-1">
                  <div className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-forest to-forest-deep text-[9px] font-bold text-cream">
                    {initials(m.student?.user?.firstName, m.student?.user?.lastName)}
                  </div>
                  <span className="text-xs text-forest">
                    {[m.student?.user?.firstName, m.student?.user?.lastName].filter(Boolean).join(" ") ||
                      m.student?.registrationNumber || "\u2014"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Milestones timeline */}
          <section>
            <h4 className="mb-2 text-xs font-bold text-forest">{t("admin.milestones")}</h4>
            <div className="space-y-2">
              {(project.milestones?.length ?? 0) === 0 && (
                <p className="text-xs text-clay">{t("admin.noMilestones")}</p>
              )}
              {project.milestones?.map((ms) => (
                <div key={ms.id} className="flex items-center justify-between rounded-xl bg-cream-2 px-3 py-2">
                  <span className="text-xs font-medium text-forest">{ms.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-clay" dir="ltr">
                      {ms.deadline ? new Date(ms.deadline).toLocaleDateString("ar") : ""}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${MS_STYLES[ms.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`status.${ms.status}`, { defaultValue: ms.status })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Change supervisor */}
          <section className="rounded-xl border border-forest/10 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-forest">
              <UserCog size={14} />
              {t("admin.changeSupervisor")}
            </h4>
            <div className="flex gap-2">
              <select
                value={newProf}
                onChange={(e) => setNewProf(e.target.value)}
                className="flex-1 rounded-lg border border-forest/15 bg-cream-2 px-3 py-2 text-xs text-forest outline-none focus:border-gold"
              >
                <option value="">{t("admin.selectProfessor")}</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.user?.firstName, p.user?.lastName].filter(Boolean).join(" ") || p.universityEmail}
                  </option>
                ))}
              </select>
              <button
                onClick={doChangeSupervisor}
                disabled={!newProf || changeSupervisor.isPending}
                className="grid size-9 place-items-center rounded-lg bg-forest text-cream transition hover:bg-forest-deep disabled:opacity-40"
              >
                <Check size={16} />
              </button>
            </div>
          </section>

          {/* Assign student */}
          <section className="rounded-xl border border-forest/10 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-forest">
              <UserPlus size={14} />
              {t("admin.assignStudent")}
            </h4>
            <div className="flex gap-2">
              <select
                value={newStudent}
                onChange={(e) => setNewStudent(e.target.value)}
                className="flex-1 rounded-lg border border-forest/15 bg-cream-2 px-3 py-2 text-xs text-forest outline-none focus:border-gold"
              >
                <option value="">{t("admin.selectStudent")}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {[s.user?.firstName, s.user?.lastName].filter(Boolean).join(" ") || s.registrationNumber}
                  </option>
                ))}
              </select>
              <button
                onClick={doAssignStudent}
                disabled={!newStudent || assignStudent.isPending}
                className="grid size-9 place-items-center rounded-lg bg-forest text-cream transition hover:bg-forest-deep disabled:opacity-40"
              >
                <Check size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
    </FormDialog>
  );
}