/**
 * معالج حذف موضوعٍ قام عليه مشروع.
 *
 * الخلفية ترفض حذف موضوعٍ له مجموعة، فالمعالج ليس تزييناً للتأكيد: هو
 * **الترتيب** الذي يجعل الحذف ممكناً. وأربعةُ أشياء فيه لو انقلبت لبدا كلّ
 * شيءٍ يعمل:
 *
 *   ١. أن تُحذف المجموعة بلا سبب — فيختفي مشروع طلبةٍ بلا كلمة؛
 *   ٢. أن يذهب سبب الطلبة إلى المشرف أو العكس — والسببان مستقلّان عمداً؛
 *   ٣. أن يُحذف الموضوع قبل أن تصل رسالة المشرف — فيضيع ويبقى بلا خبر؛
 *   ٤. أن تُعرض خطوةٌ لا موضوع لها (مجموعةٌ غير قائمة).
 *
 * ولذلك يسأل هذا الملفّ عن الترتيب والامتناع، لا عن الشكل.
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

type Opts = { onSuccess?: () => void; onError?: (e: unknown) => void };
const ok = () => vi.fn((_v: unknown, o?: Opts) => o?.onSuccess?.());

const dissolve = { mutate: ok(), isPending: false };
const send = { mutate: ok(), isPending: false };
const del = { mutate: ok(), isPending: false };

vi.mock("../../../hooks/admin-hook", () => ({
  useDissolveProject: () => dissolve,
  useDeleteTopic: () => del,
}));
vi.mock("../../../hooks/messages-hook", () => ({
  useSendMessage: () => send,
}));

const { TopicDeleteDialog } = await import("./topic-delete-dialog.form");

const onDeleted = vi.fn();

const members = [
  {
    id: "m-2",
    isLeader: false,
    student: {
      registrationNumber: "202039012346",
      user: { firstName: "يوسف", lastName: "حمادي" },
    },
  },
  {
    id: "m-1",
    isLeader: true,
    student: {
      registrationNumber: "202039435819",
      user: { firstName: "سارة", lastName: "بوعلام" },
    },
  },
];

const supervisor = {
  employeeNumber: "6130143398499",
  universityEmail: "k.merabet@univ-eloued.dz",
  user: { firstName: "خالد", lastName: "مرابط" },
};

const PROPS = {
  onClose: () => {},
  topicId: "t-1",
  topicTitle: "موضوع",
  groupId: "g-1" as string | null,
  members,
  supervisor,
  supervisorUserId: "pu-1" as string | null,
  onDeleted,
};

const open = (over: Record<string, unknown> = {}) =>
  render(<TopicDeleteDialog {...PROPS} {...over} />);

const current = () =>
  screen
    .getByTestId("stepper")
    .querySelector('[aria-current="step"]')
    ?.getAttribute("data-testid");

const args = (m: { mock: { calls: unknown[][] } }) => m.mock.calls[0]![0];

/** خطوةٌ واحدة ⇒ حقل سببٍ واحد فيها. */
const reason = (text: string) =>
  userEvent.type(screen.getByRole("textbox"), text);

describe("معالج حذف الموضوع", () => {
  beforeEach(() => {
    dissolve.mutate = ok();
    send.mutate = ok();
    del.mutate = ok();
    onDeleted.mockClear();
  });

  /**
   * من يُحذف يُرى قبل أن يُحذف. والمُرسِل أوّلاً لأنه صاحب الطلب، ومنه تُقرأ
   * المجموعة.
   */
  it("يبدأ بحذف المجموعة، ويعرض أعضاءها والمُرسِل في القمّة", () => {
    open();

    expect(current()).toBe("step-group");
    const rows = within(screen.getByTestId("group-members")).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("سارة بوعلام");
    expect(rows[0]).toHaveTextContent("admin.leader");
    expect(rows[1]).toHaveTextContent("يوسف حمادي");
  });

  it("ولا تُحذف المجموعة بلا سبب", async () => {
    open();

    await userEvent.click(screen.getByTestId("group-next"));

    expect(dissolve.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("admin.reasonRequired")).toBeInTheDocument();
    expect(current()).toBe("step-group");
  });

  it("ومع السبب تُحذف وينتقل إلى المشرف", async () => {
    open();

    await reason("تعذّر إتمام المشروع");
    await userEvent.click(screen.getByTestId("group-next"));

    expect(args(dissolve.mutate)).toEqual({
      groupId: "g-1",
      reason: "تعذّر إتمام المشروع",
    });
    expect(current()).toBe("step-supervisor");
    expect(screen.getByTestId("supervisor-card")).toHaveTextContent(
      "k.merabet@univ-eloued.dz",
    );
  });

  it("وخطوة المشرف لا تُرسل شيئاً بلا سبب", async () => {
    open({ groupId: null });

    await userEvent.click(screen.getByTestId("supervisor-next"));

    expect(send.mutate).not.toHaveBeenCalled();
    expect(current()).toBe("step-supervisor");
  });

  /**
   * السببان مستقلّان: ما يصل الطلبة غير ما يصل المشرف. ولو اختلطا لوصل كلَّ
   * طرفٍ خطابٌ لم يُكتب له.
   */
  it("وتصل رسالة المشرف بسببه هو وحده", async () => {
    open();

    await reason("سبب الطلبة");
    await userEvent.click(screen.getByTestId("group-next"));
    await reason("سبب المشرف");
    await userEvent.click(screen.getByTestId("supervisor-next"));

    const payload = args(send.mutate) as {
      recipientIds: string[];
      body: string;
    };
    expect(payload.recipientIds).toEqual(["pu-1"]);
    expect(payload.body).toBe("سبب المشرف");
    expect(current()).toBe("step-review");
  });

  it("والمراجعة تعرض ما وقع، والتأكيد يحذف الموضوع", async () => {
    open();

    await reason("سبب الطلبة");
    await userEvent.click(screen.getByTestId("group-next"));
    await reason("سبب المشرف");
    await userEvent.click(screen.getByTestId("supervisor-next"));

    const review = screen.getByRole("dialog");
    expect(review).toHaveTextContent("سبب الطلبة");
    expect(review).toHaveTextContent("سبب المشرف");
    expect(review).toHaveTextContent("سارة بوعلام");

    expect(del.mutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("confirm-delete"));

    expect(args(del.mutate)).toBe("t-1");
    expect(onDeleted).toHaveBeenCalled();
  });

  /**
   * ما تفعله الصفحة بعد الفسخ — وهو ما لم يكن يُحاكى هنا.
   *
   * `useDissolveProject` يُبطِل ذاكرة الموضوع، فتُعيد الصفحةُ جلبه وتُمرّر
   * `groupId: null` و`members: []`. وكان شكل المعالج يُحسب في كل رسمة، فتسقط
   * خطوة المجموعة وينزلق الفهرس ١ من «المشرف» إلى «المراجعة»: تُقفَز خطوة
   * المشرف، ويُحذف الموضوع دون أن يُبلَّغ أستاذه.
   */
  it("وإعادة جلب الصفحة بعد الفسخ لا تُقفِز خطوة المشرف", async () => {
    const { rerender } = open();

    await reason("سبب الطلبة");
    await userEvent.click(screen.getByTestId("group-next"));
    expect(current()).toBe("step-supervisor");

    rerender(<TopicDeleteDialog {...PROPS} groupId={null} members={[]} />);

    expect(current()).toBe("step-supervisor");
    expect(screen.getByTestId("supervisor-next")).toBeInTheDocument();
    expect(send.mutate).not.toHaveBeenCalled();
  });

  /** والمراجعة سجلٌّ لمن حُذفوا، لا لمن بقي في الصفحة بعد الفسخ. */
  it("وتبقى المراجعة تسمّي الأعضاء وإن عادت الصفحة بلا أعضاء", async () => {
    const { rerender } = open();

    await reason("سبب الطلبة");
    await userEvent.click(screen.getByTestId("group-next"));
    rerender(<TopicDeleteDialog {...PROPS} groupId={null} members={[]} />);

    await reason("سبب المشرف");
    await userEvent.click(screen.getByTestId("supervisor-next"));

    expect(current()).toBe("step-review");
    expect(screen.getByRole("dialog")).toHaveTextContent("سارة بوعلام");
  });

  /**
   * ورفض الحذف مشروع: تسليماتٌ أو مناقشةٌ مبرمجة. فيُعرض نصّ الخادم كما هو،
   * ولا يبلغ المعالج خطوة المشرف — فلا تُرسَل رسالةٌ عن حذفٍ لم يقع.
   */
  it("ورفض الخادم يُعرض كما هو، ولا رسالة ولا تقدّم", async () => {
    dissolve.mutate = vi.fn((_v: unknown, o?: Opts) =>
      o?.onError?.({
        response: { data: { message: "عليه تسليماتٌ من الطلبة" } },
      }),
    );
    open();

    await reason("سبب");
    await userEvent.click(screen.getByTestId("group-next"));

    expect(send.mutate).not.toHaveBeenCalled();
    expect(current()).toBe("step-group");
    expect(screen.getByText("عليه تسليماتٌ من الطلبة")).toBeInTheDocument();
  });

  it("وبلا مجموعةٍ تسقط خطوتها", () => {
    open({ groupId: null });

    expect(screen.queryByTestId("step-group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("group-next")).not.toBeInTheDocument();
    expect(current()).toBe("step-supervisor");
  });
});
