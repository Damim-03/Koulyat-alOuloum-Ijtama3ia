import { useTranslation } from "react-i18next";
import {
  GraduationCap,
  IdCard,
  Mail,
  Phone,
  CalendarDays,
  Layers,
  Network,
  Building2,
  ChevronLeft,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormDialog } from "../../form/form-dialog";
import { t as translate } from "i18next";

/* eslint-disable @typescript-eslint/no-explicit-any */

function initials(first?: string | null, last?: string | null, fb = translate("admin.unknownInitial")) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || fb;
}

/**
 * A student at a glance, without leaving the list.
 *
 * The lists this opens from are already filtered to one specialization, so
 * the point is to answer "who is this?" in place. Anything beyond the basics
 * lives on the student's own page, one button away.
 */
export function StudentPreviewDialog({
  open,
  student,
  onClose,
  onOpenDetails,
}: {
  open: boolean;
  student: any | null;
  onClose: () => void;
  onOpenDetails: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (!student) return null;

  const u = student.user ?? {};
  const name =
    [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
  const spec = student.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department;
  const faculty = dept?.faculty;

  const rows: { icon: LucideIcon; label: string; value?: string | null; dir?: "ltr" }[] =
    [
      {
        icon: IdCard,
        label: t("admin.regNumber"),
        value: student.registrationNumber,
        dir: "ltr",
      },
      { icon: Mail, label: t("admin.email"), value: u.email, dir: "ltr" },
      { icon: Phone, label: t("admin.phone"), value: u.phone, dir: "ltr" },
      {
        icon: CalendarDays,
        label: t("admin.academicYear"),
        value: student.academicYear?.title,
        dir: "ltr",
      },
      { icon: Layers, label: t("admin.specialization"), value: spec?.name },
      { icon: Network, label: t("admin.filiere"), value: filiere?.name },
      { icon: Building2, label: t("admin.department"), value: dept?.name },
      { icon: GraduationCap, label: t("admin.faculty"), value: faculty?.name },
    ];

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={name}
      subtitle={t("admin.studentPreviewSubtitle")}
      icon={GraduationCap}
      size="lg"
      footerAlign="center"
      footer={
        <>
          <button
            type="button"
            onClick={() => onOpenDetails(student.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
          >
            {t("admin.openStudentDetails")}
            <ChevronLeft size={16} className="ltr:rotate-180" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            <X size={16} />
            {t("admin.closeWindow")}
          </button>
        </>
      }
    >
      {/* Identity */}
      <div className="mb-5 flex items-center gap-4">
        {u.avatarUrl ? (
          <img
            src={u.avatarUrl}
            alt=""
            className="h-24 w-[4.66rem] shrink-0 rounded-xl object-cover shadow-sm"
          />
        ) : (
          <div className="grid h-24 w-[4.66rem] shrink-0 place-items-center rounded-xl bg-linear-to-br from-forest to-forest-deep text-2xl font-bold text-cream shadow-sm">
            {initials(u.firstName, u.lastName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-serif text-xl font-bold text-forest">{name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-forest ring-1 ring-gold/45 ring-inset">
              <IdCard size={13} className="text-gold" />
              <span dir="ltr" className="font-mono tracking-wide">
                {student.registrationNumber ?? "—"}
              </span>
            </span>
            {u.status && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  u.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {t(
                  u.status === "active"
                    ? "admin.statusActive"
                    : "admin.statusSuspended",
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Basics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-3 rounded-xl border border-forest/10 bg-cream-2 px-3.5 py-2.5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-forest/5 text-clay">
              <r.icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-clay">{r.label}</p>
              <p
                className="truncate text-sm font-semibold text-forest"
                dir={r.dir}
              >
                {r.value || "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </FormDialog>
  );
}
