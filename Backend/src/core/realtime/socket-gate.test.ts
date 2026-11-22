/**
 * بوّابة الاتصال اللحظيّ — بلا قاعدة ولا شبكة.
 *
 * اختبار الـAPI يتّصل بتوكناتٍ يصدرها الخادم نفسه. وهنا ما لا يصنعه: توكنٌ
 * قديمٌ بلا رقم إصدار، وتوكن مسؤولٍ بلا جلسة، و`auth.token` ليس نصّاً
 * فيُقرأ التوكن من الترويسة. ثم جولة الفحص: لا مسؤول متّصلاً ⇒ لا تُسأل
 * القاعدة، وتدور كلّ دقيقة وحدها.
 */
jest.mock("../prisma/client", () => ({
  prisma: { user: { findUnique: jest.fn() }, authSession: { findUnique: jest.fn(), findMany: jest.fn() } },
}));
jest.mock("../auth/tokens", () => ({ verifyToken: jest.fn() }));
jest.mock("../auth/sessions", () => ({ isSessionRevoked: jest.fn(async () => false) }));
jest.mock("../auth/refresh-sessions", () => ({ endUserSession: jest.fn(), sessionLapse: jest.fn() }));

import type { Server } from "socket.io";

import { prisma } from "../prisma/client";
import { verifyToken } from "../auth/tokens";
import {
  installSocketSecurity,
  socketAuthMiddleware,
  sweepAdminConnections,
  type AuthedSocket,
} from "./socket-auth";

const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  authSession: { findUnique: jest.Mock; findMany: jest.Mock };
};
const verify = verifyToken as jest.Mock;

const user = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  role: "student",
  status: "active",
  tokenVersion: 0,
  student: { id: "s1" },
  professor: null,
  ...over,
});

async function handshake(auth: Record<string, unknown>, authorization?: string) {
  const socket = { handshake: { auth, headers: { authorization } }, data: {} } as unknown as AuthedSocket;
  const next = jest.fn();
  await socketAuthMiddleware(socket, next);
  return { socket, next };
}

describe("socketAuthMiddleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("توكنٌ قديمٌ بلا رقم إصدار ⇒ يُعدّ الإصدار الأوّل ويُقبل", async () => {
    verify.mockReturnValue({ userId: "u1", role: "student", refId: "s1" });
    db.user.findUnique.mockResolvedValue(user());

    const { socket, next } = await handshake({ token: "t" });

    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toEqual({ userId: "u1", role: "student", refId: "s1" });
  });

  it("و`auth.token` ليس نصّاً ⇒ يُقرأ التوكن من الترويسة", async () => {
    verify.mockReturnValue({ userId: "u1", role: "student", refId: "s1", tokenVersion: 0 });
    db.user.findUnique.mockResolvedValue(user());

    const { next } = await handshake({ token: 42 }, "Bearer from-header");

    expect(verify).toHaveBeenCalledWith("from-header", "access");
    expect(next).toHaveBeenCalledWith();
  });

  it("توكن مسؤولٍ بلا جلسة ⇒ يُرفض، ولا يُسأل عن جلسة", async () => {
    verify.mockReturnValue({ userId: "a1", role: "admin", refId: "a1", tokenVersion: 0 });
    db.user.findUnique.mockResolvedValue(user({ id: "a1", role: "admin", student: null }));

    const { next } = await handshake({ token: "t" });

    expect(db.authSession.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
  });
});

describe("جولة فحص اتصالات المسؤولين", () => {
  const noAdmins = () =>
    ({ in: jest.fn(() => ({ fetchSockets: jest.fn(async () => []) })), use: jest.fn(), on: jest.fn() }) as unknown as Server & {
      in: jest.Mock;
    };

  beforeEach(() => jest.clearAllMocks());

  it("لا مسؤول متّصلاً ⇒ لا تُسأل القاعدة", async () => {
    await sweepAdminConnections(noAdmins());
    expect(db.authSession.findMany).not.toHaveBeenCalled();
  });

  /** تُركَّب مع الخادم، ثم تدور كلّ دقيقة وحدها — بلا طلبٍ يوقظها. */
  it("وتدور كلّ دقيقة بعد تركيب الحماية", async () => {
    jest.useFakeTimers();
    try {
      const io = noAdmins();
      installSocketSecurity(io);
      expect(io.in).not.toHaveBeenCalled();

      jest.advanceTimersByTime(60_000);
      expect(io.in).toHaveBeenCalledWith("role:admin");
    } finally {
      jest.useRealTimers();
    }
  });
});
