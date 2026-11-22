import { z } from "zod";

import { prisma } from "../prisma/client";
import { BadRequestException, NotFoundException } from "../utils/appErros";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";
import { entityId } from "../validation/id";

/**
 * ============================================================
 * WHAT A TOPIC CARRIES BESIDE ITS TITLE
 * ============================================================
 *
 * Three things the official list of proposed topics prints (the department's
 * sheet): the co-supervisor, a short description, and the topic's type.
 *
 * - The co-supervisor is a professor on the platform — never a name typed in
 *   — and never the supervisor themself.
 * - The short description is a line or two; the full description stays where
 *   it was.
 * - The type is one of the types the administration set for the department of
 *   the topic's specialization (AI, cybersecurity…).
 *
 * Every path that creates or edits a topic — the professor's, the
 * administration's, with or without a group — reads them here, by one rule.
 * `null` clears a field; leaving it out keeps it.
 */
export const topicExtrasShape = {
  coSupervisorId: entityId.nullable().optional(),
  summary: z.string().trim().max(300).nullable().optional(),
  typeId: entityId.nullable().optional(),
};

export interface TopicExtrasInput {
  coSupervisorId?: string | null;
  summary?: string | null;
  typeId?: string | null;
}

interface Current {
  coSupervisorId?: string | null;
  typeId?: string | null;
}

/**
 * The extras as they will be written, checked against the topic as it will
 * be: its supervisor and its specialization after this change. A field left
 * out is checked too when what it depends on changes — a new supervisor who
 * is the co-supervisor, a specialization in another department than the type.
 */
export async function resolveTopicExtras(
  input: TopicExtrasInput,
  topic: { professorId: string; specializationId: string },
  current: Current = {},
): Promise<{ coSupervisorId?: string | null; summary?: string | null; typeId?: string | null }> {
  const out: { coSupervisorId?: string | null; summary?: string | null; typeId?: string | null } = {};

  if (input.summary !== undefined) out.summary = input.summary ? input.summary : null;

  const coSupervisorId = input.coSupervisorId !== undefined ? input.coSupervisorId : (current.coSupervisorId ?? null);
  if (coSupervisorId) {
    if (coSupervisorId === topic.professorId)
      throw new BadRequestException(tr("topic.coSupervisorSelf"), ErrorCodeEnum.VALIDATION_ERROR);
    if (input.coSupervisorId !== undefined) {
      const found = await prisma.professor.findUnique({ where: { id: coSupervisorId }, select: { id: true } });
      if (!found) throw new NotFoundException(tr("topic.coSupervisorNotFound"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
  }
  if (input.coSupervisorId !== undefined) out.coSupervisorId = input.coSupervisorId;

  const typeId = input.typeId !== undefined ? input.typeId : (current.typeId ?? null);
  if (typeId) {
    const [type, spec] = await Promise.all([
      prisma.topicType.findUnique({ where: { id: typeId }, select: { departmentId: true } }),
      prisma.specialization.findUnique({
        where: { id: topic.specializationId },
        select: { filiere: { select: { departmentId: true } } },
      }),
    ]);
    if (!type) throw new NotFoundException(tr("topic.typeNotFound"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
    if (spec && spec.filiere.departmentId !== type.departmentId)
      throw new BadRequestException(tr("topic.typeOtherDepartment"), ErrorCodeEnum.VALIDATION_ERROR);
  }
  if (input.typeId !== undefined) out.typeId = input.typeId;

  return out;
}

/** What a topic's reader gets of them: the co-supervisor by name, the type with its code and colour. */
export const topicExtrasSelect = {
  summary: true,
  coSupervisor: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
    },
  },
  type: { select: { id: true, name: true, code: true, color: true } },
} as const;
