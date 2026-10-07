import { studentsCount } from "./student-export.service";

describe("studentsCount — العدد والمعدود", () => {
  it.each([
    [0, "لا طلبة"],
    [1, "طالبٌ واحد"],
    [2, "طالبان"],
    [3, "3 طلاب"],
    [10, "10 طلاب"],
    [11, "11 طالباً"],
    [27, "27 طالباً"],
    [99, "99 طالباً"],
    [100, "100 طالب"],
    [103, "103 طلاب"],
    [120, "120 طالباً"],
  ])("%i ⇒ %s", (n, text) => {
    expect(studentsCount(n)).toBe(text);
  });
});
