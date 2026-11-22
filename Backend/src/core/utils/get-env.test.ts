/**
 * `getEnv` — قراءة متغيّر بيئة بقيمةٍ افتراضية، أو رفضٌ صريح بلا واحدة.
 *
 * كلّ ما يناديه اليوم يعطيه قيمةً افتراضية، فالرفض لا يصله أحد — وهو مع ذلك
 * عقد الدالّة: متغيّرٌ مطلوبٌ غائب يُسمّى باسمه، لا يمرّ `undefined` صامتاً.
 */
import { getEnv } from "./get-env";

const KEY = "GET_ENV_TEST_VARIABLE";

afterEach(() => {
  delete process.env[KEY];
});

describe("getEnv", () => {
  it("القيمة الموجودة تُقرأ كما هي، ولو كانت فارغة", () => {
    process.env[KEY] = "value";
    expect(getEnv(KEY, "fallback")).toBe("value");
    process.env[KEY] = "";
    expect(getEnv(KEY, "fallback")).toBe("");
  });

  it("والغائبة تأخذ قيمتها الافتراضية", () => {
    expect(getEnv(KEY, "fallback")).toBe("fallback");
  });

  it("والغائبة بلا قيمةٍ افتراضية ⇒ خطأٌ يسمّي المتغيّر", () => {
    expect(() => getEnv(KEY)).toThrow(`Missing env variable: ${KEY}`);
  });
});
