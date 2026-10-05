import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
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
  ShieldQuestion,
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
  Pencil,
} from "lucide-react";
import {
  useUser,
  useUpdateUser,
  useProfessor,
  useStudent,
  useResetUserPassword,
  useSetUserStatus,
  useSetUserVerification,
  useDeleteUser,
} from "../../hooks/admin-hook";
import { PageLoader } from "../../../../components/page-loader";

import type { UserDetail } from "../../../../types/admin";
import { StudentEditDialog } from "../../components/dialog/student/student-edit-dialog.form";
import { ProfessorEditDialog } from "../../components/dialog/professor/professor-edit-dialog.form";
import { SuccessDialog } from "../../../../components/dialog/success-dialog";
import { GenderSelect } from "../../components/ui/gender-select";
import { useTranslation } from "react-i18next";
import { t as translate } from "i18next";
import i18n from "../../../../i18n/i18n";
import {
  ErrorDialog,
  toErrorInfo,
  type ErrorInfo,
} from "../../../../components/dialog/error-dialog";
import { noneText } from "../../../../lib/none-text";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { DangerConfirm } from "../../../../components/dialog/danger-confirm";
import { otherScriptName, personName } from "../../../../lib/person-name";
import { HeaderTrail } from "../../components/ui/hierarchy-header";
import {
  AcademicPath,
  Field,
  FieldGrid,
  HeroButton,
  HeroChip,
  HeroFact,
  HeroStat,
  ProfileHero,
  RecordCard,
} from "../../components/ui/profile-kit";

// Keys, not copy: built once at import time.
const ROLE_LABEL_KEY: Record<string, string> = {
  admin: "role.admin",
  professor: "roles.professor",
  student: "roles.student",
};

const fullName = (u: UserDetail) =>
  personName(u) ||
  u.username ||
  u.email ||
  "\u2014";

const arDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : translate("common.none");

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

/* ── حلقة تقدّم دائرية (SVG خالص) — على الواجهة الداكنة ─────── */
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
          className="stroke-white/15"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-gold-soft transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
    </div>
  );
}

/* ── shared field class + labeled input ─────────────────────── */
const fieldCls =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

function Labeled({
  label,
  group,
  children,
}: {
  label: string;
  /** Several controls (the gender's buttons): a `<label>` would click the first. */
  group?: boolean;
  children: React.ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1 block text-[11px] font-medium text-clay">
        {label}
      </span>
      {children}
    </Tag>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/50 p-4 backdrop-blur-sm"
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

type ModalKind = "edit" | "status" | "verify" | "delete" | null;

export function AdminUserDetailPage() {
  const { t } = useTranslation();
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, refetch } = useUser(id ?? null);
  const updateUser = useUpdateUser();
  const resetPassword = useResetUserPassword();
  const setStatus = useSetUserStatus();
  const setVerification = useSetUserVerification();
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
    gender: "" as "male" | "female" | "",
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
  const isBase = !isProfessor && !isStudent; // admin
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

  /**
   * التوثيق شهادةٌ من الإدارة، وهي تُراجَع: تُرفع وتُسحب.
   *
   * ولا تمسّ الدخول ولا البيانات — ولذلك يقول نصّ التأكيد ذلك صراحةً، حتى
   * لا يُخلط بـ«إيقاف الحساب» وهو الزرّ المجاور.
   */
  function onToggleVerification() {
    const next = !user!.isVerified;
    setVerification.mutate(
      { id: user!.id, isVerified: next },
      {
        onSuccess: () => {
          refetch();
          closeModal();
          setOk({
            title: next
              ? t("toast.accountVerified")
              : t("toast.accountUnverified"),
          });
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
      gender: user!.gender ?? "",
    });
    setModal("edit");
  }
  function onSaveEdit() {
    // أرسِل الحقول المتغيّرة فقط (كلها اختيارية في الـ backend).
    const data: Record<string, string | null> = {};
    const fn = form.firstName.trim();
    const ln = form.lastName.trim();
    const em = form.email.trim();
    const un = form.username.trim();
    if (fn && fn !== (user!.firstName ?? "")) data.firstName = fn;
    if (ln && ln !== (user!.lastName ?? "")) data.lastName = ln;
    if (em && em !== (user!.email ?? "")) data.email = em;
    if (un && un !== (user!.username ?? "")) data.username = un;
    // Unlike the others, an emptied gender is a real change: null clears it.
    if (form.gender !== (user!.gender ?? ""))
      data.gender = form.gender || null;
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

  const none = translate("common.none");
  const other = otherScriptName(user);
  const roleLabel = t(ROLE_LABEL_KEY[user.role]) ?? user.role;
  // An account with no academic path (an administrator) has a short right
  // column; the activity moves there, so the two columns end together.
  const hasPath = !!(faculty || dept || filiere || spec);
  const activityCard = (
    <RecordCard icon={Clock} title={t("admin.profile.activity")} className="flex-1">
      <FieldGrid cols={1}>
        <Field icon={Clock} label={t("admin.lastSignIn")} value={arDateTime(user.lastLoginAt)} />
        <Field icon={CalendarDays} label={t("pro.createdAt")} value={arDate(user.createdAt)} />
      </FieldGrid>
    </RecordCard>
  );

  return (
    <div className="font-body space-y-6">
      <ProfileHero
        trail={
          <HeaderTrail
            crumbs={[{ label: t("dash.users"), to: "/admin/users" }, { label: fullName(user) }]}
            backLabel={t("admin.backToUsersList")}
            backTo="/admin/users"
          />
        }
        avatar={<UserAvatar user={user} width={96} height={124} radius="rounded-2xl" tone="gold" className="shadow-xl ring-4 ring-[color:var(--t-brand)]" />}
        active={isActive}
        activeLabel={isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
        eyebrow={t(`admin.profile.eyebrow_${isBase ? "admin" : user.role}`)}
        name={fullName(user)}
        otherName={other || undefined}
        chips={
          <>
            <HeroChip icon={Shield} tone="gold">
              {roleLabel}
            </HeroChip>
            <HeroChip icon={isActive ? CheckCircle2 : Ban} tone={isActive ? "emerald" : "rose"}>
              {isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
            </HeroChip>
            {user.isVerified && (
              <HeroChip icon={BadgeCheck} tone="sky">
                {t("admin.verified")}
              </HeroChip>
            )}
            {user.username && (
              <HeroChip icon={AtSign} ltr>
                {user.username}
              </HeroChip>
            )}
          </>
        }
        facts={
          <>
            {user.email && <HeroFact icon={Mail} value={user.email} ltr copy={user.email} />}
            {user.phone && <HeroFact icon={Phone} value={user.phone} ltr copy={user.phone} />}
          </>
        }
        actions={
          <>
            <HeroButton
              icon={Pencil}
              variant="primary"
              onClick={isBase ? openEdit : () => setModal("edit")}
              disabled={(isProfessor && !fullProfessor) || (isStudent && !fullStudent)}
            >
              {t("admin.editData")}
            </HeroButton>
            <HeroButton icon={user.isVerified ? ShieldQuestion : BadgeCheck} variant={user.isVerified ? "glass" : "positive"} onClick={() => setModal("verify")}>
              {user.isVerified ? t("admin.unverifyAccount") : t("admin.verifyAccount")}
            </HeroButton>
            <HeroButton icon={isActive ? Ban : CheckCircle2} variant={isActive ? "danger" : "positive"} onClick={() => setModal("status")}>
              {isActive ? t("admin.suspendAccount") : t("admin.activateAccount")}
            </HeroButton>
            <HeroButton icon={Trash2} variant="danger" onClick={() => setModal("delete")}>
              {t("admin.deleteUser")}
            </HeroButton>
          </>
        }
        stats={
          <>
            <HeroStat icon={Activity} label={t("admin.profileCompletion")} value={`${pct}%`} leading={<Ring value={pct} />} />
            <HeroStat icon={CalendarClock} label={t("admin.memberSince")} value={t("admin.daysCount", { count: age })} tone="sky" compact />
            <HeroStat icon={Activity} label={t("admin.lastSignIn")} value={relLogin(user.lastLoginAt)} tone="gold" compact />
            <HeroStat
              icon={BadgeCheck}
              label={t("admin.verificationStatus")}
              value={user.isVerified ? t("admin.verified") : t("admin.unverified")}
              tone={user.isVerified ? "emerald" : "glass"}
              compact
            />
          </>
        }
      />

      {/* ── the record ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <RecordCard icon={Mail} title={t("admin.contactInfo")} className={hasPath ? undefined : "flex-1"}>
            <FieldGrid cols={1}>
              <Field icon={Mail} label={t("admin.email")} value={user.email || none} ltr copy />
              <Field icon={Phone} label={t("footer.phone")} value={user.phone || none} ltr copy />
              <Field icon={AtSign} label={t("admin.username")} value={user.username || none} ltr />
            </FieldGrid>
          </RecordCard>
          {hasPath && activityCard}
        </div>

        <div className="flex flex-col gap-6">
          <RecordCard icon={Shield} title={t("admin.accountInfo")}>
            <FieldGrid cols={1}>
              <Field icon={Shield} label={t("admin.role")} value={roleLabel} />
              {/*
                التوثيق كان في «معلومات التواصل» وهو ليس وسيلة تواصل — وهو
                هنا حالةُ حسابٍ إلى جانب الدور.
              */}
              <Field
                icon={BadgeCheck}
                label={t("admin.verificationStatus")}
                value={user.isVerified ? t("admin.verified") : t("admin.unverified")}
                valueClass={user.isVerified ? "text-emerald-600 dark:text-emerald-300" : "text-clay"}
              />
              {user.student && (
                <>
                  <Field icon={IdCardIcon} label={t("pro.regNumber")} value={user.student.registrationNumber || none} ltr copy />
                  {user.student.academicYear && <Field icon={CalendarDays} label={t("pro.academicYear")} value={user.student.academicYear.title} ltr />}
                </>
              )}
              {user.professor && (
                <>
                  <Field icon={Hash} label={t("admin.employeeNumber")} value={user.professor.employeeNumber || none} ltr copy />
                  <Field icon={Mail} label={t("admin.searchByEmail")} value={user.professor.universityEmail || none} ltr copy />
                </>
              )}
            </FieldGrid>
          </RecordCard>

          {hasPath && (
            <RecordCard icon={Network} title={t(user.student ? "admin.profile.path" : "admin.profile.affiliation")} className="flex-1">
              <AcademicPath
                steps={[
                  { icon: GraduationCap, label: t("admin.facultyLabel"), value: faculty?.name },
                  { icon: Building2, label: t("admin.department"), value: dept?.name },
                  { icon: Network, label: t("admin.filiere"), value: filiere?.name },
                  { icon: Layers, label: t("admin.specializationLabelAlt"), value: spec?.name },
                ]}
              />
            </RecordCard>
          )}
          {!hasPath && activityCard}
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
          <Labeled label={t("admin.gender")} group>
            <GenderSelect
              value={form.gender || null}
              onChange={(next) =>
                setForm((f) => ({ ...f, gender: next ?? "" }))
              }
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
        open={modal === "verify"}
        onClose={closeModal}
        title={
          user.isVerified ? t("admin.unverifyAccount") : t("admin.verifyAccount")
        }
        icon={user.isVerified ? ShieldQuestion : BadgeCheck}
      >
        <p className="mb-5 text-sm text-clay">
          {user.isVerified
            ? t("admin.confirmUnverifyUser", { name: fullName(user) })
            : t("admin.confirmVerifyUser", { name: fullName(user) })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-clay transition hover:bg-forest/5"
          >{t("pro.cancel")}</button>
          <button
            onClick={onToggleVerification}
            disabled={setVerification.isPending}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              user.isVerified
                ? "bg-clay hover:bg-forest"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {user.isVerified ? (
              <ShieldQuestion size={16} />
            ) : (
              <BadgeCheck size={16} />
            )}
            {setVerification.isPending
              ? "…"
              : user.isVerified
                ? t("admin.unverify")
                : t("admin.verify")}
          </button>
        </div>
      </Modal>

      {/*
        هذه الشاشة تحذف الحسابات الإدارية وحدها.

        `deleteUserService` يردّ ٤٠٠ إن كان الحساب طالباً أو أستاذاً، لأنّ
        لهما بياناتٍ مرتبطة لا يُنظّفها حذفُ الحساب وحده — ويطلب حذفهما من
        شاشتيهما. وهذه الصفحة تعرف الدور سلفاً، فتقول ذلك قبل الضغط بدل
        أن تُترك الإدارية تضغط ثمّ تقرأ خطأً أحمر.
      */}
      <DangerConfirm
        open={modal === "delete"}
        onClose={closeModal}
        onConfirm={onDelete}
        loading={deleteUser.isPending}
        title={t("admin.deleteUser")}
        name={fullName(user)}
        kicker={t(ROLE_LABEL_KEY[user.role]) ?? user.role}
        avatar={
          <UserAvatar user={user} width={52} height={64} radius="rounded-xl" />
        }
        facts={[
          {
            icon: Mail,
            label: t("admin.email"),
            value: user.email || noneText(),
            dir: "ltr",
          },
          {
            icon: AtSign,
            label: t("admin.username"),
            value: user.username || noneText(),
            dir: "ltr",
          },
          {
            icon: Activity,
            label: t("admin.statusLabel"),
            value: isActive
              ? t("admin.statusActive")
              : t("admin.statusSuspended"),
          },
          {
            icon: user.isVerified ? BadgeCheck : ShieldQuestion,
            label: t("admin.verificationColumn"),
            value: user.isVerified
              ? t("admin.verified")
              : t("admin.unverified"),
          },
          {
            icon: CalendarDays,
            label: t("admin.joinedOn"),
            value: arDateTime(user.createdAt ?? null),
          },
          {
            icon: Clock,
            label: t("admin.lastSignIn"),
            value: arDateTime(user.lastLoginAt ?? null),
          },
        ]}
        block={
          isStudent
            ? {
                message: t("admin.blockUserIsStudent"),
                hint: t("admin.blockUserIsStudentHint"),
              }
            : isProfessor
              ? {
                  message: t("admin.blockUserIsProfessor"),
                  hint: t("admin.blockUserIsProfessorHint"),
                }
              : null
        }
        impacts={[
          {
            icon: Shield,
            label: t("admin.impactLoginAccount"),
            detail: user.email || undefined,
          },
          { icon: IdCardIcon, label: t("admin.impactSubmissions") },
        ]}
        warning={t("admin.irreversibleWarning")}
      />

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
