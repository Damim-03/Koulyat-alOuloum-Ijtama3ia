import { prisma } from "../../core/prisma/client";
import { NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { tr } from "../../core/i18n";
import { assertYearOpen } from "../../core/academic/year-open";
import { proposalWindowState, windowBounds } from "../../core/academic/proposal-window";
import { notifyRolesQuietly } from "../notification/notification.service";
import type { ProposalWindowDTO } from "./admin.validation";

/**
 * فترة اقتراح المواضيع لسنةٍ جامعية — تحديدها وتمديدها وإلغاؤها، وما جرى
 * فيها. لكلّ سنةٍ فترةٌ واحدة لكلّ الأساتذة؛ والحارس الذي يرفض الاقتراح
 * خارجها في core/academic/proposal-window.
 */

const yearOf = async (id: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id },
    select: { id: true, title: true, isActive: true, archivedAt: true, proposalsOpenAt: true, proposalsCloseAt: true },
  });
  if (!year) throw new NotFoundException(tr("notFound.academicYear"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return year;
};

/**
 * الفترة وحالها، وما يحتاجه المسؤول ليتابعها: كم موضوعاً لهذه السنة، وكم
 * أستاذاً اقترح منها من أساتذة المنصّة العاملين — فيُعرف من بقي.
 */
export const proposalWindowService = async (id: string) => {
  const year = await yearOf(id);
  const [topics, proposers, professors] = await Promise.all([
    prisma.graduationTopic.count({ where: { academicYearId: id } }),
    prisma.graduationTopic.findMany({ where: { academicYearId: id }, select: { professorId: true }, distinct: ["professorId"] }),
    prisma.professor.count({ where: { user: { status: "active" } } }),
  ]);
  return {
    year,
    state: proposalWindowState(year),
    stats: { topics, professorsProposed: proposers.length, professorsTotal: professors },
  };
};

/**
 * يحدّد الفترة أو يغيّرها، ويُبلغ كلّ الأساتذة بتواريخها — «حُدّدت» أوّل
 * مرّة، و«تغيّرت» بعدها. وحفظٌ لم يغيّر التواريخ لا يُرسل شيئاً: لا جرس بلا خبر.
 */
export const setProposalWindowService = async (id: string, data: ProposalWindowDTO) => {
  const year = await yearOf(id);
  await assertYearOpen(id);

  const bounds = windowBounds(data.opensOn, data.closesOn, data.opensTime, data.closesTime);
  const before = year.proposalsOpenAt;
  const instants = (open: Date | null, close: Date | null) => [open, close].map((d) => d?.getTime()).join();
  const same =
    instants(year.proposalsOpenAt, year.proposalsCloseAt) === instants(bounds.proposalsOpenAt, bounds.proposalsCloseAt);
  await prisma.academicYear.update({ where: { id }, data: bounds });

  if (!same) {
    const params = {
      year: year.title,
      from: bounds.proposalsOpenAt.toISOString(),
      to: bounds.proposalsCloseAt.toISOString(),
    };
    const kind = before ? "notif.proposalWindowMoved" : "notif.proposalWindowSet";
    await notifyRolesQuietly(
      ["professor"],
      {
        type: "general",
        title: { key: `${kind}.title`, params },
        message: { key: `${kind}.message`, params },
        link: "/professor/topics",
      },
      "notifyProfessors",
    );
  }
  return proposalWindowService(id);
};

/** يلغي الفترة: يعود الاقتراح بلا قيدٍ زمنيّ، كما كان قبل تحديدها. */
export const clearProposalWindowService = async (id: string) => {
  await yearOf(id);
  await prisma.academicYear.update({ where: { id }, data: { proposalsOpenAt: null, proposalsCloseAt: null } });
  return proposalWindowService(id);
};
