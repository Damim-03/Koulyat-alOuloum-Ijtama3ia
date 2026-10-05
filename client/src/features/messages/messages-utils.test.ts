/**
 * وسم التعميم: القديم (`students:<id>`) والجديد (`students|أسماء`) يُقرآن معاً،
 * وعلامات المستوى والمشروع تُترجم عند العرض لا عند الحفظ.
 */
import { describe, it, expect } from "vitest";
import { broadcastLabel, parseBroadcast, isThreadOpen, setOpenThread } from "./messages-utils";

const t = (k: string) => k;

describe("parseBroadcast / broadcastLabel", () => {
  it("الوسم الجديد: الجمهور ثم المستوى والمشروع ثم الأسماء", () => {
    const tag = "students|علم النفس العيادي · @master · 2026/2027 · @project-without";
    expect(parseBroadcast(tag)).toMatchObject({
      target: "students",
      names: ["علم النفس العيادي", "2026/2027"],
      tokens: ["master", "project-without"],
    });
    expect(broadcastLabel(tag, t)).toBe(
      "msg.audience.target.students · msg.level.master · msg.audience.project-without · علم النفس العيادي · 2026/2027",
    );
  });

  it("والقديم يبقى مقروءاً", () => {
    expect(broadcastLabel("professors", t)).toBe("msg.audience.target.professors");
    expect(broadcastLabel("students:5b1c0000-0000-0000-0000-000000000000", t)).toBe(
      "msg.audience.target.students · msg.audience.oneSpecialization",
    );
    expect(parseBroadcast(null)).toBeNull();
  });
});

describe("المحادثة المفتوحة", () => {
  it("لا تُنبَّه لرسالةٍ محادثتُها أمامك", () => {
    setOpenThread("root-1");
    expect(isThreadOpen("root-1")).toBe(true);
    expect(isThreadOpen("root-2")).toBe(false);
    setOpenThread(null);
    expect(isThreadOpen("root-1")).toBe(false);
  });
});
