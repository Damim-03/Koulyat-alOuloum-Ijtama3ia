import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../core/prisma/client";
import { BadRequestException, HttpException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage, tr } from "../../core/i18n";
import { entityId } from "../../core/validation/id";

/**
 * ============================================================
 * TOPIC TYPES — the axes of a department's topics
 * ============================================================
 *
 * The administration sets, for each department, the kinds of topics it
 * proposes (artificial intelligence, cybersecurity, IoT…): a name, the
 * letters of a code (AI ⇒ AI01, AI02… on the official list) and a colour
 * (the topic's row on that list). A professor proposing a topic picks one of
 * the types of its specialization's department (core/topic/topic-extras).
 *
 * A type with topics on it is not deleted — they would lose it silently —
 * the administration moves them first. A code is unique in its department,
 * whatever its case (the database compares them so).
 */

const code = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9]{0,7}$/);
const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((c) => c.toLowerCase());

export const createTopicTypeSchema = z.object({
  departmentId: entityId,
  name: z.string().trim().min(1).max(80),
  code,
  color,
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export const updateTopicTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    code: code.optional(),
    color: color.optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "empty" });
export type CreateTopicTypeDTO = z.infer<typeof createTopicTypeSchema>;
export type UpdateTopicTypeDTO = z.infer<typeof updateTopicTypeSchema>;

const listQuery = z.object({ departmentId: entityId.optional() });

const SELECT = {
  id: true,
  name: true,
  code: true,
  color: true,
  sortOrder: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  _count: { select: { topics: true } },
} as const;

const shape = <T extends { _count: { topics: number } }>({ _count, ...t }: T) => ({ ...t, topicsCount: _count.topics });

/** The code is unique in its department, whatever its case. */
async function assertCodeFree(departmentId: string, value: string, except?: string) {
  const taken = await prisma.topicType.findMany({ where: { departmentId }, select: { id: true, code: true } });
  if (taken.some((t) => t.id !== except && t.code.toLowerCase() === value.toLowerCase()))
    throw new HttpException(tr("topicType.codeTaken", { code: value }), HTTPSTATUS.CONFLICT, ErrorCodeEnum.VALIDATION_ERROR);
}

const typeOf = async (id: string) => {
  const t = await prisma.topicType.findUnique({ where: { id }, select: { id: true, departmentId: true } });
  if (!t) throw new NotFoundException(tr("topic.typeNotFound"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return t;
};

export const listTopicTypesService = async (departmentId?: string) => {
  const types = await prisma.topicType.findMany({
    where: departmentId ? { departmentId } : undefined,
    select: SELECT,
    orderBy: [{ department: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
  });
  return { types: types.map(shape) };
};

export const createTopicTypeService = async (data: CreateTopicTypeDTO) => {
  const department = await prisma.department.findUnique({ where: { id: data.departmentId }, select: { id: true } });
  if (!department) throw new NotFoundException(tr("notFound.department"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  await assertCodeFree(data.departmentId, data.code);
  // A new type goes last unless told where.
  const sortOrder =
    data.sortOrder ??
    ((await prisma.topicType.aggregate({ where: { departmentId: data.departmentId }, _max: { sortOrder: true } }))._max
      .sortOrder ?? -1) + 1;
  const type = await prisma.topicType.create({ data: { ...data, sortOrder }, select: SELECT });
  return { type: shape(type) };
};

export const updateTopicTypeService = async (id: string, data: UpdateTopicTypeDTO) => {
  const current = await typeOf(id);
  if (data.code !== undefined) await assertCodeFree(current.departmentId, data.code, id);
  const type = await prisma.topicType.update({ where: { id }, data, select: SELECT });
  return { type: shape(type) };
};

export const deleteTopicTypeService = async (id: string) => {
  await typeOf(id);
  const count = await prisma.graduationTopic.count({ where: { typeId: id } });
  if (count > 0)
    throw new HttpException(tr("topicType.inUse", { count }), HTTPSTATUS.CONFLICT, ErrorCodeEnum.VALIDATION_ERROR);
  await prisma.topicType.delete({ where: { id } });
  return { deleted: true };
};

// ─── controllers ───────────────────────────────────────────────

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(issuesMessage(parsed.error.issues), ErrorCodeEnum.VALIDATION_ERROR);
  return parsed.data;
}

export const listTopicTypesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { departmentId } = parse(listQuery, req.query);
    return res.status(HTTPSTATUS.OK).json(await listTopicTypesService(departmentId));
  } catch (e) {
    next(e);
  }
};

export const createTopicTypeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(HTTPSTATUS.CREATED).json(await createTopicTypeService(parse(createTopicTypeSchema, req.body)));
  } catch (e) {
    next(e);
  }
};

export const updateTopicTypeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = parse(updateTopicTypeSchema, req.body);
    return res.status(HTTPSTATUS.OK).json(await updateTopicTypeService(req.params.id as string, data));
  } catch (e) {
    next(e);
  }
};

export const deleteTopicTypeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(HTTPSTATUS.OK).json(await deleteTopicTypeService(req.params.id as string));
  } catch (e) {
    next(e);
  }
};
