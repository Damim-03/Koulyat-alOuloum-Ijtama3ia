import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  UserCog,
  Camera,
  Loader2,
  Trash2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useUpdateProfessor,
  useDepartments,
  useFaculties,
  useFilieres,
  useUploadImage,
  useSetUserStatus,
  useResetUserPassword,
} from "../hooks/admin-hook";
import { TagInput } from "../components/tag-input";
import type { Professor } from "../../../types/admin";

interface Props {
  open: boolean;
  professor: Professor | null;
  onClose: () => void;
}

interface EditState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  universityEmail: string;
  facultyId: string;
  departmentId: string;
  filiereId: string;
  avatarUrl: string;
  status: "active" | "suspended";
  password: string;
  grade: string[];
  tags: string[];
}

const UNIV_EMAIL = /^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/;

function initials(first?: string, last?: string) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || "\u061f";
}

export function ProfessorEditDialog({ open, professor, onClose }: Props) {
  const update = useUpdateProfessor();
  const setStatus = useSetUserStatus();
  const uploadImage = useUploadImage();
  const resetPassword = useResetUserPassword();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EditState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    universityEmail: "",
    facultyId: "",
    departmentId: "",
    filiereId: "",
    avatarUrl: "",
    status: "active",
    password: "",
    grade: [],
    tags: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open && professor) {
      const dept = professor.department;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        firstName: professor.user?.firstName ?? "",
        lastName: professor.user?.lastName ?? "",
        email: professor.user?.email ?? "",
        phone: professor.user?.phone ?? "",
        universityEmail: professor.universityEmail ?? "",
        facultyId: dept?.faculty?.id ?? dept?.facultyId ?? "",
        departmentId: dept?.id ?? "",
        filiereId: "",
        avatarUrl: professor.user?.avatarUrl ?? "",
        status: professor.user?.status ?? "active",
        password: "",
        grade: professor.grade ?? [],
        tags: professor.tags ?? [],
      });
      setError(null);
      setShowPassword(false);
    }
  }, [open, professor]);

  // ── cascading options ──
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d) => !form.facultyId || d.facultyId === form.facultyId,
      ),
    [departments, form.facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter(
        (f) => !form.departmentId || f.departmentId === form.departmentId,
      ),
    [filieres, form.departmentId],
  );

  if (!open || !professor) return null;

  function set<K extends keyof EditState>(key: K, value: EditState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // when faculty changes, clear department/filiere if now incompatible
  function onFacultyChange(facultyId: string) {
    setForm((f) => {
      const deptStillValid =
        f.departmentId &&
        (departments ?? []).some(
          (d) => d.id === f.departmentId && d.facultyId === facultyId,
        );
      return {
        ...f,
        facultyId,
        departmentId: deptStillValid ? f.departmentId : "",
        filiereId: deptStillValid ? f.filiereId : "",
      };
    });
  }
  function onDepartmentChange(departmentId: string) {
    setForm((f) => ({ ...f, departmentId, filiereId: "" }));
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadImage.mutate(file, { onSuccess: (url) => set("avatarUrl", url) });
  }

  const busy =
    update.isPending ||
    setStatus.isPending ||
    uploadImage.isPending ||
    resetPassword.isPending;

  function submit() {
    setError(null);
    if (!UNIV_EMAIL.test(form.universityEmail)) {
      setError("البريد الجامعي يجب أن ينتهي بـ @univ-eloued.dz");
      return;
    }
    if (!form.departmentId) {
      setError("اختر القسم");
      return;
    }
    if (form.password && form.password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    const statusChanged = form.status !== professor!.user?.status;
    const userId = professor!.userId;

    update.mutate(
      {
        id: professor!.id,
        data: {
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          email: form.email || null,
          phone: form.phone || null,
          avatarUrl: form.avatarUrl || null,
          universityEmail: form.universityEmail,
          departmentId: form.departmentId, // only departmentId is persisted
          grade: form.grade,
          tags: form.tags,
        },
      },
      {
        onSuccess: () => {
          // chain the side operations (status + password) then close
          const afterStatus = () => {
            if (form.password && userId) {
              resetPassword.mutate(
                { id: userId, password: form.password },
                { onSuccess: onClose },
              );
            } else {
              onClose();
            }
          };
          if (statusChanged && userId) {
            setStatus.mutate(
              { id: userId, status: form.status },
              { onSuccess: afterStatus },
            );
          } else {
            afterStatus();
          }
        },
      },
    );
  }

  const inputCls =
    "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
  const lblCls = "mb-1 block text-[11px] font-medium text-clay";

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />

      <div className="animate-[fadeIn_0.15s_ease-out] relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 bg-linear-to-l from-forest to-forest-deep px-6 py-4 text-cream">
          <div className="grid size-9 place-items-center rounded-xl bg-cream/15">
            <UserCog size={18} />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-base font-bold">
              تعديل بيانات الأستاذ
            </h3>
            <p className="text-[11px] text-cream/70">
              عدّل كل الحقول ثم احفظ التغييرات
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[calc(92vh-9rem)] space-y-5 overflow-y-auto px-6 py-5">
          {/* avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt=""
                  className="size-20 rounded-2xl border border-forest/10 object-cover"
                />
              ) : (
                <div className="grid size-20 place-items-center rounded-2xl bg-linear-to-br from-forest to-forest-deep text-xl font-bold text-cream">
                  {initials(form.firstName, form.lastName)}
                </div>
              )}
              {uploadImage.isPending && (
                <div className="absolute inset-0 grid place-items-center rounded-2xl bg-forest-deep/50">
                  <Loader2 size={20} className="animate-spin text-cream" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className={lblCls}>الصورة الشخصية</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadImage.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-cream-2 px-3 py-2 text-xs font-semibold text-forest transition hover:border-gold hover:bg-gold/10 disabled:opacity-60"
                >
                  <Camera size={14} /> رفع صورة
                </button>
                {form.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => set("avatarUrl", "")}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 size={14} /> إزالة
                  </button>
                )}
              </div>
              <p className="text-[10px] text-clay/70">
                JPG / PNG / WEBP — أقصى حجم 2 ميغابايت
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={onPickFile}
                className="hidden"
              />
            </div>
          </div>

          {/* name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={lblCls}>الاسم</span>
              <input
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={lblCls}>اللقب</span>
              <input
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          {/* employee number (read-only) + university email */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={lblCls}>الرقم الوظيفي (غير قابل للتعديل)</span>
              <input
                value={professor.employeeNumber}
                readOnly
                dir="ltr"
                className={`${inputCls} cursor-not-allowed bg-forest/5 text-clay`}
              />
            </label>
            <label className="block">
              <span className={lblCls}>البريد الجامعي</span>
              <input
                value={form.universityEmail}
                onChange={(e) => set("universityEmail", e.target.value)}
                dir="ltr"
                className={inputCls}
                placeholder="prof@univ-eloued.dz"
              />
            </label>
          </div>

          {/* cascading: faculty → department → filiere */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={lblCls}>الكلّية</span>
              <select
                value={form.facultyId}
                onChange={(e) => onFacultyChange(e.target.value)}
                className={inputCls}
              >
                <option value="">كل الكلّيات</option>
                {faculties?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={lblCls}>القسم</span>
              <select
                value={form.departmentId}
                onChange={(e) => onDepartmentChange(e.target.value)}
                className={inputCls}
              >
                <option value="">اختر القسم</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={lblCls}>الشعبة</span>
              <select
                value={form.filiereId}
                onChange={(e) => set("filiereId", e.target.value)}
                className={inputCls}
              >
                <option value="">كل الشُّعب</option>
                {filiereOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* personal email + phone */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={lblCls}>البريد الشخصي</span>
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                dir="ltr"
                className={inputCls}
                placeholder="example@gmail.com"
              />
            </label>
            <label className="block">
              <span className={lblCls}>رقم الهاتف</span>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                dir="ltr"
                className={inputCls}
                placeholder="0xxxxxxxxx"
              />
            </label>
          </div>

          {/* status + password reset */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={lblCls}>الحالة</span>
              <select
                value={form.status}
                onChange={(e) =>
                  set("status", e.target.value as "active" | "suspended")
                }
                className={inputCls}
              >
                <option value="active">نشط</option>
                <option value="suspended">موقوف</option>
              </select>
            </label>
            <label className="block">
              <span className={lblCls}>
                <span className="inline-flex items-center gap-1">
                  <KeyRound size={12} /> كلمة مرور جديدة (اختياري)
                </span>
              </span>
              <div className="relative">
                <input
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  className={inputCls}
                  placeholder="اتركها فارغة لعدم التغيير"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
          </div>

          {/* grade + tags */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TagInput
              label="الرتبة"
              placeholder="أضِف رتبة ثم Enter…"
              value={form.grade}
              onChange={(v) => set("grade", v)}
            />
            <TagInput
              label="الصفة"
              placeholder="أضِف صفة ثم Enter…"
              value={form.tags}
              onChange={(v) => set("tags", v)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-500">
              {error}
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-forest/10 px-6 py-4">
          <span className="inline-flex items-center gap-1 text-[11px] text-clay">
            <ShieldCheck size={13} /> التغييرات تُحفظ فوراً عند الضغط
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
            >
              إلغاء
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
