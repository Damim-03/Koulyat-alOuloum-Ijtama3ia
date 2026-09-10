/**
 * اختبارات وحدة لطبقة قراءة حكم الخادم في الواجهة.
 *
 * هذه الوحدة هي ما يمنع الواجهة من استنتاج القواعد بنفسها — وقد كانت تستنتجها
 * (`deletable = status !== "full"`) فتعرض عمليات مستحيلة. فالمطلوب إثبات
 * شيئين: أنها تقرأ ما يرسله الخادم، وأنها **لا تُخمّن** حين لا يرسل شيئاً.
 */
import { describe, it, expect } from "vitest";
import { actionsOf, can, blockReason, filterByAction } from "./topic-actions";
import type { AdminTopic, TopicActions } from "../../../types/admin";

const actions = (over: Partial<TopicActions> = {}): TopicActions => ({
  canApprove: false,
  canReject: false,
  canPublish: false,
  canUnpublish: false,
  canArchive: false,
  canUnarchive: false,
  canDelete: false,
  canAssignGroup: false,
  blockedReasons: {},
  blockedCodes: {},
  ...over,
});

const topic = (over: Partial<TopicActions> = {}) =>
  ({ actions: actions(over) }) as Pick<AdminTopic, "actions">;

/** مترجم صوريّ يحاكي i18next: يستعمل الترجمة إن وُجدت، وإلا الاحتياط. */
const t = ((key: string, opts?: Record<string, unknown>) => {
  const dict: Record<string, string> = {
    "topicBlocked.hasGroup": "له مجموعة",
    "topicBlocked.teamWaiting": "فريق من {{count}} ينتظر",
  };
  const hit = dict[key];
  if (!hit) return (opts?.defaultValue as string) ?? key;
  return hit.replace("{{count}}", String(opts?.count ?? ""));
}) as never;

describe("can", () => {
  it("يقرأ العلم كما أرسله الخادم", () => {
    expect(can(topic({ canDelete: true }), "delete")).toBe(true);
    expect(can(topic({ canDelete: false }), "delete")).toBe(false);
  });

  /**
   * الأهمّ في هذا الملفّ.
   *
   * موضوع بلا `actions` يعني نقطة نهاية لم تُرسل الحكم. الخيار الآمن أن
   * يُمنع كل شيء — فزرٌّ مفقود مصيبته أهون من زرٍّ يَعِد بما لا ينجح. ولو
   * اشتقّت الواجهة هنا من `status` لعادت العلّة نفسها من الباب الخلفي.
   */
  it("موضوع بلا actions ⇒ يُمنع كل شيء، ولا يُخمَّن من الحالة", () => {
    const bare = { status: "approved" } as unknown as Pick<
      AdminTopic,
      "actions"
    >;
    for (const a of [
      "approve",
      "reject",
      "publish",
      "unpublish",
      "archive",
      "unarchive",
      "delete",
      "assignGroup",
    ] as const) {
      expect(can(bare, a)).toBe(false);
    }
    expect(can(null, "delete")).toBe(false);
    expect(can(undefined, "delete")).toBe(false);
  });
});

describe("blockReason", () => {
  it("يترجم الرمز بلغة المستخدم", () => {
    const tp = topic({
      blockedReasons: { delete: "نصّ الخادم العربي" },
      blockedCodes: { delete: { code: "hasGroup" } },
    });
    expect(blockReason(tp, "delete", t)).toBe("له مجموعة");
  });

  it("يمرّر المعاملات إلى الترجمة", () => {
    const tp = topic({
      blockedReasons: { archive: "عربي" },
      blockedCodes: { archive: { code: "teamWaiting", params: { count: 3 } } },
    });
    expect(blockReason(tp, "archive", t)).toBe("فريق من 3 ينتظر");
  });

  it("يعود إلى نصّ الخادم حين لا ترجمة للرمز", () => {
    const tp = topic({
      blockedReasons: { publish: "سبب من الخادم" },
      blockedCodes: { publish: { code: "notApproved" } },
    });
    expect(blockReason(tp, "publish", t)).toBe("سبب من الخادم");
  });

  it("إجراء مسموح ⇒ لا سبب", () => {
    expect(blockReason(topic({ canDelete: true }), "delete", t)).toBeUndefined();
  });
});

describe("filterByAction", () => {
  it("يُبقي ما يجوز عليه الإجراء وحده", () => {
    const list = [
      { id: "a", ...topic({ canDelete: true }) },
      { id: "b", ...topic({ canDelete: false }) },
      { id: "c", ...topic({ canDelete: true }) },
    ];
    expect(filterByAction(list, "delete").map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("قائمة فارغة تبقى فارغة", () => {
    expect(filterByAction([], "delete")).toEqual([]);
  });
});

describe("actionsOf", () => {
  it("يُرجع كائناً كامل الحقول دائماً، فلا ينهار قارئه", () => {
    const a = actionsOf(null);
    expect(a.blockedReasons).toEqual({});
    expect(a.blockedCodes).toEqual({});
    expect(a.canDelete).toBe(false);
  });
});
