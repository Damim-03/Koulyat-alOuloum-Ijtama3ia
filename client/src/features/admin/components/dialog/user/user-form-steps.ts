/**
 * خطوات إنشاء الحساب: أيّها تُعرض، وأيّ الحقول تحرسها.
 *
 * الشريط نفسه زينةٌ لا تعرف شيئاً. أمّا ما يعرف فهذا الملفّ: أن الدور يُغيّر
 * **عدد** الخطوات وعناوينها لا محتواها فحسب — فالإداريّ لا بيانات جامعية له،
 * وخطوته الثالثة بيانات دخولٍ لا انتماءٌ أكاديميّ — وأن لكلّ خطوةٍ حقولاً
 * لا يجوز تجاوزها قبل أن تصحّ.
 *
 * وأُخرج هذا من المكوّن عمداً: القاعدة إن سكنت داخل ٩٠٠ سطرٍ من JSX لم
 * تُختبَر إلّا بتشغيل متصفّح. وهي هنا دالّةٌ صرفة، فاختبارها سطران.
 *
 * ولا شيء من هذا يمسّ الخادم: السجلّ لا يُنشأ إلّا عند «حفظ البيانات»، فكلّ
 * ما قبلها حالةٌ في المتصفّح.
 */

export type Role = "student" | "professor" | "admin";

/**
 * استمارةٌ واحدةٌ واسعةٌ تغطّي كل حقلٍ ممكن؛ الدور النشط يقرّر أيّها يُعرض
 * وأيّ مخطّطٍ يُصدّق الإرسال.
 */
export interface FormValues {
  role: Role;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female" | "";
  email?: string;
  username?: string;
  password?: string;
  /**
   * توثيق الحساب — علامةٌ إداريةٌ على الحساب كلّه لا على بيانةٍ بعينها،
   * فهي في الخطوة الشخصية مع كلمة المرور لا في الجامعية: للإداريّ والأستاذ
   * والطالب سواء.
   */
  isVerified?: boolean;
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

export type FieldName = keyof FormValues;

export type StepKey = "role" | "personal" | "academic" | "review";

export interface WizardStep {
  key: StepKey;
  /** مفتاح الترجمة لما يُكتب تحت الدائرة. */
  labelKey: string;
  /** ما يجب أن يصحّ قبل الانتقال إلى ما بعدها. */
  fields: FieldName[];
}

export const isStaffRole = (role: Role) => role === "admin";

/**
 * حقول الخطوة الشخصية.
 *
 * بريد الإداريّ ليس هنا: هو مُعرّف دخوله، فيُسأل عنه مع كلمة المرور في
 * خطوة الحساب — كما هي الاستمارة اليوم.
 */
export function personalFields(role: Role): FieldName[] {
  const fields: FieldName[] = ["firstName", "lastName", "gender", "password"];
  if (!isStaffRole(role)) fields.push("email");
  if (role === "student") fields.push("phone");
  return fields;
}

/** حقول الخطوة الثالثة — وهي ثلاث خطواتٍ مختلفةٍ تحت اسمٍ واحد. */
export function academicFields(role: Role): FieldName[] {
  if (role === "student")
    return ["registrationNumber", "academicYearId", "specializationId"];
  if (role === "professor") return ["universityEmail", "departmentId"];
  return ["email", "username"];
}

/**
 * عنوان كل حقلٍ ممّا تطلبه الخطوة الثالثة.
 *
 * تستعمله بطاقات الدور لتعرض — وسماً وسماً — ما سيُسأل عنه بعد الاختيار.
 * ومصدره `academicFields` نفسها، فلا تستطيع البطاقة أن تَعِد بغير ما يُسأل.
 */
export const FIELD_LABEL_KEY: Partial<Record<FieldName, string>> = {
  registrationNumber: "pro.regNumber",
  academicYearId: "pro.academicYear",
  specializationId: "admin.specialization",
  universityEmail: "admin.universityEmail",
  departmentId: "admin.department",
  email: "admin.email",
  username: "admin.username",
};

/** وعنوانها يتبع الدور: لا «بيانات جامعية» لمن لا جامعة له. */
export function academicLabelKey(role: Role): string {
  return isStaffRole(role) ? "admin.sectionAdmin" : "admin.universityData";
}

/**
 * الخطوات كما تُعرض.
 *
 * `lockedRole` يعني أن الشاشة فُتحت من «إضافة طالب» أو «إضافة أستاذ»، فالدور
 * مقرَّرٌ سلفاً ولا يُسأل عنه: تسقط الخطوة الأولى وتبقى ثلاث. وعرض خطوةٍ
 * سؤالها محسومٌ أسوأ من ألّا تكون.
 */
export function stepsFor(role: Role, lockedRole?: Role): WizardStep[] {
  const steps: WizardStep[] = [];

  if (!lockedRole)
    steps.push({ key: "role", labelKey: "admin.userRole", fields: ["role"] });

  steps.push({
    key: "personal",
    labelKey: "admin.personalData",
    fields: personalFields(role),
  });
  steps.push({
    key: "academic",
    labelKey: academicLabelKey(role),
    fields: academicFields(role),
  });
  steps.push({ key: "review", labelKey: "admin.stepReview", fields: [] });

  return steps;
}
