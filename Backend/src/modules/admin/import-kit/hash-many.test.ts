/**
 * إجزاء كلمات المرور على العمّال: كلٌّ يُطابق كلمته، وبالترتيب الذي دخل.
 * ترتيبٌ مختلطٌ يعطي كلَّ طالبٍ كلمةَ غيره — ولا يشعر أحدٌ حتى يُمنع الدخول.
 */
import bcrypt from "bcryptjs";
import { hashMany } from "./hash-many";

describe("hashMany", () => {
  it("يُجزّئ دفعةً على العمّال، وكلّ إجزاءٍ لكلمته بالترتيب", async () => {
    const passwords = Array.from({ length: 9 }, (_, i) => `pass-${i}-${"x".repeat(i)}`);
    const hashes = await hashMany(passwords, 4);

    expect(hashes).toHaveLength(passwords.length);
    for (let i = 0; i < passwords.length; i++) {
      expect(await bcrypt.compare(passwords[i]!, hashes[i]!)).toBe(true);
      // ولا يطابق كلمةَ جاره.
      if (i > 0) expect(await bcrypt.compare(passwords[i - 1]!, hashes[i]!)).toBe(false);
    }
  });

  it("والدفعة الصغيرة تُجزّأ في مكانها", async () => {
    const [h] = await hashMany(["solo-pass"], 4);
    expect(await bcrypt.compare("solo-pass", h!)).toBe(true);
  });
});
