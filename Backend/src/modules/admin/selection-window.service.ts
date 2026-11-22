import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { tr } from "../../core/i18n";
import { assertYearOpen } from "../../core/academic/year-open";
import { selectionBounds, selectionWindowState } from "../../core/academic/selection-window";
import { AVAILABLE_TO_STUDENTS } from "../../core/topic/topic-status";
import { createNotifications } from "../notification/notification.service";
import type { ProposalWindowDTO } from "./admin.validation";

/**
 * مهلة اختيار المواضيع لسنةٍ جامعية — تحديدها وتمديدها وإلغاؤها، وما جرى
 * فيها. لكلّ سنةٍ مهلةٌ واحدة لكلّ طلبتها؛ والحارس الذي يرفض الطلب خارجها
 * في core/academic/selection-window.
 */

const yearOf = async (id: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      isActive: true,
      archivedAt: true,
      // The proposals' period beside it: the page warns when choosing opens before proposing ends.
      proposalsOpenAt: true,
      proposalsCloseAt: true,
      selectionOpenAt: true,
      selectionCloseAt: true,
    },
  });
  if (!year) throw new NotFoundException(tr("notFound.academicYear"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return year;
};

/**
 * المهلة وحالها، وما يحتاجه المسؤول ليتابعها: كم موضوعاً متاحاً للاختيار،
 * وكم طالباً من طلبة السنة العاملين في طلبٍ حيّ (أرسله أو هو فيه) — فيُعرف
 * من بقي — وكم طلباً ينتظر قراره.
 */
export const selectionWindowService = async (id: string) => {
  const year = await yearOf(id);
  const live = { status: { in: ["pending", "accepted"] as ("pending" | "accepted")[] }, topic: { academicYearId: id } };
  const [topics, studentsTotal, requesters, pendingRequests] = await Promise.all([
    prisma.graduationTopic.count({ where: { academicYearId: id, ...AVAILABLE_TO_STUDENTS } }),
    prisma.student.count({ where: { academicYearId: id, user: { status: "active" } } }),
    // The leader is one of the members (modules/student): one table says who is in a request.
    prisma.groupRequestMember.findMany({ where: { request: live }, select: { studentId: true }, distinct: ["studentId"] }),
    prisma.groupRequest.count({ where: { status: "pending", topic: { academicYearId: id } } }),
  ]);
  return {
    year,
    state: selectionWindowState(year),
    stats: { topics, studentsRequested: requesters.length, studentsTotal, pendingRequests },
  };
};

/** Tells every active student of the year; a bell that cannot ring is said in the log, and the save stands. */
async function tellStudents(yearId: string, kind: "set" | "moved", params: Record<string, string>) {
  try {
    const users = await prisma.user.findMany({
      where: { status: "active", student: { academicYearId: yearId } },
      select: { id: true },
    });
    const key = kind === "set" ? "notif.selectionWindowSet" : "notif.selectionWindowMoved";
    await createNotifications(
      users.map((u) => ({
        userId: u.id,
        type: "general" as const,
        title: { key: `${key}.title`, params },
        message: { key: `${key}.message`, params },
        link: "/topics",
      })),
    );
  } catch (error) {
    console.error(JSON.stringify({ level: "error", scope: "notifyStudents", message: (error as Error)?.message }));
  }
}

/**
 * يحدّد المهلة أو يغيّرها، ويُبلغ طلبة السنة بتواريخها — «حُدّدت» أوّل
 * مرّة، و«تغيّرت» بعدها. وحفظٌ لم يغيّر التواريخ لا يُرسل شيئاً.
 */
export const setSelectionWindowService = async (id: string, data: ProposalWindowDTO) => {
  const year = await yearOf(id);
  await assertYearOpen(id);

  const bounds = selectionBounds(data.opensOn, data.closesOn, data.opensTime, data.closesTime);
  const instants = (open: Date | null, close: Date | null) => [open, close].map((d) => d?.getTime()).join();
  const same = instants(year.selectionOpenAt, year.selectionCloseAt) === instants(bounds.selectionOpenAt, bounds.selectionCloseAt);
  await prisma.academicYear.update({ where: { id }, data: bounds });

  if (!same) {
    await tellStudents(id, year.selectionOpenAt ? "moved" : "set", {
      year: year.title,
      from: bounds.selectionOpenAt.toISOString(),
      to: bounds.selectionCloseAt.toISOString(),
    });
  }
  return selectionWindowService(id);
};

/** يلغي المهلة: يعود الاختيار بلا قيدٍ زمنيّ، كما كان قبل تحديدها. */
export const clearSelectionWindowService = async (id: string) => {
  await yearOf(id);
  await prisma.academicYear.update({ where: { id }, data: { selectionOpenAt: null, selectionCloseAt: null } });
  return selectionWindowService(id);
};
