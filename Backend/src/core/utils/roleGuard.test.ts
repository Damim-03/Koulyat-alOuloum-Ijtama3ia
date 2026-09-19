/**
 * حُرّاس الصلاحيات — اختبارات وحدة بلا قاعدة ولا شبكة.
 *
 * هذه الدوالّ تقرّر **من يفعل ماذا**، وهي أكثر ما يستحقّ تغطية كاملة في
 * المشروع: خطأٌ فيها لا يُنتج رسالة خطأ بل صمتاً — إجراءٌ يمرّ لمن لا يحقّ له.
 *
 * والاختبار هنا يغطّي **مسارات الرفض** خصوصاً. المشروع كان يغطّي مسار النجاح
 * (مستخدم مصرَّح يمرّ) ولا يغطّي شيئاً ممّا يليه: مستخدم بلا هوية، بدور
 * مجهول، بدور لا يملك الصلاحية. وهناك يسكن الأمان — لا في مسار النجاح.
 */
import type { Request, Response, NextFunction } from "express";
import { roleGuard, adminOnly, requireRole } from "./roleGuard";
import { Permissions, Roles } from "../enums/role.enum";
import type { RoleType } from "../enums/role.enum";

/** ثلاثي Express صوريّ يسجّل ما حدث. */
function harness(role?: RoleType | string) {
  const req = (role ? { user: { userId: "u1", role, refId: "r1" } } : {}) as Request;

  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  let nextCalls = 0;
  const next = (() => {
    nextCalls += 1;
  }) as NextFunction;

  return {
    req,
    res: res as unknown as Response,
    next,
    get passed() {
      return nextCalls === 1;
    },
    get status() {
      return res.statusCode;
    },
    get message() {
      return (res.body as { message?: string } | undefined)?.message;
    },
  };
}

describe("roleGuard", () => {
  it("بلا مستخدم على الطلب ⇒ 401، ولا يمرّ", () => {
    const h = harness();
    roleGuard([Permissions.VIEW_TOPICS])(h.req, h.res, h.next);

    expect(h.passed).toBe(false);
    expect(h.status).toBe(401);
  });

  /**
   * كان للمالك تجاوزٌ يمرّ به فوق الجدول كلّه. ويوم أُلغي ذلك الدور زال
   * التجاوز معه، فلم يبقَ في الملفّ بابٌ خلفيّ: **لا دور يتجاوز الجدول**.
   * وهذا الاختبار يحرس زواله — لو أُعيد يوماً لأحدٍ لاحمرّ هنا.
   */
  it("ولا دور يتجاوز الجدول: المدير نفسه يُمنع ممّا لا يملكه", () => {
    const h = harness(Roles.ADMIN);
    roleGuard([Permissions.APPLY_TO_TOPIC])(h.req, h.res, h.next);

    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });

  it("وصلاحيةٌ لا وجود لها تُمنع عن الجميع", () => {
    const h = harness(Roles.ADMIN);
    roleGuard(["A_PERMISSION_THAT_DOES_NOT_EXIST" as never])(
      h.req,
      h.res,
      h.next,
    );

    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });

  it("دور مجهول ⇒ 403 «Invalid role»", () => {
    const h = harness("intruder");
    roleGuard([Permissions.VIEW_TOPICS])(h.req, h.res, h.next);

    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
    expect(h.message).toBe("Invalid role");
  });

  it("دور لا يملك الصلاحية ⇒ 403", () => {
    const h = harness(Roles.STUDENT);
    roleGuard([Permissions.APPROVE_TOPICS])(h.req, h.res, h.next);

    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });

  it("دور يملك الصلاحية ⇒ يمرّ", () => {
    const h = harness(Roles.ADMIN);
    roleGuard([Permissions.APPROVE_TOPICS])(h.req, h.res, h.next);
    expect(h.passed).toBe(true);
  });

  /**
   * الفرق بين الوضعين هو الفرق بين «يكفي واحدة» و«تلزم كلّها»، وخلطهما يفتح
   * الباب أو يغلقه بالخطأ. الاختبار يثبّتهما على نفس المدخلات.
   */
  describe("ANY مقابل ALL", () => {
    const owned = Permissions.VIEW_TOPICS; // يملكها الطالب
    const notOwned = Permissions.APPROVE_TOPICS; // لا يملكها

    it("ANY: واحدة مملوكة تكفي", () => {
      const h = harness(Roles.STUDENT);
      roleGuard([notOwned, owned], "ANY")(h.req, h.res, h.next);
      expect(h.passed).toBe(true);
    });

    it("ALL: واحدة ناقصة تمنع", () => {
      const h = harness(Roles.STUDENT);
      roleGuard([notOwned, owned], "ALL")(h.req, h.res, h.next);
      expect(h.passed).toBe(false);
      expect(h.status).toBe(403);
    });

    it("ALL: كلّها مملوكة ⇒ يمرّ", () => {
      const h = harness(Roles.STUDENT);
      roleGuard([owned, Permissions.LOGIN], "ALL")(h.req, h.res, h.next);
      expect(h.passed).toBe(true);
    });

    it("الوضع الافتراضي هو ANY", () => {
      const h = harness(Roles.STUDENT);
      roleGuard([notOwned, owned])(h.req, h.res, h.next);
      expect(h.passed).toBe(true);
    });
  });

  /**
   * قائمة فارغة مع ANY لا يجتازها أحد (`some` على فارغ = false)، ومع ALL
   * يجتازها الجميع (`every` على فارغ = true). سلوكٌ صحيح منطقياً وخطِرٌ عملياً
   * إن كُتب `roleGuard([], "ALL")` سهواً — فيُثبَّت هنا ليُرى.
   */
  it("قائمة صلاحيات فارغة: ANY تمنع، وALL تسمح", () => {
    const any = harness(Roles.STUDENT);
    roleGuard([], "ANY")(any.req, any.res, any.next);
    expect(any.passed).toBe(false);

    const all = harness(Roles.STUDENT);
    roleGuard([], "ALL")(all.req, all.res, all.next);
    expect(all.passed).toBe(true);
  });
});

describe("adminOnly", () => {
  it("بلا مستخدم ⇒ 401", () => {
    const h = harness();
    adminOnly()(h.req, h.res, h.next);
    expect(h.status).toBe(401);
    expect(h.passed).toBe(false);
  });

  it("المدير يمرّ", () => {
    const h = harness(Roles.ADMIN);
    adminOnly()(h.req, h.res, h.next);
    expect(h.passed).toBe(true);
  });

  /**
   * هذا الحارس يحمي — من بين ما يحمي — مسارات حذف الحسابات. وكانت محجوزةً
   * لدور `owner`؛ فلمّا أُلغي انتقلت إلى المدير. والأستاذ والطالب على
   * حالهما: ممنوعان.
   */
  it.each([Roles.PROFESSOR, Roles.STUDENT])("و«%s» ⇒ 403", (role) => {
    const h = harness(role);
    adminOnly()(h.req, h.res, h.next);
    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });

  it("ودورٌ مجهول ⇒ 403", () => {
    const h = harness("intruder");
    adminOnly()(h.req, h.res, h.next);
    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });
});

describe("requireRole", () => {
  it("بلا مستخدم ⇒ 401", () => {
    const h = harness();
    requireRole(Roles.PROFESSOR)(h.req, h.res, h.next);
    expect(h.status).toBe(401);
  });

  it("الدور المسموح يمرّ", () => {
    const h = harness(Roles.PROFESSOR);
    requireRole(Roles.PROFESSOR)(h.req, h.res, h.next);
    expect(h.passed).toBe(true);
  });

  it("الدور غير المسموح ⇒ 403", () => {
    const h = harness(Roles.STUDENT);
    requireRole(Roles.PROFESSOR)(h.req, h.res, h.next);
    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });

  /** التجاوز الذي كان للمالك هنا زال أيضاً: القائمة تعني ما تقول. */
  it("والمدير لا يمرّ إلى مسارٍ ليس في قائمته", () => {
    const h = harness(Roles.ADMIN);
    requireRole(Roles.STUDENT)(h.req, h.res, h.next);

    expect(h.passed).toBe(false);
    expect(h.status).toBe(403);
  });

  it("أدوار متعدّدة: كلٌّ منها يمرّ", () => {
    for (const role of [Roles.PROFESSOR, Roles.STUDENT]) {
      const h = harness(role);
      requireRole(Roles.PROFESSOR, Roles.STUDENT)(h.req, h.res, h.next);
      expect(h.passed).toBe(true);
    }
  });

  /**
   * السبب الذي وُجدت من أجله: كان `roleGuard([LOGIN])` بوّابةَ مسارَي الأستاذ
   * والطالب، وLOGIN ممنوحة لكل دور — فكانت البوّابة تُدخل أي مستخدم مصادَق.
   * هذا التأكيد يمنع العودة إلى ذلك.
   */
  it("لا تُغني عنها roleGuard([LOGIN]): تلك تُدخل كل دور", () => {
    const viaLogin = harness(Roles.STUDENT);
    roleGuard([Permissions.LOGIN])(viaLogin.req, viaLogin.res, viaLogin.next);
    expect(viaLogin.passed).toBe(true); // الطالب يمرّ إلى مسار الأستاذ!

    const viaRole = harness(Roles.STUDENT);
    requireRole(Roles.PROFESSOR)(viaRole.req, viaRole.res, viaRole.next);
    expect(viaRole.passed).toBe(false); // البوّابة الصحيحة تمنعه
  });
});
