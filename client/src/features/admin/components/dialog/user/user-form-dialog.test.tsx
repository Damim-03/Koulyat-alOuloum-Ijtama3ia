/**
 * سلوك معالج إنشاء الحساب.
 *
 * منطق الخطوات مُختبَرٌ صرفاً في `user-form-steps.test.ts`؛ وهذا الملفّ يسأل
 * ما لا تجيب عنه دالّة: **هل يحرس الشريط فعلاً؟**
 *
 * فالوعد الذي تقطعه الخطوات على المستخدم أن ما تجاوزه صحيح. ولو تقدّم زرّ
 * «التالي» بحقلٍ ناقص لانكسر الوعد في أسوأ موضع: يُردّ عند الحفظ بخطأٍ عن
 * حقلٍ صار وراءه بخطوتين، فيبحث عنه في الخطوة التي يراها.
 *
 * والترجمة مُستبدَلة بمفاتيحها عمداً: الاختبار يؤكّد السلوك لا نصّ العربية،
 * فلا ينكسر بتحرير ملفّ ترجمة.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const noop = { mutate: vi.fn(), isPending: false };
vi.mock("../../../hooks/admin-hook", () => ({
  useProfessors: () => ({ data: { items: [] } }),
  useCreateUser: () => noop,
  useCreateStudent: () => noop,
  useCreateProfessor: () => noop,
  useUploadImage: () => noop,
  useSpecializations: () => ({
    data: [{
      id: "11111111-1111-4111-8111-111111111111",
      name: "علم النفس العيادي",
      filiereId: "fl-1",
    }],
  }),
  useAcademicYears: () => ({ data: [{ id: "22222222-2222-4222-8222-222222222222", title: "2025/2026" }] }),
  useDepartments: () => ({ data: [] }),
  useFaculties: () => ({ data: [] }),
  useFilieres: () => ({ data: [] }),
}));

const { UserFormDialog } = await import("./user-form-dialog.form");

const open = (props: Partial<Parameters<typeof UserFormDialog>[0]> = {}) =>
  render(<UserFormDialog open onClose={() => {}} {...props} />);

/** مفتاح الخطوة التي يقف عليها الشريط الآن. */
const currentStep = () =>
  screen
    .getByTestId("stepper")
    .querySelector('[aria-current="step"]')
    ?.getAttribute("data-testid");

const next = () => userEvent.click(screen.getByTestId("wizard-next"));

describe("هيئة المعالج", () => {
  it("يبدأ عند اختيار الدور، ولا زرّ حفظٍ قبل الأخيرة", () => {
    open();

    expect(currentStep()).toBe("step-role");
    expect(screen.queryByTestId("wizard-save")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-next")).toBeInTheDocument();
    // ولا زرّ رجوعٍ في الأولى — لا وراء لها.
    expect(screen.queryByTestId("wizard-back")).not.toBeInTheDocument();
  });

  /**
   * تُفتح الشاشة أحياناً من «إضافة طالب»، فالدور محسوم. وعرض خطوةٍ سؤالها
   * محسومٌ يُوهم بقرارٍ لا وجود له.
   */
  it("ومع دورٍ مثبّت تسقط خطوة الدور", () => {
    open({ lockedRole: "student" });

    expect(currentStep()).toBe("step-personal");
    expect(screen.queryByTestId("step-role")).not.toBeInTheDocument();
  });

  it("وعنوان الخطوة الثالثة يتبع الدور: الإداريّ لا بيانات جامعية له", () => {
    open({ lockedRole: "admin" });

    expect(screen.getByTestId("step-academic")).toHaveTextContent(
      "admin.sectionAdmin",
    );
    expect(screen.queryByText("admin.universityData")).not.toBeInTheDocument();
  });

  /**
   * البطاقات ليست زينةً فوق قائمة: اختيارها يُعيد بناء ما بعدها. ولو انقطع
   * الخيط بينها وبين الاستمارة لبدت تعمل — تُضاء البطاقة — والخطوة الثالثة
   * على حالها.
   */
  it("واختيار بطاقةٍ يُبدّل الخطوة التي تليها", async () => {
    open();
    expect(screen.getByTestId("step-academic")).toHaveTextContent(
      "admin.universityData",
    );

    await userEvent.click(screen.getByTestId("role-card-admin"));

    expect(screen.getByTestId("step-academic")).toHaveTextContent(
      "admin.sectionAdmin",
    );
  });

  it("والبطاقة المختارة معلَّمةٌ لقارئ الشاشة لا باللون وحده", async () => {
    open();

    const student = screen.getByTestId("role-card-student").querySelector("input")!;
    const admin = screen.getByTestId("role-card-admin").querySelector("input")!;
    expect(student).toBeChecked();

    await userEvent.click(admin);

    expect(admin).toBeChecked();
    expect(student).not.toBeChecked();
  });
});

describe("الحراسة عند الانتقال", () => {
  it("حقلٌ مطلوبٌ ناقص ⇒ «التالي» لا يتقدّم", async () => {
    open({ lockedRole: "student" });
    expect(currentStep()).toBe("step-personal");

    // كلمة المرور فارغة — وهي مطلوبة في كل دور.
    await next();

    expect(currentStep()).toBe("step-personal");
  });

  /**
   * الحقل الناقص قد يكون تحت الطيّة: يضغط المستخدم «التالي» فلا يتحرّك شيءٌ
   * ممّا يراه، ويظنّ الزرّ معطّلاً. فنقلُ التركيز هو ما يدلّه على موضع
   * المشكلة — والمتصفّح يُمرّر إليه من تلقاء نفسه.
   */
  it("وينتقل التركيز إلى أوّل حقلٍ ناقص", async () => {
    open({ lockedRole: "student" });
    const password = screen.getByPlaceholderText("••••••••");

    await next();

    expect(password).toHaveFocus();
  });

  /**
   * والرسالة تحت الحقل نفسه لا في رأس الاستمارة: «راجع البيانات» لا تدلّ
   * على شيء في استمارةٍ فيها عشرة حقول.
   *
   * ولا أؤكّد نصّها هنا: `admin.schema` يستدعي `t` من i18next مباشرةً، وهي
   * غير مُهيّأة في الاختبارات — فالنصّ رهن الإعداد، أمّا **موضع** الرسالة
   * فهو السلوك المقصود.
   */
  it("وتظهر رسالةٌ تحت الحقل الناقص وحده", async () => {
    open({ lockedRole: "student" });
    const box = screen.getByPlaceholderText("••••••••").closest("label")!;

    expect(box.querySelector("p")).toBeNull();
    await next();

    expect(box.querySelector("p")).not.toBeNull();
  });

  it("وحين يصحّ الحقل يتقدّم، والشريط يتبع", async () => {
    open({ lockedRole: "student" });

    await userEvent.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await next();

    expect(currentStep()).toBe("step-academic");
    // وزرّ الرجوع ظهر الآن.
    expect(screen.getByTestId("wizard-back")).toBeInTheDocument();
  });

  /**
   * الرجوع لا يُفرّغ شيئاً: معالجٌ يمحو ما كُتب كلّما رجعتَ خطوةً يجعل
   * المراجعة عقوبة.
   */
  it("والرجوع يُبقي ما كُتب", async () => {
    open({ lockedRole: "student" });
    const password = screen.getByPlaceholderText("••••••••");

    await userEvent.type(password, "secret123");
    await next();
    await userEvent.click(screen.getByTestId("wizard-back"));

    expect(currentStep()).toBe("step-personal");
    expect(screen.getByPlaceholderText("••••••••")).toHaveValue("secret123");
  });

  it("ولا يبلغ الحفظ إلّا في الخطوة الأخيرة", async () => {
    open({ lockedRole: "admin" });

    await userEvent.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await next();
    expect(screen.queryByTestId("wizard-save")).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText("admin.usernamePlaceholder"),
      "someadmin",
    );
    await next();

    expect(currentStep()).toBe("step-review");
    expect(screen.getByTestId("wizard-save")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-next")).not.toBeInTheDocument();
  });
});


/**
 * الخطوة الأخيرة ليست تحصيلَ حاصل.
 *
 * يبلغها المستخدم بأربع ضغطاتٍ متتاليةٍ على «التالي» دون أن يقرأ سطراً،
 * فلو أنشأ الزرّ الحسابَ عندها مباشرةً لكانت «المراجعة» اسماً بلا فعل.
 * فالإقرار شرطٌ قائمٌ بذاته، منفصلٌ عن التنقّل الذي أوصل إليه.
 */
describe("الإقرار قبل الإنشاء", () => {
  const toReview = async () => {
    open({ lockedRole: "admin" });
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await next();
    await userEvent.type(
      screen.getByPlaceholderText("admin.usernamePlaceholder"),
      "someadmin",
    );
    await next();
    expect(currentStep()).toBe("step-review");
  };

  const ack = () =>
    screen.getByTestId("review-confirm").querySelector("input")!;
  const save = () => screen.getByTestId("wizard-save");

  beforeEach(() => noop.mutate.mockClear());

  it("لا يُنشأ الحساب ما لم يُقرّ بالمراجعة", async () => {
    await toReview();

    await userEvent.click(save());

    expect(noop.mutate).not.toHaveBeenCalled();
    // ولا تُردّ الضغطة صامتة: الزرّ حيٌّ، فعليه أن يقول لماذا لم يُنشئ.
    expect(screen.getByTestId("review-confirm")).toHaveTextContent(
      "admin.confirmRequired",
    );
  });

  it("وبعد الإقرار يُنشأ", async () => {
    await toReview();

    await userEvent.click(ack());
    await userEvent.click(save());

    await waitFor(() => expect(noop.mutate).toHaveBeenCalled());
  });

  /**
   * الإقرار ببياناتٍ بعينها لا بالاستمارة: من رجع فعدّل لم يُقرّ بما صارت
   * إليه. ولو بقي الصندوق مؤشَّراً لمرّ التعديل بلا مراجعة.
   */
  it("والرجوع يُسقط الإقرار", async () => {
    await toReview();
    await userEvent.click(ack());
    expect(ack()).toBeChecked();

    await userEvent.click(screen.getByTestId("wizard-back"));
    await next();

    expect(currentStep()).toBe("step-review");
    expect(ack()).not.toBeChecked();
  });
});


/**
 * التوثيق سؤالٌ عن الحساب كلّه، لا عن بيانةٍ فيه.
 *
 * ولذلك هو في الخطوة الشخصية مع كلمة المرور: الخطوة الثالثة «جامعية» عند
 * الطالب والأستاذ، ولا وجود لها أصلاً عند الإداريّ — فلو سكن فيها لسقط عن
 * دورٍ من ثلاثة.
 */
describe("توثيق الحساب", () => {
  const radios = () => [
    ...document.querySelectorAll<HTMLInputElement>('input[name="isVerified"]'),
  ];

  it("يُسأل عنه في الخطوة الشخصية، والأصل ألّا يكون موثّقاً", () => {
    open({ lockedRole: "student" });
    const [yes, no] = radios();

    expect(currentStep()).toBe("step-personal");
    expect(no).toBeChecked();
    expect(yes).not.toBeChecked();
  });

  /**
   * ولا يكفي أن يُسأل: الخطوة الأخيرة تَعِد بأنها تعرض ما سيُنشأ. فلو اختار
   * «موثّق» ثم راجع فلم يجد للتوثيق ذكراً، أقرّ بما لا يعلم.
   */
  /** الطريق إلى المراجعة بدورٍ إداريّ: كلمة مرورٍ ثم اسم مستخدم. */
  const reachReview = async () => {
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await next();
    await userEvent.type(
      screen.getByPlaceholderText("admin.usernamePlaceholder"),
      "someadmin",
    );
    await next();
    expect(currentStep()).toBe("step-review");
  };

  it("وما يُختار يظهر في المراجعة شارةً", async () => {
    open({ lockedRole: "admin" });
    await userEvent.click(radios()[0]!);

    await reachReview();

    expect(screen.getByText("admin.verified")).toBeInTheDocument();
    expect(screen.queryByText("admin.unverified")).toBeNull();
  });

  it("وغير الموثّق يظهر كذلك — لا فراغاً يُقرأ سهواً", async () => {
    open({ lockedRole: "admin" });

    await reachReview();

    expect(screen.getByText("admin.unverified")).toBeInTheDocument();
    expect(screen.queryByText("admin.verified")).toBeNull();
  });
});

/**
 * المراجعة تسأل «هل هذا صحيح؟» عن حسابٍ لم يُخلق بعد. وقائمةٌ مسطّحة أوّلها
 * «نوع الصلاحية» تسأل عن **حقول**؛ أمّا رأس البطاقة — صورةٌ واسمٌ ودور —
 * فيسأل عن **شخص**، وهو ما يُراجَع فعلاً.
 */
describe("رأس بطاقة المراجعة", () => {
  it("يعرض الاسم والدور قبل التفاصيل", async () => {
    open({ lockedRole: "admin" });
    const first = document.querySelector<HTMLInputElement>(
      'input[name="firstName"]',
    )!;
    await userEvent.type(first, "سارة");

    await userEvent.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await next();
    await userEvent.type(
      screen.getByPlaceholderText("admin.usernamePlaceholder"),
      "someadmin",
    );
    await next();

    expect(currentStep()).toBe("step-review");
    const identity = screen.getByTestId("review-identity");
    expect(identity).toHaveTextContent("سارة");
    expect(identity).toHaveTextContent("role.admin");
    // والصورة معهما — هي المرفوعة، أو البديل المرسوم حين لا صورة.
    expect(identity.querySelector("img, svg")).not.toBeNull();
  });

  /**
   * القوائم لم تعد `<select>` أصلية بل مكوّناً مخصّصاً مربوطاً عبر
   * `Controller`. والربط إمّا أن يصل القيمة إلى الاستمارة أو يبدو واصلاً:
   * تُضاء الرقاقة في الشاشة والحقل في الاستمارة فارغ — فيمنع التحقّقُ
   * التقدّم بلا سببٍ ظاهر، أو يُرسَل الطلب ناقصاً.
   *
   * فيؤكّد هذا الاختبار السلسلة: اختيارٌ بالنقر ⇒ تجاوزُ التحقّق ⇒ ظهورُ
   * المختار في المراجعة.
   */
  it("واختيارٌ من قائمةٍ يصل إلى الاستمارة", async () => {
    open({ lockedRole: "student" });

    await userEvent.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await next();
    expect(currentStep()).toBe("step-academic");

    const reg = document.querySelector<HTMLInputElement>(
      'input[name="registrationNumber"]',
    )!;
    await userEvent.type(reg, "202039012345");

    // القوائم بترتيب الحقول: السنة أوّلاً ثم سلسلة الانتماء ثم التخصّص.
    const boxes = () => screen.getAllByRole("combobox");
    await userEvent.click(boxes()[0]!);
    await userEvent.click(screen.getByRole("option", { name: "2025/2026" }));

    const specBox = boxes()[boxes().length - 1]!;
    await userEvent.click(specBox);
    await userEvent.click(
      screen.getByRole("option", { name: "علم النفس العيادي" }),
    );

    await next();

    expect(currentStep()).toBe("step-review");
    const review = screen.getByRole("dialog");
    expect(review).toHaveTextContent("2025/2026");
    expect(review).toHaveTextContent("علم النفس العيادي");
  });
});
