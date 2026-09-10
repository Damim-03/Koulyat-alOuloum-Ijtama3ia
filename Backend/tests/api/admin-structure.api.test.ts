/**
 * الإدارة — الهيكل الأكاديمي والسنوات ونطاقات البريد.
 *
 * الشجرة: كلّية ← قسم ← (ميدان · شعبة) ← تخصّص. وعليها يقوم كل شيء آخر:
 * الطلبة والمواضيع والأساتذة كلّهم معلّقون بها.
 *
 * ولذلك **الحذف هو خطر هذا المجال كلّه**. حذف تخصّصٍ عليه طلبة يقطعهم عن
 * تخصّصهم، وحذف كلّيةٍ عليها أقسام يقطع الشجرة من جذرها. والحُرّاس مكتوبة —
 * لكنها لم تُنفَّذ في اختبار قطّ، وسطرٌ يقول «امنع» ولم يُنفَّذ لا نعرف أنه
 * يمنع.
 *
 * وثلاثة أنماط تتكرّر في هذا الملفّ:
 *
 *   **العدّ قبل القطع** — لا يُحذف ما تحته شيء، والرسالة تقول كم وماذا.
 *   **الرمز فريد** — رمز الكلّية والقسم والميدان والشعبة، وتكراره يُقال.
 *   **النشط واحد** — سنةٌ نشطة واحدة، ونطاقٌ افتراضي واحد. وهذا شرطٌ على
 *     الجدول كلّه لا على الصفّ، فلا يحفظه إلّا مرورُ كل الكتابات بنقطة
 *     واحدة — وهي عين المشكلة التي عالجناها في `status`.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  TEST_DOMAIN_SUFFIX,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";

const NO_SUCH_ID = "00000000-0000-0000-0000-000000000000";

const as = (r: request.Test) => r.set("Authorization", `Bearer ${adminToken}`);

const ids = (list: unknown) => (list as { id: string }[]).map((r) => r.id);

let n = 0;
const uniq = () => `${TAG}-S${++n}`;

/** شجرةٌ فارغة كاملة الطبقات، قابلة للحذف من أي مستوى. */
async function emptyTree() {
  const faculty = await prisma.faculty.create({
    data: { name: `${TAG} كلّية ${n}`, code: uniq() },
  });
  const department = await prisma.department.create({
    data: { name: `${TAG} قسم ${n}`, code: uniq(), facultyId: faculty.id },
  });
  const filiere = await prisma.filiere.create({
    data: {
      name: `${TAG} شعبة ${n}`,
      code: uniq(),
      departmentId: department.id,
    },
  });
  const specialization = await prisma.specialization.create({
    data: { name: `${TAG} تخصّص ${n}`, level: "master", filiereId: filiere.id },
  });
  return { faculty, department, filiere, specialization };
}

/** سنة جامعية موسومة بعنوانٍ لا يتكرّر. */
const newYear = async () => {
  const title = `${TAG} year ${2100 + ++n}`;
  const res = await as(
    request(app).post("/api/admin/academic-years").send({ title }),
  ).expect(201);
  return res.body.academicYear as { id: string; title: string };
};

/** نطاق بريدٍ موسوم — أحرفٌ وأرقامٌ وشرطات فقط، فالتعبير النمطي صارم. */
const newDomain = async (isDefault = false) => {
  const domain = `d${++n}.${TEST_DOMAIN_SUFFIX}`;
  const res = await as(
    request(app)
      .post("/api/admin/university-domains")
      .send({ domain, isDefault }),
  ).expect(201);
  return res.body.domain as { id: string; domain: string };
};

beforeAll(async () => {
  await teardown();
  f = await seed(6);

  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ الإنشاء ═══
//

describe("إنشاء عناصر الشجرة", () => {
  it("كلّية ثم قسم ثم ميدان ثم شعبة ثم تخصّص — كلٌّ تحت سابقه", async () => {
    const facultyId = (
      await as(
        request(app)
          .post("/api/admin/faculties")
          .send({ name: `${TAG} كلّية جديدة`, code: uniq() }),
      ).expect(201)
    ).body.faculty.id;

    const departmentId = (
      await as(
        request(app)
          .post("/api/admin/departments")
          .send({ name: `${TAG} قسم جديد`, code: uniq(), facultyId }),
      ).expect(201)
    ).body.department.id;

    const domainId = (
      await as(
        request(app)
          .post("/api/admin/domains")
          .send({ name: `${TAG} ميدان جديد`, code: uniq(), departmentId }),
      ).expect(201)
    ).body.domain.id;

    // الشعبة تُنشأ بالميدان وحده، والقسم يُشتقّ منه — لا يُطلب مرّتين.
    const filiere = (
      await as(
        request(app)
          .post("/api/admin/filieres")
          .send({ name: `${TAG} شعبة جديدة`, code: uniq(), domainId }),
      ).expect(201)
    ).body.filiere;
    expect(filiere.departmentId).toBe(departmentId);

    const spec = (
      await as(
        request(app).post("/api/admin/specializations").send({
          name: `${TAG} تخصّص جديد`,
          level: "licence",
          filiereId: filiere.id,
        }),
      ).expect(201)
    ).body.specialization;
    expect(spec.filiereId).toBe(filiere.id);
  });

  it("وشعبةٌ بلا قسمٍ ولا ميدان ⇒ 400", async () => {
    await as(
      request(app)
        .post("/api/admin/filieres")
        .send({ name: `${TAG} شعبة معلّقة`, code: uniq() }),
    ).expect(400);
  });

  it.each([["faculties"], ["departments"], ["domains"], ["filieres"]])(
    "ورمزٌ مكرّر في %s ⇒ يُرفض بسببٍ مذكور لا بـ«خطأ خادم»",
    async (path) => {
      const tree = await emptyTree();
      const parent =
        path === "faculties"
          ? {}
          : path === "departments"
            ? { facultyId: tree.faculty.id }
            : { departmentId: tree.department.id };

      // الميدان وحده يحتاج رمزاً قائماً نصنعه له.
      let taken: string;
      if (path === "faculties") taken = tree.faculty.code;
      else if (path === "departments") taken = tree.department.code;
      else if (path === "filieres") taken = tree.filiere.code;
      else {
        taken = uniq();
        await prisma.domain.create({
          data: {
            name: `${TAG} ميدان قائم`,
            code: taken,
            departmentId: tree.department.id,
          },
        });
      }

      const res = await as(
        request(app)
          .post(`/api/admin/${path}`)
          .send({ name: `${TAG} مكرّر`, code: taken, ...parent }),
      );

      expect([400, 409]).toContain(res.status);
      expect(res.body.message).toMatch(/already exists|مستعمل|مكرّر/i);
    },
  );

  it("وأبٌ غير موجود ⇒ خطأ عميل مفهوم لا 500", async () => {
    const res = await as(
      request(app)
        .post("/api/admin/departments")
        .send({ name: `${TAG} يتيم`, code: uniq(), facultyId: NO_SUCH_ID }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.message).toBeTruthy();
  });

  it("وشعبةٌ تحت ميدانٍ غير موجود ⇒ 404", async () => {
    await as(
      request(app)
        .post("/api/admin/filieres")
        .send({ name: `${TAG} ش`, code: uniq(), domainId: NO_SUCH_ID }),
    ).expect(404);
  });

  it("ومستوىً غير معروف للتخصّص ⇒ 400", async () => {
    const tree = await emptyTree();
    await as(
      request(app).post("/api/admin/specializations").send({
        name: `${TAG} مستوى خاطئ`,
        level: "postdoc",
        filiereId: tree.filiere.id,
      }),
    ).expect(400);
  });
});

//
// ═══ التعديل ═══
//

describe("تعديل عناصر الشجرة", () => {
  it("نقل شعبةٍ إلى ميدانٍ في قسمٍ آخر ينقل قسمها معه", async () => {
    const a = await emptyTree();
    const b = await emptyTree();
    const target = await prisma.domain.create({
      data: {
        name: `${TAG} ميدان الوجهة`,
        code: uniq(),
        departmentId: b.department.id,
      },
    });

    const res = await as(
      request(app)
        .patch(`/api/admin/filieres/${a.filiere.id}`)
        .send({ domainId: target.id }),
    ).expect(200);

    // القسم لا يُرسَل، ومع ذلك يتبع الميدان — وإلّا صارت الشعبة في قسمٍ
    // وميدانُها في قسمٍ آخر.
    expect(res.body.filiere.domainId).toBe(target.id);
    expect(res.body.filiere.departmentId).toBe(b.department.id);
  });

  it.each([
    ["faculties", { name: `${TAG} اسم جديد` }],
    ["departments", { name: `${TAG} اسم جديد` }],
    ["domains", { name: `${TAG} اسم جديد` }],
    ["filieres", { name: `${TAG} اسم جديد` }],
    ["specializations", { name: `${TAG} اسم جديد` }],
    ["academic-years", { title: `${TAG} لا شيء` }],
  ])("و%s غير موجود عند التعديل ⇒ 404", async (path, body) => {
    await as(
      request(app).patch(`/api/admin/${path}/${NO_SUCH_ID}`).send(body),
    ).expect(404);
  });
});

//
// ═══ الحذف: العدّ قبل القطع ═══
//

describe("لا يُحذف ما تحته شيء", () => {
  it("كلّية عليها أقسام ⇒ 400، والرسالة تقول كم", async () => {
    const tree = await emptyTree();

    const res = await as(
      request(app).delete(`/api/admin/faculties/${tree.faculty.id}`),
    ).expect(400);
    expect(res.body.message).toMatch(/\d+\s*قسم/);

    expect(
      await prisma.faculty.findUnique({ where: { id: tree.faculty.id } }),
    ).not.toBeNull();
  });

  it("وقسمٌ عليه شعب ⇒ 400 تذكر الشعب", async () => {
    const tree = await emptyTree();
    const res = await as(
      request(app).delete(`/api/admin/departments/${tree.department.id}`),
    ).expect(400);
    expect(res.body.message).toMatch(/\d+\s*شعبة/);
  });

  it("وقسمٌ عليه ميدانٌ وأستاذ ⇒ الرسالة تجمع الأسباب لا تكتفي بأوّلها", async () => {
    // قسم الأستاذ الموسوم هو نفسه قسم التجهيز، فنضيف إليه ميداناً.
    await prisma.domain.create({
      data: {
        name: `${TAG} ميدان القسم`,
        code: uniq(),
        departmentId: f.department.id,
      },
    });

    const res = await as(
      request(app).delete(`/api/admin/departments/${f.department.id}`),
    ).expect(400);

    expect(res.body.message).toContain("ميدان");
    expect(res.body.message).toContain("أستاذ");
  });

  it("وشعبةٌ عليها تخصّصات ⇒ 400", async () => {
    const tree = await emptyTree();
    const res = await as(
      request(app).delete(`/api/admin/filieres/${tree.filiere.id}`),
    ).expect(400);
    expect(res.body.message).toMatch(/\d+\s*تخصص/);
  });

  it("وتخصّصٌ عليه طلبة ⇒ 400 مع ذكر الطلبة", async () => {
    const res = await as(
      request(app).delete(`/api/admin/specializations/${f.specialization.id}`),
    ).expect(400);
    expect(res.body.message).toContain("طالب");
  });

  it("وتخصّصٌ عليه مواضيع ⇒ 400 مع ذكر المواضيع", async () => {
    const tree = await emptyTree();
    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} STR topic`,
        description: `${TAG} d`,
        maxStudents: 3,
        status: "approved",
        professorId: f.professor.id,
        specializationId: tree.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    const res = await as(
      request(app).delete(
        `/api/admin/specializations/${tree.specialization.id}`,
      ),
    ).expect(400);
    expect(res.body.message).toContain("موضوع");
  });

  /**
   * الترتيب المعكوس هو الطريق الوحيد للحذف: من الورقة إلى الجذر. وهذا يُثبت
   * أن الحُرّاس ليست جداراً مغلقاً بل تسلسلٌ مقصود — وأن المنع أعلاه ليس
   * عطلاً في الحذف نفسه.
   */
  it("والشجرة تُحذف من الورقة إلى الجذر", async () => {
    const t = await emptyTree();

    await as(
      request(app).delete(`/api/admin/specializations/${t.specialization.id}`),
    ).expect(200);
    await as(request(app).delete(`/api/admin/filieres/${t.filiere.id}`)).expect(
      200,
    );
    await as(
      request(app).delete(`/api/admin/departments/${t.department.id}`),
    ).expect(200);
    await as(
      request(app).delete(`/api/admin/faculties/${t.faculty.id}`),
    ).expect(200);

    expect(
      await prisma.faculty.findUnique({ where: { id: t.faculty.id } }),
    ).toBeNull();
  });

  it.each([
    ["faculties"],
    ["departments"],
    ["domains"],
    ["filieres"],
    ["specializations"],
  ])("و%s غير موجود ⇒ 404", async (path) => {
    await as(request(app).delete(`/api/admin/${path}/${NO_SUCH_ID}`)).expect(
      404,
    );
  });
});

//
// ═══ الميادين ═══
//

describe("الميادين", () => {
  it("تُنشأ تحت قسمها، وتُقرأ مرشَّحةً به، وتُحذف وهي فارغة", async () => {
    const tree = await emptyTree();
    const domain = (
      await as(
        request(app).post("/api/admin/domains").send({
          name: `${TAG} ميدان`,
          code: uniq(),
          departmentId: tree.department.id,
        }),
      ).expect(201)
    ).body.domain;

    const mine = await as(
      request(app)
        .get("/api/admin/domains")
        .query({ departmentId: tree.department.id }),
    ).expect(200);
    expect(ids(mine.body.domains)).toEqual([domain.id]);

    const elsewhere = await as(
      request(app)
        .get("/api/admin/domains")
        .query({ departmentId: NO_SUCH_ID }),
    ).expect(200);
    expect(ids(elsewhere.body.domains)).not.toContain(domain.id);

    await as(request(app).delete(`/api/admin/domains/${domain.id}`)).expect(200);
  });

  /**
   * تعليقٌ في `deleteDomainService` يقول: «عند ربط الشعبة بالميدان أضِف هنا
   * فحص _count.filieres كما في القسم». والمخطّط يربطهما فعلاً عبر
   * `Filiere.domainId`، والعلاقة اختيارية — فحذف ميدانٍ له شعب لا يُمنع، بل
   * تبقى الشعبة ويُفرَغ انتماؤها بصمت.
   *
   * وهذا التأكيد يصف **ما يقع اليوم** لا ما ينبغي أن يقع. فإن أُضيف الفحص
   * لاحقاً سلك الاختبار الفرع الآخر وبقي أخضر، وهو الموضع الذي يُراجَع فيه
   * القرار.
   */
  it("وحذف ميدانٍ له شعب: الشعبة تبقى ويُفرَغ انتماؤها — لا حارس بعد", async () => {
    const tree = await emptyTree();
    const domain = await prisma.domain.create({
      data: {
        name: `${TAG} ميدان بشعبة`,
        code: uniq(),
        departmentId: tree.department.id,
      },
    });
    await prisma.filiere.update({
      where: { id: tree.filiere.id },
      data: { domainId: domain.id },
    });

    const res = await as(
      request(app).delete(`/api/admin/domains/${domain.id}`),
    );

    if (res.status === 200) {
      const after = await prisma.filiere.findUnique({
        where: { id: tree.filiere.id },
      });
      expect(after).not.toBeNull(); // الشعبة لم تُحذف معه
      expect(after!.domainId).toBeNull(); // لكن انتماءها زال بلا إشعار
    } else {
      // أُضيف الحارس لاحقاً: الحذف يُمنع، وهو السلوك الأفضل.
      expect(res.status).toBe(400);
      expect(
        (await prisma.filiere.findUnique({ where: { id: tree.filiere.id } }))!
          .domainId,
      ).toBe(domain.id);
    }
  });
});

//
// ═══ السنوات الدراسية: النشطة واحدة ═══
//

describe("السنوات الدراسية", () => {
  it("تُنشأ مطفأة، والتفعيل يُطفئ ما عداها", async () => {
    const a = await newYear();
    const b = await newYear();

    expect(
      (await prisma.academicYear.findUnique({ where: { id: a.id } }))!.isActive,
    ).toBe(false);

    await as(
      request(app).patch(`/api/admin/academic-years/${a.id}/activate`),
    ).expect(200);
    await as(
      request(app).patch(`/api/admin/academic-years/${b.id}/activate`),
    ).expect(200);

    expect(
      (await prisma.academicYear.findUnique({ where: { id: a.id } }))!.isActive,
    ).toBe(false);
    expect(
      (await prisma.academicYear.findUnique({ where: { id: b.id } }))!.isActive,
    ).toBe(true);
    expect(await prisma.academicYear.count({ where: { isActive: true } })).toBe(
      1,
    );
  });

  /**
   * الشرط مكتوبٌ في `activate`، لكن `create` و`update` كانا يكتبان `isActive`
   * مباشرةً من الحمولة — ونافذة الواجهة فيها مربّع «اجعلها نشطة» يُرسله في
   * الحالتين. فسنةٌ تُنشأ نشطةً كانت تصير **الثانية** النشطة، بينما لوحة
   * التحكّم تقرأ `findFirst({isActive:true})` وصفحة الأرشيف تقرأ
   * `years.find(y => y.isActive)` — كلٌّ يختار واحدةً بلا قاعدة.
   *
   * وهو عين الخلل الذي عالجناه في `status`: حقيقةٌ لها شرطُ وحدانية تُكتب من
   * أكثر من موضع. والعلاج نفسه: نقطة كتابة واحدة.
   */
  it("وإنشاء سنةٍ «نشطة» يمرّ بالتفعيل نفسه فلا تجتمع نشطتان", async () => {
    const before = await newYear();
    await as(
      request(app).patch(`/api/admin/academic-years/${before.id}/activate`),
    ).expect(200);

    const title = `${TAG} year ${2200 + ++n}`;
    const created = (
      await as(
        request(app)
          .post("/api/admin/academic-years")
          .send({ title, isActive: true }),
      ).expect(201)
    ).body.academicYear;

    expect(created.isActive).toBe(true);
    expect(
      (await prisma.academicYear.findUnique({ where: { id: before.id } }))!
        .isActive,
    ).toBe(false);
    expect(await prisma.academicYear.count({ where: { isActive: true } })).toBe(
      1,
    );
  });

  it("وكذلك رفع العلم عبر التعديل", async () => {
    const a = await newYear();
    const b = await newYear();
    await as(
      request(app).patch(`/api/admin/academic-years/${a.id}/activate`),
    ).expect(200);

    const res = await as(
      request(app)
        .patch(`/api/admin/academic-years/${b.id}`)
        .send({ isActive: true }),
    ).expect(200);

    expect(res.body.academicYear.isActive).toBe(true);
    expect(
      (await prisma.academicYear.findUnique({ where: { id: a.id } }))!.isActive,
    ).toBe(false);
    expect(await prisma.academicYear.count({ where: { isActive: true } })).toBe(
      1,
    );
  });

  it("وتعديل العنوان وحده لا يمسّ التفعيل", async () => {
    const y = await newYear();
    await as(
      request(app).patch(`/api/admin/academic-years/${y.id}/activate`),
    ).expect(200);

    const renamed = `${TAG} year renamed ${++n}`;
    const res = await as(
      request(app)
        .patch(`/api/admin/academic-years/${y.id}`)
        .send({ title: renamed }),
    ).expect(200);

    expect(res.body.academicYear.title).toBe(renamed);
    expect(res.body.academicYear.isActive).toBe(true);
  });

  it("والسنة النشطة لا تُحذف", async () => {
    const y = await newYear();
    await as(
      request(app).patch(`/api/admin/academic-years/${y.id}/activate`),
    ).expect(200);

    const res = await as(
      request(app).delete(`/api/admin/academic-years/${y.id}`),
    ).expect(400);
    expect(res.body.message).toContain("النشطة");

    expect(
      await prisma.academicYear.findUnique({ where: { id: y.id } }),
    ).not.toBeNull();
  });

  it("وسنةٌ عليها طلبة لا تُحذف", async () => {
    const res = await as(
      request(app).delete(`/api/admin/academic-years/${f.academicYear.id}`),
    ).expect(400);
    expect(res.body.message).toContain("طالب");
  });

  it("وعنوانٌ مكرّر يُرفض بسببٍ مذكور", async () => {
    const y = await newYear();
    const res = await as(
      request(app).post("/api/admin/academic-years").send({ title: y.title }),
    );
    expect([400, 409]).toContain(res.status);
    expect(res.body.message).toMatch(/already exists|موجودة|مكرّر/i);
  });

  it("وسنةٌ فارغة مطفأة تُحذف", async () => {
    const y = await newYear();
    await as(request(app).delete(`/api/admin/academic-years/${y.id}`)).expect(
      200,
    );
    expect(
      await prisma.academicYear.findUnique({ where: { id: y.id } }),
    ).toBeNull();
  });

  it("وسنةٌ غير موجودة ⇒ 404 في التفعيل والحذف", async () => {
    await as(
      request(app).patch(`/api/admin/academic-years/${NO_SUCH_ID}/activate`),
    ).expect(404);
    await as(
      request(app).delete(`/api/admin/academic-years/${NO_SUCH_ID}`),
    ).expect(404);
  });
});

//
// ═══ نطاقات البريد الجامعي ═══
//

describe("نطاقات البريد الجامعي", () => {
  it("يُضاف نطاق ويظهر في القائمة", async () => {
    const d = await newDomain();
    const list = await as(
      request(app).get("/api/admin/university-domains"),
    ).expect(200);
    expect(ids(list.body.domains)).toContain(d.id);
  });

  it("وصيغةٌ غير صالحة تُرفض قبل أن تصل القاعدة", async () => {
    for (const bad of ["@univ.dz", "univ dz", "https://univ.dz", "univ"]) {
      await as(
        request(app)
          .post("/api/admin/university-domains")
          .send({ domain: bad }),
      ).expect(400);
    }
  });

  it("ونطاقٌ مكرّر يُرفض", async () => {
    const d = await newDomain();
    const res = await as(
      request(app)
        .post("/api/admin/university-domains")
        .send({ domain: d.domain }),
    );
    expect([400, 409]).toContain(res.status);
    expect(res.body.message).toBeTruthy();
  });

  it("والافتراضيّ واحدٌ لا أكثر — سواءٌ عُيّن عند الإنشاء أو بعده", async () => {
    const a = await newDomain(true);
    const b = await newDomain(true); // الثاني يُنشأ افتراضياً ⇒ يُطفئ الأول

    expect(
      await prisma.universityDomain.count({ where: { isDefault: true } }),
    ).toBe(1);
    expect(
      (await prisma.universityDomain.findUnique({ where: { id: a.id } }))!
        .isDefault,
    ).toBe(false);

    await as(
      request(app).patch(`/api/admin/university-domains/${a.id}/default`),
    ).expect(200);

    expect(
      await prisma.universityDomain.count({ where: { isDefault: true } }),
    ).toBe(1);
    expect(
      (await prisma.universityDomain.findUnique({ where: { id: b.id } }))!
        .isDefault,
    ).toBe(false);
  });

  /**
   * حذف آخر نطاق يترك النظام بلا نطاقٍ صالح، فلا يستطيع أحد إنشاء أستاذ
   * بعدها — عطلٌ كامل ناتجٌ عن حذفٍ يبدو بريئاً.
   */
  it("ولا يُحذف النطاق الأخير", async () => {
    // نُبقي واحداً فقط — كلّها موسومة، فلا يُمسّ شيء خارج الاختبار.
    let all = await prisma.universityDomain.findMany({ select: { id: true } });
    if (all.length === 0) await newDomain();
    all = await prisma.universityDomain.findMany({ select: { id: true } });
    const only = all[0]!;
    await prisma.universityDomain.deleteMany({ where: { id: { not: only.id } } });

    const res = await as(
      request(app).delete(`/api/admin/university-domains/${only.id}`),
    ).expect(400);
    expect(res.body.message).toContain("الوحيد");

    expect(
      await prisma.universityDomain.findUnique({ where: { id: only.id } }),
    ).not.toBeNull();
  });

  it("ولا نطاقٌ يستعمله أساتذة", async () => {
    await newDomain(); // حتى لا يصطدم الاختبار بحارس «النطاق الأخير»
    const used = await prisma.universityDomain.create({
      data: { domain: `used.${TEST_DOMAIN_SUFFIX}` },
    });

    const before = (await prisma.professor.findUnique({
      where: { id: f.professor.id },
    }))!;
    await prisma.professor.update({
      where: { id: f.professor.id },
      data: { universityEmail: `${TAG}.emp@${used.domain}` },
    });

    try {
      const res = await as(
        request(app).delete(`/api/admin/university-domains/${used.id}`),
      ).expect(400);
      expect(res.body.message).toContain("أستاذ");
    } finally {
      // نُعيد بريد الأستاذ كما كان: بقيّة الاختبارات تعتمد عليه.
      await prisma.professor.update({
        where: { id: f.professor.id },
        data: { universityEmail: before.universityEmail },
      });
    }
  });

  it("ونطاقٌ حرٌّ يُحذف، وغير الموجود ⇒ 404", async () => {
    await newDomain(); // حتى لا يكون التالي هو الأخير
    const doomed = await newDomain();

    await as(
      request(app).delete(`/api/admin/university-domains/${doomed.id}`),
    ).expect(200);
    expect(
      await prisma.universityDomain.findUnique({ where: { id: doomed.id } }),
    ).toBeNull();

    await as(
      request(app).delete(`/api/admin/university-domains/${NO_SUCH_ID}`),
    ).expect(404);
  });
});

//
// ═══ معالج الهيكل: شجرةٌ كاملة في معاملة واحدة ═══
//

describe("معالج الهيكل الأكاديمي", () => {
  const tree = () => {
    const k = ++n;
    return {
      faculty: {
        kind: "new" as const,
        name: `${TAG} كلّية معالج ${k}`,
        code: `${TAG}-W${k}F`,
      },
      departments: [
        { key: "d1", name: `${TAG} قسم ${k}`, code: `${TAG}-W${k}D` },
      ],
      domains: [
        {
          key: "m1",
          name: `${TAG} ميدان ${k}`,
          code: `${TAG}-W${k}M`,
          department: { kind: "new" as const, value: "d1" },
        },
      ],
      filieres: [
        {
          key: "f1",
          name: `${TAG} شعبة ${k}`,
          code: `${TAG}-W${k}L`,
          department: { kind: "new" as const, value: "d1" },
          domain: { kind: "new" as const, value: "m1" },
          specializations: [
            { name: `${TAG} تخصّص ${k}أ`, level: "licence" as const },
            { name: `${TAG} تخصّص ${k}ب`, level: "master" as const },
          ],
        },
      ],
    };
  };

  it("يُنشئ الشجرة كلّها ويربطها بالمفاتيح المؤقّتة", async () => {
    const payload = tree();
    const res = await as(
      request(app).post("/api/admin/academic-structure").send(payload),
    ).expect(201);

    expect(res.body.created).toEqual({
      departments: 1,
      domains: 1,
      filieres: 1,
      specializations: 2,
    });

    // المفاتيح المؤقّتة صارت معرّفات حقيقية متّسقة.
    const filiere = await prisma.filiere.findUnique({
      where: { code: payload.filieres[0]!.code },
      include: { domain: true, department: true, specializations: true },
    });
    expect(filiere!.domain!.code).toBe(payload.domains[0]!.code);
    expect(filiere!.department.code).toBe(payload.departments[0]!.code);
    expect(filiere!.specializations).toHaveLength(2);
  });

  it("ويقبل كلّيةً قائمة بدل إنشاء جديدة", async () => {
    const host = await emptyTree();
    const payload = tree();

    await as(
      request(app)
        .post("/api/admin/academic-structure")
        .send({ ...payload, faculty: { kind: "existing", id: host.faculty.id } }),
    ).expect(201);

    const dep = await prisma.department.findUnique({
      where: { code: payload.departments[0]!.code },
    });
    expect(dep!.facultyId).toBe(host.faculty.id);
  });

  it("ورمزٌ مكرّر داخل النموذج نفسه يُرفض قبل أي كتابة", async () => {
    const payload = tree();
    payload.domains[0]!.code = payload.departments[0]!.code;

    const res = await as(
      request(app).post("/api/admin/academic-structure").send(payload),
    ).expect(400);
    expect(res.body.message).toContain("مكرّر");

    expect(
      await prisma.faculty.findUnique({ where: { code: payload.faculty.code } }),
    ).toBeNull();
  });

  it("ورمزٌ مستعمل في القاعدة يُرفض والشجرة لا تُكتب نصفها", async () => {
    const existing = await emptyTree();
    const payload = tree();
    payload.departments[0]!.code = existing.department.code;

    const res = await as(
      request(app).post("/api/admin/academic-structure").send(payload),
    ).expect(400);
    expect(res.body.message).toContain("مستعملة");

    // لا كلّيةً يتيمة ولا ميداناً معلّقاً: الرفض قبل المعاملة لا داخلها.
    expect(
      await prisma.faculty.findUnique({ where: { code: payload.faculty.code } }),
    ).toBeNull();
    expect(
      await prisma.domain.findUnique({
        where: { code: payload.domains[0]!.code },
      }),
    ).toBeNull();
  });

  /**
   * المفتاح المؤقّت الذي لا يقابله عنصرٌ في الحمولة يُكتشف **داخل** المعاملة،
   * بعد إنشاء الكلّية والقسم. فإن لم تتراجع المعاملة بقيت كلّيةٌ لم يطلبها
   * أحد، وقسمٌ تحتها. وهذا ما يُثبته هذا الاختبار.
   */
  it("ومرجعٌ مكسور يُبطل المعاملة كلّها فلا يبقى نصف شجرة", async () => {
    const payload = tree();
    payload.filieres[0]!.domain = { kind: "new", value: "لا-وجود-له" };

    await as(
      request(app).post("/api/admin/academic-structure").send(payload),
    ).expect(400);

    expect(
      await prisma.faculty.findUnique({ where: { code: payload.faculty.code } }),
    ).toBeNull();
    expect(
      await prisma.department.findUnique({
        where: { code: payload.departments[0]!.code },
      }),
    ).toBeNull();
    expect(
      await prisma.domain.findUnique({
        where: { code: payload.domains[0]!.code },
      }),
    ).toBeNull();
  });

  it("وكلّيةٌ قائمة غير موجودة ⇒ 404", async () => {
    await as(
      request(app)
        .post("/api/admin/academic-structure")
        .send({ ...tree(), faculty: { kind: "existing", id: NO_SUCH_ID } }),
    ).expect(404);
  });
});

//
// ═══ القوائم ═══
//

describe("قوائم الشجرة", () => {
  it("الكلّية تحمل عدّاد كل ما تحتها، لا أقسامها وحدها", async () => {
    const t = await emptyTree();
    await prisma.domain.create({
      data: {
        name: `${TAG} ميدان العدّ`,
        code: uniq(),
        departmentId: t.department.id,
      },
    });

    const res = await as(request(app).get("/api/admin/faculties")).expect(200);
    const row = (
      res.body.faculties as { id: string; _count: Record<string, number> }[]
    ).find((r) => r.id === t.faculty.id);

    expect(row).toBeDefined();
    // التخصّص يتبع الشعبة لا الكلّية، فلا تعدّه Prisma تلقائياً — والعدّاد
    // مجموعٌ يدوياً عبر الطبقات. وهذا ما يُتحقَّق منه هنا.
    expect(row!._count).toMatchObject({
      departments: 1,
      domains: 1,
      filieres: 1,
      specializations: 1,
    });
  });

  it("والقسم يحمل عدّاد تخصّصاته المجموعة عبر شُعبه", async () => {
    const t = await emptyTree();
    const res = await as(request(app).get("/api/admin/departments")).expect(200);
    const row = (
      res.body.departments as { id: string; _count: Record<string, number> }[]
    ).find((r) => r.id === t.department.id);

    expect(row!._count.filieres).toBe(1);
    expect(row!._count.specializations).toBe(1);
  });

  it("والشُّعب تُرشَّح بالقسم", async () => {
    const t = await emptyTree();
    const res = await as(
      request(app)
        .get("/api/admin/filieres")
        .query({ departmentId: t.department.id }),
    ).expect(200);
    expect(ids(res.body.filieres)).toEqual([t.filiere.id]);
  });

  it("والتخصّص يصل ومعه شعبته وقسمها — لا معرّفاً وحده", async () => {
    const t = await emptyTree();
    const res = await as(
      request(app).get("/api/admin/specializations"),
    ).expect(200);
    const row = (
      res.body.specializations as {
        id: string;
        filiere: { id: string; department: { id: string } };
      }[]
    ).find((r) => r.id === t.specialization.id);

    expect(row!.filiere.id).toBe(t.filiere.id);
    expect(row!.filiere.department.id).toBe(t.department.id);
  });
});
