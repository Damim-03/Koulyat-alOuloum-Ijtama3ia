/**
 * الحياة والجاهزية — بلا حساب، ولا يقولان شيئاً عن الداخل.
 *
 * `/api/health` يجيب ما دامت العملية حيّة. و`/api/ready` يسأل القاعدة: إن لم
 * تجب فـ503 بلا نصّ المُشغِّل ولا العنوان ولا اسم الخادم.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("الحياة والجاهزية", () => {
  it("/api/health ⇒ حيّ", async () => {
    expect((await request(app).get("/api/health").expect(200)).body).toEqual({ status: "ok" });
  });

  it("/api/ready ⇒ جاهزٌ حين تجيب القاعدة، و503 بلا تفاصيل حين لا تجيب", async () => {
    expect((await request(app).get("/api/ready").expect(200)).body).toEqual({ status: "ready" });

    const down = jest
      .spyOn(prisma as unknown as { $queryRaw: () => Promise<unknown> }, "$queryRaw")
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:3306"));
    try {
      expect((await request(app).get("/api/ready").expect(503)).body).toEqual({ status: "unavailable" });
    } finally {
      down.mockRestore();
    }
  });
});
