/**
 * ثوابت حالة الموضوع — اختبارات تكامل على قاعدة الاختبار.
 *
 * هذه هي الـ٣٥ تأكيداً التي قادت إصلاح `GraduationTopic.status` من أوّله،
 * منقولةً من `scripts/checks/` إلى الإطار. السيناريوهات لم تتغيّر حرفاً:
 * نفس الحالات ونفس الترتيب ونفس ما تؤكّده. ما تغيّر ثلاثة أشياء لا رابع لها:
 *
 *   1. تعمل على `kouliate_ouloum_test` لا على قاعدة التطوير.
 *   2. تدخل في `npm test` ووضع المراقبة والتغطية.
 *   3. وصف الفشل لم يعد يُكتب يدوياً — Jest يطبع المتوقَّع والواقع.
 *
 * كل تأكيد يصف **ما يوجبه الثابت**، لا ما تفعله الشيفرة. وهذا ما جعلها
 * تُكتب حمراء أوّلاً ثم تخضرّ مرحلةً بعد مرحلة.
 */
import { prisma } from "../../src/core/prisma/client";
import * as admin from "../../src/modules/admin/admin.service";
import * as student from "../../src/modules/student/student.service";
import * as pub from "../../src/modules/public/public.service";
import {
  seed,
  makeTopic,
  teardown,
  residue,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;

beforeAll(async () => {
  await teardown(); // بقايا تشغيل انقطع سابقاً
  // عدد كبير عمداً: الموزّع يمنح كل سيناريو طلبةً لم يُستعملوا قطّ، وإعادة
  // الاستعمال هي ما أنتج نجاحاً كاذباً من قبل.
  f = await seed(160);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ─── أدوات مشتركة ────────────────────────────────────────────────
//

/** ينفّذ ويُعيد رسالة الخطأ، أو null إن نجح. */
const attempt = async (fn: () => Promise<unknown>): Promise<string | null> => {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

const statusOf = async (id: string) =>
  (await prisma.graduationTopic.findUnique({ where: { id } }))!.status;

/** ما يُعلنه الخادم عن موضوع: ما يجوز عليه، ولماذا لا. */
const readActions = async (id: string) =>
  (
    (await admin.getTopicByIdService(id)) as unknown as {
      actions: {
        canApprove: boolean;
        canReject: boolean;
        canPublish: boolean;
        canUnpublish: boolean;
        canArchive: boolean;
        canUnarchive: boolean;
        canDelete: boolean;
        canAssignGroup: boolean;
        blockedReasons: Record<string, string | undefined>;
      };
    }
  ).actions;

/** ينشئ موضوعاً منشوراً، ويقدّم فريقاً عليه، وتقبله الإدارة. */
async function acceptedProject(title: string, maxStudents = 3) {
  const [leader, member] = f.nextStudents(2);
  const topic = await makeTopic(f, title, "open", maxStudents);
  const request = (await student.createGroupRequestService(leader.userId, {
    topicId: topic.id,
    memberRegistrationNumbers: [member.reg],
    priority: 1,
  } as never)) as { id: string };
  await admin.acceptGroupRequestService(request.id);
  const group = (await prisma.projectGroup.findUnique({
    where: { topicId: topic.id },
  }))!;
  return { topic, request, group, leader, member };
}

/** يفسخ المشروع بالإجراء الصريح. */
const dissolve = (groupId: string) =>
  admin.dissolveProjectService(groupId, { reason: "test" });

//
// ═══════════════════════════════════════════════════════════════
//

describe('I1 — status = "full" ⟺ للموضوع مجموعة', () => {
  it("قبول الطلب ينشئ المجموعة ويجعل الحالة full", async () => {
    const { topic, group } = await acceptedProject("I1 accept");
    expect(group).not.toBeNull();
    expect(await statusOf(topic.id)).toBe("full");
  });

  it("فسخ المجموعة يُخرج الحالة من full", async () => {
    const { topic, group } = await acceptedProject("I1 dissolve");
    await dissolve(group.id);

    expect(await statusOf(topic.id)).not.toBe("full");
    expect(
      await prisma.projectGroup.findUnique({ where: { topicId: topic.id } }),
    ).toBeNull();
  });
});

describe("I2 — المجموعة وطلبها المصدر يحييان ويموتان معاً", () => {
  it("بعد الفسخ لا يبقى طلب accepted على الموضوع", async () => {
    const { request, group } = await acceptedProject("I2 pair");
    await dissolve(group.id);

    const req = await prisma.groupRequest.findUnique({
      where: { id: request.id },
    });
    expect(req?.status).not.toBe("accepted");
  });

  it("بعد الفسخ يتحرّر الحجز (activeTopicId)", async () => {
    const { request, group } = await acceptedProject("I2 reservation");
    await dissolve(group.id);

    const req = await prisma.groupRequest.findUnique({
      where: { id: request.id },
    });
    expect(req?.activeTopicId ?? null).toBeNull();
  });

  it("رفض طلب accepted مرفوض — المشروع القائم لا يُفكَّك من شاشة الطلبات", async () => {
    const { request, group } = await acceptedProject("I2 reject-accepted");

    const err = await attempt(() =>
      admin.rejectGroupRequestService(request.id, "test"),
    );

    expect(err).not.toBeNull();
    const groupAfter = await prisma.projectGroup.findUnique({
      where: { id: group.id },
      include: { members: true },
    });
    expect(groupAfter?.members).toHaveLength(2);
  });
});

describe("I3 — الرجوع من الاكتمال دقيق لا تخميني", () => {
  it('موضوع كان "open" يعود "open" بعد الفسخ', async () => {
    const { topic, group } = await acceptedProject("I3 was-open");
    await dissolve(group.id);
    expect(await statusOf(topic.id)).toBe("open");
  });

  it("الخروج من الإشغال بأي باب يعطي نفس الحالة", async () => {
    // الباب الأوّل: فسخ المجموعة.
    const a = await acceptedProject("I3 door-dissolve");
    await dissolve(a.group.id);
    const viaDissolve = await statusOf(a.topic.id);

    // الباب الثاني: رفض الطلب قبل قبوله.
    const [leader, member] = f.nextStudents(2);
    const topicB = await makeTopic(f, "I3 door-pending", "open");
    const reqB = (await student.createGroupRequestService(leader.userId, {
      topicId: topicB.id,
      memberRegistrationNumbers: [member.reg],
      priority: 1,
    } as never)) as { id: string };
    await admin.rejectGroupRequestService(reqB.id, "test");
    const viaReject = await statusOf(topicB.id);

    expect(viaDissolve).toBe(viaReject);
  });
});

describe("I3b — القرار الإداري يذهب ويعود بلا فقدان", () => {
  it("pending ← approve → approved", async () => {
    const topic = await makeTopic(f, "I3b approve", "pending");
    await admin.approveTopicService(topic.id);
    expect(await statusOf(topic.id)).toBe("approved");
  });

  it("approved ← publish → open، ويُسجَّل وقت النشر", async () => {
    const topic = await makeTopic(f, "I3b publish", "approved");
    await admin.publishTopicService(topic.id);

    const row = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(row?.status).toBe("open");
    expect(row?.publishedAt).not.toBeNull();
  });

  it("open ← unpublish → approved، ويُمحى وقت النشر", async () => {
    const topic = await makeTopic(f, "I3b unpublish", "approved");
    await admin.publishTopicService(topic.id);
    await admin.unpublishTopicService(topic.id);

    const row = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(row?.status).toBe("approved");
    expect(row?.publishedAt).toBeNull();
  });

  it("open ← archive → archived", async () => {
    const topic = await makeTopic(f, "I3b archive", "approved");
    await admin.publishTopicService(topic.id);
    await admin.archiveTopicService(topic.id);
    expect(await statusOf(topic.id)).toBe("archived");
  });

  /** التخمين القديم كان يُعيد كل موضوع مؤرشف «معتمداً» فيُفقده نشره. */
  it('موضوع منشور أُرشف يعود "open" لا "approved" — الأرشفة لا تُلغي النشر', async () => {
    const topic = await makeTopic(f, "I3b unarchive", "approved");
    await admin.publishTopicService(topic.id);
    await admin.archiveTopicService(topic.id);
    await admin.unarchiveTopicService(topic.id);
    expect(await statusOf(topic.id)).toBe("open");
  });

  it("الرفض يحفظ سببه، والاعتماد بعده يمحوه", async () => {
    const topic = await makeTopic(f, "I3b reason", "pending");

    await admin.rejectTopicService(topic.id, {
      reason: "سبب الاختبار",
    } as never);
    const rejected = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.rejectionReason).toBe("سبب الاختبار");

    await admin.approveTopicService(topic.id);
    const reapproved = await prisma.graduationTopic.findUnique({
      where: { id: topic.id },
    });
    expect(reapproved?.status).toBe("approved");
    expect(reapproved?.rejectionReason).toBeNull();
  });

  it("الموضوع المُسنَد يصل full بالإسقاط، ويبقى غير منشور", async () => {
    const [leader, member] = f.nextStudents(2);
    const created = (await admin.createAssignedTopicService({
      title: `${TAG} I3b assigned`,
      description: `${TAG} description`,
      maxStudents: 3,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
      leaderStudentId: leader.id,
      memberStudentIds: [leader.id, member.id],
    } as never)) as { id: string };

    const row = await prisma.graduationTopic.findUnique({
      where: { id: created.id },
    });
    expect(row?.status).toBe("full");
    expect(row?.publishedAt).toBeNull();
    // مجموعة بلا طلب — فـ`full` لا تعني «عليه طلب».
    expect(
      await prisma.groupRequest.count({ where: { topicId: created.id } }),
    ).toBe(0);
  });
});

describe("I4 — الإتاحة تُحسب من الإشغال لا من status وحده", () => {
  it("موضوع فُسخت مجموعته يعود مرئياً للطلبة", async () => {
    const { topic, group } = await acceptedProject("I4 freed");
    await dissolve(group.id);

    const [onlooker] = f.nextStudents(1);
    const browse = (await student.browseTopicsService(onlooker.userId, {
      page: 1,
      limit: 100,
    } as never)) as { id: string }[];

    expect(browse.map((t) => t.id)).toContain(topic.id);
  });

  it("وفريق آخر يستطيع طلبه", async () => {
    const { topic, group } = await acceptedProject("I4 reclaim");
    await dissolve(group.id);

    const [leader, member] = f.nextStudents(2);
    const err = await attempt(() =>
      student.createGroupRequestService(leader.userId, {
        topicId: topic.id,
        memberRegistrationNumbers: [member.reg],
        priority: 1,
      } as never),
    );

    expect(err).toBeNull();
  });

  /**
   * الحالة العالقة التي أنتجها الفسخ الناقص قبل الإصلاح: موضوع `approved`
   * بلا مجموعة لكن عليه طلب مقبول يحجزه. نشره يضع في قائمة الطلبة شيئاً لا
   * يستطيع أحد أخذه.
   */
  it("النشر لا ينجح على موضوع محجوز بطلب حيّ", async () => {
    const { topic } = await acceptedProject("I4 publish-guard");

    const g = await prisma.projectGroup.findUnique({
      where: { topicId: topic.id },
    });
    await prisma.projectMember.deleteMany({ where: { groupId: g!.id } });
    await prisma.projectGroup.delete({ where: { id: g!.id } });
    await prisma.graduationTopic.update({
      where: { id: topic.id },
      data: { status: "approved" },
    });

    const err = await attempt(() => admin.publishTopicService(topic.id));
    expect(err).not.toBeNull();
  });

  it('تبويب "محجوز" العامّ يعرض الموضوع الذي اكتمل بطلب', async () => {
    const { topic } = await acceptedProject("I4 public-reserved");

    const reserved = (await pub.listPublicTopicsService({
      page: 1,
      limit: 100,
      availability: "reserved",
      search: `${TAG} I4 public-reserved`,
    } as never)) as { items: { id: string }[] };

    expect(reserved.items.map((t) => t.id)).toContain(topic.id);
  });
});

describe("I5 — القائد ينتقل مع المجموعة ويقبل التصحيح", () => {
  it("قبول الطلب ينقل المرسِل إلى المجموعة كقائد واحد", async () => {
    const { request, group } = await acceptedProject("I5 leader");

    const reqRow = await prisma.groupRequest.findUnique({
      where: { id: request.id },
    });
    const leaders = await prisma.projectMember.findMany({
      where: { groupId: group.id, isLeader: true },
      select: { studentId: true },
    });

    expect(leaders).toHaveLength(1);
    expect(leaders[0].studentId).toBe(reqRow!.leaderStudentId);
  });

  it("للإدارة إجراء لتغيير قائد المشروع بعد الاكتمال", () => {
    expect(typeof admin.setProjectLeaderService).toBe("function");
  });

  it("وتغيير القائد ينقل العلامة إلى عضو واحد فقط", async () => {
    const { group, leader, member } = await acceptedProject("I5 set-leader");

    await admin.setProjectLeaderService(group.id, member.id);

    const leaders = await prisma.projectMember.findMany({
      where: { groupId: group.id, isLeader: true },
      select: { studentId: true },
    });
    expect(leaders).toHaveLength(1);
    expect(leaders[0].studentId).toBe(member.id);
    expect(leaders[0].studentId).not.toBe(leader.id);
  });

  it("وإخراج القائد يورّث القيادة لعضو باقٍ، لا يترك المجموعة بلا قائد", async () => {
    const { group, leader } = await acceptedProject("I5 leader-removed");
    const [third] = f.nextStudents(1);
    await admin.assignStudentService(group.id, {
      studentId: third.id,
    } as never);

    await admin.removeProjectMemberService(group.id, leader.id);

    const leaders = await prisma.projectMember.findMany({
      where: { groupId: group.id, isLeader: true },
      select: { studentId: true },
    });
    expect(leaders).toHaveLength(1);
    expect(leaders[0].studentId).not.toBe(leader.id);
    expect(
      await prisma.projectMember.count({ where: { groupId: group.id } }),
    ).toBe(2);
  });

  it("ولا يُعيَّن قائد من خارج المجموعة، ولا يتجاوز الإسناد الحدّ الأقصى", async () => {
    const { group } = await acceptedProject("I5 guards", 3);
    const [outsider, extra] = f.nextStudents(2);

    expect(
      await attempt(() => admin.setProjectLeaderService(group.id, outsider.id)),
    ).not.toBeNull();

    // maxStudents=3 والمجموعة فيها 2 ⇒ الثالث يمرّ، والرابع لا.
    await admin.assignStudentService(group.id, { studentId: extra.id } as never);
    expect(
      await attempt(() =>
        admin.assignStudentService(group.id, {
          studentId: outsider.id,
        } as never),
      ),
    ).not.toBeNull();
  });
});

describe("I6 — الحذف محروس، وسببه يصل الواجهة", () => {
  it("الخادم يرفض حذف موضوع مؤرشف تشكّلت له مجموعة", async () => {
    const { topic } = await acceptedProject("I6 archived-full");
    await admin.archiveTopicService(topic.id);

    expect(await attempt(() => admin.deleteTopicService(topic.id))).not.toBeNull();
  });

  it("وحمولة القائمة تحمل حكم الخادم على الحذف بدل تركه للواجهة", async () => {
    const { topic } = await acceptedProject("I6 list-actions");
    await admin.archiveTopicService(topic.id);

    const listed = (await admin.listTopicsService({
      page: 1,
      limit: 100,
      search: `${TAG} I6 list-actions`,
    } as never)) as { items: Record<string, unknown>[] };
    const row = listed.items.find((i) => i.id === topic.id);

    expect(row).toBeDefined();
    expect((row!.actions as { canDelete: boolean }).canDelete).toBe(false);
  });

  it("ولا يُحذف موضوع فريقٌ ينتظر قراره", async () => {
    const topic = await makeTopic(f, "I6 pending-request", "open");
    const [leader, member] = f.nextStudents(2);
    await student.createGroupRequestService(leader.userId, {
      topicId: topic.id,
      memberRegistrationNumbers: [member.reg],
      priority: 1,
    } as never);

    expect(await attempt(() => admin.deleteTopicService(topic.id))).not.toBeNull();
  });

  it("ولا تُسنَد مجموعة إلى موضوع فريقٌ ينتظر قراره", async () => {
    const topic = await makeTopic(f, "I6 assign-over-request", "open");
    const [qLeader, qMember] = f.nextStudents(2);
    await student.createGroupRequestService(qLeader.userId, {
      topicId: topic.id,
      memberRegistrationNumbers: [qMember.reg],
      priority: 1,
    } as never);

    // طلبة جدد تماماً: لو أُعيد استعمال طالب صار في مشروع سابق لرفضه الخادم
    // لسبب آخر، فقرأنا الرفض حارساً وليس هناك حارس.
    const [aLeader, aMember] = f.nextStudents(2);
    const err = await attempt(() =>
      admin.updateAssignedTopicService(topic.id, {
        leaderStudentId: aLeader.id,
        memberStudentIds: [aLeader.id, aMember.id],
      } as never),
    );

    expect(err).not.toBeNull();
  });
});

/**
 * الثابت الذي يمنع عودة العطل الأصلي.
 *
 * لا يكفي أن يكون الحكم صحيحاً اليوم: يجب أن يستحيل أن يفترق الحارس عن
 * المُعلَن. فلكل حالة موضوع ولكل إجراء: يُقرأ ما يقوله `actions`، ثم يُنفَّذ
 * الإجراء فعلاً، ثم يُقارَن.
 */
describe("I6b — المُعلَن يطابق المُنفَّذ في كل حالة", () => {
  it("الحكم المُعلَن = الحكم المُنفَّذ في 7×7 حالة", async () => {
    let n = 0;
    const builders: Record<string, () => Promise<string>> = {
      pending: async () => (await makeTopic(f, `M${n++} pending`, "pending")).id,
      approved: async () =>
        (await makeTopic(f, `M${n++} approved`, "approved")).id,
      open: async () => (await makeTopic(f, `M${n++} open`, "open")).id,
      "open+فريق منتظر": async () => {
        const [l, m] = f.nextStudents(2);
        const t = await makeTopic(f, `M${n++} waiting`, "open");
        await student.createGroupRequestService(l.userId, {
          topicId: t.id,
          memberRegistrationNumbers: [m.reg],
          priority: 1,
        } as never);
        return t.id;
      },
      full: async () => (await acceptedProject(`M${n++} full`)).topic.id,
      archived: async () => {
        const t = await makeTopic(f, `M${n++} archived`, "approved");
        await admin.archiveTopicService(t.id);
        return t.id;
      },
      "archived+مجموعة": async () => {
        const { topic } = await acceptedProject(`M${n++} arch-full`);
        await admin.archiveTopicService(topic.id);
        return topic.id;
      },
    };

    const runners: Record<
      string,
      {
        flag: keyof Awaited<ReturnType<typeof readActions>>;
        run: (id: string) => Promise<unknown>;
      }
    > = {
      approve: {
        flag: "canApprove",
        run: (id) => admin.approveTopicService(id),
      },
      reject: {
        flag: "canReject",
        run: (id) => admin.rejectTopicService(id, { reason: "m" } as never),
      },
      publish: {
        flag: "canPublish",
        run: (id) => admin.publishTopicService(id),
      },
      unpublish: {
        flag: "canUnpublish",
        run: (id) => admin.unpublishTopicService(id),
      },
      archive: {
        flag: "canArchive",
        run: (id) => admin.archiveTopicService(id),
      },
      unarchive: {
        flag: "canUnarchive",
        run: (id) => admin.unarchiveTopicService(id),
      },
      delete: { flag: "canDelete", run: (id) => admin.deleteTopicService(id) },
    };

    const mismatches: string[] = [];
    for (const [stateName, build] of Object.entries(builders)) {
      for (const [actionName, { flag, run: doIt }] of Object.entries(runners)) {
        const id = await build();
        const declared = (await readActions(id))[flag];
        const err = await attempt(() => doIt(id));
        const actuallyWorked = err === null;
        if (declared !== actuallyWorked) {
          mismatches.push(
            `${stateName} × ${actionName}: أُعلن ${declared ? "متاح" : "ممنوع"} ` +
              `لكنه ${actuallyWorked ? "نجح" : `رُفض (${err})`}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("ولكل إجراء ممنوع سببٌ نصّي جاهز للعرض", async () => {
    const { topic } = await acceptedProject("I6b reasons");
    const a = await readActions(topic.id);

    const blockedWithoutReason = (
      [
        ["approve", a.canApprove],
        ["reject", a.canReject],
        ["publish", a.canPublish],
        ["unpublish", a.canUnpublish],
        ["unarchive", a.canUnarchive],
        ["delete", a.canDelete],
      ] as const
    )
      .filter(([, allowed]) => !allowed)
      .filter(([key]) => !a.blockedReasons[key])
      .map(([key]) => key);

    expect(blockedWithoutReason).toEqual([]);
  });
});

describe("I7 — المشروع القائم لا يُفقد ضمناً", () => {
  it("إزالة آخر عضو مرفوضة وتوجّه إلى إجراء الفسخ الصريح", async () => {
    const { group } = await acceptedProject("I7 last-member");
    const members = await prisma.projectMember.findMany({
      where: { groupId: group.id },
      select: { studentId: true },
    });

    await admin.removeProjectMemberService(group.id, members[0].studentId);
    const err = await attempt(() =>
      admin.removeProjectMemberService(group.id, members[1].studentId),
    );

    expect(err).not.toBeNull();
    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).not.toBeNull();
  });

  it("وللإدارة إجراء فسخ صريح واحد للتراجع عن اكتمال خاطئ", () => {
    expect(typeof admin.dissolveProjectService).toBe("function");
  });
});

describe("I7b — الفسخ لا يبتلع عملاً قائماً", () => {
  it("مشروع عليه تسليم لا يُفسَخ", async () => {
    const { group, leader } = await acceptedProject("I7b submission");
    const milestone = await prisma.milestone.create({
      data: {
        title: `${TAG} مرحلة`,
        deadline: new Date(Date.now() + 86_400_000),
        order: 1,
        groupId: group.id,
      },
    });
    const leaderUser = (await prisma.student.findUnique({
      where: { id: leader.id },
      select: { userId: true },
    }))!;
    await prisma.submission.create({
      data: {
        fileUrl: "/uploads/test.pdf",
        fileName: "test.pdf",
        version: 1,
        milestoneId: milestone.id,
        uploadedById: leaderUser.userId,
      },
    });

    const err = await attempt(() => admin.dissolveProjectService(group.id));

    expect(err).not.toBeNull();
    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).not.toBeNull();

    await prisma.submission.deleteMany({ where: { milestoneId: milestone.id } });
  });

  it("ومشروع له مناقشة مبرمجة لا يُفسَخ", async () => {
    const { group } = await acceptedProject("I7b defense");
    await prisma.defense.create({
      data: {
        date: new Date(Date.now() + 86_400_000),
        room: `${TAG}-room`,
        groupId: group.id,
      },
    });

    const err = await attempt(() => admin.dissolveProjectService(group.id));

    expect(err).not.toBeNull();
    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).not.toBeNull();

    await prisma.defense.deleteMany({ where: { groupId: group.id } });
  });

  it("ومشروع بلا عمل قائم يُفسَخ، ويُبلَّغ بما حُذف، ويعود الموضوع للتداول", async () => {
    const { group } = await acceptedProject("I7b clean");
    await prisma.milestone.create({
      data: {
        title: `${TAG} خطة بلا تسليم`,
        deadline: new Date(Date.now() + 86_400_000),
        order: 1,
        groupId: group.id,
      },
    });

    const out = (await admin.dissolveProjectService(group.id, {
      reason: "قُبل الفريق الخطأ",
    })) as {
      removedMembers: number;
      removedMilestones: number;
      topicStatus: string;
    };

    expect(out.removedMembers).toBe(2);
    expect(out.removedMilestones).toBe(1);
    expect(out.topicStatus).toBe("open");
    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).toBeNull();
    expect(
      await prisma.milestone.count({ where: { groupId: group.id } }),
    ).toBe(0);
  });

  it("ويعرف الطلبة أن مشروعهم فُسخ ولماذا", async () => {
    const { topic, group, leader, member } = await acceptedProject(
      "I7b notified",
    );

    await admin.dissolveProjectService(group.id, {
      reason: "قُبل الفريق الخطأ",
    });

    expect(
      await prisma.notification.count({
        where: {
          user: { student: { id: { in: [leader.id, member.id] } } },
          title: "فُسخت مجموعتكم",
        },
      }),
    ).toBe(2);

    const req = await prisma.groupRequest.findFirst({
      where: { topicId: topic.id },
      select: { status: true, activeTopicId: true, rejectionReason: true },
    });
    expect(req?.status).toBe("rejected");
    expect(req?.activeTopicId).toBeNull();
    expect(req?.rejectionReason).toBe("قُبل الفريق الخطأ");
  });
});
