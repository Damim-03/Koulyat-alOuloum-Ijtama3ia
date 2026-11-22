import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../core/prisma/client";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage } from "../../core/i18n";
import { entityId } from "../../core/validation/id";

/**
 * What a topic form offers beside its title (core/topic/topic-extras):
 *
 * - `GET /common/topic-types` — the types of a department, or of the
 *   department of a specialization: the professor picks the topic's type
 *   among them.
 * - `GET /common/professors` — the platform's professors by name, to pick a
 *   co-supervisor. For professors and the administration only (the route
 *   says so): a student has no topic form, and no use for a staff list.
 */

const typesQuery = z.object({ departmentId: entityId.optional(), specializationId: entityId.optional() });

export const listTopicTypeOptionsService = async (q: { departmentId?: string; specializationId?: string }) => {
  let departmentId = q.departmentId;
  if (!departmentId && q.specializationId) {
    const spec = await prisma.specialization.findUnique({
      where: { id: q.specializationId },
      select: { filiere: { select: { departmentId: true } } },
    });
    // An unknown specialization offers no type, not an error: the form just shows none.
    if (!spec) return { types: [] };
    departmentId = spec.filiere.departmentId;
  }
  const types = await prisma.topicType.findMany({
    where: departmentId ? { departmentId } : undefined,
    select: { id: true, name: true, code: true, color: true, departmentId: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return { types };
};

/**
 * Active professors, by name; the department beside it tells two namesakes
 * apart. The reader is marked (`isMe`): a professor is not their own
 * co-supervisor, and the form knows it without asking for their profile.
 */
export const listProfessorOptionsService = async (me?: string) => {
  const professors = await prisma.professor.findMany({
    where: { user: { status: "active" } },
    select: {
      id: true,
      department: { select: { id: true, name: true } },
      user: { select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });
  return {
    professors: professors.map((p) => ({ id: p.id, department: p.department, ...p.user, isMe: p.id === me })),
  };
};

export const listTopicTypeOptionsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = typesQuery.safeParse(req.query);
    if (!parsed.success) throw new BadRequestException(issuesMessage(parsed.error.issues), ErrorCodeEnum.VALIDATION_ERROR);
    return res.status(HTTPSTATUS.OK).json(await listTopicTypeOptionsService(parsed.data));
  } catch (e) {
    next(e);
  }
};

export const listProfessorOptionsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // `refId` is the professor's id for a professor (core/middleware/auth).
    const me = req.user?.role === "professor" ? req.user.refId : undefined;
    return res.status(HTTPSTATUS.OK).json(await listProfessorOptionsService(me));
  } catch (e) {
    next(e);
  }
};
