/**
 * ترميزُ EAN-13.
 *
 * هذا ترميزٌ لا يُرى خطؤه: رمزٌ مرسومٌ بجدولٍ فيه بتٌّ مقلوب يبدو رمزاً
 * سليماً للعين تماماً، ولا يظهر العطب إلّا يوم يقف موظّفٌ أمام قارئٍ لا
 * يقرأ ورقةً رسمية بيده. فالحُكم هنا للحساب لا للنظر.
 */
import { describe, it, expect } from "vitest";

import {
  ean13CheckDigit,
  ean13Modules,
  isGuardModule,
  isValidEan13,
} from "./ean13";

/** شواهدُ منشورة، حُسبت خارج هذا الملفّ. */
const KNOWN = ["4006381333931", "5901234123457", "9780201379624"];

describe("رقم التحقّق", () => {
  it.each(KNOWN)("%s رقمُ تحقّقه هو الأخير", (code) => {
    expect(ean13CheckDigit(code.slice(0, 12))).toBe(Number(code[12]));
    expect(isValidEan13(code)).toBe(true);
  });

  it("يرفض ما اختلّ فيه رقمٌ واحد", () => {
    // تبديلُ خانةٍ واحدة — أشيعُ خطأٍ في الكتابة باليد.
    expect(isValidEan13("4006381333932")).toBe(false);
    expect(isValidEan13("4006381333831")).toBe(false);
  });

  it("ويرفض ما ليس ثلاثة عشر رقماً", () => {
    expect(isValidEan13("400638133393")).toBe(false);
    expect(isValidEan13("40063813339311")).toBe(false);
    expect(isValidEan13("400638133393a")).toBe(false);
    expect(isValidEan13("")).toBe(false);
  });
});

describe("الخطوط", () => {
  it("خمسٌ وتسعون وحدة، حارسان ووسطٌ في مواضعها", () => {
    const bits = ean13Modules(KNOWN[1])!;

    expect(bits).toHaveLength(95);
    expect(bits.slice(0, 3)).toBe("101");
    expect(bits.slice(45, 50)).toBe("01010");
    expect(bits.slice(92)).toBe("101");
  });

  /**
   * الرقمُ الأوّل لا خطَّ له: يُقرأ من تكافؤ الستّة بعده. فلو ضاع ترتيبُ
   * التكافؤ لَقرأ الماسحُ رقماً أوّلَ غيرَ المطبوع تحت الرمز — واختلف
   * المقروءُ عن المكتوب في وثيقةٍ رسمية.
   */
  it("والرقم الأوّل يُقرأ من تكافؤ المجموعة اليسرى", () => {
    const ones = (s: string) => [...s].filter((b) => b === "1").length;

    // `4` ⇒ LGLLGG: فردي، زوجي، فردي، فردي، زوجي، زوجي.
    const bits = ean13Modules("4006381333931")!;
    const parity = Array.from({ length: 6 }, (_, i) =>
      ones(bits.slice(3 + i * 7, 10 + i * 7)) % 2 === 1 ? "L" : "G",
    ).join("");

    expect(parity).toBe("LGLLGG");

    // و`0` ⇒ ستّةٌ كلُّها فردية.
    const zero = ean13Modules("0123456789012");
    if (zero) {
      const p0 = Array.from({ length: 6 }, (_, i) =>
        ones(zero.slice(3 + i * 7, 10 + i * 7)) % 2 === 1 ? "L" : "G",
      ).join("");
      expect(p0).toBe("LLLLLL");
    }
  });

  /** المجموعة اليمنى متمّمُ اليسرى: كلُّ خانةٍ تبدأ بأسود وتنتهي بأبيض. */
  it("واليمنى معكوسةُ اليسرى لوناً", () => {
    const bits = ean13Modules(KNOWN[0])!;

    for (let i = 0; i < 6; i++) {
      const left = bits.slice(3 + i * 7, 10 + i * 7);
      expect(left[0]).toBe("0");
      expect(left[6]).toBe("1");

      const right = bits.slice(50 + i * 7, 57 + i * 7);
      expect(right[0]).toBe("1");
      expect(right[6]).toBe("0");
    }
  });

  it("ولا يُرسم شيءٌ لرمزٍ غير صالح", () => {
    expect(ean13Modules("4006381333932")).toBeNull();
    expect(ean13Modules("abc")).toBeNull();
  });

  it("والحارسان والوسط وحدها تمتدّ", () => {
    const extended = Array.from({ length: 95 }, (_, i) => i).filter(
      isGuardModule,
    );
    expect(extended).toEqual([
      0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94,
    ]);
  });
});

/**
 * كلُّ نمطٍ في الجدول اليساريّ أربعةُ مقاطع — خطّان وفراغان — في سبع
 * وحدات، يبدأ بأبيض وينتهي بأسود وعددُ آحاده فردي. هذه صفاتُ مجموعة
 * الترميز في المعيار، وهي ما يكشف بتّاً مقلوباً في جدولٍ كُتب باليد.
 */
describe("سلامة جدول الترميز", () => {
  /** عددُ المقاطع المتّصلة: كم مرّةً يتبدّل اللون على امتداد النمط. */
  const runs = (bits: string) =>
    [...bits].filter((b, i) => i === 0 || b !== bits[i - 1]).length;

  const ones = (bits: string) => [...bits].filter((b) => b === "1").length;

  it("عشرةُ أنماطٍ متمايزة، كلٌّ منها أربعةُ مقاطع بتكافؤٍ فردي", () => {
    const patterns = new Set<string>();

    // رمزٌ أوّلُه صفر ⇒ المجموعة اليسرى كلُّها `L`، فتُقرأ الأنماط مباشرةً.
    for (let d = 0; d < 10; d++) {
      const twelve = "0" + String(d).repeat(6) + "00000";
      const bits = ean13Modules(twelve + String(ean13CheckDigit(twelve)))!;
      const pattern = bits.slice(3, 10);
      patterns.add(pattern);

      expect(pattern[0]).toBe("0");
      expect(pattern[6]).toBe("1");
      expect(runs(pattern)).toBe(4);
      expect(ones(pattern) % 2).toBe(1);
    }

    expect(patterns.size).toBe(10);
  });

  /** ورسمٌ كاملٌ لرمزٍ معلوم، يُثبّت ترتيب التجميع والحارسين معاً. */
  it("ورمزٌ معلومٌ يُرسم خمساً وتسعين وحدةً بعينها", () => {
    expect(ean13Modules("5901234123457")).toBe(
      "10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101",
    );
  });
});
