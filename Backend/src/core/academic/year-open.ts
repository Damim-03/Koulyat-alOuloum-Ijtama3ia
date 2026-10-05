import { prisma } from "../prisma/client";
import { BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";

/**
 * A closed year is a record, not a workspace: nothing new is filed under it
 * — no student, no topic — until the administration reopens it.
 */
export const assertYearOpen = async (yearId: string | null | undefined) => {
  if (!yearId) return;
  const y = await prisma.academicYear.findUnique({
    where: { id: yearId },
    select: { title: true, archivedAt: true },
  });
  if (y?.archivedAt)
    throw new BadRequestException(
      `السنة الجامعية «${y.title}» مغلقةٌ ومحفوظة في الأرشيف — لا تُضاف إليها بيانات جديدة. أعد فتحها من صفحة الأرشيف إن لزم.`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
};
