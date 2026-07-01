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
  Clock,
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
} from "lucide-react";
import {
  useUser,
  useResetUserPassword,
  useSetUserStatus,
  useDeleteUser,
} from "../hooks/admin-hook";
import { PageLoader } from "../../../components/page-loader";
import type { UserDetail } from "../../../types/admin";

const ROLE_LABEL: Record<string, string> = {
  owner: "المالك",
  admin: "مدير",
  professor: "أستاذ",
  student: "طالب",
};
const ROLE_STYLES: Record<string, string> = {
  owner: "bg-gold/20 text-gold",
  admin: "bg-forest/10 text-forest",
  professor: "bg-sage/20 text-sage",
  student: "bg-soft-sage/30 text-forest",
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

type ModalKind = "password" | "status" | "delete" | null;

export function AdminUserDetailPage() {
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, refetch } = useUser(id ?? null);
  const resetPassword = useResetUserPassword();
  const setStatus = useSetUserStatus();
  const deleteUser = useDeleteUser();

  const [modal, setModal] = useState<ModalKind>(null);
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

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

  const spec = user.student?.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department ?? user.professor?.department;
  const faculty = dept?.faculty;

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

      {/* identity banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={fullName(user)}
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <div className="grid size-16 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-lg font-bold text-cream">
            {(user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") ||
              "\u061f"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl font-bold text-forest">
            {fullName(user)}
          </h1>
          {user.username && (
            <p className="text-sm text-clay" dir="ltr">
              @{user.username}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLES[user.role] ?? "bg-gray-100 text-gray-600"}`}
          >
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isActive ? "نشط" : "موقوف"}
          </span>
        </div>
      </div>

      {/* ── 2) INFO ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* contact */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <h3 className="mb-4 flex items-center gap-2 font-serif text-base font-bold text-forest">
            <Mail size={17} /> معلومات التواصل
          </h3>
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
          <h3 className="mb-4 flex items-center gap-2 font-serif text-base font-bold text-forest">
            <Shield size={17} /> معلومات الحساب
          </h3>
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

      {/* ── 3) ACTIONS ── */}
      <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <h3 className="mb-4 font-serif text-base font-bold text-forest">
          الإجراءات
        </h3>
        <div className="flex flex-wrap items-center gap-3">
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

      {/* ── MODALS ── */}
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
