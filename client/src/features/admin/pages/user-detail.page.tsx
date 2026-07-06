import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  Phone,
  AtSign,
  Shield,
  IdCard as IdCardIcon,
  Hash,
  CalendarDays,
  CalendarClock,
  Clock,
  Activity,
  BadgeCheck,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  GraduationCap,
  Building2,
  Layers,
  Network,
  ChevronLeft,
  Sparkles,
  Pencil,
} from "lucide-react";
import {
  useUser,
  useUpdateUser,
  useProfessor,
  useStudent,
  useResetUserPassword,
  useSetUserStatus,
  useDeleteUser,
} from "../hooks/admin-hook";
import { PageLoader } from "../../../components/page-loader";
import { ProfessorEditDialog } from "../components/professor-edit-dialog";
import { StudentEditDialog } from "../components/student-edit-dialog";
import type { UserDetail } from "../../../types/admin";

const ROLE_LABEL: Record<string, string> = {
  owner: "المالك",
  admin: "مدير",
  professor: "أستاذ",
  student: "طالب",
};

const fullName = (u: UserDetail) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") ||
  u.username ||
  u.email ||
  "\u2014";

const arDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ar", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : "\u2014";

const arDate = (iso: string) =>
  new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(iso));

/* ── عدد الأيام منذ الإنشاء ─────────────────────────────────── */
function daysSince(iso: string): number {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d < 0 ? 0 : d;
}

/* ── آخر دخول كوقت نسبي بالعربية ────────────────────────────── */
function relLogin(iso: string | null): string {
  if (!iso) return "لم يدخل بعد";
  const diff = new Date(iso).getTime() - Date.now(); // سالب = في الماضي
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  const min = 60_000,
    hr = 3_600_000,
    day = 86_400_000;
  if (abs < hr) return rtf.format(Math.round(diff / min), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  if (abs < 365 * day)
    return rtf.format(Math.round(diff / (30 * day)), "month");
  return rtf.format(Math.round(diff / (365 * day)), "year");
}

/* ── نسبة اكتمال الملف الشخصي ───────────────────────────────── */
function completeness(u: UserDetail): number {
  let fields: boolean[] = [
    !!u.firstName,
    !!u.lastName,
    !!u.email,
    !!u.phone,
    !!u.username,
    !!u.avatarUrl,
    u.isVerified,
  ];
  if (u.student) {
    fields = fields.concat([
      !!u.student.registrationNumber,
      !!u.student.academicYear,
      !!u.student.specialization,
    ]);
  } else if (u.professor) {
    fields = fields.concat([
      !!u.professor.employeeNumber,
      !!u.professor.universityEmail,
    ]);
  }
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

/* ── حلقة تقدّم دائرية (SVG خالص) ───────────────────────────── */
function Ring({ value }: { value: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const off = c - (pct / 100) * c;
  return (
    <div className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-forest/10"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-gold transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
    </div>
  );
}

/* ── دائرة أيقونة ملوّنة ─────────────────────────────────────── */
function iconChip(Icon: typeof Mail, tint: string) {
  return (
    <div
      className={`grid size-11 shrink-0 place-items-center rounded-full ${tint}`}
    >
      <Icon size={20} />
    </div>
  );
}

/* ── بطاقة إحصائية ──────────────────────────────────────────── */
function StatTile({
  leading,
  value,
  label,
}: {
  leading: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(38,66,61,0.10)]">
      {leading}
      <div className="min-w-0">
        <div className="truncate font-serif text-lg font-bold text-forest">
          {value}
        </div>
        <p className="text-[11px] text-clay">{label}</p>
      </div>
    </div>
  );
}

/* ── labeled info row ─────────────────────────────────────── */
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
    <div className="flex items-start gap-3 rounded-xl bg-cream-2 px-4 py-3 transition hover:bg-forest/5">
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

/* ── عنوان قسم بأيقونة داخل رقاقة ───────────────────────────── */
function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-4 flex items-center gap-2.5 font-serif text-base font-bold text-forest">
      <span className="grid size-9 place-items-center rounded-xl bg-soft-sage/30 text-forest">
        <Icon size={17} />
      </span>
      {children}
    </h3>
  );
}

/* ── shared field class + labeled input ─────────────────────── */
const fieldCls =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-clay">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ── modal shell ──────────────────────────────────────────── */
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
  // close on Escape
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

type ModalKind = "edit" | "password" | "status" | "delete" | null;

export function AdminUserDetailPage() {
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, refetch } = useUser(id ?? null);
  const updateUser = useUpdateUser();
  const resetPassword = useResetUserPassword();
  const setStatus = useSetUserStatus();
  const deleteUser = useDeleteUser();

  // نجلب الكيان الكامل حسب الدور كي تُعبّئ النافذة المخصّصة حقولها.
  const profId =
    user?.role === "professor" ? (user.professor?.id ?? null) : null;
  const studId = user?.role === "student" ? (user.student?.id ?? null) : null;
  const { data: fullProfessor, refetch: refetchProfessor } =
    useProfessor(profId);
  const { data: fullStudent, refetch: refetchStudent } = useStudent(studId);

  const [modal, setModal] = useState<ModalKind>(null);
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
  });

  const usersPath = `/${lang}/admin/users`;

  if (isLoading) return <PageLoader />;

  if (!user)
    return (
      <div className="font-body rounded-2xl border border-forest/10 bg-cream-card p-10 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <p className="text-clay">المستخدم غير موجود.</p>
        <button
          onClick={() => navigate(usersPath)}
          className="mt-4 rounded-xl bg-forest px-5 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          العودة للقائمة
        </button>
      </div>
    );

  const isActive = user.status === "active";
  const isProfessor = user.role === "professor";
  const isStudent = user.role === "student";
  const isBase = !isProfessor && !isStudent; // admin / owner
  const closeEdit = () => {
    setModal(null);
    refetch();
    refetchProfessor();
    refetchStudent();
  };
  const closeModal = () => {
    setModal(null);
    setPw("");
    setShowPw(false);
  };

  function onResetPassword() {
    if (pw.length < 6) return;
    resetPassword.mutate(
      { id: user!.id, password: pw },
      { onSuccess: closeModal },
    );
  }
  function onToggleStatus() {
    setStatus.mutate(
      { id: user!.id, status: isActive ? "suspended" : "active" },
      {
        onSuccess: () => {
          refetch();
          closeModal();
        },
      },
    );
  }
  function onDelete() {
    deleteUser.mutate(user!.id, { onSuccess: () => navigate(usersPath) });
  }
  function openEdit() {
    setForm({
      firstName: user!.firstName ?? "",
      lastName: user!.lastName ?? "",
      email: user!.email ?? "",
      username: user!.username ?? "",
    });
    setModal("edit");
  }
  function onSaveEdit() {
    // أرسِل الحقول المتغيّرة فقط (كلها اختيارية في الـ backend).
    const data: Record<string, string> = {};
    const fn = form.firstName.trim();
    const ln = form.lastName.trim();
    const em = form.email.trim();
    const un = form.username.trim();
    if (fn && fn !== (user!.firstName ?? "")) data.firstName = fn;
    if (ln && ln !== (user!.lastName ?? "")) data.lastName = ln;
    if (em && em !== (user!.email ?? "")) data.email = em;
    if (un && un !== (user!.username ?? "")) data.username = un;
    if (Object.keys(data).length === 0) {
      closeModal();
      return;
    }
    updateUser.mutate(
      { id: user!.id, data },
      {
        onSuccess: () => {
          refetch();
          closeModal();
        },
      },
    );
  }

  const spec = user.student?.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department ?? user.professor?.department;
  const faculty = dept?.faculty;

  const pct = completeness(user);
  const age = daysSince(user.createdAt);

  // صلاحية نموذج التعديل.
  const emailOk =
    !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const usernameOk = !form.username.trim() || form.username.trim().length >= 3;
  const editValid = emailOk && usernameOk && !updateUser.isPending;

  // سلسلة المسار الأكاديمي (للطلبة) — تُعرض فقط عند توفّر أي مستوى.
  const pathChain = [
    faculty?.name,
    dept?.name,
    filiere?.name,
    spec?.name,
  ].filter(Boolean) as string[];

  return (
    <div className="font-body space-y-6">
      {/* back */}
      <button
        onClick={() => navigate(usersPath)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} />
        العودة لقائمة المستخدمين
      </button>

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-l from-forest-deep to-forest p-6 text-cream shadow-[0_10px_40px_rgba(38,66,61,0.20)]">
        {/* decorative glows */}
        <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-cream/5" />
        <div className="pointer-events-none absolute -bottom-16 left-24 size-48 rounded-full bg-gold/10 blur-2xl" />
        <Sparkles
          size={18}
          className="pointer-events-none absolute left-6 top-6 text-gold/60"
        />

        <div className="relative flex flex-wrap items-center gap-5">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={fullName(user)}
              className="size-20 rounded-full object-cover ring-4 ring-cream/20"
            />
          ) : (
            <div className="grid size-20 place-items-center rounded-full bg-cream/15 text-2xl font-bold text-cream ring-4 ring-cream/20">
              {(user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") ||
                "\u061f"}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-bold">
                {fullName(user)}
              </h1>
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
                  <BadgeCheck size={12} /> موثّق
                </span>
              )}
            </div>
            {user.username && (
              <p className="text-sm text-cream/70" dir="ltr">
                @{user.username}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/15 px-3 py-1 text-xs font-semibold text-cream ring-1 ring-cream/20">
                <Shield size={13} />
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  isActive
                    ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/30"
                    : "bg-red-400/20 text-red-100 ring-red-300/30"
                }`}
              >
                {isActive ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                {isActive ? "نشط" : "موقوف"}
              </span>
              {user.email && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs text-cream/80"
                  dir="ltr"
                >
                  <Mail size={13} /> {user.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          leading={<Ring value={pct} />}
          value={`${pct}%`}
          label="اكتمال الملف"
        />
        <StatTile
          leading={iconChip(CalendarClock, "bg-soft-sage/30 text-forest")}
          value={`${age} يوم`}
          label="عضو منذ الإنشاء"
        />
        <StatTile
          leading={iconChip(Activity, "bg-gold/15 text-gold")}
          value={relLogin(user.lastLoginAt)}
          label="آخر دخول"
        />
        <StatTile
          leading={iconChip(
            BadgeCheck,
            user.isVerified
              ? "bg-emerald-100 text-emerald-600"
              : "bg-gray-100 text-gray-400",
          )}
          value={user.isVerified ? "موثّق" : "غير موثّق"}
          label="حالة التوثيق"
        />
      </div>

      {/* ── INFO ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* contact */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <SectionTitle icon={Mail}>معلومات التواصل</SectionTitle>
          <div className="space-y-2">
            <Info
              icon={Mail}
              label="البريد الإلكتروني"
              value={user.email}
              ltr
            />
            <Info icon={Phone} label="الهاتف" value={user.phone} ltr />
            <Info
              icon={AtSign}
              label="اسم المستخدم"
              value={user.username}
              ltr
            />
            <div className="flex items-center gap-2 rounded-xl bg-cream-2 px-4 py-3">
              <BadgeCheck
                size={16}
                className={user.isVerified ? "text-emerald-600" : "text-clay"}
              />
              <span className="text-sm font-medium text-forest">
                {user.isVerified ? "حساب موثّق" : "غير موثّق"}
              </span>
            </div>
          </div>
        </div>

        {/* account / academic */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <SectionTitle icon={Shield}>معلومات الحساب</SectionTitle>

          {/* academic path chain (students) */}
          {user.student && pathChain.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-cream-2 px-4 py-3">
              {pathChain.map((name, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span
                    className={`text-xs ${
                      i === pathChain.length - 1
                        ? "font-semibold text-sage"
                        : "text-clay"
                    }`}
                  >
                    {name}
                  </span>
                  {i < pathChain.length - 1 && (
                    <ChevronLeft size={11} className="text-clay/40" />
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Info
              icon={Shield}
              label="الدور"
              value={ROLE_LABEL[user.role] ?? user.role}
            />

            {user.student && (
              <>
                <Info
                  icon={IdCardIcon}
                  label="رقم التسجيل"
                  value={user.student.registrationNumber}
                  ltr
                />
                {spec && (
                  <Info icon={Layers} label="التخصّص" value={spec.name} />
                )}
                {filiere && (
                  <Info icon={Network} label="الشعبة" value={filiere.name} />
                )}
                {user.student.academicYear && (
                  <Info
                    icon={CalendarDays}
                    label="السنة الجامعية"
                    value={user.student.academicYear.title}
                  />
                )}
              </>
            )}

            {user.professor && (
              <>
                <Info
                  icon={Hash}
                  label="الرقم الوظيفي"
                  value={user.professor.employeeNumber}
                  ltr
                />
                <Info
                  icon={Mail}
                  label="البريد الجامعي"
                  value={user.professor.universityEmail}
                  ltr
                />
              </>
            )}

            {dept && <Info icon={Building2} label="القسم" value={dept.name} />}
            {faculty && (
              <Info icon={GraduationCap} label="الكلّية" value={faculty.name} />
            )}

            <Info
              icon={Clock}
              label="آخر دخول"
              value={arDateTime(user.lastLoginAt)}
            />
            <Info
              icon={CalendarDays}
              label="تاريخ الإنشاء"
              value={arDate(user.createdAt)}
            />
          </div>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <SectionTitle icon={KeyRound}>الإجراءات</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={isBase ? openEdit : () => setModal("edit")}
            disabled={
              (isProfessor && !fullProfessor) || (isStudent && !fullStudent)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-50"
          >
            <Pencil size={16} /> تعديل البيانات
          </button>
          <button
            onClick={() => setModal("password")}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            <KeyRound size={16} /> إعادة كلمة المرور
          </button>
          <button
            onClick={() => setModal("status")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "border-red-200 text-red-600 hover:bg-red-50"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
            {isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
          </button>
          <button
            onClick={() => setModal("delete")}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            <Trash2 size={16} /> حذف المستخدم
          </button>
        </div>
      </div>

      {/* role-specific edit dialogs */}
      {isProfessor && modal === "edit" && (
        <ProfessorEditDialog
          open
          professor={fullProfessor ?? null}
          onClose={closeEdit}
        />
      )}
      {isStudent && modal === "edit" && (
        <StudentEditDialog
          open
          student={fullStudent ?? null}
          onClose={closeEdit}
        />
      )}

      {/* ── MODALS ── */}
      <Modal
        open={isBase && modal === "edit"}
        onClose={closeModal}
        title="تعديل بيانات المستخدم"
        icon={Pencil}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="الاسم الأول">
              <input
                autoFocus
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                className={fieldCls}
              />
            </Labeled>
            <Labeled label="اسم العائلة">
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                className={fieldCls}
              />
            </Labeled>
          </div>
          <Labeled label="البريد الإلكتروني">
            <input
              dir="ltr"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className={fieldCls}
              placeholder="name@example.com"
            />
          </Labeled>
          <Labeled label="اسم المستخدم">
            <input
              dir="ltr"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              className={fieldCls}
            />
          </Labeled>
          {!emailOk && (
            <p className="text-[11px] text-red-500">بريد إلكتروني غير صالح</p>
          )}
          {!usernameOk && (
            <p className="text-[11px] text-red-500">
              اسم المستخدم ٣ أحرف على الأقل
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >
            إلغاء
          </button>
          <button
            onClick={onSaveEdit}
            disabled={!editValid}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {updateUser.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </Modal>

      <Modal
        open={modal === "password"}
        onClose={closeModal}
        title="إعادة تعيين كلمة المرور"
        icon={KeyRound}
      >
        <p className="mb-4 text-xs text-clay">
          عيّن كلمة مرور جديدة لـ «{fullName(user)}» (6 أحرف على الأقل).
        </p>
        <div className="relative mb-4">
          <input
            type={showPw ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            dir="ltr"
            placeholder="••••••••"
            autoFocus
            className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >
            إلغاء
          </button>
          <button
            onClick={onResetPassword}
            disabled={pw.length < 6 || resetPassword.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {resetPassword.isPending ? "جارٍ الحفظ…" : "تعيين"}
          </button>
        </div>
      </Modal>

      <Modal
        open={modal === "status"}
        onClose={closeModal}
        title={isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
        icon={isActive ? Ban : CheckCircle2}
      >
        <p className="mb-5 text-sm text-clay">
          {isActive
            ? `سيُمنَع «${fullName(user)}» من الدخول حتى إعادة التفعيل. لن تُحذَف بياناته.`
            : `سيُعاد تفعيل حساب «${fullName(user)}» ويتمكّن من الدخول.`}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >
            إلغاء
          </button>
          <button
            onClick={onToggleStatus}
            disabled={setStatus.isPending}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              isActive
                ? "bg-red-500 hover:bg-red-600"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
            {setStatus.isPending ? "…" : isActive ? "إيقاف" : "تفعيل"}
          </button>
        </div>
      </Modal>

      <Modal
        open={modal === "delete"}
        onClose={closeModal}
        title="حذف المستخدم"
        icon={Trash2}
      >
        <p className="mb-5 text-sm text-clay">
          هل أنت متأكّد من حذف «{fullName(user)}» نهائيًّا؟ لا يمكن التراجع عن
          هذا الإجراء.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >
            إلغاء
          </button>
          <button
            onClick={onDelete}
            disabled={deleteUser.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {deleteUser.isPending ? "جارٍ الحذف…" : "حذف نهائي"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
