import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  Shield,
  IdCard as IdCardIcon,
  CalendarDays,
  Layers,
  Network,
  Building2,
  GraduationCap,
  FileText,
  Users,
  FolderKanban,
  MessagesSquare,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import {
  useUpdateStudent,
  useDeleteStudent,
  useSpecializations,
  useAcademicYears,
  useStudent,
} from "../hooks/admin-hook";
import { PageLoader } from "../../../components/page-loader";

/* eslint-disable @typescript-eslint/no-explicit-any */

const arDate = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
        new Date(iso),
      )
    : "\u2014";

const STATUS_AR: Record<string, string> = {
  pending: "معلّق",
  accepted: "مقبول",
  rejected: "مرفوض",
  approved: "مقبول",
  open: "منشور",
  full: "مكتمل",
};

function Info({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: typeof Mail;
  label: string;
  value?: string | null;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-cream-2 px-4 py-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-clay" />
      <div className="min-w-0">
        <p className="text-[11px] text-clay">{label}</p>
        <p
          className="truncate text-sm font-medium text-forest"
          dir={ltr ? "ltr" : undefined}
        >
          {value || "\u2014"}
        </p>
      </div>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-forest">
            <Icon size={18} />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AdminStudentDetailPage() {
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useNavigate();

  const { data: student, isLoading } = useStudent(id ?? null) as {
    data: any;
    isLoading: boolean;
  };
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    specializationId: "",
    academicYearId: "",
  });

  const studentsPath = `/${lang}/admin/students`;

  // hydrate edit form when student loads
  useEffect(() => {
    if (student) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        firstName: student.user?.firstName ?? "",
        lastName: student.user?.lastName ?? "",
        specializationId: student.specialization?.id ?? "",
        academicYearId: student.academicYear?.id ?? "",
      });
    }
  }, [student]);

  if (isLoading) return <PageLoader />;

  if (!student)
    return (
      <div className="font-body rounded-2xl border border-forest/10 bg-cream-card p-10 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <p className="text-clay">الطالب غير موجود.</p>
        <button
          onClick={() => navigate(studentsPath)}
          className="mt-4 rounded-xl bg-forest px-5 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          العودة للقائمة
        </button>
      </div>
    );

  const u = student.user ?? {};
  const name =
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    student.registrationNumber ||
    "\u2014";
  const spec = student.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department;
  const faculty = dept?.faculty;

  const applications = student.applications ?? [];
  const ledRequests = student.ledGroupRequests ?? [];
  const projectMembers = student.projectMembers ?? [];

  function onSaveEdit() {
    const data: Record<string, unknown> = {
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      specializationId: form.specializationId || undefined,
      academicYearId: form.academicYearId || undefined,
    };
    updateStudent.mutate(
      { id: student.id, data },
      { onSuccess: () => setModal(null) },
    );
  }

  function onDelete() {
    deleteStudent.mutate(student.id, {
      onSuccess: () => navigate(studentsPath),
    });
  }

  return (
    <div className="font-body space-y-6">
      <button
        onClick={() => navigate(studentsPath)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} />
        العودة لقائمة الطلبة
      </button>

      {/* identity banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {u.avatarUrl ? (
          <img
            src={u.avatarUrl}
            alt={name}
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <div className="grid size-16 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-lg font-bold text-cream">
            {(u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "") || "\u061f"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl font-bold text-forest">{name}</h1>
          <p className="text-sm text-clay" dir="ltr">
            {student.registrationNumber}
          </p>
        </div>
        <span className="rounded-full bg-soft-sage/30 px-3 py-1 text-xs font-semibold text-forest">
          طالب
        </span>
      </div>

      {/* info grids */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <h3 className="mb-4 flex items-center gap-2 font-serif text-base font-bold text-forest">
            <Mail size={17} /> معلومات التواصل
          </h3>
          <div className="space-y-2">
            <Info icon={Mail} label="البريد الإلكتروني" value={u.email} ltr />
            <Info
              icon={IdCardIcon}
              label="رقم التسجيل"
              value={student.registrationNumber}
              ltr
            />
          </div>
        </div>

        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <h3 className="mb-4 flex items-center gap-2 font-serif text-base font-bold text-forest">
            <Shield size={17} /> المعلومات الأكاديمية
          </h3>
          <div className="space-y-2">
            {spec && <Info icon={Layers} label="التخصّص" value={spec.name} />}
            {filiere && (
              <Info icon={Network} label="الشعبة" value={filiere.name} />
            )}
            {dept && <Info icon={Building2} label="القسم" value={dept.name} />}
            {faculty && (
              <Info icon={GraduationCap} label="الكلّية" value={faculty.name} />
            )}
            {student.academicYear && (
              <Info
                icon={CalendarDays}
                label="السنة الجامعية"
                value={student.academicYear.title}
              />
            )}
          </div>
        </div>
      </div>

      {/* applications */}
      {applications.length > 0 && (
        <Section icon={FileText} title="طلبات المواضيع الفردية">
          <ul className="divide-y divide-forest/10">
            {applications.map((a: any) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <p className="truncate text-sm font-medium text-forest">
                  {a.topic?.title ?? "\u2014"}
                </p>
                <span className="shrink-0 rounded-full bg-cream-2 px-2.5 py-0.5 text-[11px] text-clay">
                  {STATUS_AR[a.status] ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* led group requests */}
      {ledRequests.length > 0 && (
        <Section icon={Users} title="طلبات الفرق (كقائد)">
          <ul className="divide-y divide-forest/10">
            {ledRequests.map((r: any) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <p className="truncate text-sm font-medium text-forest">
                  {r.topic?.title ?? "\u2014"}
                </p>
                <span className="shrink-0 rounded-full bg-cream-2 px-2.5 py-0.5 text-[11px] text-clay">
                  {STATUS_AR[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* projects + defense */}
      {projectMembers.length > 0 && (
        <Section icon={FolderKanban} title="المشاريع">
          <ul className="divide-y divide-forest/10">
            {projectMembers.map((pm: any) => {
              const g = pm.group ?? pm;
              return (
                <li key={pm.id} className="py-3">
                  <p className="truncate text-sm font-medium text-forest">
                    {g.topic?.title ?? "\u2014"}
                  </p>
                  {g.defense && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gold">
                      <MessagesSquare size={12} />
                      مناقشة: {arDate(g.defense.date)} · {g.defense.room}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* actions */}
      <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <h3 className="mb-4 font-serif text-base font-bold text-forest">
          الإجراءات
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setModal("edit")}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            <Pencil size={16} /> تعديل البيانات
          </button>
          <button
            onClick={() => setModal("delete")}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            <Trash2 size={16} /> حذف الطالب
          </button>
        </div>
      </div>

      {/* edit modal */}
      <Modal
        open={modal === "edit"}
        onClose={() => setModal(null)}
        title="تعديل بيانات الطالب"
        icon={Pencil}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="الاسم">
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </Field>
            <Field label="اللقب">
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </Field>
          </div>
          <Field label="التخصّص">
            <select
              value={form.specializationId}
              onChange={(e) =>
                setForm((f) => ({ ...f, specializationId: e.target.value }))
              }
              className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            >
              <option value="">—</option>
              {specs?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="السنة الجامعية">
            <select
              value={form.academicYearId}
              onChange={(e) =>
                setForm((f) => ({ ...f, academicYearId: e.target.value }))
              }
              className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            >
              <option value="">—</option>
              {years?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setModal(null)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >
            إلغاء
          </button>
          <button
            onClick={onSaveEdit}
            disabled={updateStudent.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {updateStudent.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </Modal>

      {/* delete modal */}
      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="حذف الطالب"
        icon={Trash2}
      >
        <p className="mb-5 text-sm text-clay">
          هل أنت متأكّد من حذف «{name}» نهائيًّا؟ سيُحذَف حسابه وبياناته
          المرتبطة. لا يمكن التراجع.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setModal(null)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >
            إلغاء
          </button>
          <button
            onClick={onDelete}
            disabled={deleteStudent.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {deleteStudent.isPending ? "جارٍ الحذف…" : "حذف نهائي"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-bold text-forest">
        <Icon size={17} /> {title}
      </h3>
      {children}
    </div>
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
      <span className="mb-1 block text-xs text-clay">{label}</span>
      {children}
    </label>
  );
}
