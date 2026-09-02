import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  UserPlus,
  User,
  Mail,
  AtSign,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Save,
  Hash,
  IdCard,
  Layers,
  CalendarDays,
  Network,
  Building2,
  GitBranch,
  Sparkles,
} from "lucide-react";
import {
  useCreateUser,
  useCreateStudent,
  useCreateProfessor,
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
import { Field, FormDialog, Section, inputClass } from "../../form/form-dialog";
import { TagInput } from "../../ui/tag-input";
import { RoleSelect } from "../../ui/role-select";
import { UniversityEmailInput } from "../../ui/university-email-input";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the role is fixed and the role selector is hidden. */
  lockedRole?: Role;
}

type Role = "student" | "professor" | "admin" | "owner";

// One wide form covering every possible field; the active role decides
// which fields are shown AND which schema validates the submission.
interface FormValues {
  role: Role;
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  password?: string;
  // student
  registrationNumber?: string;
  specializationId?: string;
  academicYearId?: string;
  // professor
  employeeNumber?: string;
  universityEmail?: string;
  facultyId?: string; // helper (not persisted)
  departmentId?: string; // persisted
  filiereId?: string; // helper (not persisted)
  grade?: string[];
  tags?: string[];
}

const EMPTY: FormValues = {
  role: "student",
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
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

  const initial = useMemo<FormValues>(
    () => ({ ...EMPTY, role: lockedRole ?? "student" }),
    [lockedRole],
  );

  const createUser = useCreateUser();
  const createStudent = useCreateStudent();
  const createProfessor = useCreateProfessor();
  const pending =
    createUser.isPending ||
    createStudent.isPending ||
    createProfessor.isPending;

  const { data: specializations } = useSpecializations();
  const { data: years } = useAcademicYears();
  const { data: departments } = useDepartments();
  const { data: faculties } = useFaculties();
  const { data: filieres } = useFilieres();

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
  const facultyId = watch("facultyId");
  const departmentId = watch("departmentId");

  // ── cascading options for the professor branch ──
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d) => !facultyId || d.facultyId === facultyId,
      ),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter(
        (f) => !departmentId || f.departmentId === departmentId,
      ),
    [filieres, departmentId],
  );

  useEffect(() => {
    if (open) {
      reset(initial);
      setShowPassword(false);
    }
  }, [open, reset, initial]);

  function onSubmit(values: FormValues) {
    const payload = clean(values);
    // strip helper-only fields the backend doesn't accept
    delete (payload as Record<string, unknown>).facultyId;
    delete (payload as Record<string, unknown>).filiereId;
    const done = () => {
      onClose();
      reset(initial);
    };
    if (role === "student") {
      delete (payload as Record<string, unknown>).role;
      createStudent.mutate(payload, { onSuccess: done });
    } else if (role === "professor") {
      delete (payload as Record<string, unknown>).role;
      createProfessor.mutate(payload, { onSuccess: done });
    } else {
      createUser.mutate(payload, { onSuccess: done });
    }
  }

  const e = errors as Record<string, { message?: string } | undefined>;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={
        lockedRole === "student"
          ? t("admin.addStudent")
          : lockedRole === "professor"
            ? t("admin.addProfessor")
            : t("admin.addUser")
      }
      subtitle={t("admin.addUserSubtitle")}
      icon={UserPlus}
      size="xl"
      footer={
        <>
          <button
            type="submit"
            form="user-form"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {pending ? t("admin.saving") : t("admin.saveData")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <form
        id="user-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* ── الهوية والصلاحية ── */}
        <Section title={t("admin.sectionIdentity")} icon={Shield}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {!lockedRole && (
              <Field
                label={t("admin.userRole")}
                icon={Shield}
                error={e.role?.message}
              >
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
              </Field>
            )}
            <Field
              label={t("admin.firstName")}
              icon={User}
              error={e.firstName?.message}
            >
              <input
                {...register("firstName")}
                className={inputClass}
                placeholder={t("admin.firstNamePlaceholder")}
              />
            </Field>
            <Field
              label={t("admin.lastName")}
              icon={User}
              error={e.lastName?.message}
            >
              <input
                {...register("lastName")}
                className={inputClass}
                placeholder={t("admin.lastNamePlaceholder")}
              />
            </Field>
          </div>
        </Section>

        {/* ── STUDENT ── */}
        {role === "student" && (
          <Section title={t("admin.sectionStudent")} icon={IdCard}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label={t("admin.registrationNumber")}
                icon={IdCard}
                error={e.registrationNumber?.message}
              >
                <input
                  {...register("registrationNumber")}
                  dir="ltr"
                  className={inputClass}
                  placeholder={t("admin.regNumberPlaceholder")}
                />
              </Field>
              <Field
                label={t("admin.specialization")}
                icon={Layers}
                error={e.specializationId?.message}
              >
                <select
                  {...register("specializationId")}
                  className={inputClass}
                >
                  <option value="">{t("admin.selectSpecialization")}</option>
                  {specializations?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("admin.academicYear")}
                icon={CalendarDays}
                error={e.academicYearId?.message}
              >
                <select {...register("academicYearId")} className={inputClass}>
                  <option value="">{t("admin.selectYear")}</option>
                  {years?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={`${t("admin.email")} (${t("admin.optional")})`}
                icon={Mail}
                error={e.email?.message}
              >
                <input
                  {...register("email")}
                  dir="ltr"
                  className={inputClass}
                  placeholder="example@univ-eloued.dz"
                />
              </Field>
            </div>
          </Section>
        )}

        {/* ── PROFESSOR ── */}
        {role === "professor" && (
          <Section title={t("admin.sectionProfessor")} icon={Hash}>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("admin.universityEmail")}
                icon={Mail}
                error={e.universityEmail?.message}
              >
                <UniversityEmailInput
                  value={watch("universityEmail") ?? ""}
                  onChange={(next) => {
                    // Picking a domain before typing the local part yields an
                    // empty address — don't flag that as invalid yet; submit
                    // still validates it.
                    setValue("universityEmail", next, {
                      shouldValidate: next.length > 0,
                      shouldDirty: true,
                    });
                    if (!next) clearErrors("universityEmail");
                  }}
                  firstName={watch("firstName")}
                  lastName={watch("lastName")}
                />
              </Field>

              {/* الرقم الوظيفي يُولَّد في الخلفية — معروض للعلم فقط. */}
              <Field label={t("admin.employeeNumber")} icon={Hash}>
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-forest/20 bg-cream-2/60 px-3 py-2.5">
                  <Sparkles size={14} className="shrink-0 text-gold" />
                  <span className="text-sm text-clay">
                    {t("admin.employeeNumberAuto")}
                  </span>
                </div>
              </Field>
            </div>

            {/* cascading: faculty → department → filiere */}
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("admin.facultyLabel")} icon={Building2}>
                <select
                  {...register("facultyId", {
                    onChange: () => {
                      setValue("departmentId", "");
                      setValue("filiereId", "");
                    },
                  })}
                  className={inputClass}
                >
                  <option value="">{t("admin.allFacultiesShort")}</option>
                  {faculties?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("admin.department")}
                icon={Network}
                error={e.departmentId?.message}
              >
                <select
                  {...register("departmentId", {
                    onChange: () => setValue("filiereId", ""),
                  })}
                  className={inputClass}
                >
                  <option value="">{t("admin.selectDepartment")}</option>
                  {deptOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("admin.filiere")} icon={GitBranch}>
                <select {...register("filiereId")} className={inputClass}>
                  <option value="">{t("admin.allFilieresShort")}</option>
                  {filiereOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* الرتبة + الصفة */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TagInput
                label={t("admin.gradeLabel")}
                placeholder={t("admin.addGradeHint")}
                value={watch("grade") ?? []}
                onChange={(v) =>
                  setValue("grade", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
              <TagInput
                label={t("admin.tagLabel")}
                placeholder={t("admin.addTagHint")}
                value={watch("tags") ?? []}
                onChange={(v) =>
                  setValue("tags", v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </Section>
        )}

        {/* ── ADMIN / OWNER ── */}
        {(role === "admin" || role === "owner") && (
          <Section title={t("admin.sectionAdmin")} icon={AtSign}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("admin.email")}
                icon={Mail}
                error={e.email?.message}
              >
                <input
                  {...register("email")}
                  dir="ltr"
                  className={inputClass}
                  placeholder="example@univ-eloued.dz"
                />
              </Field>
              <Field
                label={t("admin.username")}
                icon={AtSign}
                error={e.username?.message}
              >
                <input
                  {...register("username")}
                  dir="ltr"
                  className={inputClass}
                  placeholder={t("admin.usernamePlaceholder")}
                />
              </Field>
            </div>
          </Section>
        )}

        {/* ── بيانات الدخول + الملاحظة ── */}
        <Section title={t("admin.sectionCredentials")} icon={Lock}>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Field
              label={t("admin.password")}
              icon={Lock}
              error={e.password?.message}
            >
              <div className="relative">
                {/* pl-11 keeps the typed text clear of the eye toggle */}
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  className={`${inputClass} pl-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {/* note */}
            <div className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-3">
              <p className="mb-1 text-xs font-bold text-forest">
                {t("admin.importantNote")}
              </p>
              <p className="text-[11px] leading-relaxed text-clay">
                {t("admin.userNoteBody")}
              </p>
            </div>
          </div>
        </Section>
      </form>
    </FormDialog>
  );
}
