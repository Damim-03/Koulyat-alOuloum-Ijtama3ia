/**
 * طلب المجموعة — ثلاث خطوات.
 *
 * كانت شاشةً واحدة: بطاقة المرسِل، ثم حقل بحث، ثم الأولوية، ثم ملاحظةٌ
 * أسفل الكلّ. فيمرّ الطالب على الشروط والملاحظة مرورَ العين ويضغط «إرسال»
 * وهو لا يعرف بمَ التزم.
 *
 * وما يستحقّ اختباراً هنا ليس شكل الخطوات، بل ثلاثة أشياء لو انقلبت لبدا
 * كلّ شيءٍ يعمل: أن يُرسَل الطلب من خطوة الشروط، وأن يضيع عضوٌ أُضيف عند
 * الرجوع، وأن تُرسَل أرقام الزملاء ناقصةً.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));

const createReq = {
  mutate: vi.fn((_v: unknown, o?: { onSuccess?: () => void }) =>
    o?.onSuccess?.(),
  ),
  isPending: false,
};

let lookupResult: Record<string, unknown> = {
  id: "s-9",
  registrationNumber: "202039012346",
  user: { firstName: "يوسف", lastName: "حمادي" },
  specialization: { name: "علم النفس العيادي" },
};
const sameSpec = { ...lookupResult };
const otherSpec = {
  ...lookupResult,
  specialization: { name: "علم النفس المدرسي" },
};

vi.mock("../hooks/Student-hook", () => ({
  useCreateGroupRequest: () => createReq,
  useStudentLookup: (term: string) => ({
    data: term ? lookupResult : null,
    isFetching: false,
    isSuccess: !!term,
    isError: false,
  }),
}));
// بلا تأخير في الاختبار: الرقم يستقرّ فور كتابته.
vi.mock("../../../hooks/use-debounced-value", () => ({
  useDebouncedValue: (v: string) => v,
}));

const { GroupRequestDialog } = await import("./group-request-dialog");

const topic = {
  id: "t-1",
  title: "موضوع",
  description: "وصف",
  requirements: ["أن يكون الطالب في السنة الثانية ماستر"],
  objectives: [],
  status: "open",
  maxStudents: 3,
  professor: { id: "p-1", user: { firstName: "خالد", lastName: "مرابط" } },
  specialization: { id: "s-1", name: "علم النفس العيادي" },
  createdAt: new Date().toISOString(),
};

const open = () =>
  render(
    <GroupRequestDialog
      open
      onClose={() => {}}
      topic={topic as never}
    />,
  );

const current = () =>
  screen
    .getByTestId("stepper")
    .querySelector('[aria-current="step"]')
    ?.getAttribute("data-testid");

const next = () => userEvent.click(screen.getByTestId("request-next"));

/** يكتب رقم زميلٍ في مقعدٍ بعينه — لا زرّ إضافة: المقعد هو الحقل. */
const fillSeat = async (seat: number, reg: string) => {
  const box = within(screen.getByTestId(`seat-${seat}`)).getByRole("textbox");
  await userEvent.type(box, reg);
};

describe("معالج طلب المجموعة", () => {
  beforeEach(() => {
    createReq.mutate.mockClear();
    lookupResult = sameSpec;
  });

  it("يبدأ بالشروط، ويعرض ما كتبه الأستاذ", () => {
    open();

    expect(current()).toBe("step-terms");
    expect(
      screen.getByText("أن يكون الطالب في السنة الثانية ماستر"),
    ).toBeInTheDocument();
    // ولا زرّ إرسالٍ قبل الأخيرة.
    expect(screen.queryByTestId("request-submit")).not.toBeInTheDocument();
  });

  it("والخطوة الثانية تعرض المشرف وحقل الإضافة", async () => {
    open();

    await next();

    expect(current()).toBe("step-members");
    expect(screen.getByText("خالد مرابط")).toBeInTheDocument();
    // ثلاثة طلبة ⇒ مقعد المرسِل ومقعدان للزميلين.
    expect(within(screen.getByTestId("seats")).getAllByRole("listitem"))
      .toHaveLength(3);
    expect(screen.getByTestId("seat-2")).toBeInTheDocument();
    expect(screen.getByTestId("seat-3")).toBeInTheDocument();
  });

  /**
   * الرجوع لمراجعة الشروط لا يُفرّغ المجموعة: معالجٌ يمحو ما أُدخل كلّما
   * رجعتَ خطوةً يجعل المراجعة عقوبة.
   */
  it("والرجوع يُبقي من أُضيف", async () => {
    open();
    await next();
    await fillSeat(2, "202039012346");

    await userEvent.click(screen.getByTestId("request-back"));
    await next();

    expect(screen.getByText("يوسف حمادي")).toBeInTheDocument();
  });

  it("والمراجعة تعرض المرسِل ومن أُضيف، والإرسال يحمل أرقامهم", async () => {
    open();
    await next();
    await fillSeat(2, "202039012346");
    await next();

    expect(current()).toBe("step-review");
    const list = within(screen.getByTestId("review-members"));
    expect(list.getByText("stu.youAreLeader")).toBeInTheDocument();
    expect(list.getByText("يوسف حمادي")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("request-submit"));

    expect(createReq.mutate).toHaveBeenCalledTimes(1);
    const payload = createReq.mutate.mock.calls[0]![0] as {
      topicId: string;
      memberRegistrationNumbers: string[];
    };
    expect(payload.topicId).toBe("t-1");
    expect(payload.memberRegistrationNumbers).toEqual(["202039012346"]);
  });

  /**
   * الموضوع مربوطٌ بتخصّص، فزميلٌ من تخصّصٍ آخر قد يُردّ طلبُه. والتنبيه
   * **لا يمنع**: الإدارة هي من تبتّ — لكن لا يُترك القائد يُرسل وهو لا يرى.
   */
  it("وتخصّصٌ مختلف يُنبَّه عليه ولا يُمنع", async () => {
    lookupResult = otherSpec;
    open();
    await next();
    await fillSeat(2, "202039012346");

    expect(screen.getByText(/stu\.specMismatch/)).toBeInTheDocument();
    // ومع ذلك يتقدّم، ويصل الرقم كما هو.
    await next();
    expect(current()).toBe("step-review");
  });

  it("وتخصّصٌ مطابقٌ لا تنبيه فيه", async () => {
    open();
    await next();
    await fillSeat(2, "202039012346");

    expect(screen.queryByText(/stu\.specMismatch/)).not.toBeInTheDocument();
  });
});
