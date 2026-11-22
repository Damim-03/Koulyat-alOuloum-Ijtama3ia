import { prisma } from "../prisma/client";
import { BadRequestException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";

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
      tr("year.archivedNoWrite", { title: y.title }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
};
