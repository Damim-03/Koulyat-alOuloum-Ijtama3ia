/**
 * سجلّ التدقيق — المرشّحات ووحدة التحكّم، بلا قاعدة بيانات.
 *
 * «التغييرات» ما كتبته الإدارة، و«الأمان» ما سواها (الدخول وكلمات المرور
 * والتحقّق بخطوتين)، و«المرفوضة» المحاولات التي رُدّت. وتاريخٌ بلا ساعةٍ في
 * «إلى» يعني اليوم كلّه، لا أوّل لحظةٍ فيه.
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: { auditLog: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() } },
}));

import type { NextFunction, Request, Response } from "express";

import { prisma } from "../../core/prisma/client";
import {
  AREAS,
  listAuditCountriesController,
  auditLogQuerySchema,
  auditLogWhere,
  auditSummaryController,
  listAuditActorsController,
  listAuditLogsController,
  listAuditLogsService,
} from "./audit-log";

const db = prisma as unknown as { auditLog: { findMany: jest.Mock; count: jest.Mock; groupBy: jest.Mock } };
const where = (q: Record<string, unknown>) => auditLogWhere(auditLogQuerySchema.parse(q));
const WRITES = ["POST ", "PATCH ", "PUT ", "DELETE "].map((v) => ({ action: { startsWith: v } }));

describe("auditLogWhere", () => {
  it("بلا مرشّح ⇒ كلّ شيء", () => {
    expect(where({})).toEqual({});
  });

  it("الأمان ما ليس كتابة، والمرفوضة ما لم ينجح، ومن فعل، ومنذ متى", () => {
    expect(where({ kind: "security", actorId: "a1", from: "2026-10-01" })).toEqual({
      AND: [{ NOT: WRITES }, { actorId: "a1" }, { createdAt: { gte: new Date("2026-10-01") } }],
    });
    expect(where({ kind: "failed" })).toEqual({ AND: [{ success: false }] });
  });

  /** «إلى 13 أكتوبر» يشمل يوم 13 كلّه. وساعةٌ مكتوبة — ولو بعد منتصف الليل بدقائق — تُؤخذ كما هي. */
  it("«إلى» بتاريخٍ وحده ⇒ نهاية اليوم؛ وبساعة ⇒ كما كُتب", () => {
    expect(where({ to: "2026-10-13" })).toEqual({ AND: [{ createdAt: { lt: new Date("2026-10-14T00:00:00Z") } }] });
    expect(where({ to: "2026-10-13T00:30:00Z" })).toEqual({ AND: [{ createdAt: { lt: new Date("2026-10-13T00:30:00Z") } }] });
    expect(where({ to: "2026-10-13T15:00:00Z" })).toEqual({ AND: [{ createdAt: { lt: new Date("2026-10-13T15:00:00Z") } }] });
  });
});

describe("listAuditLogsController", () => {
  const call = async (query: Record<string, unknown>) => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn() as unknown as NextFunction & jest.Mock;
    await listAuditLogsController({ query } as unknown as Request, res as unknown as Response, next);
    return { res, next };
  };

  it("استعلامٌ غير صالح ⇒ 400 قبل أن تُسأل القاعدة", async () => {
    const { next } = await call({ kind: "everything" });
    expect(next.mock.calls[0]![0]).toMatchObject({ statusCode: 400 });
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("وعطلٌ في القاعدة ⇒ يصل next", async () => {
    const down = new Error("database connection lost");
    db.auditLog.findMany.mockRejectedValueOnce(down);
    db.auditLog.count.mockResolvedValueOnce(0);
    const { next } = await call({});
    expect(next).toHaveBeenCalledWith(down);
  });
});

describe("auditLogWhere — the stronger filters", () => {
  it("an area, a role, a kind of act, one operation, one item, one address", () => {
    expect(where({ area: "structure", role: "professor", verb: "update", action: "PATCH /faculties/:id", targetType: "faculties", targetId: "f1", ip: "::1" })).toEqual({
      AND: [
        AREAS.structure,
        { actorRole: "professor" },
        { OR: [{ action: { startsWith: "PATCH " } }, { action: { startsWith: "PUT " } }] },
        { action: "PATCH /faculties/:id" },
        { targetType: "faculties" },
        { targetId: "f1" },
        { ip: "::1" },
      ],
    });
  });

  /** «بلا حساب»: ما لم يفعله حسابٌ — منفذ الخادم، والتنبيه، ودخولٌ إلى حسابٍ لا وجود له. */
  it("«no account» ⇒ neither an actor nor a role", () => {
    expect(where({ role: "none" })).toEqual({ AND: [{ actorId: null, actorRole: null }] });
  });

  it("the search reaches what a change was made to, by name", () => {
    const or = (where({ search: "أسامة" }) as { AND: { OR: object[] }[] }).AND[0]!.OR;
    expect(or).toContainEqual({ targetLabel: { contains: "أسامة" } });
  });
});

describe("listAuditLogsService — oldest first when asked", () => {
  it("orders by time, then by id, the way asked", async () => {
    db.auditLog.findMany.mockResolvedValueOnce([]);
    db.auditLog.count.mockResolvedValueOnce(0);
    await listAuditLogsService(auditLogQuerySchema.parse({ order: "asc", page: 2, limit: 10 }));
    expect(db.auditLog.findMany.mock.lastCall![0]).toMatchObject({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: 10, take: 10 });
  });
});

describe("who appears in the log, and the last day", () => {
  const call = async (controller: typeof listAuditActorsController, query: Record<string, unknown>) => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn();
    await controller({ query } as unknown as Request, res as unknown as Response, next as unknown as NextFunction);
    return { body: res.json.mock.lastCall?.[0], next };
  };

  it("the most active first, each by the name the log last gave them", async () => {
    const last = new Date("2026-11-09T10:00:00Z");
    db.auditLog.groupBy.mockResolvedValueOnce([
      { actorId: "a1", _count: { _all: 12 }, _max: { createdAt: last } },
      { actorId: "p1", _count: { _all: 3 }, _max: { createdAt: last } },
    ]);
    db.auditLog.findMany.mockResolvedValueOnce([{ actorId: "a1", actorLabel: "أحمد · a@univ.dz", actorRole: "admin" }]);
    const { body } = await call(listAuditActorsController, { search: "أحمد", role: "admin" });
    expect(db.auditLog.groupBy.mock.lastCall![0].where).toEqual({
      actorId: { not: null },
      actorRole: "admin",
      OR: [{ actorLabel: { contains: "أحمد" } }, { actorId: "أحمد" }],
    });
    expect(body.actors).toEqual([
      { id: "a1", label: "أحمد · a@univ.dz", role: "admin", count: 12, lastAt: last },
      { id: "p1", label: null, role: null, count: 3, lastAt: last },
    ]);
  });

  it("nobody yet ⇒ no second question to the database", async () => {
    db.auditLog.groupBy.mockResolvedValueOnce([]);
    db.auditLog.findMany.mockClear();
    const { body } = await call(listAuditActorsController, {});
    expect(body).toEqual({ actors: [] });
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("the last 24 hours: everything, the changes, the refusals, how many people", async () => {
    db.auditLog.count.mockResolvedValueOnce(40).mockResolvedValueOnce(9).mockResolvedValueOnce(2);
    db.auditLog.groupBy.mockResolvedValueOnce([{ actorId: "a" }, { actorId: "b" }]);
    const { body } = await call(auditSummaryController, {});
    expect(body).toEqual({ total: 40, changes: 9, failed: 2, people: 2 });
  });
});

describe("where from", () => {
  it("one country, by its code in either case; a code that is not one ⇒ refused", () => {
    expect(where({ country: "dz" })).toEqual({ AND: [{ country: "DZ" }] });
    expect(auditLogQuerySchema.safeParse({ country: "Algeria" }).success).toBe(false);
  });

  it("the search reaches the city, the wilaya and the network", () => {
    const or = (where({ search: "Djezzy" }) as { AND: { OR: object[] }[] }).AND[0]!.OR;
    expect(or).toEqual(expect.arrayContaining([{ city: { contains: "Djezzy" } }, { region: { contains: "Djezzy" } }, { isp: { contains: "Djezzy" } }]));
  });

  it("the countries in the log, the most frequent first", async () => {
    db.auditLog.groupBy.mockResolvedValueOnce([
      { country: "DZ", _count: { _all: 40 } },
      { country: "FR", _count: { _all: 2 } },
    ]);
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    await listAuditCountriesController({ query: {} } as unknown as Request, res as unknown as Response, jest.fn() as unknown as NextFunction);
    expect(db.auditLog.groupBy.mock.lastCall![0]).toMatchObject({ by: ["country"], where: { country: { not: null } } });
    expect(res.json).toHaveBeenCalledWith({ countries: [{ country: "DZ", count: 40 }, { country: "FR", count: 2 }] });
  });
});
