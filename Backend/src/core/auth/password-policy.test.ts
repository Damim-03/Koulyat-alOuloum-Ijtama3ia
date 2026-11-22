import { normalizeForCompare, passwordIssue } from "./password-policy";

describe("passwordIssue — what a chosen password may not be", () => {
  it("accepts ordinary strong passwords and long passphrases", () => {
    for (const ok of ["Tamtam#Oasis42", "vélo-rouge-17", "Kh9!mPq2wz", "نخلة_الوادي٢٠٢٦x", "le soleil se leve tard"]) {
      expect(passwordIssue(ok)).toBeNull();
    }
  });

  it("length: at least 8 characters, at most 72 bytes", () => {
    expect(passwordIssue("Ab1!x")).toBe("tooShort");
    expect(passwordIssue("ا".repeat(37))).toBe("tooLong"); // 74 bytes
  });

  it("needs letters with digits or symbols — unless it is a long passphrase", () => {
    expect(passwordIssue("12/05/2003")).toBe("needsMix"); // a birth date
    expect(passwordIssue("20030512")).toBe("needsMix");
    expect(passwordIssue("goodmorning")).toBe("needsMix");
    expect(passwordIssue("goodmorningsunshinefriend")).toBeNull();
  });

  it("refuses the passwords everyone tries, dressed up or not", () => {
    for (const weak of ["password1", "Passw0rd@2026", "P@ssw0rd!", "azerty123", "Azerty2024!", "motdepasse1", "Algerie2026", "a1z2e3r4t5y6", "123memoire"]) {
      expect([weak, passwordIssue(weak)]).toEqual([weak, "common"]);
    }
  });

  it("refuses runs and repetitions", () => {
    for (const weak of ["bcdefgh1", "qsdfghjk9", "aaaa1111", "abab1212", "12345678a", "zyxwvu12"]) {
      expect([weak, passwordIssue(weak)]).toEqual([weak, "pattern"]);
    }
  });

  it("allows its owner's name — common first names included", () => {
    const owner = { registrationNumber: "202131012345" };
    for (const ok of ["Benali#2026", "Ahmed2026", "Mohamed-1998", "اسامة_2026!", "محمد2003x"]) {
      expect([ok, passwordIssue(ok, owner)]).toEqual([ok, null]);
    }
    // The other rules still ask for more than the name alone.
    expect(passwordIssue("Benali", owner)).toBe("tooShort");
    expect(passwordIssue("Benaliahmed", owner)).toBe("needsMix");
  });

  it("refuses its owner's registration or employee number", () => {
    expect(passwordIssue("x202131012345y", { registrationNumber: "202131012345" })).toBe("personal");
    expect(passwordIssue("Wahat#0000123456789", { employeeNumber: "0000123456789" })).toBe("personal");
  });
});

describe("normalizeForCompare", () => {
  it("unifies case, accents and Arabic letter forms", () => {
    expect(normalizeForCompare("Élève")).toBe("eleve");
    expect(normalizeForCompare("أحْمَد")).toBe("احمد");
    expect(normalizeForCompare("فاطمة")).toBe("فاطمه");
  });
});
