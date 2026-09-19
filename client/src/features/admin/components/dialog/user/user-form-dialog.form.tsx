import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  X,
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
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Check,
  BadgeCheck,
  ShieldQuestion,
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
import { VerificationSelect } from "../../ui/verification-select";
import { TagInput } from "../../ui/tag-input";
import { ACADEMIC_RANKS } from "../../../constants/academic-ranks";
import { RoleCards } from "../../ui/role-cards";
import { GenderSelect } from "../../ui/gender-select";
import { UniversityEmailInput } from "../../ui/university-email-input";
import { ImageCropperDialog } from "../../ui/image-cropper-dialog";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { Stepper } from "../../../../../components/ui/stepper";
import {
  academicFields,
  FIELD_LABEL_KEY,
  isStaffRole,
  stepsFor,
  type FormValues,
  type Role,
} from "./user-form-steps";
import { None } from "../../../../../lib/none";
import { Select } from "../../../../../components/ui/select";

/** وصفُ كلّ دورٍ على بطاقته — مَن هو، لا ماذا سيُسأل (الوسوم تقول ذلك). */
const ROLE_DESC_KEY: Record<Role, string> = {
  student: "admin.roleCardStudent",
  professor: "admin.roleCardProfessor",
  admin: "admin.roleCardAdmin",
};

const ALL_ROLES: Role[] = ["student", "professor", "admin"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, the role is fixed and the role selector is hidden. */
  lockedRole?: Role;
}

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
// شكلها ومَن يحرس كلّ حقلٍ منها في `user-form-steps.ts`.

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
  // كما في القاعدة: الحساب غير موثّقٍ ما لم تُوثّقه الإدارة صراحةً.
  isVerified: false,
};

/**
 * Strip empty strings/empty arrays + the helper-only fields before sending.
 * Constrained to `object` rather than `Record<string, unknown>` so plain
 * interfaces (which carry no index signature) can be passed directly.
 */
/** سطرٌ في جدول المراجعة؛ و`tone` يجعله شارةً بدل نصّ. */
type ReviewRow = {
  label: string;
  value?: string;
  tone?: "on" | "off";
  /** المسار الأكاديميّ سلسلةٌ طويلة؛ عمودٌ واحدٌ يكسرها ثلاثة أسطر. */
  wide?: boolean;
};

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
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    clearErrors,
    trigger,
    setFocus,
    getFieldState,
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
  const isVerified = watch("isVerified");
  // الخطوة الأخيرة تعرض ما جُمِع كلّه، لا حقلاً بعينه.
  const values = watch();

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

  /**
   * بطاقات الدور.
   *
   * وسومها مشتقّةٌ من `academicFields` — أي من نفس الجدول الذي يحرس الخطوة
   * الثالثة. فلو أُضيف حقلٌ هناك ظهر وسمه هنا بلا تعديل، ولا تَعِد بطاقةٌ
   * بشيءٍ لا يُسأل عنه.
   */
  const roleOptions = useMemo(
    () =>
      ALL_ROLES.map((r) => ({
        value: r,
        label: t(`role.${r}`),
        description: t(ROLE_DESC_KEY[r]),
        chips: academicFields(r)
          .map((field) => FIELD_LABEL_KEY[field])
          .filter((key): key is string => Boolean(key))
          .map((key) => t(key)),
      })),
    [t],
  );

  /**
   * ما تعرضه المراجعة.
   *
   * أسماءٌ لا مُعرِّفات: الإدارة اختارت «قسم الإعلام الآلي» لا
   * `3f2a…`. وما لم يُملأ يظهر شرطةً — الفراغ الصامت يُقرأ سهواً.
   */
  const reviewRows = useMemo<ReviewRow[]>(() => {
    // الدور والاسم والتوثيق ليست هنا: هي في رأس البطاقة أعلاه، حيث
    // تُقرأ قبل التفاصيل لا بينها.
    const person: ReviewRow[] = [
      {
        label: t("admin.gender"),
        value: values.gender
          ? t(values.gender === "male" ? "admin.genderMale" : "admin.genderFemale")
          : "",
      },
      ...(isStaffRole(role)
        ? []
        : [{ label: t("admin.personalEmail"), value: values.email }]),
      ...(role === "student"
        ? [{ label: t("admin.phone"), value: values.phone }]
        : []),
      // لا تُعرض كلمة المرور نصّاً ولو كان من كتبها واقفاً أمامها.
      { label: t("admin.password"), value: values.password ? "••••••••" : "" },
    ];

    const name = <T extends { id: string; name?: string; title?: string }>(
      list: T[] | undefined,
      id?: string,
    ) => {
      const hit = (list ?? []).find((x) => x.id === id);
      return hit?.name ?? hit?.title;
    };

    if (role === "student")
      return [
        ...person,
        { label: t("pro.regNumber"), value: values.registrationNumber },
        {
          label: t("pro.academicYear"),
          value: name(years, values.academicYearId),
        },
        {
          label: t("admin.specialization"),
          value: name(specOptions, values.specializationId),
        },
        {
          label: t("admin.academicPath"),
          wide: true,
          value: [
            name(faculties, values.facultyId),
            name(deptOptions, values.departmentId),
            name(filiereOptions, values.filiereId),
          ]
            .filter(Boolean)
            .join(" ← "),
        },
      ];

    if (role === "professor")
      return [
        ...person,
        { label: t("admin.searchByEmail"), value: values.universityEmail },
        {
          label: t("admin.department"),
          value: name(deptOptions, values.departmentId),
        },
        {
          label: t("admin.academicAffiliation"),
          wide: true,
          value: [
            name(faculties, values.facultyId),
            name(filiereOptions, values.filiereId),
          ]
            .filter(Boolean)
            .join(" ← "),
        },
        { label: t("admin.gradeLabel"), value: (values.grade ?? []).join("، ") },
        { label: t("admin.tagLabel"), value: (values.tags ?? []).join("، ") },
      ];

    return [
      ...person,
      { label: t("admin.email"), value: values.email },
      { label: t("admin.username"), value: values.username },
    ];
  }, [
    t,
    role,
    values,
    years,
    faculties,
    deptOptions,
    filiereOptions,
    specOptions,
  ]);

  // ── الخطوات ──
  // الدور يُغيّر عددها لا محتواها فحسب، فتُحسب منه. و`index` يُقصّ على الطول
  // لأن تبديل الدور قد يُقصّر القائمة بينما نحن واقفون في آخرها.
  const [stepIndex, setStepIndex] = useState(0);

  /**
   * إقرار المراجعة.
   *
   * بلوغُ الخطوة الأخيرة ليس مراجعة: يبلغها المستخدم بأربع ضغطاتٍ متتالية
   * على «التالي» دون أن يقرأ سطراً واحداً ممّا جمَع. فالإنشاء معلَّقٌ على
   * فعلٍ **منفصلٍ عن التنقّل** — إقرارٌ بأن ما في الجدول هو المقصود.
   *
   * ويسقط الإقرار كلّما رجع المستخدم خطوة: هو إقرارٌ ببياناتٍ بعينها لا
   * بالاستمارة، ومن عدّل بعده فما أقرّ بما صار إليه.
   */
  const [confirmed, setConfirmed] = useState(false);
  const [ackError, setAckError] = useState(false);
  const ackRef = useRef<HTMLInputElement>(null);

  const steps = useMemo(() => stepsFor(role, lockedRole), [role, lockedRole]);
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  async function goNext() {
    // لا يُتجاوَز حقلٌ ناقصٌ إلى خطوةٍ تالية: خطأٌ يظهر بعد ثلاث خطواتٍ
    // يُلقي بالمستخدم إلى الوراء بلا أن يعرف أين.
    const ok = await trigger(step.fields);
    if (ok) {
      setStepIndex(index + 1);
      return;
    }

    // ولا يكفي أن تحمرّ الحقول: الناقص قد يكون تحت الطيّة، فيضغط المستخدم
    // «التالي» فلا يتحرّك شيءٌ ممّا يراه. فيُنقل التركيز إلى أوّلها —
    // والمتصفّح يُمرّر إليه من تلقاء نفسه.
    const firstInvalid = step.fields.find((f) => getFieldState(f).invalid);
    if (firstInvalid) setFocus(firstInvalid, { shouldSelect: true });
  }

  /** الرجوع إلى خطوةٍ سابقة يُبطل الإقرار — انظر تعليق `confirmed`. */
  function goBack(to: number) {
    setStepIndex(to);
    setConfirmed(false);
    setAckError(false);
  }

  useEffect(() => {
    if (open) {
      reset(initial);
      setShowPassword(false);
      setCropFile(null);
      setStepIndex(0);
      setConfirmed(false);
      setAckError(false);
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
  const isStaffAccount = isStaffRole(role);

  /**
   * الإرسال لا يقع إلّا في الخطوة الأخيرة.
   *
   * ضغطة Enter داخل أيّ حقلٍ ترسل الاستمارة ضمنياً — ولو تُركت لأرسلت من
   * الخطوة الأولى، فيُصدّق المخطّط كلّه ويظهر خطأٌ عن حقلٍ لم يُعرض بعد.
   * فهنا تتحوّل الضغطة إلى «التالي».
   */
  function onFormSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!isLast) {
      void goNext();
      return;
    }

    // ولا يقع الإنشاء بلا إقرار، ولو صحّت الحقول كلّها. والزرّ يبقى حيّاً
    // ليقول **لماذا** لم يقع: زرٌّ معطَّلٌ بلا سبب ظاهرٍ يُقرأ عُطلاً.
    if (!confirmed) {
      setAckError(true);
      ackRef.current?.focus();
      return;
    }
    void handleSubmit(onSubmit)();
  }

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

      {/*
        ارتفاعٌ ثابتٌ لا أقصى.
        كان `max-h` يجعل النافذة تتمدّد بطول محتوى كل خطوة: قصيرةٌ عند
        البطاقات، طويلةٌ عند البيانات الشخصية — فيقفز الإطار وتتحرّك أزرار
        «التالي» تحت الإصبع في كل انتقال. الآن الإطار واحدٌ في الخطوات
        الأربع، والمحتوى وحده يتمرّر داخله.
        و`min` تحمي الشاشات القصيرة: على حاسوبٍ منخفض الارتفاع يصير ٩٠٪ منه.
      */}
      <div className="animate-[fadeIn_0.15s_ease-out] relative flex h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-2xl">
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

        {/* ── شريط الخطوات ── */}
        <div className="shrink-0 border-b border-forest/10 bg-cream-2/40 px-8 py-3">
          <Stepper
            steps={steps.map((s) => ({ key: s.key, label: t(s.labelKey) }))}
            current={index}
            onGo={goBack}
            ariaLabel={t("admin.addUser")}
          />
        </div>

        {/* ── body: خطوةٌ واحدةٌ في كل مرّة ── */}
        <form
          id="user-form"
          onSubmit={onFormSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2.5"
        >
          {/*
            `my-auto` يُوسّط عمودياً حين يكون المحتوى أقصر من الإطار، ويذوب
            حين يطول فيعود التمرير كما كان. وخطوة الدور تأخذ العرض كاملاً:
            ثلاث بطاقاتٍ في صفٍّ تحتاجه، وبقيّة الخطوات استمارةٌ لا تُقرأ
            عريضة.
          */}
          <div
            className={`mx-auto w-full ${
              step.key === "role" ? "my-auto max-w-none" : "max-w-3xl"
            }`}
          >
            {/* ══ STEP — الدور ══ */}
            {step.key === "role" && (
              /*
                بلا `Panel` هنا وحدها.
                اللوحة إطارٌ يجمع حقولاً متفرّقة تحت عنوان — وهي في بقيّة
                الخطوات في محلّها. أمّا هنا فالبطاقات **هي** المحتوى كلّه،
                ووضعها داخل صندوقٍ يُحيط بها صندوقاً في صندوق، ويكرّر عنواناً
                يقوله الشريط فوقها. فتطفو كلّ بطاقةٍ بذاتها.
              */
              <RoleCards
                value={role}
                onChange={(next) =>
                  setValue("role", next, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={roleOptions}
                selectLabel={t("admin.roleCardSelect")}
                selectedLabel={t("admin.roleCardSelected")}
              />
            )}

            {/* ══ STEP — personal ══ */}
            {step.key === "personal" && (
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

              {/*
                اختياران من خيارين في صفٍّ واحد.

                والتوثيق في الخطوة الشخصية لأنّه قرارٌ عن الحساب كلّه: الخطوة
                الثالثة «جامعية» عند الطالب والأستاذ، ولا وجود لها بهذا المعنى
                عند الإداريّ — فلو سكن فيها لسقط عن دورٍ من ثلاثة.
              */}
              <div className="grid grid-cols-2 gap-3">
                <FieldBox label={t("admin.gender")} icon={Users}>
                  <GenderSelect
                    value={gender || null}
                    onChange={(next) =>
                      setValue("gender", next ?? "", { shouldDirty: true })
                    }
                  />
                </FieldBox>

                <FieldBox
                  label={t("admin.verificationStatus")}
                  icon={BadgeCheck}
                >
                  <VerificationSelect
                    value={isVerified === true}
                    onChange={(next) =>
                      setValue("isVerified", next, { shouldDirty: true })
                    }
                  />
                </FieldBox>
              </div>

              {/* For staff the address is the login, so it lives with the
                  other credentials rather than here.

                  والبريد والهاتف في صفٍّ واحد عند الطالب — وهو وحده من
                  يُسأل عنهما معاً — فلا تطول الخطوة حتى يختفي آخرها تحت
                  الطيّة. وعند الأستاذ يبقى البريد وحده بعرضه كما كان. */}
              {!isStaffAccount && (
                <div className={role === "student" ? "grid grid-cols-2 gap-3" : ""}>
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
                </div>
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

            </Panel>
            )}

            {/* ══ STEP — academic / account ══ */}
            {step.key === "academic" && (
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
                      <Controller
                        control={control}
                        name="academicYearId"
                        render={({ field }) => (
                          <Select
                            ref={field.ref}
                            value={(field.value as string) ?? ""}
                            onChange={(v) => {
                              field.onChange(v);
                            }}
                            options={[
                              { value: "", label: t("admin.selectYear") },
                              ...(years ?? []).map((y) => ({ value: y.id, label: y.title })),
                            ]}
                          />
                        )}
                      />
                    </FieldBox>
                  </div>

                  <FieldBox label={t("admin.facultyLabel")} icon={Building2}>
                    <Controller
                      control={control}
                      name="facultyId"
                      render={({ field }) => (
                        <Select
                          ref={field.ref}
                          value={(field.value as string) ?? ""}
                          onChange={(v) => {
                            field.onChange(v);
                          // ما كان مُرفقاً بـ`register` يبقى كما هو
                          setValue("departmentId", "");
                                                    setValue("filiereId", "");
                                                    setValue("specializationId", "");
                          }}
                          options={[
                            { value: "", label: t("admin.allFacultiesShort") },
                            ...(faculties ?? []).map((f) => ({ value: f.id, label: f.name })),
                          ]}
                        />
                      )}
                    />
                  </FieldBox>

                  <FieldBox label={t("admin.department")} icon={Network}>
                    <Controller
                      control={control}
                      name="departmentId"
                      render={({ field }) => (
                        <Select
                          ref={field.ref}
                          value={(field.value as string) ?? ""}
                          onChange={(v) => {
                            field.onChange(v);
                          // ما كان مُرفقاً بـ`register` يبقى كما هو
                          setValue("filiereId", "");
                                                    setValue("specializationId", "");
                          }}
                          options={[
                            { value: "", label: t("admin.chooseDepartment") },
                            ...deptOptions.map((d) => ({ value: d.id, label: d.name })),
                          ]}
                        />
                      )}
                    />
                  </FieldBox>

                  <FieldBox label={t("admin.filiere")} icon={GitBranch}>
                    <Controller
                      control={control}
                      name="filiereId"
                      render={({ field }) => (
                        <Select
                          ref={field.ref}
                          value={(field.value as string) ?? ""}
                          onChange={(v) => {
                            field.onChange(v);
                            // ما كان مُرفقاً بـ`register` يبقى كما هو
                            setValue("specializationId", "");
                          }}
                          options={[
                            { value: "", label: t("admin.allFilieresShort") },
                            ...filiereOptions.map((f) => ({ value: f.id, label: f.name })),
                          ]}
                        />
                      )}
                    />
                  </FieldBox>

                  <FieldBox
                    label={t("admin.specialization")}
                    icon={Layers}
                    required
                    error={e.specializationId?.message}
                  >
                    <Controller
                      control={control}
                      name="specializationId"
                      render={({ field }) => (
                        <Select
                          ref={field.ref}
                          value={(field.value as string) ?? ""}
                          onChange={(v) => {
                            field.onChange(v);
                          }}
                          options={[
                            { value: "", label: t("admin.selectSpecialization") },
                            ...specOptions.map((s) => ({ value: s.id, label: s.name })),
                          ]}
                        />
                      )}
                    />
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
                      <Controller
                        control={control}
                        name="facultyId"
                        render={({ field }) => (
                          <Select
                            ref={field.ref}
                            value={(field.value as string) ?? ""}
                            onChange={(v) => {
                              field.onChange(v);
                            // ما كان مُرفقاً بـ`register` يبقى كما هو
                            setValue("departmentId", "");
                                                        setValue("filiereId", "");
                            }}
                            options={[
                              { value: "", label: t("admin.allFacultiesShort") },
                              ...(faculties ?? []).map((f) => ({ value: f.id, label: f.name })),
                            ]}
                          />
                        )}
                      />
                    </FieldBox>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <FieldBox
                      label={t("admin.department")}
                      icon={Network}
                      required
                      error={e.departmentId?.message}
                    >
                      <Controller
                        control={control}
                        name="departmentId"
                        render={({ field }) => (
                          <Select
                            ref={field.ref}
                            value={(field.value as string) ?? ""}
                            onChange={(v) => {
                              field.onChange(v);
                              // ما كان مُرفقاً بـ`register` يبقى كما هو
                              setValue("filiereId", "");
                            }}
                            options={[
                              { value: "", label: t("admin.chooseDepartment") },
                              ...deptOptions.map((d) => ({ value: d.id, label: d.name })),
                            ]}
                          />
                        )}
                      />
                    </FieldBox>
                    <FieldBox label={t("admin.filiere")} icon={GitBranch}>
                      <Controller
                        control={control}
                        name="filiereId"
                        render={({ field }) => (
                          <Select
                            ref={field.ref}
                            value={(field.value as string) ?? ""}
                            onChange={(v) => {
                              field.onChange(v);
                            }}
                            options={[
                              { value: "", label: t("admin.allFilieresShort") },
                              ...filiereOptions.map((f) => ({ value: f.id, label: f.name })),
                            ]}
                          />
                        )}
                      />
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
            )}

            {/* ══ STEP — review ══ */}
            {step.key === "review" && (
              <Panel title={t("admin.stepReview")} icon={ClipboardCheck}>
                {/*
                  الحساب قبل حقوله.

                  كانت المراجعة قائمةً مسطّحة أوّلها «نوع الصلاحية» — وهي
                  تسأل «هل هذه البيانات صحيحة؟» عن شخصٍ لا وجه له. فالصورة
                  والاسم والدور في رأسٍ واحد: يُعرَف الحساب قبل أن يُدقَّق.

                  والصورة هي التي رُفعت فعلاً، وإلّا فالبديل المرسوم بحسب
                  الجنس — نفسه الذي يظهر في ترويسة الشاشة، فلا يفاجئ الحسابُ
                  منشئه بعد الحفظ.
                */}
                <div
                  data-testid="review-identity"
                  className="mb-3 flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-2/60 p-3"
                >
                  <UserAvatar
                    user={previewUser}
                    size={62}
                    radius="rounded-2xl"
                    className="shrink-0 ring-2 ring-gold/35"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold leading-tight text-forest">
                      {`${firstName ?? ""} ${lastName ?? ""}`.trim() || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-forest-deep">
                        <Shield size={11} />
                        {t(`role.${role}`)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isVerified
                            ? "bg-sage/20 text-forest"
                            : "bg-forest/8 text-clay"
                        }`}
                      >
                        {isVerified ? (
                          <BadgeCheck size={11} className="text-sage" />
                        ) : (
                          <ShieldQuestion size={11} />
                        )}
                        {isVerified
                          ? t("admin.verified")
                          : t("admin.unverified")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* عمودان: أحد عشر سطراً في عمودٍ واحد تدفع آخر الخطوة —
                    وفيه الإقرار — تحت الطيّة. */}
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  {reviewRows.map((row) => (
                    <div
                      key={row.label}
                      className={`flex items-start justify-between gap-4 border-b border-forest/8 py-1.5 ${
                        row.wide ? "sm:col-span-2" : ""
                      }`}
                    >
                      <dt className="shrink-0 text-[11px] font-semibold text-clay">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 break-words text-right text-[12px] text-forest">
                        {/* التوثيق حالةٌ لا نصّ: شارةٌ تُرى قبل أن تُقرأ. */}
                        {row.tone ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              row.tone === "on"
                                ? "bg-sage/15 text-forest"
                                : "bg-forest/8 text-clay"
                            }`}
                          >
                            {row.tone === "on" ? (
                              <BadgeCheck size={12} className="text-sage" />
                            ) : (
                              <ShieldQuestion size={12} />
                            )}
                            {row.value}
                          </span>
                        ) : row.value ? (
                          row.value
                        ) : (
                          // والفراغ مُخفَتٌ هنا أيضاً، كما في صفحات التفاصيل.
                          <span className="text-clay/75">
                            {t("common.none")}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/*
                  الإقرار صريحٌ لا ضمنيّ.
                  ولا يُخفى زرّ التأكيد قبله ولا يُعطَّل: المطلوب أن يعرف
                  المستخدم ما ينقصه، لا أن يجد زرّاً لا يستجيب.

                  والتنبيه بداخله لا في صندوقٍ فوقه: صندوقان متجاوران
                  يقولان «راجِع» و«راجعتُ» تكرارٌ يطول به آخر الخطوة حتى
                  يهرب تحت الطيّة — والمراجعة أوّل ما يجب أن يُرى كاملاً.

                  و«مراجعة» لا «تحقّق»: تفرّد البريد ورقم التسجيل لا يعرفه
                  المتصفّح — يعرفه الخادم وحده عند الحفظ.
                */}
                <label
                  data-testid="review-confirm"
                  className={`mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                    ackError
                      ? "border-brick/40 bg-brick/5"
                      : confirmed
                        ? "border-sage/45 bg-sage/10"
                        : "border-forest/15 bg-cream-2/40"
                  }`}
                >
                  <input
                    ref={ackRef}
                    type="checkbox"
                    checked={confirmed}
                    onChange={(ev) => {
                      setConfirmed(ev.target.checked);
                      if (ev.target.checked) setAckError(false);
                    }}
                    className="mt-0.5 size-4 shrink-0 accent-gold"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-semibold leading-snug text-forest">
                      {t("admin.confirmReview")}
                    </span>
                    <span className="mt-1 flex items-start gap-1.5 text-[10px] leading-relaxed text-clay">
                      <CircleAlert
                        size={11}
                        className="mt-0.5 shrink-0 text-gold"
                      />
                      {t("admin.reviewHint")}
                    </span>
                    {ackError && (
                      <span className="mt-1 block text-[11px] font-semibold text-brick">
                        {t("admin.confirmRequired")}
                      </span>
                    )}
                  </span>
                </label>
              </Panel>
            )}
          </div>
        </form>

        {/* ── footer ── */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-clay">
            <ShieldCheck size={13} className="text-sage" />
            {isLast
              ? t("admin.savedOnSubmitHint")
              : t("admin.stepOf", { current: index + 1, total: steps.length })}
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

            {index > 0 && (
              <button
                type="button"
                onClick={() => goBack(index - 1)}
                disabled={busy}
                data-testid="wizard-back"
                className="inline-flex items-center gap-1 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
              >
                <ChevronRight size={16} className="ltr:rotate-180" />
                {t("admin.previous")}
              </button>
            )}

            {/* زرّ الحفظ لا يظهر إلّا في الأخيرة: زرٌّ يحفظ وأنت في الخطوة
                الثانية يجعل بقيّة الخطوات اختيارية في نظر المستخدم. */}
            {isLast ? (
              <button
                type="submit"
                form="user-form"
                disabled={busy}
                data-testid="wizard-save"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {busy ? t("admin.savingEllipsis") : t("admin.confirmAndCreate")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={busy}
                data-testid="wizard-next"
                className="inline-flex items-center gap-1 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
              >
                {t("admin.next")}
                <ChevronLeft size={16} className="ltr:rotate-180" />
              </button>
            )}
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
        {parts.filter(Boolean).join(" ← ") || <None />}
      </p>
    </div>
  );
}
