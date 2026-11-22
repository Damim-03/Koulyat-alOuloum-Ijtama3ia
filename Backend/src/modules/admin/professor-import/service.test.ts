/**
 * أرقامٌ وظيفيةٌ لمن تُرك رقمه: لا تتكرّر فيما بينها، ولا مع ما كُتب في
 * الملف، ولا مع ما في المنصّة — والتصادم يُصنع هنا بمولّدٍ مزيّف.
 */
jest.mock("../../../core/prisma/client", () => ({ prisma: { professor: { findMany: jest.fn() } } }));
jest.mock("../admin.service", () => ({ randomEmployeeNumber: jest.fn() }));

import { prisma } from "../../../core/prisma/client";
import { randomEmployeeNumber } from "../admin.service";
import { freshEmployeeNumbers } from "./service";

const findMany = prisma.professor.findMany as jest.Mock;
const random = randomEmployeeNumber as jest.Mock;
const draws = (...values: string[]) => {
  for (const v of values) random.mockReturnValueOnce(v);
};
const takenIn = (used: string[]) => async ({ where }: { where: { employeeNumber: { in: string[] } } }) =>
  where.employeeNumber.in.filter((n) => used.includes(n)).map((employeeNumber) => ({ employeeNumber }));

beforeEach(() => {
  findMany.mockReset().mockImplementation(takenIn([]));
  random.mockReset();
});

describe("freshEmployeeNumbers", () => {
  it("يتخطّى ما كُتب في الملف وما سبق سحبه", async () => {
    draws("RESERVED", "A", "A", "B");
    expect(await freshEmployeeNumbers(2, new Set(["RESERVED"]))).toEqual(["A", "B"]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("وما وُجد في المنصّة يُستبدل في جولةٍ تالية", async () => {
    findMany.mockImplementation(takenIn(["A"]));
    draws("A", "B", "C");
    expect(await freshEmployeeNumbers(2, new Set())).toEqual(["B", "C"]);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("وبعد عشر جولاتٍ بلا كفاية يستسلم برسالةٍ مفهومة", async () => {
    let n = 0;
    random.mockImplementation(() => `N${++n}`);
    findMany.mockImplementation(async ({ where }: { where: { employeeNumber: { in: string[] } } }) =>
      where.employeeNumber.in.map((employeeNumber) => ({ employeeNumber })),
    );
    await expect(freshEmployeeNumbers(1, new Set())).rejects.toThrow("تعذّر توليد أرقامٍ وظيفية فريدة");
    expect(findMany).toHaveBeenCalledTimes(10);
  });

  it("ولا شيء يُطلب ⇒ لا سؤال", async () => {
    expect(await freshEmployeeNumbers(0, new Set())).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
