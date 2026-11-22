import {
  base32Decode,
  base32Encode,
  hashRecoveryCode,
  hotp,
  matchTotp,
  newRecoveryCodes,
  otpauthUrl,
  stepAt,
  totpAt,
} from "./totp";
import { seal, unseal } from "./secret-box";

// RFC 6238 appendix B: the SHA-1 secret is the ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP — RFC 6238 / RFC 4226 test vectors", () => {
  it("HOTP values of RFC 4226 appendix D", () => {
    const secret = Buffer.from("12345678901234567890");
    expect([0, 1, 2, 9].map((c) => hotp(secret, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });

  it("TOTP values of RFC 6238 appendix B (8 digits, SHA-1)", () => {
    expect(totpAt(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totpAt(RFC_SECRET, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totpAt(RFC_SECRET, 1_234_567_890_000, 8)).toBe("89005924");
    expect(totpAt(RFC_SECRET, 20_000_000_000_000, 8)).toBe("65353130");
  });

  it("base32: حرفٌ خارج أبجديّته (0 و1 و8 و9) ⇒ يُرفض، لا يُقرأ سرّاً خاطئاً", () => {
    expect(() => base32Decode("JBSWY3DP1")).toThrow("Invalid base32");
    // ويُتسامح فيما يكتبه الناس: الحالة والمسافات والشرطات وعلامة الحشو.
    expect(base32Decode("jbsw y3dp-ehpk 3pxp==")).toEqual(base32Decode("JBSWY3DPEHPK3PXP"));
  });

  it("base32 round-trips", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });
});

describe("matchTotp", () => {
  const now = 1_700_000_000_000;

  it("accepts this step's code and its neighbours, nothing further", () => {
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, now), { now })).toBe(stepAt(now));
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 30_000), { now })).toBe(stepAt(now) - 1);
    expect(matchTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 90_000), { now })).toBeNull();
  });

  it("refuses a code already used (its step or an earlier one)", () => {
    const code = totpAt(RFC_SECRET, now);
    expect(matchTotp(RFC_SECRET, code, { now, lastStep: stepAt(now) })).toBeNull();
  });

  it("refuses anything that is not six digits", () => {
    expect(matchTotp(RFC_SECRET, "12345", { now })).toBeNull();
    expect(matchTotp(RFC_SECRET, "abcdef", { now })).toBeNull();
  });

  it("builds the URL authenticator apps read", () => {
    expect(otpauthUrl({ secret: "ABC", account: "a@b.dz", issuer: "Mudhakkirati" })).toBe(
      "otpauth://totp/Mudhakkirati%3Aa%40b.dz?secret=ABC&issuer=Mudhakkirati&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("recovery codes", () => {
  it("are distinct, readable, and hash the same however they are typed", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(hashRecoveryCode(codes[0]!.toUpperCase().replace("-", " "))).toBe(hashRecoveryCode(codes[0]!));
  });
});

describe("secret box", () => {
  it("opens what it sealed, and nothing altered", () => {
    const sealed = seal("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DP");
    expect(unseal(sealed)).toBe("JBSWY3DPEHPK3PXP");
    // One character of the sealed text changed — chosen from the one it
    // replaces (choosing it from another let it sometimes "change" to itself).
    const i = sealed.length - 2;
    const flipped = sealed.slice(0, i) + (sealed[i] === "A" ? "B" : "A") + sealed.slice(i + 1);
    expect(flipped).not.toBe(sealed);
    expect(unseal(flipped)).toBeNull();
    expect(unseal("JBSWY3DPEHPK3PXP")).toBeNull();
  });
});
