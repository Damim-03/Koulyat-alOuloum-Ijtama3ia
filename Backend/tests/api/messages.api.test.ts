/**
 * الرسائل — الخصوصية ومن يراسل مَن.
 *
 * كانت هذه الوحدة على **٠٪ فروع**، وهي أكثر ما يستحقّ الحراسة في المشروع بعد
 * المصادقة: الرسائل خاصّة بطبعها، وقواعدها ليست تقنية بل اجتماعية.
 *
 *   الطالب يراسل: الإدارة · أستاذه المشرف · زملاءه في الفريق — لا غير
 *   الأستاذ يراسل: الإدارة · الأساتذة · طلبة مواضيعه — لا غير
 *   والتعميم للإدارة وحدها
 *
 * وهذه القواعد وُضعت لسبب: بدونها يصير دليل المستخدمين قناةً يراسل بها أي
 * طالب أي طالب. وسطرٌ يقول «امنع» ولم يُنفَّذ قطّ لا نعرف أنه يمنع.
 *
 * وأخطر ما هنا ليس المنع بل **القراءة**: هل يستطيع أحد فتح رسالة ليست له؟
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
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
const tok: Record<string, string> = {};

/** طالبان في مشروع واحد، وثالثٌ غريب عنهما، وأستاذهما. */
let teammateA: { id: string; userId: string; reg: string };
let teammateB: { id: string; userId: string; reg: string };
let outsider: { id: string; userId: string; reg: string };

const bearer = (t: string) => `Bearer ${t}`;
const as = (r: request.Test, who: string) =>
  r.set("Authorization", bearer(tok[who]));

async function loginStudent(reg: string) {
  return (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;
}

beforeAll(async () => {
  await teardown();
  f = await seed(6);

  [teammateA, teammateB, outsider] = f.nextStudents(3);

  // مشروعٌ يضمّ A و B على موضوع الأستاذ الأوّل. `outsider` خارجه تماماً.
  const topic = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} MSG topic`,
      description: `${TAG} description`,
      maxStudents: 3,
      status: "full",
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
  const group = await prisma.projectGroup.create({
    data: { topicId: topic.id },
  });
  await prisma.projectMember.createMany({
    data: [
      { groupId: group.id, studentId: teammateA.id, isLeader: true },
      { groupId: group.id, studentId: teammateB.id },
    ],
  });

  tok.admin = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;

  tok.professor = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({
        universityEmail: f.professor.universityEmail,
        password: TEST_PASSWORD,
      })
      .expect(200)
  ).body.accessToken;

  tok.professor2 = (
    await request(app)
      .post("/api/auth/professor/login")
      .send({
        universityEmail: f.professor2.universityEmail,
        password: TEST_PASSWORD,
      })
      .expect(200)
  ).body.accessToken;

  tok.A = await loginStudent(teammateA.reg);
  tok.B = await loginStudent(teammateB.reg);
  tok.outsider = await loginStudent(outsider.reg);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

/** يرسل رسالة ويُعيد الردّ. */
const sendAs = (who: string, recipientIds: string[], subject = `${TAG} موضوع`) =>
  as(
    request(app)
      .post("/api/messages")
      .send({ recipientIds, subject, body: `${TAG} نصّ الرسالة` }),
    who,
  );

//
// ═══ من يراسل مَن ═══
//

describe("الطالب: من يستطيع مراسلته", () => {
  it("الإدارة ⇒ مسموح", async () => {
    const res = await sendAs("A", [f.admin.id]);
    expect([200, 201]).toContain(res.status);
  });

  it("أستاذه المشرف ⇒ مسموح", async () => {
    const res = await sendAs("A", [f.profUser.id]);
    expect([200, 201]).toContain(res.status);
  });

  it("زميله في الفريق ⇒ مسموح", async () => {
    const res = await sendAs("A", [teammateB.userId]);
    expect([200, 201]).toContain(res.status);
  });

  it("طالبٌ غريب عن فريقه ⇒ ممنوع", async () => {
    const res = await sendAs("A", [outsider.userId]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("وأستاذٌ ليس مشرفه ⇒ ممنوع", async () => {
    const res = await sendAs("A", [f.prof2User.id]);
    expect(res.status).toBe(400);
  });

  /** مستلمٌ واحد ممنوع يُبطل الرسالة كلّها — لا تُرسَل جزئياً. */
  it("ومستلمٌ ممنوع بين مسموحين يُبطل الرسالة كلّها", async () => {
    const before = await prisma.message.count();

    const res = await sendAs("A", [f.admin.id, outsider.userId]);
    expect(res.status).toBe(400);

    expect(await prisma.message.count()).toBe(before);
  });
});

describe("الأستاذ: من يستطيع مراسلته", () => {
  it("طالبٌ في مشروعه ⇒ مسموح", async () => {
    const res = await sendAs("professor", [teammateA.userId]);
    expect([200, 201]).toContain(res.status);
  });

  it("والإدارة ⇒ مسموح", async () => {
    const res = await sendAs("professor", [f.admin.id]);
    expect([200, 201]).toContain(res.status);
  });

  it("لكن طالباً لا صلة له بمواضيعه ⇒ ممنوع", async () => {
    const res = await sendAs("professor", [outsider.userId]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("مواضيعك");
  });

  it("وأستاذٌ آخر لا يراسل طلبة ليسوا له", async () => {
    const res = await sendAs("professor2", [teammateA.userId]);
    expect(res.status).toBe(400);
  });
});

describe("قواعد عامّة على الإرسال", () => {
  it("مستلمٌ غير موجود ⇒ 400 لا 500", async () => {
    const res = await sendAs("admin", [
      "00000000-0000-0000-0000-000000000000",
    ]);
    expect(res.status).toBe(400);
  });

  it("قائمة مستلمين فارغة ⇒ 400", async () => {
    const res = await sendAs("admin", []);
    expect(res.status).toBe(400);
  });

  it("ومراسلة النفس وحدها ⇒ 400 (تُصفّى فتبقى القائمة فارغة)", async () => {
    const res = await sendAs("admin", [f.admin.id]);
    expect(res.status).toBe(400);
  });

  it("والإدارة تراسل أي أحد", async () => {
    for (const target of [teammateA.userId, outsider.userId, f.profUser.id]) {
      const res = await sendAs("admin", [target]);
      expect([200, 201]).toContain(res.status);
    }
  });
});

//
// ═══ الخصوصية — أخطر ما في الوحدة ═══
//

describe("لا يقرأ أحدٌ رسالة ليست له", () => {
  /** رسالة من الإدارة إلى A وحده. */
  async function messageToA() {
    const res = await sendAs("admin", [teammateA.userId], `${TAG} خاصّة بـA`);
    expect([200, 201]).toContain(res.status);
    const id = res.body.message?.id ?? res.body.id ?? res.body.data?.id;
    expect(typeof id).toBe("string");
    return id as string;
  }

  it("المستلِم يقرؤها", async () => {
    const id = await messageToA();
    await as(request(app).get(`/api/messages/${id}`), "A").expect(200);
  });

  it("والمرسِل يقرؤها", async () => {
    const id = await messageToA();
    await as(request(app).get(`/api/messages/${id}`), "admin").expect(200);
  });

  /**
   * والغريب يُردّ بـ404 لا 403: «موجودة لكنها ليست لك» تُثبت وجودها، فتصير
   * الأخطاء نفسها قناة تسريب. عدم التمييز هو الصواب هنا.
   */
  it("وطالبٌ ثالث ⇒ 404، لا 403 ولا محتوى", async () => {
    const id = await messageToA();
    const res = await as(request(app).get(`/api/messages/${id}`), "outsider");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("نصّ الرسالة");
  });

  it("وأستاذٌ لا علاقة له ⇒ 404", async () => {
    const id = await messageToA();
    await as(request(app).get(`/api/messages/${id}`), "professor2").expect(404);
  });

  it("ورسالة غير موجودة ⇒ 404", async () => {
    await as(
      request(app).get(
        "/api/messages/00000000-0000-0000-0000-000000000000",
      ),
      "A",
    ).expect(404);
  });
});

describe("لا يعلّم أحدٌ رسالةَ غيره مقروءة ولا يحذفها", () => {
  async function messageToA() {
    const res = await sendAs("admin", [teammateA.userId], `${TAG} للتعليم`);
    return (res.body.message?.id ?? res.body.id) as string;
  }

  it("تعليم رسالة الغير مقروءة ⇒ 404", async () => {
    const id = await messageToA();
    await as(request(app).patch(`/api/messages/${id}/read`), "outsider").expect(
      404,
    );
  });

  it("وحذفها من صندوق الغير ⇒ 404، والرسالة باقية عند صاحبها", async () => {
    const id = await messageToA();

    await as(request(app).delete(`/api/messages/${id}`), "outsider").expect(404);

    // صاحبها ما يزال يقرؤها.
    await as(request(app).get(`/api/messages/${id}`), "A").expect(200);
  });

  it("والمستلِم يعلّمها ويحذفها من صندوقه، ونسخة المرسِل تبقى", async () => {
    const id = await messageToA();

    await as(request(app).patch(`/api/messages/${id}/read`), "A").expect(200);
    await as(request(app).delete(`/api/messages/${id}`), "A").expect(200);

    // اختفت من صندوق المستلِم…
    await as(request(app).get(`/api/messages/${id}`), "A").expect(404);
    // …وبقيت عند المرسِل.
    await as(request(app).get(`/api/messages/${id}`), "admin").expect(200);
  });
});

//
// ═══ الصناديق والعدّاد ═══
//

describe("الوارد والصادر والعدّاد", () => {
  it("الوارد يعرض ما وصلني لا ما أرسلتُه", async () => {
    await sendAs("admin", [teammateB.userId], `${TAG} إلى B وحده`);

    const inbox = await as(request(app).get("/api/messages/inbox"), "B").expect(
      200,
    );
    const body = JSON.stringify(inbox.body);
    expect(body).toContain("إلى B وحده");

    const other = await as(
      request(app).get("/api/messages/inbox"),
      "outsider",
    ).expect(200);
    expect(JSON.stringify(other.body)).not.toContain("إلى B وحده");
  });

  it("والصادر يعرض ما أرسلتُه أنا", async () => {
    await sendAs("admin", [teammateB.userId], `${TAG} صادرة من الإدارة`);

    const sent = await as(request(app).get("/api/messages/sent"), "admin").expect(
      200,
    );
    expect(JSON.stringify(sent.body)).toContain("صادرة من الإدارة");

    const notMine = await as(request(app).get("/api/messages/sent"), "B").expect(
      200,
    );
    expect(JSON.stringify(notMine.body)).not.toContain("صادرة من الإدارة");
  });

  it("وعدّاد غير المقروء ينقص عند القراءة", async () => {
    const countOf = async (who: string) => {
      const r = await as(
        request(app).get("/api/messages/unread-count"),
        who,
      ).expect(200);
      return (r.body.count ?? r.body.unread ?? r.body) as number;
    };

    const before = await countOf("B");
    const res = await sendAs("admin", [teammateB.userId], `${TAG} للعدّاد`);
    const id = (res.body.message?.id ?? res.body.id) as string;

    expect(await countOf("B")).toBe(before + 1);

    await as(request(app).patch(`/api/messages/${id}/read`), "B").expect(200);
    expect(await countOf("B")).toBe(before);
  });

  it("و«تعليم الكلّ مقروءاً» يُصفّر العدّاد", async () => {
    await sendAs("admin", [teammateB.userId], `${TAG} دفعة 1`);
    await sendAs("admin", [teammateB.userId], `${TAG} دفعة 2`);

    await as(request(app).patch("/api/messages/read-all"), "B").expect(200);

    const r = await as(
      request(app).get("/api/messages/unread-count"),
      "B",
    ).expect(200);
    expect(r.body.count ?? r.body.unread ?? r.body).toBe(0);
  });
});

//
// ═══ التعميم ═══
//

describe("التعميم للإدارة وحدها", () => {
  it("الطالب ⇒ 403", async () => {
    await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({ target: "all", subject: `${TAG} ب`, body: "نصّ" }),
      "A",
    ).expect(403);
  });

  it("والأستاذ ⇒ 403", async () => {
    await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({ target: "all", subject: `${TAG} ب`, body: "نصّ" }),
      "professor",
    ).expect(403);
  });

  it("والإدارة تُعمِّم على الطلبة، فيصل الجميع", async () => {
    const res = await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({
          target: "students",
          subject: `${TAG} تعميم للطلبة`,
          body: "نصّ التعميم",
        }),
      "admin",
    );
    expect([200, 201]).toContain(res.status);

    for (const who of ["A", "B", "outsider"]) {
      const inbox = await as(
        request(app).get("/api/messages/inbox"),
        who,
      ).expect(200);
      expect(JSON.stringify(inbox.body)).toContain("تعميم للطلبة");
    }
  });

  it("وتعميمٌ على الطلبة لا يصل الأساتذة", async () => {
    await as(
      request(app)
        .post("/api/messages/broadcast")
        .send({
          target: "students",
          subject: `${TAG} للطلبة فقط`,
          body: "نصّ",
        }),
      "admin",
    );

    const inbox = await as(
      request(app).get("/api/messages/inbox"),
      "professor",
    ).expect(200);
    expect(JSON.stringify(inbox.body)).not.toContain("للطلبة فقط");
  });
});
