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
} from "../../hooks/admin-hook";
import { PageLoader } from "../../../../components/page-loader";

import type { UserDetail } from "../../../../types/admin";
import { StudentEditDialog } from "../../components/dialog/student/student-edit-dialog.form";
import { ProfessorEditDialog } from "../../components/dialog/professor/professor-edit-dialog.form";
import { SuccessDialog } from "../../../../components/dialog/success-dialog";
import { useTranslation } from "react-i18next";
import { t as translate } from "i18next";
import i18n from "../../../../i18n/i18n";
import {
  ErrorDialog,
  toErrorInfo,
  type ErrorInfo,
} from "../../../../components/dialog/error-dialog";

// Keys, not copy: built once at import time.
const ROLE_LABEL_KEY: Record<string, string> = {
  owner: "roles.owner",
  admin: "role.admin",
  professor: "roles.professor",
  student: "roles.student",
};

const fullName = (u: UserDetail) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") ||
  u.username ||
  u.email ||
  "\u2014";

const arDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : "\u2014";

const arDate = (iso: string) =>
  new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso));

/* ── عدد الأيام منذ الإنشاء ─────────────────────────────────── */
function daysSince(iso: string): number {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d < 0 ? 0 : d;
}

/* ── آخر دخول كوقت نسبي بالعربية ────────────────────────────── */
function relLogin(iso: string | null): string {
  if (!iso) return translate("admin.neverSignedIn");
  const diff = new Date(iso).getTime() - Date.now(); // سالب = في الماضي
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
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

type ModalKind = "edit" | "status" | "delete" | null;

export function AdminUserDetailPage() {
  const { t } = useTranslation();
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

  // shared feedback dialogs
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [ok, setOk] = useState<{ title: string; message?: string } | null>(
    null,
  );
  const onErr = (e: unknown) => setErr(toErrorInfo(e));

  const usersPath = `/${lang}/admin/users`;

  if (isLoading) return <PageLoader />;

  if (!user)
    return (
      <div className="font-body rounded-2xl border border-forest/10 bg-cream-card p-10 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <p className="text-clay">{t("admin.userNotFound")}</p>
        <button
          onClick={() => navigate(usersPath)}
          className="mt-4 rounded-xl bg-forest px-5 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >{t("admin.backToList")}</button>
      </div>
    );

  const isActive = user.status === "active";
  const isProfessor = user.role === "professor";
  const isStudent = user.role === "student";
  const isBase = !isProfessor && !isStudent; // admin / owner
  const closeEdit = () => {
    setModal(null);
    refetch();
    // Only the query that has an id. A manual refetch() ignores `enabled`,
    // so calling both fired GET /admin/students/null (404) on every professor
    // edit — and the mirror-image request on every student edit.
    if (profId) refetchProfessor();
    if (studId) refetchStudent();
  };
  const closeModal = () => {
    setModal(null);
    setPw("");
    setShowPw(false);
  };

  function onToggleStatus() {
    setStatus.mutate(
      { id: user!.id, status: isActive ? "suspended" : "active" },
      {
        onSuccess: () => {
          refetch();
          closeModal();
          setOk({ title: isActive ? t("toast.accountSuspended") : t("toast.accountActivated") });
        },
        onError: onErr,
      },
    );
  }
  function onDelete() {
    deleteUser.mutate(user!.id, {
      onSuccess: () => navigate(usersPath),
      onError: (e) => {
        closeModal();
        onErr(e);
      },
    });
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
    const newPassword = pw.trim();

    // كلمة المرور صارت داخل نفس الحوار — تُرسل بعد حفظ البيانات.
    const finish = () => {
      refetch();
      closeModal();
      setPw("");
      setOk({
        title: t("toast.changesSaved"),
        message: newPassword
          ? t("admin.dataAndPasswordUpdated")
          : t("admin.userDataUpdated"),
      });
    };

    const savePassword = () =>
      newPassword
        ? resetPassword.mutate(
            { id: user!.id, password: newPassword },
            { onSuccess: finish, onError: onErr },
          )
        : finish();

    if (Object.keys(data).length === 0) {
      // لا تغيير في الحقول — ربّما كلمة المرور فقط.
      if (!newPassword) {
        closeModal();
        return;
      }
      savePassword();
      return;
    }

    updateUser.mutate(
      { id: user!.id, data },
      { onSuccess: savePassword, onError: onErr },
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
  const passwordOk = !pw.trim() || pw.trim().length >= 6;
  const editValid =
    emailOk &&
    usernameOk &&
    passwordOk &&
    !updateUser.isPending &&
    !resetPassword.isPending;

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
        <ArrowRight size={16} className="ltr:rotate-180" />{t("admin.backToUsersList")}</button>

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
              className="h-24 w-[4.67rem] rounded-xl object-cover ring-4 ring-cream/20"
            />
          ) : (
            <div className="grid h-24 w-[4.67rem] place-items-center rounded-xl bg-cream/15 text-2xl font-bold text-cream ring-4 ring-cream/20">
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
                  <BadgeCheck size={12} />{t("admin.verified")}</span>
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
                {t(ROLE_LABEL_KEY[user.role]) ?? user.role}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  isActive
                    ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/30"
                    : "bg-red-400/20 text-red-100 ring-red-300/30"
                }`}
              >
                {isActive ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                {isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
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
          label={t("admin.profileCompletion")}
        />
        <StatTile
          leading={iconChip(CalendarClock, "bg-soft-sage/30 text-forest")}
          value={t("admin.daysCount", { count: age })}
          label={t("admin.memberSince")}
        />
        <StatTile
          leading={iconChip(Activity, "bg-gold/15 text-gold")}
          value={relLogin(user.lastLoginAt)}
          label={t("admin.lastSignIn")}
        />
        <StatTile
          leading={iconChip(
            BadgeCheck,
            user.isVerified
              ? "bg-emerald-100 text-emerald-600"
              : "bg-gray-100 text-gray-400",
          )}
          value={user.isVerified ? t("admin.verified") : t("admin.unverified")}
          label={t("admin.verificationStatus")}
        />
      </div>

      {/* ── INFO ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* contact */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <SectionTitle icon={Mail}>{t("admin.contactInfo")}</SectionTitle>
          <div className="space-y-2">
            <Info
              icon={Mail}
              label={t("admin.email")}
              value={user.email}
              ltr
            />
            <Info icon={Phone} label={t("footer.phone")} value={user.phone} ltr />
            <Info
              icon={AtSign}
              label={t("admin.username")}
              value={user.username}
              ltr
            />
            <div className="flex items-center gap-2 rounded-xl bg-cream-2 px-4 py-3">
              <BadgeCheck
                size={16}
                className={user.isVerified ? "text-emerald-600" : "text-clay"}
              />
              <span className="text-sm font-medium text-forest">
                {user.isVerified ? t("admin.verifiedAccount") : t("admin.unverified")}
              </span>
            </div>
          </div>
        </div>

        {/* account / academic */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <SectionTitle icon={Shield}>{t("admin.accountInfo")}</SectionTitle>

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
                    <ChevronLeft size={11} className="text-clay/40 ltr:rotate-180" />
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Info
              icon={Shield}
              label={t("admin.role")}
              value={t(ROLE_LABEL_KEY[user.role]) ?? user.role}
            />

            {user.student && (
              <>
                <Info
                  icon={IdCardIcon}
                  label={t("pro.regNumber")}
                  value={user.student.registrationNumber}
                  ltr
                />
                {spec && (
                  <Info icon={Layers} label={t("admin.specializationLabelAlt")} value={spec.name} />
                )}
                {filiere && (
                  <Info icon={Network} label={t("admin.filiere")} value={filiere.name} />
                )}
                {user.student.academicYear && (
                  <Info
                    icon={CalendarDays}
                    label={t("pro.academicYear")}
                    value={user.student.academicYear.title}
                  />
                )}
              </>
            )}

            {user.professor && (
              <>
                <Info
                  icon={Hash}
                  label={t("admin.employeeNumber")}
                  value={user.professor.employeeNumber}
                  ltr
                />
                <Info
                  icon={Mail}
                  label={t("admin.searchByEmail")}
                  value={user.professor.universityEmail}
                  ltr
                />
              </>
            )}

            {dept && <Info icon={Building2} label={t("admin.department")} value={dept.name} />}
            {faculty && (
              <Info icon={GraduationCap} label={t("admin.facultyLabel")} value={faculty.name} />
            )}

            <Info
              icon={Clock}
              label={t("admin.lastSignIn")}
              value={arDateTime(user.lastLoginAt)}
            />
            <Info
              icon={CalendarDays}
              label={t("pro.createdAt")}
              value={arDate(user.createdAt)}
            />
          </div>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <SectionTitle icon={KeyRound}>{t("pro.actions")}</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={isBase ? openEdit : () => setModal("edit")}
            disabled={
              (isProfessor && !fullProfessor) || (isStudent && !fullStudent)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-50"
          >
            <Pencil size={16} />{t("admin.editData")}</button>
          <button
            onClick={() => setModal("status")}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "border-red-200 text-red-600 hover:bg-red-50"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
            {isActive ? t("admin.suspendAccount") : t("admin.activateAccount")}
          </button>
          <button
            onClick={() => setModal("delete")}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            <Trash2 size={16} />{t("admin.deleteUser")}</button>
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
        title={t("admin.editUserTitle")}
        icon={Pencil}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Labeled label={t("admin.firstName")}>
              <input
                autoFocus
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                className={fieldCls}
              />
            </Labeled>
            <Labeled label={t("admin.familyName")}>
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                className={fieldCls}
              />
            </Labeled>
          </div>
          <Labeled label={t("admin.email")}>
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
          <Labeled label={t("admin.username")}>
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
            <p className="text-[11px] text-red-500">{t("validation.emailInvalidAlt")}</p>
          )}
          {!usernameOk && (
            <p className="text-[11px] text-red-500">{t("validation.usernameMinAlt")}</p>
          )}

          {/* كلمة المرور داخل نفس الحوار — لا زرّ منفصل لها. */}
          <div className="border-t border-forest/10 pt-3">
            <Labeled label={t("admin.newPassword")}>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  dir="ltr"
                  placeholder={t("admin.leaveBlankToKeep")}
                  className={`${fieldCls} pl-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-clay transition hover:text-forest"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Labeled>
            {!passwordOk && (
              <p className="mt-1 text-[11px] text-red-500">{t("validation.passwordMinAlt")}</p>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >{t("pro.cancel")}</button>
          <button
            onClick={onSaveEdit}
            disabled={!editValid}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {updateUser.isPending ? t("admin.savingEllipsis") : t("pro.save")}
          </button>
        </div>
      </Modal>

      <Modal
        open={modal === "status"}
        onClose={closeModal}
        title={isActive ? t("admin.suspendAccount") : t("admin.activateAccount")}
        icon={isActive ? Ban : CheckCircle2}
      >
        <p className="mb-5 text-sm text-clay">
          {isActive
            ? t("admin.confirmSuspendUser", { name: fullName(user) })
            : t("admin.confirmActivateUser", { name: fullName(user) })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >{t("pro.cancel")}</button>
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
            {setStatus.isPending ? "…" : isActive ? t("admin.suspend") : t("admin.activate")}
          </button>
        </div>
      </Modal>

      <Modal
        open={modal === "delete"}
        onClose={closeModal}
        title={t("admin.deleteUser")}
        icon={Trash2}
      >
        <p className="mb-5 text-sm text-clay">
          {t("admin.confirmDeleteUserLong", { name: fullName(user) })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >{t("pro.cancel")}</button>
          <button
            onClick={onDelete}
            disabled={deleteUser.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {deleteUser.isPending ? t("admin.deletingEllipsis") : t("admin.deletePermanently")}
          </button>
        </div>
      </Modal>

      {/* feedback dialogs */}
      <ErrorDialog open={!!err} error={err} onClose={() => setErr(null)} />
      <SuccessDialog
        open={!!ok}
        title={ok?.title ?? ""}
        message={ok?.message}
        onClose={() => setOk(null)}
        autoCloseMs={2200}
      />
    </div>
  );
}
