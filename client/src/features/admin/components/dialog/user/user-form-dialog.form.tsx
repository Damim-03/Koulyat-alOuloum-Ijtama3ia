import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  X,
  Save,
  Loader2,
  Camera,
  Trash2,
  User,
  Users,
  Mail,
  Phone,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  Hash,
  IdCard,
  Layers,
  CalendarDays,
  Network,
  Building2,
  GitBranch,
  Sparkles,
  Shield,
  ShieldCheck,
  GraduationCap,
  UserCog,
  CircleAlert,
} from "lucide-react";
import {
  useProfessors,
  useCreateUser,
  useCreateStudent,
  useCreateProfessor,
  useUploadImage,
  useSpecializations,
  useAcademicYears,
  useDepartments,
  useFaculties,
  useFilieres,
} from "../../../hooks/admin-hook";
import {
  createStudentSchema,
  createProfessorSchema,
  createUserSchema,
} from "../../../validation/admin.schema";
import { inputCls, Panel, FieldBox } from "../../form/entity-form";
import { TagInput } from "../../ui/tag-input";
import { ACADEMIC_RANKS } from "../../../constants/academic-ranks";
import { RoleSelect } from "../../ui/role-select";
import { GenderSelect } from "../../ui/gender-select";
import { UniversityEmailInput } from "../../ui/university-email-input";
import { ImageCropperDialog } from "../../ui/image-cropper-dialog";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the role is fixed and the role selector is hidden. */
  lockedRole?: Role;
}

type Role = "student" | "professor" | "admin" | "owner";

/**
 * Creating an account, in the same shape as editing one.
 *
 * The two edit dialogs had settled on a layout — a branded header carrying
 * the person, then personal data beside university data — while creation
 * still used a stack of full-width sections. Same task, same fields, two
 * different rooms. This is the edit dialogs' room, with the create endpoints
 * behind it: nothing about what the API accepts has changed.
 */

// One wide form covering every possible field; the active role decides
// which fields are shown AND which schema validates the submission.
interface FormValues {
  role: Role;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female" | "";
  email?: string;
  username?: string;
  password?: string;
  // student
  phone?: string;
  avatarUrl?: string;
  registrationNumber?: string;
  specializationId?: string;
  academicYearId?: string;
  // professor
  employeeNumber?: string;
  universityEmail?: string;
  facultyId?: string; // helper (not persisted)
  departmentId?: string; // persisted for professors, a helper for students
  filiereId?: string; // helper (not persisted)
  grade?: string[];
  tags?: string[];
}

const EMPTY: FormValues = {
  role: "student",
  firstName: "",
  lastName: "",
  gender: "",
  email: "",
  username: "",
  password: "",
  phone: "",
  avatarUrl: "",
  registrationNumber: "",
  specializationId: "",
  academicYearId: "",
  employeeNumber: "",
  universityEmail: "",
  facultyId: "",
  departmentId: "",
  filiereId: "",
  grade: [],
  tags: [],
};

/**
 * Strip empty strings/empty arrays + the helper-only fields before sending.
 * Constrained to `object` rather than `Record<string, unknown>` so plain
 * interfaces (which carry no index signature) can be passed directly.
 */
function clean<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length > 0) out[k] = v;
    } else if (v !== "" && v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out as Partial<T>;
}

export function UserFormDialog({ open, onClose, lockedRole }: Props) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  // The picked file waits here until the admin frames it in the cropper.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(open);

  const initial = useMemo<FormValues>(
    () => ({ ...EMPTY, role: lockedRole ?? "student" }),
    [lockedRole],
  );

  const createUser = useCreateUser();
  const createStudent = useCreateStudent();
  const createProfessor = useCreateProfessor();
  const uploadImage = useUploadImage();
  const busy =
    createUser.isPending ||
    createStudent.isPending ||
    createProfessor.isPending ||
    uploadImage.isPending;

  const { data: specializations } = useSpecializations();
  const { data: years } = useAcademicYears();
  const { data: departments } = useDepartments();
  const { data: faculties } = useFaculties();
  const { data: filieres } = useFilieres();

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

  // The active role picks the schema, so the resolver is assembled per call
  // and re-typed to this form's shape rather than casting at the call site.
  const resolver: Resolver<FormValues> = (values, ctx, opts) => {
    const schema =
      values.role === "student"
        ? createStudentSchema
        : values.role === "professor"
          ? createProfessorSchema
          : createUserSchema;
    const validate = zodResolver(schema as never) as Resolver<FormValues>;
    return validate(values, ctx, opts);
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({ resolver, defaultValues: initial });

  // eslint-disable-next-line react-hooks/incompatible-library
  const role = watch("role");
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const gender = watch("gender");
  const avatarUrl = watch("avatarUrl");
  const facultyId = watch("facultyId");
  const departmentId = watch("departmentId");
  const filiereId = watch("filiereId");
  const specializationId = watch("specializationId");
  const universityEmail = watch("universityEmail");
  const grade = watch("grade");
  const tags = watch("tags");

  // ── cascading options, shared by both academic branches ──
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter((d) => !facultyId || d.facultyId === facultyId),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter(
        (f) => !departmentId || f.departmentId === departmentId,
      ),
    [filieres, departmentId],
  );
  const specOptions = useMemo(
    () =>
      (specializations ?? []).filter(
        (s: { filiereId?: string }) => !filiereId || s.filiereId === filiereId,
      ),
    [specializations, filiereId],
  );

  useEffect(() => {
    if (open) {
      reset(initial);
      setShowPassword(false);
      setCropFile(null);
    }
  }, [open, reset, initial]);

  // The header preview follows what is being typed, so the account is
  // recognisable before it exists.
  const previewUser = {
    firstName,
    lastName,
    gender: gender || undefined,
    avatarUrl: avatarUrl || undefined,
  };

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function onCropped(cropped: File) {
    setCropFile(null);
    uploadImage.mutate(cropped, {
      onSuccess: (url) => setValue("avatarUrl", url, { shouldDirty: true }),
    });
  }

  function onSubmit(values: FormValues) {
    const payload = clean(values);
    const drop = (key: string) =>
      delete (payload as Record<string, unknown>)[key];

    // Helper-only fields the backend does not accept. `departmentId` is real
    // for a professor and a mere filter for a student, so it is dropped by
    // role rather than always.
    drop("facultyId");
    drop("filiereId");

    const done = () => {
      onClose();
      reset(initial);
    };
    if (role === "student") {
      drop("role");
      drop("departmentId");
      createStudent.mutate(payload, { onSuccess: done });
    } else if (role === "professor") {
      drop("role");
      // The professor endpoint accepts neither of these.
      drop("phone");
      drop("avatarUrl");
      createProfessor.mutate(payload, { onSuccess: done });
    } else {
      drop("departmentId");
      drop("phone");
      drop("avatarUrl");
      createUser.mutate(payload, { onSuccess: done });
    }
  }

  const e = errors as Record<string, { message?: string } | undefined>;
  const isStaffAccount = role === "admin" || role === "owner";

  if (!open) return null;

  const title =
    `${firstName ?? ""} ${lastName ?? ""}`.trim() ||
    (lockedRole === "student"
      ? t("admin.addStudent")
      : lockedRole === "professor"
        ? t("admin.addProfessor")
        : t("admin.addUser"));

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
              <h3 className="truncate font-serif text-lg font-bold">{title}</h3>
              <p className="flex items-center gap-2 text-[11px] text-cream/70">
                <Sparkles size={12} />
                {t("admin.addUserSubtitle")}
              </p>
            </div>

            <button
              onClick={() => !busy && onClose()}
              aria-label={t("admin.cancel")}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/15 hover:text-cream"
            >
              <X size={17} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </header>

        {/* ── body: two panels ── */}
        <form
          id="user-form"
          onSubmit={handleSubmit(onSubmit)}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5"
        >
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {/* ══ PANEL 1 — personal ══ */}
            <Panel title={t("admin.personalData")} icon={User}>
              {/* Only the student endpoint accepts a photo at creation; the
                  others take one from the edit dialog afterwards. */}
              {role === "student" && (
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
                        <Camera size={13} />
                        {t("admin.uploadPhoto")}
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setValue("avatarUrl", "")}
                          className="inline-flex items-center gap-1 rounded-lg border border-brick/25 px-2.5 py-1.5 text-xs font-semibold text-brick transition hover:bg-brick/10"
                        >
                          <Trash2 size={13} />
                          {t("admin.removeCover")}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-clay/70">
                      {t("admin.photoHint")}
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onPickFile}
                    className="hidden"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <FieldBox
                  label={t("admin.name")}
                  icon={User}
                  error={e.firstName?.message}
                >
                  <input
                    {...register("firstName")}
                    className={inputCls}
                    placeholder={t("admin.firstNamePlaceholder")}
                  />
                </FieldBox>
                <FieldBox
                  label={t("admin.lastName")}
                  icon={User}
                  error={e.lastName?.message}
                >
                  <input
                    {...register("lastName")}
                    className={inputCls}
                    placeholder={t("admin.lastNamePlaceholder")}
                  />
                </FieldBox>
              </div>

              <FieldBox label={t("admin.gender")} icon={Users}>
                <GenderSelect
                  value={gender || null}
                  onChange={(next) =>
                    setValue("gender", next ?? "", { shouldDirty: true })
                  }
                />
              </FieldBox>

              {/* For staff the address is the login, so it lives with the
                  other credentials rather than here. */}
              {!isStaffAccount && (
                <FieldBox
                  label={t("admin.personalEmail")}
                  icon={Mail}
                  error={e.email?.message}
                >
                  <input
                    {...register("email")}
                    dir="ltr"
                    className={inputCls}
                    placeholder="example@gmail.com"
                  />
                </FieldBox>
              )}

              {role === "student" && (
                <FieldBox label={t("admin.phone")} icon={Phone}>
                  <input
                    {...register("phone")}
                    dir="ltr"
                    className={inputCls}
                    placeholder="0xxxxxxxxx"
                  />
                </FieldBox>
              )}

              <FieldBox
                label={t("admin.password")}
                icon={Lock}
                required
                error={e.password?.message}
              >
                <div className="relative">
                  {/* pl-11 keeps the typed text clear of the eye toggle */}
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    className={`${inputCls} pl-11`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-clay transition hover:text-forest"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FieldBox>

              <p className="flex items-start gap-1.5 rounded-xl bg-cream-2/70 px-3 py-2 text-[10px] leading-relaxed text-clay">
                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-sage" />
                {t("admin.userNoteBody")}
              </p>
            </Panel>

            {/* ══ PANEL 2 — role + academic ══ */}
            <Panel
              title={
                isStaffAccount
                  ? t("admin.sectionAdmin")
                  : t("admin.universityData")
              }
              icon={
                isStaffAccount
                  ? Shield
                  : role === "professor"
                    ? UserCog
                    : GraduationCap
              }
            >
              {!lockedRole && (
                <FieldBox label={t("admin.userRole")} icon={Shield}>
                  <RoleSelect
                    value={role}
                    onChange={(next) =>
                      setValue("role", next, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    options={[
                      { value: "student", label: t("role.student") },
                      { value: "professor", label: t("role.professor") },
                      { value: "admin", label: t("role.admin") },
                      { value: "owner", label: t("role.owner") },
                    ]}
                  />
                </FieldBox>
              )}

              {/* ── STUDENT ── */}
              {role === "student" && (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <FieldBox
                      label={t("pro.regNumber")}
                      icon={IdCard}
                      required
                      error={e.registrationNumber?.message}
                    >
                      <input
                        {...register("registrationNumber")}
                        dir="ltr"
                        className={`${inputCls} font-mono`}
                        placeholder={t("admin.regNumberPlaceholder")}
                      />
                    </FieldBox>
                    <FieldBox
                      label={t("pro.academicYear")}
                      icon={CalendarDays}
                      required
                      error={e.academicYearId?.message}
                    >
                      <select
                        {...register("academicYearId")}
                        className={inputCls}
                      >
                        <option value="">{t("admin.selectYear")}</option>
                        {years?.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.title}
                          </option>
                        ))}
                      </select>
                    </FieldBox>
                  </div>

                  <FieldBox label={t("admin.facultyLabel")} icon={Building2}>
                    <select
                      {...register("facultyId", {
                        onChange: () => {
                          setValue("departmentId", "");
                          setValue("filiereId", "");
                          setValue("specializationId", "");
                        },
                      })}
                      className={inputCls}
                    >
                      <option value="">{t("admin.allFacultiesShort")}</option>
                      {faculties?.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </FieldBox>

                  <FieldBox label={t("admin.department")} icon={Network}>
                    <select
                      {...register("departmentId", {
                        onChange: () => {
                          setValue("filiereId", "");
                          setValue("specializationId", "");
                        },
                      })}
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
                      {...register("filiereId", {
                        onChange: () => setValue("specializationId", ""),
                      })}
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

                  <FieldBox
                    label={t("admin.specialization")}
                    icon={Layers}
                    required
                    error={e.specializationId?.message}
                  >
                    <select
                      {...register("specializationId")}
                      className={inputCls}
                    >
                      <option value="">
                        {t("admin.selectSpecialization")}
                      </option>
                      {specOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FieldBox>

                  <AcademicPath
                    label={t("admin.academicPath")}
                    parts={[
                      faculties?.find((f) => f.id === facultyId)?.name,
                      deptOptions.find((d) => d.id === departmentId)?.name,
                      filiereOptions.find((f) => f.id === filiereId)?.name,
                      specOptions.find((s) => s.id === specializationId)
                        ?.name,
                    ]}
                  />
                </>
              )}

              {/* ── PROFESSOR ── */}
              {role === "professor" && (
                <>
                  {/* the compound domain control needs the full row */}
                  <FieldBox
                    label={t("admin.searchByEmail")}
                    icon={Mail}
                    required
                    error={e.universityEmail?.message}
                  >
                    <UniversityEmailInput
                      value={universityEmail ?? ""}
                      onChange={(next) => {
                        // Picking a domain before typing the local part yields
                        // an empty address — don't flag that as invalid yet;
                        // submit still validates it.
                        setValue("universityEmail", next, {
                          shouldValidate: next.length > 0,
                          shouldDirty: true,
                        });
                        if (!next) clearErrors("universityEmail");
                      }}
                      firstName={firstName}
                      lastName={lastName}
                    />
                  </FieldBox>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* الرقم الوظيفي يُولَّد في الخلفية — معروض للعلم فقط. */}
                    <FieldBox label={t("admin.employeeNumber")} icon={Hash}>
                      <div className="flex items-center gap-2 rounded-xl border border-dashed border-forest/20 bg-cream-2/60 px-3 py-2">
                        <Sparkles size={13} className="shrink-0 text-gold" />
                        <span className="truncate text-[11px] text-clay">
                          {t("admin.employeeNumberAuto")}
                        </span>
                      </div>
                    </FieldBox>
                    <FieldBox label={t("admin.facultyLabel")} icon={Building2}>
                      <select
                        {...register("facultyId", {
                          onChange: () => {
                            setValue("departmentId", "");
                            setValue("filiereId", "");
                          },
                        })}
                        className={inputCls}
                      >
                        <option value="">{t("admin.allFacultiesShort")}</option>
                        {faculties?.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </FieldBox>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <FieldBox
                      label={t("admin.department")}
                      icon={Network}
                      required
                      error={e.departmentId?.message}
                    >
                      <select
                        {...register("departmentId", {
                          onChange: () => setValue("filiereId", ""),
                        })}
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
                      <select {...register("filiereId")} className={inputCls}>
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
                      value={grade ?? []}
                      onChange={(v) => setValue("grade", v, { shouldDirty: true })}
                    />
                    <TagInput
                      label={t("admin.tagLabel")}
                      placeholder={t("admin.pickOrTypeHint")}
                      suggestions={tagOptions}
                      hint={t("admin.tagFieldHint")}
                      value={tags ?? []}
                      onChange={(v) => setValue("tags", v, { shouldDirty: true })}
                    />
                  </div>

                  <AcademicPath
                    label={t("admin.academicAffiliation")}
                    parts={[
                      faculties?.find((f) => f.id === facultyId)?.name,
                      deptOptions.find((d) => d.id === departmentId)?.name,
                      filiereOptions.find((f) => f.id === filiereId)?.name,
                    ]}
                  />
                </>
              )}

              {/* ── ADMIN / OWNER ── */}
              {isStaffAccount && (
                <>
                  <FieldBox
                    label={t("admin.email")}
                    icon={Mail}
                    error={e.email?.message}
                  >
                    <input
                      {...register("email")}
                      dir="ltr"
                      className={inputCls}
                      placeholder="example@univ-eloued.dz"
                    />
                  </FieldBox>
                  <FieldBox
                    label={t("admin.username")}
                    icon={AtSign}
                    error={e.username?.message}
                  >
                    <input
                      {...register("username")}
                      dir="ltr"
                      className={inputCls}
                      placeholder={t("admin.usernamePlaceholder")}
                    />
                  </FieldBox>
                  <p className="flex items-start gap-1.5 rounded-xl bg-cream-2/70 px-3 py-2 text-[10px] leading-relaxed text-clay">
                    <CircleAlert size={12} className="mt-0.5 shrink-0 text-gold" />
                    {t("validation.emailOrUsername")}
                  </p>
                </>
              )}
            </Panel>
          </div>
        </form>

        {/* ── footer ── */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-clay">
            <ShieldCheck size={13} className="text-sage" />
            {t("admin.savedOnSubmitHint")}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
            >
              {t("admin.cancel")}
            </button>
            <button
              type="submit"
              form="user-form"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {busy ? t("admin.savingEllipsis") : t("admin.saveData")}
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

/** The chain the selects above resolve to, spelled out as it is chosen. */
function AcademicPath({
  label,
  parts,
}: {
  label: string;
  parts: (string | undefined)[];
}) {
  return (
    <div className="mt-0.5 rounded-xl bg-cream-2/70 px-3 py-2">
      <p className="text-[10px] font-bold text-clay">{label}</p>
      <p className="text-[11px] leading-relaxed text-forest">
        {parts.filter(Boolean).join(" ← ") || "—"}
      </p>
    </div>
  );
}
