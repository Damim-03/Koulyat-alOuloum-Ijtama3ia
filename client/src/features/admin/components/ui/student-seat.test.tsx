/**
 * مقعد الإسناد.
 *
 * كان الإسناد صندوق بحثٍ يُضيف إلى قائمة، فصار مقعداً مرقَّماً يُملأ برقم
 * التسجيل. وما يستحقّ اختباراً ليس شكل المقعد، بل أربعة أشياء لو انقلبت
 * لبدا كلُّ شيء يعمل:
 *
 *   ١. أن يُبلَّغ الأب بالطالب حين يُطابق الرقم، فبذلك وحده يُرسَل؛
 *   ٢. أن يُبلَّغ بالفراغ حين يُمسح الرقم، وإلّا بقي مسنَداً بعد مسحه؛
 *   ٣. أن يُمنع الرقم المكرَّر قبل أن يُطلب من الخادم؛
 *   ٤. أن يُقصَر البحث على التخصّص وعلى من لا موضوع له — وهو شرطٌ لا يظهر
 *      في الشاشة، فلا يكشفه إلا اختبارُ ما يُرسَل.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

type Params = Record<string, unknown> | undefined;
const calls: { params: Params; enabled: boolean }[] = [];

const STUDENT = {
  id: "s-1",
  registrationNumber: "20210034561",
  user: { firstName: "أمينة", lastName: "بن عمارة" },
  specializationId: "spec-7",
  specialization: { id: "spec-7", name: "علم النفس العيادي" },
};

/** طالبٌ حرٌّ من تخصّصٍ آخر — الخادم يقبل إسناده، فلا يحجبه المقعد. */
const OTHER_SPEC = {
  id: "s-2",
  registrationNumber: "202039435870",
  user: { firstName: "ثثثث", lastName: "ثثثث" },
  specializationId: "spec-9",
  specialization: { id: "spec-9", name: "علم المجانين" },
};

/** طالبٌ مرتبطٌ بمشروع: لا تُرجعه قائمة «من لا موضوع له»، ويجده المِجسّ. */
const ENGAGED = {
  id: "s-3",
  registrationNumber: "20190000001",
  user: { firstName: "خالد", lastName: "مرابط" },
  specializationId: "spec-7",
  specialization: { id: "spec-7", name: "علم النفس العيادي" },
};

const FREE = [STUDENT, OTHER_SPEC];
const ALL = [...FREE, ENGAGED];

vi.mock("../../hooks/admin-hook", () => ({
  useStudents: (params: Params, enabled = true) => {
    calls.push({ params, enabled });
    if (!enabled) return { data: undefined, isFetching: false };
    const p = params as Record<string, unknown>;

    // المِجسّ: بحثٌ بالرقم وحده، بلا قيد «من لا موضوع له».
    if (p?.registrationNumber) {
      const n = String(p.registrationNumber).trim();
      return {
        data: { items: ALL.filter((x) => x.registrationNumber.includes(n)) },
        isFetching: false,
      };
    }

    const term = String(p?.quickSearch ?? "").trim();
    if (!term) return { data: undefined, isFetching: false };
    // الخادم يبحث بالجزء: اسمٌ ناقص أو أوّل الرقم يُرجعان الطالب. والمقعد
    // وحده هو من يشترط المطابقة التامّة، وهذا ما تفحصه الاختبارات أدناه.
    // المحاكاة تحترم `specializationId` كما يفعل الخادم — وإلّا لما كشف
    // الاختبارُ عودةَ التصفية بالتخصّص.
    const scope = p?.specializationId
      ? FREE.filter((x) => x.specializationId === p.specializationId)
      : FREE;
    const hit = scope.filter(
      (x) =>
        x.registrationNumber.includes(term) ||
        `${x.user.firstName} ${x.user.lastName}`.includes(term),
    );
    return { data: { items: hit }, isFetching: false };
  },
}));

vi.mock("../../../../hooks/use-debounced-value", () => ({
  useDebouncedValue: (v: string) => v,
}));

const { StudentSeat } = await import("./student-seat");

function setup(over: Partial<Parameters<typeof StudentSeat>[0]> = {}) {
  const onChange = vi.fn();
  const onResolve = vi.fn();
  const props = {
    seat: 1,
    index: 0,
    value: "",
    onChange,
    onResolve,
    taken: [] as string[],
    specializationId: "spec-7",
    isLeader: false,
    onMakeLeader: vi.fn(),
    ...over,
  };
  const view = render(<StudentSeat {...props} />);
  return { ...view, onChange, onResolve, props };
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("مقعد الإسناد", () => {
  it("لا يسأل الخادم والمقعد فارغ", () => {
    setup();
    expect(calls.every((c) => c.enabled === false)).toBe(true);
  });

  it("رقمٌ مطابق ⇒ يُعرض الطالب ويُبلَّغ الأب به", () => {
    const { onResolve } = setup({ value: STUDENT.registrationNumber });

    expect(screen.getByText("أمينة بن عمارة")).toBeInTheDocument();
    expect(onResolve).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: "s-1", reg: STUDENT.registrationNumber }),
    );
  });

  /**
   * `search` تبحث في الاسم وحده في الخادم؛ ورقمُ التسجيل لا يُطابَق إلا
   * عبر `quickSearch`. فلو أُرسل في `search` لما وجد المقعدُ أحداً أبداً
   * — وهذا ما يثبّته هذا الاختبار.
   */
  it("يسأل بـquickSearch، ومقصورٌ على من لا موضوع له", () => {
    setup({ value: STUDENT.registrationNumber });

    const asked = calls.find((c) => c.enabled);
    expect(asked?.params).toMatchObject({
      quickSearch: STUDENT.registrationNumber,
      unassigned: "true",
    });
    // التخصّص لا يُصفّى به: الخادم لا يفحصه، فلا يكون المقعد أشدّ منه.
    expect(asked?.params).not.toHaveProperty("specializationId");
  });

  /**
   * هذا هو العطب الذي أبلغ عنه المستعمل: رقمٌ صحيحٌ لطالبٍ حرّ، يُردّ بـ«لا
   * طالب بهذا الرقم» لأنّ تخصّصه غير تخصّص الموضوع — وإسنادُه يقبله الخادم.
   */
  it("وطالبٌ حرٌّ من تخصّصٍ آخر يُقبل، ويُنبَّه على الاختلاف", () => {
    const { onResolve } = setup({ value: OTHER_SPEC.registrationNumber });

    expect(screen.getByText("ثثثث ثثثث")).toBeInTheDocument();
    expect(onResolve).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: "s-2" }),
    );
    expect(
      screen.getByText(/admin\.seatSpecMismatch/),
    ).toBeInTheDocument();
  });

  it("ولا تنبيه حين يتّفق التخصّصان", () => {
    setup({ value: STUDENT.registrationNumber });
    expect(screen.queryByText(/admin\.seatSpecMismatch/)).toBeNull();
  });

  /** ولمّا لا يُوجد، يُقال السبب لا العَرَض. */
  it("ومن له مشروعٌ يُقال إنه مرتبط، لا إنه غير موجود", () => {
    setup({ value: ENGAGED.registrationNumber });

    expect(
      screen.getByText(/admin\.studentAlreadyEngaged/),
    ).toBeInTheDocument();
    expect(screen.queryByText("admin.noStudentWithNumber")).toBeNull();
  });

  it("ورقمٌ لا وجود له يُقال إنه لا وجود له", () => {
    setup({ value: "00000000000" });

    expect(screen.getByText("admin.noStudentWithNumber")).toBeInTheDocument();
  });

  it("مقعدٌ فارغ ⇒ يُبلَّغ الأب بالفراغ، فلا يبقى مسنَداً بعد مسحه", () => {
    const { onResolve } = setup({ value: "" });
    expect(onResolve).toHaveBeenCalledWith(0, null);
  });

  it("رقمٌ في مقعدٍ آخر ⇒ يُرفض قبل أن يُسأل الخادم", () => {
    const { onResolve } = setup({
      value: STUDENT.registrationNumber,
      taken: [STUDENT.registrationNumber],
    });

    expect(screen.getByText("admin.duplicateSeat")).toBeInTheDocument();
    expect(calls.every((c) => c.enabled === false)).toBe(true);
    expect(onResolve).toHaveBeenCalledWith(0, null);
  });

  it("نصٌّ لا يطابق رقماً ⇒ يُعرض ما وجده الخادم لينقره المستعمل", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "أمينة" });

    expect(screen.getByText("admin.noStudentWithNumber")).toBeInTheDocument();
    await user.click(screen.getByText(STUDENT.registrationNumber));
    expect(onChange).toHaveBeenCalledWith(0, STUDENT.registrationNumber);
  });

  /**
   * أوّلُ الرقم يُرجعه الخادم، والمقعد لا يقبله.
   *
   * لولا هذا لأسند المقعدُ طالباً بمجرّد أن تُكتب أربعة أرقامٍ تُصادف
   * بدايةَ رقمه — ولربما كان أوّلَ من ردّه الخادم لا من قُصِد.
   */
  it("أوّلُ الرقم لا يُعدّ مطابقة", () => {
    const { onResolve } = setup({ value: "2021" });

    expect(screen.getByText("admin.noStudentWithNumber")).toBeInTheDocument();
    expect(onResolve).toHaveBeenCalledWith(0, null);
  });

  it("زرّ المسح يُفرغ المقعد", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: STUDENT.registrationNumber });

    await user.click(screen.getByLabelText("admin.clear"));
    expect(onChange).toHaveBeenCalledWith(0, "");
  });
});
