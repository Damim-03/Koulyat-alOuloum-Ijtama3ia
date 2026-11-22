/**
 * اختبارات وحدة لقلب النظام — بلا قاعدة بيانات إطلاقاً.
 *
 * `projectTopicStatus` و`decisionOf` و`topicActions` دوالّ صرفة: مدخلات
 * ومخرجات، بلا حالة ولا شبكة ولا قرص. لذلك تُختبَر بالكامل — كل تركيبة
 * ممكنة، لا عيّنة منها — في أجزاء من الثانية.
 *
 * وهذا ما يجعلها الطبقة الأرخص والأثمن معاً: العطل الأصلي في هذا المشروع كان
 * في هذا المنطق بالذات، ولو وُجدت هذه الاختبارات لما احتاج اكتشافه قاعدة
 * بيانات ولا خادماً يعمل.
 */
import {
  decisionOf,
  occupancyFromRelations,
  projectTopicStatus,
  topicActions,
  type TopicDecision,
} from "./topic-status";
import type { TopicStatus } from "../../generated/prisma";
import { tr } from "../i18n";

const ALL_STATUSES: TopicStatus[] = [
  "pending",
  "approved",
  "rejected",
  "open",
  "full",
  "archived",
];

/** إشغال محايد، تُعدَّل منه كل حالة. */
const free = {
  hasGroup: false,
  pendingRequestId: null,
  pendingRequestMemberCount: 0,
  acceptedRequestId: null,
};
const waiting = { ...free, pendingRequestId: "r1", pendingRequestMemberCount: 3 };
const taken = { ...free, hasGroup: true, acceptedRequestId: "r2" };

describe("decisionOf", () => {
  it.each([
    ["pending", "pending"],
    ["rejected", "rejected"],
    ["archived", "archived"],
  ] as const)("%s قرارٌ بذاته", (status, expected) => {
    expect(decisionOf(status)).toBe(expected);
  });

  it.each(["approved", "open", "full"] as const)(
    "%s كلها تعني القرار نفسه: approved",
    (status) => {
      expect(decisionOf(status)).toBe("approved");
    },
  );

  it("تغطّي كل قيم enum بلا استثناء", () => {
    for (const s of ALL_STATUSES) {
      expect(["pending", "approved", "rejected", "archived"]).toContain(
        decisionOf(s),
      );
    }
  });
});

describe("projectTopicStatus", () => {
  it("القرار غير approved يمرّ كما هو مهما كان الإشغال", () => {
    for (const decision of ["pending", "rejected", "archived"] as TopicDecision[]) {
      for (const publishedAt of [null, new Date()]) {
        for (const hasGroup of [false, true]) {
          expect(projectTopicStatus({ decision, publishedAt, hasGroup })).toBe(
            decision,
          );
        }
      }
    }
  });

  it("المجموعة تغلب النشر: full", () => {
    expect(
      projectTopicStatus({
        decision: "approved",
        publishedAt: new Date(),
        hasGroup: true,
      }),
    ).toBe("full");
  });

  it("منشور بلا مجموعة ⇒ open", () => {
    expect(
      projectTopicStatus({
        decision: "approved",
        publishedAt: new Date(),
        hasGroup: false,
      }),
    ).toBe("open");
  });

  it("معتمد غير منشور بلا مجموعة ⇒ approved", () => {
    expect(
      projectTopicStatus({
        decision: "approved",
        publishedAt: null,
        hasGroup: false,
      }),
    ).toBe("approved");
  });

  /**
   * هذا هو العطل الأصلي في سطر واحد: كان `full` يُكتب فوق `open` فيمحو
   * «هل نُشر؟»، فلا يعرف الفسخ إلى أين يعيد الموضوع. `publishedAt` ينجو من
   * الاكتمال، فالذهاب والإياب يعودان بنا إلى نفس النقطة بالضبط.
   */
  it.each([
    ["منشور", new Date(), "open"],
    ["غير منشور", null, "approved"],
  ] as const)(
    "موضوع %s يصير full ثم يعود إلى %s بعد الفسخ",
    (_label, publishedAt, expected) => {
      const occupied = projectTopicStatus({
        decision: "approved",
        publishedAt,
        hasGroup: true,
      });
      expect(occupied).toBe("full");

      const released = projectTopicStatus({
        decision: "approved",
        publishedAt,
        hasGroup: false,
      });
      expect(released).toBe(expected);
    },
  );

  it("الدالّة صرفة: نفس المدخلات تعطي نفس المخرجات دائماً", () => {
    const input = {
      decision: "approved" as TopicDecision,
      publishedAt: new Date(),
      hasGroup: false,
    };
    expect(projectTopicStatus(input)).toBe(projectTopicStatus(input));
  });
});

describe("topicActions", () => {
  it("لا يُعتمد إلا قيد الانتظار أو المرفوض", () => {
    expect(topicActions({ status: "pending" }, free).canApprove).toBe(true);
    expect(topicActions({ status: "rejected" }, free).canApprove).toBe(true);
    for (const s of ["approved", "open", "full", "archived"] as TopicStatus[]) {
      expect(topicActions({ status: s }, free).canApprove).toBe(false);
    }
  });

  it("لا يُنشَر إلا المعتمَد، وبشرط ألّا يكون محجوزاً", () => {
    expect(topicActions({ status: "approved" }, free).canPublish).toBe(true);
    expect(topicActions({ status: "approved" }, waiting).canPublish).toBe(false);
    expect(topicActions({ status: "approved" }, taken).canPublish).toBe(false);
    expect(topicActions({ status: "open" }, free).canPublish).toBe(false);
  });

  /** العَرَض الثاني الأصلي: الواجهة كانت تقول `status !== "full"`. */
  it("الحذف يسأل عن الإشغال لا عن الحالة", () => {
    // مؤرشف وله مجموعة — الحالة ليست full، والحذف ممنوع رغم ذلك.
    expect(topicActions({ status: "archived" }, taken).canDelete).toBe(false);
    // ومؤرشف بلا مجموعة — الحذف جائز.
    expect(topicActions({ status: "archived" }, free).canDelete).toBe(true);
    // وفريق ينتظر يمنع الحذف أيضاً، وإلا مُحي طلبه بلا خبر.
    expect(topicActions({ status: "open" }, waiting).canDelete).toBe(false);
  });

  it("الأرشفة تُمنع بفريق منتظر، لا بوجود مجموعة", () => {
    expect(topicActions({ status: "full" }, taken).canArchive).toBe(true);
    expect(topicActions({ status: "open" }, waiting).canArchive).toBe(false);
    expect(topicActions({ status: "pending" }, free).canArchive).toBe(false);
  });

  it("إلغاء الأرشفة للمؤرشف وحده", () => {
    for (const s of ALL_STATUSES) {
      expect(topicActions({ status: s }, free).canUnarchive).toBe(
        s === "archived",
      );
    }
  });

  /**
   * الثابت الذي يخدم المطلب الخامس: زرٌّ مطفأ بلا سبب لا يشرح شيئاً.
   * لكل إجراء ممنوع — في كل حالة وكل إشغال — سببٌ نصّي ورمزٌ للترجمة.
   */
  it("كل منع مصحوب بسبب ورمز، في كل تركيبة", () => {
    const keys = [
      ["approve", "canApprove"],
      ["reject", "canReject"],
      ["publish", "canPublish"],
      ["unpublish", "canUnpublish"],
      ["archive", "canArchive"],
      ["unarchive", "canUnarchive"],
      ["delete", "canDelete"],
      ["assignGroup", "canAssignGroup"],
    ] as const;

    for (const status of ALL_STATUSES) {
      for (const occ of [free, waiting, taken]) {
        const a = topicActions({ status }, occ);
        for (const [action, flag] of keys) {
          if (a[flag]) {
            expect(a.blockedReasons[action]).toBeUndefined();
            expect(a.blockedCodes[action]).toBeUndefined();
          } else {
            expect(a.blockedReasons[action]).toBeTruthy();
            expect(a.blockedCodes[action]?.code).toBeTruthy();
          }
        }
      }
    }
  });

  it("سبب انتظار الفريق يحمل عددهم، فلا يبقى مبهماً", () => {
    const a = topicActions({ status: "open" }, waiting);
    expect(a.blockedCodes.delete).toEqual({
      code: "teamWaiting",
      params: { count: 3, teams: 1 },
    });
    expect(a.blockedReasons.delete).toContain("3");
  });

  /**
   * الموضوعُ المنشور تتقدّم إليه عدّة فرقٍ معاً حتى سقفه. والسببُ يقول كم
   * فريقاً ينتظر — لا «فريقٌ من ٣ طلاب» عن أوّلهم وحده.
   */
  it("وعدّة فرقٍ تنتظر معاً: السببُ بعددها", () => {
    const a = topicActions({ status: "open" }, { ...waiting, pendingRequestCount: 3 });
    expect(a.canArchive).toBe(false);
    expect(a.blockedCodes.archive).toEqual({
      code: "teamWaiting",
      params: { count: 3, teams: 3 },
    });
    expect(a.blockedReasons.archive).toContain("3 فرق تنتظر");
  });

  /** والعدد بصيغة كلّ لغة: «3 teams are waiting»، «3 équipes attendent» — ولفريقٍ واحد صيغته. */
  it("وبالإنجليزية والفرنسية كذلك، والمفرد بصيغته", () => {
    const say = (lang: "en" | "fr", teams?: number) =>
      tr("gate.archiveWaiting", { count: 3, ...(teams === undefined ? {} : { teams }) }, lang);
    expect(say("en", 3)).toContain("3 teams are waiting");
    expect(say("fr", 3)).toContain("3 équipes attendent");
    expect(say("en", 1)).toContain("a team of 3 students is waiting");
    expect(say("fr", 1)).toContain("une équipe de 3 étudiants attend");
    // بلا عدد الفرق (رسالةٌ قديمة): صيغة الفريق الواحد.
    expect(say("en")).toContain("a team of 3 students is waiting");
    expect(tr("gate.archiveWaiting", { count: 3 }, "ar")).toContain("فريقٌ من 3 طلاب ينتظر");
  });
});

describe("occupancyFromRelations", () => {
  /** صفٌّ حُمّل بلا علاقاته (استعلامٌ لم يطلب `OCCUPANCY_INCLUDE`) يُقرأ فارغاً، لا يرمي. */
  it("صفٌّ بلا طلباتٍ ولا مجموعة ⇒ إشغالٌ فارغ، والعدّاد صفر", () => {
    expect(occupancyFromRelations({})).toMatchObject({
      hasGroup: false,
      groupMemberCount: 0,
      pendingRequestId: null,
      pendingRequestMemberCount: 0,
      pendingRequestCount: 0,
      acceptedRequestId: null,
      hasLiveRequest: false,
      hasPendingRequest: false,
      hasAcceptedRequest: false,
    });
  });

  it("يعدّ المعلّق كلّه، ويجد المقبول، ويقرأ أعضاء المجموعة", () => {
    const occ = occupancyFromRelations({
      projectGroup: { _count: { members: 3 } },
      groupRequests: [
        { id: "p1", status: "pending", _count: { members: 2 } },
        { id: "p2", status: "pending", _count: { members: 4 } },
        { id: "a1", status: "accepted", _count: { members: 3 } },
      ],
    });
    expect(occ).toMatchObject({
      hasGroup: true,
      groupMemberCount: 3,
      pendingRequestId: "p1",
      pendingRequestMemberCount: 2,
      pendingRequestCount: 2,
      acceptedRequestId: "a1",
      hasLiveRequest: true,
    });
  });
});
