import { useEffect, useMemo, useRef, useState} from "react";
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
  User,
  Users,
  Mail,
  Phone,
  Hash,
  Building2,
  Network,
  GitBranch,
  CircleAlert,
  CheckCircle2,
  Ban,
} from "lucide-react";
import type { Professor } from "../../../../../types/admin";
import {
  useProfessors,
  useUpdateProfessor,
  useSetUserStatus,
  useUploadImage,
  useResetUserPassword,
  useFaculties,
  useDepartments,
  useFilieres,
} from "../../../hooks/admin-hook";
import { TagInput } from "../../ui/tag-input";
import { ACADEMIC_RANKS } from "../../../constants/academic-ranks";
import { ImageCropperDialog } from "../../ui/image-cropper-dialog";
import { GenderSelect } from "../../ui/gender-select";
import { UniversityEmailInput } from "../../ui/university-email-input";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { inputCls, Panel, FieldBox } from "../../form/entity-form";

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
  gender: "male" | "female" | "";
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

// الصيغة فقط — النطاق المسموح به تفرضه الخلفية مقابل جدول النطاقات.
const UNIV_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;


export function ProfessorEditDialog({ open, professor, onClose }: Props) {
  const { t } = useTranslation();
  const update = useUpdateProfessor();
  const setStatus = useSetUserStatus();
  const uploadImage = useUploadImage();
  const resetPassword = useResetUserPassword();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const fileRef = useRef<HTMLInputElement>(null);

  // Suggestions come from the ranks in use plus the official ladder, and —
  // for the free-form attributes — from what other professors already carry,
  // so one spelling spreads instead of many. 100 is the API's ceiling.
  const { data: profsData } = useProfessors({ limit: 100 });
  const { rankOptions, tagOptions } = useMemo(() => {
    const ranks = new Set<string>(ACADEMIC_RANKS);
    const tags = new Set<string>();
    for (const p of profsData?.items ?? []) {
      for (const g of p.grade ?? []) ranks.add(g);
      for (const tg of p.tags ?? []) tags.add(tg);
    }
    return {
      rankOptions: [...ranks],
      tagOptions: [...tags].sort((a, b) => a.localeCompare(b, "ar")),
    };
  }, [profsData]);

  const [form, setForm] = useState<EditState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
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
  // The picked file waits here until the admin frames it in the cropper.
  const [cropFile, setCropFile] = useState<File | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (open && professor) {
      const dept = professor.department;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        firstName: professor.user?.firstName ?? "",
        lastName: professor.user?.lastName ?? "",
        email: professor.user?.email ?? "",
        phone: professor.user?.phone ?? "",
        gender: professor.user?.gender ?? "",
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
  // The preview follows the form, not the saved account: picking a gender
  // must change the default photo before the dialog is saved.
  const previewUser = {
    firstName: form.firstName,
    lastName: form.lastName,
    gender: form.gender || undefined,
    avatarUrl: form.avatarUrl || undefined,
  };

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
    if (!UNIV_EMAIL.test(form.universityEmail)) {
      setError(t("validation.universityEmailInvalid"));
      return;
    }
    if (!form.departmentId) {
      setError(t("admin.chooseDepartment"));
      return;
    }
    if (form.password && form.password.length < 6) {
      setError(t("validation.passwordMinLong"));
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
          // null = امسح القيمة (زرّ «إزالة» يفرّغ الحقل).
          email: form.email || null,
          phone: form.phone || null,
          avatarUrl: form.avatarUrl || null,
          gender: form.gender || null,
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
                  t("admin.editProfessorTitle")}
              </h3>
              <p className="flex items-center gap-2 text-[11px] text-cream/70">
                <UserCog size={12} />
                {professor.employeeNumber}
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

              <FieldBox label={t("admin.personalEmail")} icon={Mail}>
                <input
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  dir="ltr"
                  className={inputCls}
                  placeholder="example@gmail.com"
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
            <Panel title={t("admin.universityData")} icon={UserCog}>
              {/* the compound domain control needs the full row */}
              <FieldBox label={t("admin.searchByEmail")} icon={Mail} required>
                <UniversityEmailInput
                  value={form.universityEmail}
                  onChange={(next) => set("universityEmail", next)}
                  firstName={form.firstName}
                  lastName={form.lastName}
                />
              </FieldBox>

              <div className="grid grid-cols-2 gap-2.5">
                <FieldBox label={t("admin.employeeNumber")} icon={Hash}>
                  <input
                    value={professor.employeeNumber}
                    disabled
                    dir="ltr"
                    className={`${inputCls} cursor-not-allowed font-mono opacity-60`}
                  />
                </FieldBox>
                <FieldBox label={t("admin.facultyLabel")} icon={Building2}>
                  <select
                    value={form.facultyId}
                    onChange={(e) => onFacultyChange(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t("admin.allFacultiesShort")}</option>
                    {(faculties ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </FieldBox>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <FieldBox label={t("admin.department")} icon={Network} required>
                  <select
                    value={form.departmentId}
                    onChange={(e) => onDepartmentChange(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t("admin.chooseDepartment")}</option>
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
                    onChange={(e) => set("filiereId", e.target.value)}
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
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <TagInput
                  label={t("admin.gradeLabel")}
                  placeholder={t("admin.pickOrTypeHint")}
                  suggestions={rankOptions}
                  hint={t("admin.gradeFieldHint")}
                  value={form.grade}
                  onChange={(v) => set("grade", v)}
                />
                <TagInput
                  label={t("admin.tagLabel")}
                  placeholder={t("admin.pickOrTypeHint")}
                  suggestions={tagOptions}
                  hint={t("admin.tagFieldHint")}
                  value={form.tags}
                  onChange={(v) => set("tags", v)}
                />
              </div>

              {/* live affiliation preview */}
              <div className="mt-0.5 rounded-xl bg-cream-2/70 px-3 py-2">
                <p className="text-[10px] font-bold text-clay">{t("admin.academicAffiliation")}</p>
                <p className="text-[11px] leading-relaxed text-forest">
                  {[
                    (faculties ?? []).find((f) => f.id === form.facultyId)?.name,
                    deptOptions.find((d) => d.id === form.departmentId)?.name,
                    filiereOptions.find((f) => f.id === form.filiereId)?.name,
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
