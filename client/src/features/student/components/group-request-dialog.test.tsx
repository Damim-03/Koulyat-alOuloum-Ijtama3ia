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

type MutateOpts = { onSuccess?: () => void; onError?: (e: unknown) => void };
const createReq = {
  mutate: vi.fn((_v: unknown, o?: MutateOpts) => o?.onSuccess?.()),
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

/** كلّ رقمٍ بُحث عنه — ليُثبَت أنّ رقم المرسِل لا يصل إلى الخادم أصلاً. */
const lookedUp: string[] = [];
/** جوابٌ لرقمٍ بعينه (`null` = لا طالب به)؛ وما سواه يأخذ `lookupResult`. */
let lookupByTerm: Record<string, Record<string, unknown> | null> = {};

vi.mock("../hooks/Student-hook", () => ({
  useCreateGroupRequest: () => createReq,
  useStudentLookup: (term: string) => {
    if (term) lookedUp.push(term);
    return {
      data: !term
        ? null
        : term in lookupByTerm
          ? lookupByTerm[term]
          : lookupResult,
      isFetching: false,
      isSuccess: !!term,
      isError: false,
    };
  },
}));
// بلا تأخير في الاختبار: الرقم يستقرّ فور كتابته.
vi.mock("../../../hooks/use-debounced-value", () => ({
  useDebouncedValue: (v: string) => v,
}));

const { GroupRequestDialog } = await import("./group-request-dialog");
const { useAuthStore } = await import("../../../store/auth.store");

/** المرسِل — الطالب المسجَّل دخوله. */
const MY_REG = "202039012345";

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

const open = (maxStudents = topic.maxStudents) =>
  render(
    <GroupRequestDialog
      open
      onClose={() => {}}
      topic={{ ...topic, maxStudents } as never}
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

/** زميلٌ ثانٍ باسمٍ آخر — ليُعرف في المراجعة من أيّ مقعدٍ جاء. */
const SECOND_REG = "202039012347";
const second = {
  ...sameSpec,
  registrationNumber: SECOND_REG,
  user: { firstName: "سارة", lastName: "بوقرة" },
};

describe("معالج طلب المجموعة", () => {
  beforeEach(() => {
    createReq.mutate.mockClear();
    lookupResult = sameSpec;
    lookupByTerm = { [SECOND_REG]: second };
    lookedUp.length = 0;
    useAuthStore.setState({
      user: { id: "u-1", role: "student", registrationNumber: MY_REG },
    });
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
    await fillSeat(3, SECOND_REG);
    await next();

    expect(current()).toBe("step-review");
    const list = within(screen.getByTestId("review-members"));
    expect(list.getByText("stu.youAreLeader")).toBeInTheDocument();
    expect(list.getByText("يوسف حمادي")).toBeInTheDocument();
    expect(list.getByText("سارة بوقرة")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("request-submit"));

    expect(createReq.mutate).toHaveBeenCalledTimes(1);
    const payload = createReq.mutate.mock.calls[0]![0] as {
      topicId: string;
      memberRegistrationNumbers: string[];
    };
    expect(payload.topicId).toBe("t-1");
    expect(payload.memberRegistrationNumbers).toEqual([
      "202039012346",
      SECOND_REG,
    ]);
  });

  /**
   * رفضُ الخادم يشرح ما يُفعل بعده، فيُقرأ في النافذة فوق زرّ الإرسال — لا في
   * تنبيهٍ عابر. ويبقى حتى يُخفى، أو يتغيّر الفريق فلا يعود الرفضُ عنه.
   */
  it("ورفضُ الخادم يظهر في النافذة بنصّه، ويُخفى، ويزول إذا تغيّر الفريق", async () => {
    const said = "أنت عضوٌ في طلبٍ قائم أرسله يوسف حمادي على موضوع «bbb».";
    const refuse = (_v: unknown, o?: MutateOpts) =>
      o?.onError?.({ isAxiosError: true, response: { status: 400, data: { message: said } } });
    createReq.mutate.mockImplementationOnce(refuse).mockImplementationOnce(refuse);

    open();
    await next();
    await fillSeat(2, "202039012346");
    await fillSeat(3, SECOND_REG);
    await next();
    expect(screen.queryByTestId("request-error")).toBeNull();

    await userEvent.click(screen.getByTestId("request-submit"));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-testid", "request-error");
    expect(within(alert).getByText(said)).toBeInTheDocument();
    expect(within(alert).getByText("stu.sendFailedTitle")).toBeInTheDocument();
    expect(current()).toBe("step-review"); // لا يُغلق ولا يُعاد إلى أوّله

    await userEvent.click(within(alert).getByRole("button", { name: "stu.dismissError" }));
    expect(screen.queryByTestId("request-error")).toBeNull();

    // يُرفض ثانيةً، ثم يُعدَّل الفريق: الرسالة كانت عن فريقٍ لم يعد.
    await userEvent.click(screen.getByTestId("request-submit"));
    expect(screen.getByTestId("request-error")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("request-back"));
    await userEvent.type(within(screen.getByTestId("seat-3")).getByRole("textbox"), "{backspace}7");
    await next();
    expect(current()).toBe("step-review");
    expect(screen.queryByTestId("request-error")).toBeNull();
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
    await fillSeat(3, SECOND_REG);

    expect(screen.getByText(/stu\.specMismatch/)).toBeInTheDocument();
    // ومع ذلك يتقدّم، ويصل الرقم كما هو.
    await next();
    expect(current()).toBe("step-review");
  });

  /**
   * المجموعة تُرسَل كاملة: كلّ مقعدٍ بزميلٍ وُجد صاحبُ رقمه. والزرّ المطفأ
   * يُرافقه سطرٌ يقول كم بقي — لا يُترك الطالب يضغط ولا يدري لماذا لا شيء.
   */
  describe("«التالي» لا يعمل حتى تكتمل المقاعد", () => {
    it("مقعدان ⇒ ممنوعٌ فارغاً، وممنوعٌ بواحد، ويعمل باثنين", async () => {
      open();
      await next();

      expect(screen.getByTestId("request-next")).toBeDisabled();
      expect(screen.getByTestId("seats-hint")).toHaveTextContent(
        'stu.fillAllSeats:{"done":0,"total":2}',
      );

      await fillSeat(2, "202039012346");
      expect(screen.getByTestId("request-next")).toBeDisabled();
      expect(screen.getByTestId("seats-hint")).toHaveTextContent(
        '"done":1,"total":2',
      );

      // ولا Enter يلتفّ عليه.
      await userEvent.type(
        within(screen.getByTestId("seat-2")).getByRole("textbox"),
        "{Enter}",
      );
      expect(current()).toBe("step-members");

      await fillSeat(3, SECOND_REG);
      expect(screen.getByTestId("request-next")).toBeEnabled();
      expect(screen.queryByTestId("seats-hint")).not.toBeInTheDocument();
    });

    it("ومقعدٌ واحد ⇒ يعمل بزميلٍ واحد", async () => {
      open(2);
      await next();

      expect(screen.getByTestId("request-next")).toBeDisabled();
      await fillSeat(2, "202039012346");
      expect(screen.getByTestId("request-next")).toBeEnabled();
    });

    it("ورقمٌ لا طالب به لا يملأ مقعداً", async () => {
      lookupByTerm = { [SECOND_REG]: null };
      open();
      await next();
      await fillSeat(2, "202039012346");
      await fillSeat(3, SECOND_REG);

      expect(screen.getByText("stu.studentNotFound")).toBeInTheDocument();
      expect(screen.getByTestId("request-next")).toBeDisabled();
    });

    it("والرقمُ نفسه في مقعدين لا يملؤهما", async () => {
      open();
      await next();
      await fillSeat(2, "202039012346");
      await fillSeat(3, "202039012346");

      expect(screen.getAllByText("stu.duplicateMember")).toHaveLength(2);
      expect(screen.getByTestId("request-next")).toBeDisabled();
    });

    it("وموضوعٌ لطالبٍ واحد ⇒ لا مقاعد، ويعمل فوراً", async () => {
      open(1);
      await next();

      expect(screen.queryByTestId("seat-2")).not.toBeInTheDocument();
      expect(screen.getByTestId("request-next")).toBeEnabled();
    });
  });

  it("وتخصّصٌ مطابقٌ لا تنبيه فيه", async () => {
    open();
    await next();
    await fillSeat(2, "202039012346");

    expect(screen.queryByText(/stu\.specMismatch/)).not.toBeInTheDocument();
  });

  /**
   * المرسِل يُضاف تلقائيًا، فرقمُه في مقعد زميلٍ خطأٌ أو محاولةٌ لملء المقعد.
   * يُكشف محلّياً مع آخر ضغطة، بلا بحثٍ ولا انتظار، ويوقف المعالج.
   */
  describe("رقم المرسِل نفسه في مقعد زميل", () => {
    it("يُكشف فوراً: الحقل أحمر، والخطأ ظاهر، ولا بحث عنه", async () => {
      open();
      await next();
      await fillSeat(2, MY_REG);

      const seat = within(screen.getByTestId("seat-2"));
      expect(seat.getByRole("alert")).toHaveTextContent("stu.selfAsMember");
      expect(seat.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
      expect(seat.getByRole("textbox").className).toContain("border-brick");
      // لا بطاقة طالب، ولم يُرسَل رقمه إلى البحث.
      expect(seat.queryByText("يوسف حمادي")).not.toBeInTheDocument();
      expect(lookedUp).not.toContain(MY_REG);
    });

    // المقعد الآخر ممتلئٌ بزميلٍ صحيح في كلّ ما يلي: فلا يمنع إلّا ما يُختبر.
    it("ويمنع «التالي» حتى يُصحَّح", async () => {
      open();
      await next();
      await fillSeat(3, SECOND_REG);
      await fillSeat(2, MY_REG);

      expect(screen.getByTestId("request-next")).toBeDisabled();
      await next();
      expect(current()).toBe("step-members");

      // وتصحيحه يُعيد الباب.
      const box = within(screen.getByTestId("seat-2")).getByRole("textbox");
      await userEvent.clear(box);
      await userEvent.type(box, "202039012346");
      expect(screen.getByTestId("request-next")).toBeEnabled();
      expect(screen.queryByTestId("seat-2-self")).not.toBeInTheDocument();
    });

    it("ويُكشف ولو كُتب بأرقامٍ عربية أو بمسافات", async () => {
      open();
      await next();
      await fillSeat(3, SECOND_REG);
      await fillSeat(2, "٢٠٢٠٣٩ ٠١٢٣٤٥");

      expect(screen.getByTestId("seat-2-self")).toBeInTheDocument();
      expect(screen.getByTestId("request-next")).toBeDisabled();
    });

    /** ما يفلت من المقارنة المحلّية — جلسةٌ بلا رقم مثلاً — يُعلّمه الخادم. */
    it("وما يُعلّمه الخادم بـisSelf يُرفض كذلك", async () => {
      useAuthStore.setState({ user: { id: "u-1", role: "student" } });
      lookupResult = { ...sameSpec, registrationNumber: MY_REG, isSelf: true };
      open();
      await next();
      await fillSeat(3, SECOND_REG);
      await fillSeat(2, MY_REG);

      expect(screen.getByTestId("seat-2-self")).toBeInTheDocument();
      expect(screen.getByTestId("request-next")).toBeDisabled();
    });
  });

  /**
   * طالبٌ واحد في مجموعةٍ واحدة: من هو في مجموعةٍ أخرى — بطلبٍ حيٍّ أو
   * بمشروعٍ قائم — يُرفض في مقعده، وتبقى بطاقتُه ليعرف القائد من كتب.
   */
  describe("زميلٌ في مجموعةٍ أخرى", () => {
    it("في طلبٍ حيٍّ لفريقٍ آخر: الحقل أحمر، وبطاقته ظاهرة، و«التالي» ممنوع", async () => {
      lookupResult = { ...sameSpec, otherGroup: "request" };
      open();
      await next();
      await fillSeat(3, SECOND_REG);
      await fillSeat(2, "202039012346");

      const seat = within(screen.getByTestId("seat-2"));
      expect(seat.getByRole("alert")).toHaveTextContent("stu.memberInOtherGroup");
      expect(seat.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
      expect(seat.getByRole("textbox").className).toContain("border-brick");
      expect(seat.getByText("يوسف حمادي")).toBeInTheDocument();

      expect(screen.getByTestId("request-next")).toBeDisabled();
      await next();
      expect(current()).toBe("step-members");
    });

    it("وله مشروع ⇒ رسالته هو", async () => {
      lookupResult = { ...sameSpec, otherGroup: "project" };
      open();
      await next();
      await fillSeat(3, SECOND_REG);
      await fillSeat(2, "202039012346");

      expect(screen.getByTestId("seat-2-busy")).toHaveTextContent(
        "stu.memberHasProject",
      );
      expect(screen.getByTestId("request-next")).toBeDisabled();
    });

    it("واستبداله بزميلٍ حرّ يُعيد الباب", async () => {
      lookupResult = { ...sameSpec, otherGroup: "request" };
      lookupByTerm = {
        ...lookupByTerm,
        "202039012399": { ...sameSpec, registrationNumber: "202039012399" },
      };
      open();
      await next();
      await fillSeat(3, SECOND_REG);
      await fillSeat(2, "202039012346");
      expect(screen.getByTestId("request-next")).toBeDisabled();

      const box = within(screen.getByTestId("seat-2")).getByRole("textbox");
      await userEvent.clear(box);
      await userEvent.type(box, "202039012399");

      expect(screen.queryByTestId("seat-2-busy")).not.toBeInTheDocument();
      expect(screen.getByTestId("request-next")).toBeEnabled();
    });
  });
});

describe("معالج طلب المجموعة: التنقّل والإغلاق", () => {
  beforeEach(() => {
    createReq.mutate.mockClear();
    lookupResult = sameSpec;
    lookupByTerm = { [SECOND_REG]: second };
    lookedUp.length = 0;
    useAuthStore.setState({
      user: { id: "u-1", role: "student", registrationNumber: MY_REG },
    });
  });

  it("رقم المرسِل بالأرقام الفارسية يُكشف كذلك", async () => {
    open();
    await next();
    await fillSeat(3, SECOND_REG);
    await fillSeat(2, "۲۰۲۰۳۹۰۱۲۳۴۵");
    expect(screen.getByTestId("seat-2-self")).toBeInTheDocument();
  });

  it("الخطوة السابقة تُفتح من شريط الخطوات؛ وEnter في مقعدٍ مكتملٍ يعني «التالي»", async () => {
    open(2);
    await next();
    expect(current()).toBe("step-members");
    await userEvent.click(within(screen.getByTestId("step-terms")).getByRole("button"));
    expect(current()).toBe("step-terms");

    await next();
    // مقعدٌ فارغ: Enter لا يتجاوزه.
    const box = within(screen.getByTestId("seat-2")).getByRole("textbox");
    await userEvent.type(box, "{Enter}");
    expect(current()).toBe("step-members");
    await userEvent.type(box, "202039012346{Enter}");
    expect(current()).toBe("step-review");
    expect(createReq.mutate).not.toHaveBeenCalled();
  });

  it("«إلغاء» يُغلق ويعيد المعالج إلى أوّله؛ وموضوعٌ آخر يُرسل بمعرّفه", async () => {
    const onClose = vi.fn();
    const view = render(<GroupRequestDialog open onClose={onClose} topic={{ ...topic, maxStudents: 1 } as never} />);
    // لطالبٍ واحد: خطوة الفريق بلا مقاعد، تُتجاوز في الحال.
    await next();
    await next();
    expect(current()).toBe("step-review");
    await userEvent.click(screen.getByRole("button", { name: "stu.cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(current()).toBe("step-terms");

    view.rerender(<GroupRequestDialog open onClose={onClose} topic={{ ...topic, id: "t-2", maxStudents: 1 } as never} />);
    await next();
    await next();
    await userEvent.click(screen.getByTestId("request-submit"));
    expect((createReq.mutate.mock.calls[0]![0] as { topicId: string }).topicId).toBe("t-2");
  });
});
