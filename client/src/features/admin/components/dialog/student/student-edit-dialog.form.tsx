import { useEffect, useMemo, useRef, useState} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  GraduationCap,
  Camera,
  Loader2,
  Trash2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Users,
  Mail,
  Phone,
  IdCard,
  CalendarDays,
  Building2,
  Network,
  GitBranch,
  Layers,
  CircleAlert,
  CheckCircle2,
  Ban,
} from "lucide-react";
import type { Student } from "../../../../../types/admin";
import { ImageCropperDialog } from "../../ui/image-cropper-dialog";
import { GenderSelect } from "../../ui/gender-select";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { useTranslation } from "react-i18next";
import {
  useUpdateStudent,
  useSetUserStatus,
  useUploadImage,
  useResetUserPassword,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
  useAcademicYears,
} from "../../../hooks/admin-hook";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { inputCls, Panel, FieldBox } from "../../form/entity-form";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  open: boolean;
  student: Student | null;
  onClose: () => void;
}

interface EditState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: "male" | "female" | "";
  registrationNumber: string;
  facultyId: string;
  departmentId: string;
  filiereId: string;
  specializationId: string;
  academicYearId: string;
  avatarUrl: string;
  status: "active" | "suspended";
  password: string;
}


export function StudentEditDialog({ open, student, onClose }: Props) {
  const { t } = useTranslation();
  const update = useUpdateStudent();
  const setStatus = useSetUserStatus();
  const uploadImage = useUploadImage();
  const resetPassword = useResetUserPassword();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EditState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    registrationNumber: "",
    facultyId: "",
    departmentId: "",
    filiereId: "",
    specializationId: "",
    academicYearId: "",
    avatarUrl: "",
    status: "active",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // The picked file waits here until the admin frames it in the cropper.
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    if (open && student) {
      const sp: any = student.specialization;
      const dept: any = sp?.filiere?.department;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        firstName: student.user?.firstName ?? "",
        lastName: student.user?.lastName ?? "",
        email: student.user?.email ?? "",
        phone: student.user?.phone ?? "",
        gender: student.user?.gender ?? "",
        registrationNumber: student.registrationNumber ?? "",
        facultyId: dept?.faculty?.id ?? dept?.facultyId ?? "",
        departmentId: dept?.id ?? "",
        filiereId: sp?.filiere?.id ?? sp?.filiereId ?? "",
        specializationId: sp?.id ?? "",
        academicYearId: student.academicYear?.id ?? "",
        avatarUrl: student.user?.avatarUrl ?? "",
        status: student.user?.status ?? "active",
        password: "",
      });
      setError(null);
      setShowPassword(false);
    }
  }, [open, student]);

  // The preview follows the form, not the saved account: picking a gender
  // must change the default photo before the dialog is saved.
  const previewUser = {
    firstName: form.firstName,
    lastName: form.lastName,
    gender: form.gender || undefined,
    avatarUrl: form.avatarUrl || undefined,
  };

  // ── cascading options ──
  const deptOptions = useMemo(
    () =>
      ((departments ?? []) as any[]).filter(
        (d) => !form.facultyId || d.facultyId === form.facultyId,
      ),
    [departments, form.facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      ((filieres ?? []) as any[]).filter(
        (f) => !form.departmentId || f.departmentId === form.departmentId,
      ),
    [filieres, form.departmentId],
  );
  const specOptions = useMemo(
    () =>
      ((specs ?? []) as any[]).filter(
        (s) => !form.filiereId || s.filiereId === form.filiereId,
      ),
    [specs, form.filiereId],
  );

  useBodyScrollLock(open);

  if (!open || !student) return null;

  function set<K extends keyof EditState>(key: K, value: EditState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onFaculty(facultyId: string) {
    setForm((f) => ({
      ...f,
      facultyId,
      departmentId: "",
      filiereId: "",
      specializationId: "",
    }));
  }
  function onDepartment(departmentId: string) {
    setForm((f) => ({
      ...f,
      departmentId,
      filiereId: "",
      specializationId: "",
    }));
  }
  function onFiliere(filiereId: string) {
    setForm((f) => ({ ...f, filiereId, specializationId: "" }));
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function onCropped(cropped: File) {
    setCropFile(null);
    uploadImage.mutate(cropped, { onSuccess: (url) => set("avatarUrl", url) });
  }

  const busy =
    update.isPending ||
    setStatus.isPending ||
    uploadImage.isPending ||
    resetPassword.isPending;

  function submit() {
    setError(null);
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t("validation.emailInvalidAlt"));
      return;
    }
    if (!form.specializationId) {
      setError(t("admin.chooseSpecialization"));
      return;
    }
    if (!form.academicYearId) {
      setError(t("admin.chooseAcademicYear"));
      return;
    }
    if (form.password && form.password.length < 6) {
      setError(t("validation.passwordMinLong"));
      return;
    }

    // أرسِل الحقول المملوءة فقط (كلها اختيارية في updateStudentSchema).
    const data: Record<string, unknown> = {};
    if (form.firstName.trim()) data.firstName = form.firstName.trim();
    if (form.lastName.trim()) data.lastName = form.lastName.trim();

    // Optional fields must be sent as null when emptied. Omitting them means
    // "leave unchanged", so removing a photo (or clearing a phone) would look
    // like it worked and then come back on the next load.
    const clearable = (key: string, next: string, before: string) => {
      const value = next.trim();
      if (value !== before) data[key] = value === "" ? null : value;
    };
    clearable("email", form.email, student!.user?.email ?? "");
    clearable("phone", form.phone, student!.user?.phone ?? "");
    clearable("avatarUrl", form.avatarUrl, student!.user?.avatarUrl ?? "");
    clearable("gender", form.gender, student!.user?.gender ?? "");

    if (form.registrationNumber.trim())
      data.registrationNumber = form.registrationNumber.trim();
    if (form.specializationId) data.specializationId = form.specializationId;
    if (form.academicYearId) data.academicYearId = form.academicYearId;

    const statusChanged = form.status !== (student!.user?.status ?? "active");
    const userId = student!.userId;

    update.mutate(
      { id: student!.id, data },
      {
        onSuccess: () => {
          // سلسِل تغيير الحالة ثم كلمة المرور ثم أغلق.
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

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm"
      />

      <div className="animate-[fadeIn_0.15s_ease-out] relative flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-2xl">
        {/* ── header ── */}
        <header className="relative shrink-0 bg-linear-to-l from-forest to-forest-deep px-6 py-3 text-cream">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <UserAvatar
                user={previewUser}
                width={50}
                height={64}
                radius="rounded-lg"
                className="border-2 border-gold/60"
              />
              {uploadImage.isPending && (
                <div className="absolute inset-0 grid place-items-center rounded-lg bg-forest-deep/60">
                  <Loader2 size={18} className="animate-spin text-cream" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate font-serif text-lg font-bold">
                {`${form.firstName} ${form.lastName}`.trim() ||
                  t("admin.editStudentTitle")}
              </h3>
              <p className="flex items-center gap-2 text-[11px] text-cream/70">
                <GraduationCap size={12} />
                {form.registrationNumber || t("roles.student")}
              </p>
            </div>

            <button
              onClick={() => !busy && onClose()}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/15 hover:text-cream"
            >
              <X size={17} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </header>

        {/* ── body: two panels ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {/* ══ PANEL 1 — personal ══ */}
            <Panel title={t("admin.personalData")} icon={User}>
              {/* avatar controls */}
              <div className="mb-2 flex items-center gap-3 rounded-xl bg-cream-2/70 p-2">
                <UserAvatar
                  user={previewUser}
                  width={44}
                  height={56}
                  radius="rounded-lg"
                  className="border-2 border-gold/40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadImage.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-forest/20 bg-cream-card px-2.5 py-1.5 text-xs font-semibold text-forest transition hover:border-gold hover:bg-gold/10 disabled:opacity-60"
                    >
                      <Camera size={13} />{t("admin.uploadPhoto")}</button>
                    {form.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => set("avatarUrl", "")}
                        className="inline-flex items-center gap-1 rounded-lg border border-brick/25 px-2.5 py-1.5 text-xs font-semibold text-brick transition hover:bg-brick/10"
                      >
                        <Trash2 size={13} />{t("admin.removeCover")}</button>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-clay/70">{t("admin.photoHint")}</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={onPickFile}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <FieldBox label={t("admin.name")} icon={User}>
                  <input
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    className={inputCls}
                  />
                </FieldBox>
                <FieldBox label={t("admin.lastName")} icon={User}>
                  <input
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    className={inputCls}
                  />
                </FieldBox>
              </div>

              <FieldBox label={t("admin.gender")} icon={Users}>
                <GenderSelect
                  value={form.gender || null}
                  onChange={(next) => set("gender", next ?? "")}
                />
              </FieldBox>

              <FieldBox label={t("admin.email")} icon={Mail}>
                <input
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  dir="ltr"
                  className={inputCls}
                  placeholder="example@univ-eloued.dz"
                />
              </FieldBox>

              <FieldBox label={t("admin.phone")} icon={Phone}>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  dir="ltr"
                  className={inputCls}
                  placeholder="0xxxxxxxxx"
                />
              </FieldBox>

              {/* status as a segmented control */}
              <FieldBox label={t("admin.accountStatus")} icon={ShieldCheck}>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["active", t("admin.statusActive"), CheckCircle2],
                      ["suspended", t("admin.statusSuspended"), Ban],
                    ] as const
                  ).map(([value, label, Icon]) => {
                    const on = form.status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set("status", value)}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          on && value === "active"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : on
                              ? "border-brick/40 bg-brick/10 text-brick"
                              : "border-forest/15 bg-cream-2 text-clay hover:border-forest/30"
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </FieldBox>

              {/* password — lives here so there is no separate reset flow */}
              <FieldBox label={t("admin.newPassword")} icon={KeyRound}>
                <div className="relative">
                  <input
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    className={`${inputCls} pl-11`}
                    placeholder={t("admin.leaveBlankToKeep")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-clay transition hover:text-forest"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {form.password.length > 0 && form.password.length < 6 && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-brick">
                    <CircleAlert size={11} />{t("admin.sixCharsMin")}</p>
                )}
              </FieldBox>
            </Panel>

            {/* ══ PANEL 2 — university ══ */}
            <Panel title={t("admin.universityData")} icon={GraduationCap}>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBox label={t("pro.regNumber")} icon={IdCard}>
                  <input
                    value={form.registrationNumber}
                    onChange={(e) => set("registrationNumber", e.target.value)}
                    dir="ltr"
                    className={`${inputCls} font-mono`}
                  />
                </FieldBox>
                <FieldBox label={t("pro.academicYear")} icon={CalendarDays}>
                  <select
                    value={form.academicYearId}
                    onChange={(e) => set("academicYearId", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t("pro.selectYear")}</option>
                    {((years ?? []) as any[]).map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.title}
                      </option>
                    ))}
                  </select>
                </FieldBox>
              </div>

              {/* the hierarchy narrows step by step */}
              <FieldBox label={t("admin.facultyLabel")} icon={Building2}>
                <select
                  value={form.facultyId}
                  onChange={(e) => onFaculty(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t("admin.allFacultiesShort")}</option>
                  {((faculties ?? []) as any[]).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </FieldBox>

              <FieldBox label={t("admin.department")} icon={Network}>
                <select
                  value={form.departmentId}
                  onChange={(e) => onDepartment(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t("admin.allDepartments")}</option>
                  {deptOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FieldBox>

              <FieldBox label={t("admin.filiere")} icon={GitBranch}>
                <select
                  value={form.filiereId}
                  onChange={(e) => onFiliere(e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t("admin.allFilieresShort")}</option>
                  {filiereOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </FieldBox>

              <FieldBox label={t("admin.specializationLabelAlt")} icon={Layers} required>
                <select
                  value={form.specializationId}
                  onChange={(e) => set("specializationId", e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t("admin.chooseSpecialization")}</option>
                  {specOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FieldBox>

              {/* live path preview */}
              <div className="mt-0.5 rounded-xl bg-cream-2/70 px-3 py-2">
                <p className="text-[10px] font-bold text-clay">{t("admin.academicPath")}</p>
                <p className="text-[11px] leading-relaxed text-forest">
                  {[
                    ((faculties ?? []) as any[]).find(
                      (f) => f.id === form.facultyId,
                    )?.name,
                    deptOptions.find((d) => d.id === form.departmentId)?.name,
                    filiereOptions.find((f) => f.id === form.filiereId)?.name,
                    specOptions.find((s) => s.id === form.specializationId)
                      ?.name,
                  ]
                    .filter(Boolean)
                    .join(" ← ") || "—"}
                </p>
              </div>
            </Panel>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-brick/10 px-3 py-2.5 text-xs font-medium text-brick">
              <CircleAlert size={14} />
              {error}
            </p>
          )}
        </div>

        {/* ── footer ── */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-clay">
            <ShieldCheck size={13} className="text-sage" />{t("admin.savedOnSubmitHint")}</span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
            >{t("pro.cancel")}</button>
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
              {busy ? t("admin.savingEllipsis") : t("admin.saveChangesShort")}
            </button>
          </div>
        </footer>
      </div>
      <ImageCropperDialog
        open={!!cropFile}
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onDone={onCropped}
      />
    </div>,
    document.body,
  );
}
