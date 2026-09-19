/**
 * جدول قواعد طلب المجموعة.
 *
 * وُلد لأن شاشة «طلبات المجموعات» كانت تُقرّر من حالة الطلب وحدها بينما
 * الخادم يحرس بأربعة شروط — ثلاثةٌ منها لا تصل الواجهة أصلاً. فكان زرّ
 * «رفض» يُعرض على كل طلبٍ مقبول، وقبولُ الطلب يُنشئ المشروع، فالرفض بعده
 * مرفوضٌ دائماً: زرٌّ لإجراءٍ مستحيل.
 *
 * وهذه الاختبارات على الدالّة الصرفة لا على المسار: هي الآن **الحارس والعرض
 * معاً**، فخطأٌ فيها يظهر في الموضعين، والوحدة أرخص موضعٍ يُمسَك فيه.
 */
import { requestActions } from "./topic-status";

/** طلبٌ وموضوعه، وما يلزم الجدول منهما. */
const make = (over: {
  status?: string;
  memberCount?: number;
  topicStatus?: string;
  maxStudents?: number;
  hasGroup?: boolean;
} = {}) =>
  requestActions({
    status: over.status ?? "pending",
    memberCount: over.memberCount ?? 2,
    topic: {
      status: (over.topicStatus ?? "open") as never,
      maxStudents: over.maxStudents ?? 3,
      hasGroup: over.hasGroup ?? false,
    },
  });

describe("متى يجوز القبول", () => {
  it("طلبٌ معلَّق على موضوعٍ منشورٍ حرّ ⇒ يجوز", () => {
    const a = make();
    expect(a.canAccept).toBe(true);
    expect(a.blockedReasons.accept).toBeUndefined();
  });

  /**
   * `pending` من الحالات المقبولة عمداً: الأستاذ قد يقترح موضوعاً مع فريقه،
   * فيحمل الطلب اعتماد الموضوع معه. والطالب لا يبلغ هذه الحالة.
   */
  it.each(["pending", "approved", "open", "full"])(
    "وموضوعٌ حالته «%s» ⇒ يجوز",
    (topicStatus) => {
      expect(make({ topicStatus }).canAccept).toBe(true);
    },
  );

  it.each(["rejected", "archived"])(
    "وموضوعٌ حالته «%s» ⇒ يُمنع بسببٍ مذكور",
    (topicStatus) => {
      const a = make({ topicStatus });
      expect(a.canAccept).toBe(false);
      expect(a.blockedReasons.accept).toContain("لم يعد متاحاً");
      expect(a.blockedCodes.accept?.code).toBe("topicUnavailable");
    },
  );

  it("وطلبٌ مقبولٌ سلفاً ⇒ يُمنع", () => {
    const a = make({ status: "accepted" });
    expect(a.canAccept).toBe(false);
    expect(a.blockedCodes.accept?.code).toBe("alreadyAccepted");
  });

  /**
   * فريقٌ آخر سبقهم. وهذا هو الشرط الذي **لا تراه الواجهة أصلاً**: وجود
   * المجموعة ليس في حالة الطلب ولا في حالة الموضوع كما تقرأها الشاشة.
   */
  it("وموضوعٌ صارت له مجموعة ⇒ يُمنع، والسبب يقول إن فريقاً سبقهم", () => {
    const a = make({ hasGroup: true });
    expect(a.canAccept).toBe(false);
    expect(a.blockedReasons.accept).toContain("سبقهم");
    expect(a.blockedCodes.accept?.code).toBe("topicTaken");
  });

  it("وعددٌ يتجاوز السعة ⇒ يُمنع، والسبب يذكر الرقمين", () => {
    const a = make({ memberCount: 5, maxStudents: 3 });
    expect(a.canAccept).toBe(false);
    expect(a.blockedReasons.accept).toContain("5");
    expect(a.blockedReasons.accept).toContain("3");
    expect(a.blockedCodes.accept?.params).toEqual({ members: 5, max: 3 });
  });

  it("والعدد المساوي للسعة مقبول — الحدّ يشمل نفسه", () => {
    expect(make({ memberCount: 3, maxStudents: 3 }).canAccept).toBe(true);
  });

  /**
   * حين تجتمع أسباب، يُعرض أوّل ما يمنع فعلاً — بترتيب الخادم نفسه. ولو
   * اختلف الترتيبان لقال الزرّ المطفأ سبباً والخادمُ سبباً آخر عند المحاولة.
   */
  it("وحين تجتمع الأسباب يُعرض أوّلها بترتيب الخادم", () => {
    const a = make({
      status: "accepted",
      topicStatus: "archived",
      hasGroup: true,
      memberCount: 99,
    });
    expect(a.blockedCodes.accept?.code).toBe("alreadyAccepted");
  });
});

describe("ومتى يجوز الرفض", () => {
  it.each(["pending", "rejected"])("طلبٌ «%s» ⇒ يجوز رفضه", (status) => {
    expect(make({ status }).canReject).toBe(true);
  });

  it("وطلبٌ مقبولٌ تشكّل له مشروع ⇒ يُمنع، والسبب يدلّ على البديل", () => {
    const a = make({ status: "accepted", hasGroup: true });
    expect(a.canReject).toBe(false);
    expect(a.blockedReasons.reject).toContain("افسخ المشروع");
    expect(a.blockedCodes.reject?.code).toBe("hasProject");
  });

  /**
   * الشرط على المجموعة لا على حالة الطلب. فطلبٌ مقبولٌ فُسخت مجموعته — حالةٌ
   * عالقة من بياناتٍ قديمة — يبقى رفضه ممكناً، إذ هو الإصلاح لا الهدم.
   */
  it("وطلبٌ مقبولٌ بلا مشروع ⇒ يبقى رفضه ممكناً", () => {
    expect(make({ status: "accepted", hasGroup: false }).canReject).toBe(true);
  });

  it("وسعة الفريق لا تدخل في قاعدة الرفض", () => {
    expect(make({ memberCount: 99, maxStudents: 1 }).canReject).toBe(true);
  });
});

describe("وشكل الجدول", () => {
  it("ما جاز لا سبب له، وما مُنع له سببٌ ورمز", () => {
    const a = make({ status: "accepted", hasGroup: true });

    expect(a.canAccept).toBe(false);
    expect(a.canReject).toBe(false);
    expect(Object.keys(a.blockedReasons).sort()).toEqual(["accept", "reject"]);
    expect(Object.keys(a.blockedCodes).sort()).toEqual(["accept", "reject"]);

    const free = make();
    expect(free.blockedReasons).toEqual({});
    expect(free.blockedCodes).toEqual({});
  });

  /**
   * الرمز هو ما تترجمه الواجهة؛ والنصّ العربيّ احتياطٌ وهو ما يرسله الخادم
   * في رسالة الرفض. فكلّ منعٍ يجب أن يحمل الاثنين معاً.
   */
  it("وكل منعٍ يحمل نصّاً ورمزاً معاً", () => {
    for (const a of [
      make({ status: "accepted" }),
      make({ topicStatus: "archived" }),
      make({ hasGroup: true }),
      make({ memberCount: 9, maxStudents: 2 }),
      make({ status: "accepted", hasGroup: true }),
    ]) {
      for (const key of ["accept", "reject"] as const) {
        const blocked = key === "accept" ? !a.canAccept : !a.canReject;
        if (!blocked) continue;
        expect(a.blockedReasons[key]).toBeTruthy();
        expect(a.blockedCodes[key]?.code).toBeTruthy();
      }
    }
  });
});
