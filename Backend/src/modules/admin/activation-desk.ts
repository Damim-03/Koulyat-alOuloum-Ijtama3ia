import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../../core/prisma/client";
import { config } from "../../core/config/app.config";
import { BadRequestException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage, tr } from "../../core/i18n";
import { entityId } from "../../core/validation/id";
import { nameSearchFilter } from "./admin.service";

/**
 * ============================================================
 * THE ACTIVATION PAGE: THE STUDENTS
 * ============================================================
 *
 * A student's first password is a birth date, printed on their own card —
 * known to anyone who has seen it. A student replaces it, then sends two
 * photos — the card, and their face (modules/activation/activation-request);
 * an administrator who sees the face is the card's holder verifies the account.
 *
 * Here, beside those requests: where the students stand (the page's header),
 * any student found — by the card's QR code (read by a camera or a scanner,
 * it carries the registration number), the number typed, a name, or a filter
 * on where they stand — and everything about them on one page.
 *
 * Whether a student's first sign-in goes on to the photos is a setting
 * (REQUIRE_STUDENT_ACTIVATION).
 */

export const deskLookupSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(64),
});

const DESK_SELECT = {
  id: true,
  registrationNumber: true,
  specialization: { select: { name: true, level: true } },
  academicYear: { select: { title: true } },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstNameLatin: true,
      lastNameLatin: true,
      status: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  },
} as const;

/** The student whose card was scanned, or whose number was typed. */
export async function deskLookupService(registrationNumber: string) {
  const s = await prisma.student.findUnique({ where: { registrationNumber }, select: DESK_SELECT });
  if (!s) throw new NotFoundException(tr("notFound.student"), ErrorCodeEnum.RESOURCE_NOT_FOUND);
  return {
    id: s.id,
    registrationNumber: s.registrationNumber,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    firstNameLatin: s.user.firstNameLatin,
    lastNameLatin: s.user.lastNameLatin,
    specialization: s.specialization,
    academicYear: s.academicYear.title,
    status: s.user.status,
    /** Chose a password of their own — the handed-out one is gone. */
    activated: !s.user.mustChangePassword,
    lastLoginAt: s.user.lastLoginAt,
  };
}

/** How activation is set up — shown on its page. */
export const deskSettings = () => ({
  required: config.REQUIRE_STUDENT_ACTIVATION,
});

/** The page's header: the setting, and where the students stand. */
export async function deskOverviewService() {
  const [students, notActivated, verified, suspended, pendingRequests] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { user: { mustChangePassword: true } } }),
    prisma.student.count({ where: { user: { isVerified: true } } }),
    prisma.student.count({ where: { user: { status: "suspended" } } }),
    prisma.activationRequest.count({ where: { status: "pending" } }),
  ]);
  return { ...deskSettings(), counts: { students, notActivated, verified, suspended, pendingRequests } };
}

// ─── Finding a student without the card: the filtered list ───

export const DESK_STATES = ["all", "notActivated", "activated", "verified", "unverified", "requested", "suspended"] as const;

export const deskStudentsSchema = z.object({
  /** A name (any order, Arabic or Latin) or part of a registration number. */
  q: z.string().trim().max(120).optional(),
  state: z.enum(DESK_STATES).optional().default("all"),
  specializationId: entityId.optional(),
  academicYearId: entityId.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});
export type DeskStudentsQuery = z.infer<typeof deskStudentsSchema>;

const NAMES = { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true } as const;

/** The students the desk is looking for: by name or number, by where they stand, by specialization and year. */
export async function deskStudentsService(q: DeskStudentsQuery) {
  const and: Record<string, unknown>[] = [];
  if (q.q) {
    const byName = nameSearchFilter(q.q, (f) => ({ user: f }));
    and.push({ OR: [...(byName ? [byName] : []), { registrationNumber: { contains: q.q } }] });
  }
  const state: Record<(typeof DESK_STATES)[number], Record<string, unknown> | null> = {
    all: null,
    notActivated: { user: { mustChangePassword: true } },
    activated: { user: { mustChangePassword: false } },
    verified: { user: { isVerified: true } },
    unverified: { user: { isVerified: false } },
    requested: { user: { activationRequest: { is: { status: "pending" } } } },
    suspended: { user: { status: "suspended" } },
  };
  if (state[q.state]) and.push(state[q.state]!);
  if (q.specializationId) and.push({ specializationId: q.specializationId });
  if (q.academicYearId) and.push({ academicYearId: q.academicYearId });
  const where = and.length ? { AND: and } : {};

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        registrationNumber: true,
        specialization: { select: { name: true, level: true } },
        academicYear: { select: { title: true } },
        user: {
          select: {
            ...NAMES,
            gender: true,
            avatarUrl: true,
            status: true,
            isVerified: true,
            mustChangePassword: true,
            lastLoginAt: true,
            activationRequest: { select: { status: true, sentAt: true } },
          },
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  const items = rows.map(({ user: u, ...s }) => ({
    id: s.id,
    registrationNumber: s.registrationNumber,
    firstName: u.firstName,
    lastName: u.lastName,
    firstNameLatin: u.firstNameLatin,
    lastNameLatin: u.lastNameLatin,
    gender: u.gender,
    avatarUrl: u.avatarUrl,
    specialization: s.specialization,
    academicYear: s.academicYear.title,
    status: u.status,
    activated: !u.mustChangePassword,
    verified: u.isVerified,
    lastLoginAt: u.lastLoginAt,
    pendingRequest: u.activationRequest?.status === "pending" ? { sentAt: u.activationRequest.sentAt } : null,
  }));
  return { items, total, page: q.page, limit: q.limit };
}

// ─── Everything about the student at the desk, on one page ───

const TOPIC = {
  id: true,
  title: true,
  status: true,
  professor: { select: { user: { select: NAMES } } },
} as const;

/**
 * The student in full, for the administration deciding on them: who they are,
 * where they study, the topics they asked for and the project they have, and
 * what the account has done lately (the audit log's own record of it).
 */
export async function deskProfileService(studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      registrationNumber: true,
      academicYear: { select: { title: true, isActive: true } },
      specialization: {
        select: {
          name: true,
          level: true,
          filiere: { select: { name: true, department: { select: { name: true, faculty: { select: { name: true } } } } } },
        },
      },
      user: {
        select: {
          id: true,
          ...NAMES,
          email: true,
          username: true,
          phone: true,
          gender: true,
          avatarUrl: true,
          status: true,
          isVerified: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          activationRequest: { select: { status: true, sentAt: true, rejectionReason: true, decidedAt: true } },
          _count: { select: { devices: true } },
        },
      },
      ledGroupRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          rejectionReason: true,
          topic: { select: TOPIC },
          members: { select: { student: { select: { registrationNumber: true, user: { select: NAMES } } } } },
        },
      },
      groupRequestMembers: {
        orderBy: { createdAt: "desc" },
        select: {
          request: {
            select: {
              id: true,
              leaderStudentId: true,
              status: true,
              priority: true,
              createdAt: true,
              rejectionReason: true,
              topic: { select: TOPIC },
              leader: { select: { registrationNumber: true, user: { select: NAMES } } },
            },
          },
        },
      },
      projectMembers: {
        select: {
          isLeader: true,
          group: {
            select: {
              id: true,
              topic: { select: TOPIC },
              defense: { select: { date: true, room: true, grade: true, status: true } },
              milestones: { select: { status: true } },
              members: { select: { isLeader: true, student: { select: { registrationNumber: true, user: { select: NAMES } } } } },
            },
          },
        },
      },
    },
  });
  if (!s) throw new NotFoundException(tr("notFound.student"), ErrorCodeEnum.RESOURCE_NOT_FOUND);

  const activity = await prisma.auditLog.findMany({
    where: { actorId: s.user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, action: true, success: true, createdAt: true, ip: true, userAgent: true },
  });

  const u = s.user;
  const r = u.activationRequest;
  const person = (p: { registrationNumber: string; user: Record<keyof typeof NAMES, string | null> }) => ({
    registrationNumber: p.registrationNumber,
    ...p.user,
  });
  const requests = [
    ...s.ledGroupRequests.map((g) => ({
      id: g.id,
      role: "leader" as const,
      status: g.status,
      priority: g.priority,
      createdAt: g.createdAt,
      rejectionReason: g.rejectionReason,
      topic: { id: g.topic.id, title: g.topic.title, status: g.topic.status, supervisor: g.topic.professor.user },
      // The others in it: a request's members include its leader.
      team: g.members.filter((m) => m.student.registrationNumber !== s.registrationNumber).map((m) => person(m.student)),
    })),
    // Requests led by someone else — the leader's own are listed above.
    ...s.groupRequestMembers.filter(({ request: g }) => g.leaderStudentId !== s.id).map(({ request: g }) => ({
      id: g.id,
      role: "member" as const,
      status: g.status,
      priority: g.priority,
      createdAt: g.createdAt,
      rejectionReason: g.rejectionReason,
      topic: { id: g.topic.id, title: g.topic.title, status: g.topic.status, supervisor: g.topic.professor.user },
      team: [person(g.leader)],
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const membership = s.projectMembers[0];
  const project = membership
    ? {
        id: membership.group.id,
        leader: membership.isLeader,
        topic: { id: membership.group.topic.id, title: membership.group.topic.title, supervisor: membership.group.topic.professor.user },
        defense: membership.group.defense,
        milestones: {
          total: membership.group.milestones.length,
          completed: membership.group.milestones.filter((m) => m.status === "completed").length,
          overdue: membership.group.milestones.filter((m) => m.status === "overdue").length,
        },
        team: membership.group.members.map((m) => ({ ...person(m.student), leader: m.isLeader })),
      }
    : null;

  return {
    id: s.id,
    registrationNumber: s.registrationNumber,
    personal: {
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      firstNameLatin: u.firstNameLatin,
      lastNameLatin: u.lastNameLatin,
      email: u.email,
      username: u.username,
      phone: u.phone,
      gender: u.gender,
      avatarUrl: u.avatarUrl,
    },
    academic: {
      faculty: s.specialization.filiere.department.faculty.name,
      department: s.specialization.filiere.department.name,
      filiere: s.specialization.filiere.name,
      specialization: { name: s.specialization.name, level: s.specialization.level },
      academicYear: s.academicYear.title,
      currentYear: s.academicYear.isActive,
    },
    account: {
      status: u.status,
      activated: !u.mustChangePassword,
      verified: u.isVerified,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      devices: u._count.devices,
      request: r
        ? {
            status: r.status,
            sentAt: r.sentAt,
            rejectionReason: r.rejectionReason,
            decidedAt: r.decidedAt,
          }
        : null,
    },
    requests,
    project,
    activity,
  };
}

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(issuesMessage(parsed.error.issues), ErrorCodeEnum.VALIDATION_ERROR);
  return parsed.data;
};

/** `GET /admin/activation/settings` — the setting, and the counts in the page's header. */
export async function deskSettingsController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(HTTPSTATUS.OK).json(await deskOverviewService());
  } catch (error) {
    next(error);
  }
}

/** `GET /admin/activation/students?q=&state=&specializationId=&academicYearId=&page=` */
export async function deskStudentsController(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(HTTPSTATUS.OK).json(await deskStudentsService(parse(deskStudentsSchema, req.query)));
  } catch (error) {
    next(error);
  }
}

/** `GET /admin/activation/students/:id` — everything about the student, on one page. */
export async function deskProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(HTTPSTATUS.OK).json(await deskProfileService(parse(entityId, req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** `GET /admin/activation/student?registrationNumber=…` */
export async function deskLookupController(req: Request, res: Response, next: NextFunction) {
  try {
    const { registrationNumber } = parse(deskLookupSchema, req.query);
    res.status(HTTPSTATUS.OK).json(await deskLookupService(registrationNumber));
  } catch (error) {
    next(error);
  }
}
