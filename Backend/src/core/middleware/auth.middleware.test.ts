/**
 * وسيط المصادقة — ما لا يصنعه اختبار API بتوكنٍ يصدره الخادم نفسه.
 *
 * توكنٌ قديمٌ صدر قبل أن يُحمل رقم الإصدار (`tokenVersion`) يُعدّ الإصدار
 * الأوّل. وتوكن مسؤولٍ بلا جلسة (`sid`) لا جلسة تُحسب عليها مدّته، فيُردّ
 * — ولا جلسة تُنهى. وعطلٌ في القاعدة لا يُقرأ رفضاً للتوكن: 500 لا 401.
 */
jest.mock("../prisma/client", () => ({
  prisma: { user: { findUnique: jest.fn() }, authSession: { findUnique: jest.fn() } },
}));
jest.mock("../auth/tokens", () => ({ verifyToken: jest.fn() }));
jest.mock("../auth/sessions", () => ({ isSessionRevoked: jest.fn(async () => false) }));
jest.mock("../auth/refresh-sessions", () => ({
  endUserSession: jest.fn(),
  sessionLapse: jest.fn(),
  touchSession: jest.fn(),
}));
jest.mock("../realtime/realtime", () => ({ disconnectSessions: jest.fn() }));

import type { NextFunction, Response } from "express";

import { prisma } from "../prisma/client";
import { verifyToken } from "../auth/tokens";
import { endUserSession } from "../auth/refresh-sessions";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { tr } from "../i18n";
import { authMiddleware, type AuthenticatedRequest } from "./auth.middleware";

const db = prisma as unknown as { user: { findUnique: jest.Mock }; authSession: { findUnique: jest.Mock } };
const verify = verifyToken as jest.Mock;

const user = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  role: "student",
  status: "active",
  tokenVersion: 0,
  mustChangePassword: false,
  totpEnabledAt: null,
  student: { id: "s1" },
  professor: null,
  ...over,
});

async function call() {
  const req = { headers: { authorization: "Bearer t" }, baseUrl: "/api/student", path: "/topics", method: "GET" } as unknown as AuthenticatedRequest;
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn() as unknown as NextFunction & jest.Mock;
  await authMiddleware(req, res as unknown as Response, next);
  return { req, res, next };
}

describe("authMiddleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("توكنٌ قديمٌ بلا رقم إصدار ⇒ يُعدّ الإصدار الأوّل ويُقبل", async () => {
    verify.mockReturnValue({ userId: "u1", role: "student", refId: "s1" });
    db.user.findUnique.mockResolvedValue(user());

    const { req, next } = await call();

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ userId: "u1", role: "student", refId: "s1" });
  });

  it("توكن مسؤولٍ بلا جلسة ⇒ 401، ولا جلسة تُنهى", async () => {
    verify.mockReturnValue({ userId: "a1", role: "admin", refId: "a1", tokenVersion: 0 });
    db.user.findUnique.mockResolvedValue(user({ id: "a1", role: "admin", student: null }));

    const { res, next } = await call();

    expect(next).not.toHaveBeenCalled();
    expect(db.authSession.findUnique).not.toHaveBeenCalled();
    expect(endUserSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: tr("auth.sessionRevoked"),
      errorCode: ErrorCodeEnum.AUTH_INVALID_TOKEN,
    });
  });

  it("عطلٌ في القاعدة ⇒ 500، لا «توكن غير صالح»", async () => {
    verify.mockReturnValue({ userId: "u1", role: "student", refId: "s1", tokenVersion: 0 });
    db.user.findUnique.mockRejectedValue(new Error("connection lost"));

    const { res, next } = await call();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: tr("auth.failed") });
  });
});
