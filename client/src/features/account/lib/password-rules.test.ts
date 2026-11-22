import { describe, expect, it } from "vitest";
import { passwordChecks, passwordIssue, passwordLevel } from "./password-rules";

// The same cases as the server's own tests (Backend/src/core/auth/password-policy.test.ts):
// the two copies of the rules must agree.
describe("password rules — in step with the server", () => {
  it("accepts strong passwords and long passphrases", () => {
    for (const ok of ["Tamtam#Oasis42", "vélo-rouge-17", "Kh9!mPq2wz", "نخلة_الوادي٢٠٢٦x", "le soleil se leve tard"]) {
      expect(passwordIssue(ok)).toBeNull();
    }
  });

  it("length, mix, common, pattern", () => {
    expect(passwordIssue("Ab1!x")).toBe("tooShort");
    expect(passwordIssue("ا".repeat(37))).toBe("tooLong");
    expect(passwordIssue("12/05/2003")).toBe("needsMix");
    expect(passwordIssue("goodmorning")).toBe("needsMix");
    for (const weak of ["password1", "Passw0rd@2026", "azerty123", "Algerie2026", "a1z2e3r4t5y6"]) {
      expect([weak, passwordIssue(weak)]).toEqual([weak, "common"]);
    }
    for (const weak of ["bcdefgh1", "qsdfghjk9", "aaaa1111", "abab1212", "12345678a"]) {
      expect([weak, passwordIssue(weak)]).toEqual([weak, "pattern"]);
    }
  });

  it("allows the owner's name, refuses only their id number", () => {
    const owner = { registrationNumber: "202131012345" };
    for (const ok of ["Benali#2026", "Ahmed2026", "Mohamed-1998", "اسامة_2026!", "محمد2003x"]) {
      expect([ok, passwordIssue(ok, owner)]).toEqual([ok, null]);
    }
    expect(passwordIssue("x202131012345y", owner)).toBe("personal");
    expect(passwordChecks("x202131012345y", owner).notPersonal).toBe(false);
  });

  it("levels: refused, then better with length, symbols and both cases", () => {
    expect(passwordLevel("")).toBe(0);
    expect(passwordLevel("azerty123")).toBe(1);
    expect(passwordLevel("tamtamoasis9")).toBe(3);
    expect(passwordLevel("oasis-9x")).toBe(3);
    expect(passwordLevel("oasis9xy")).toBe(2);
    expect(passwordLevel("Tamtam#Oasis42")).toBe(4);
  });
});
