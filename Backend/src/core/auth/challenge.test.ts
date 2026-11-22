/**
 * تذكرة الخطوة الثانية — ما يُصدَر بعد كلمة المرور ويُبادَل برمز التطبيق.
 *
 * اختبار الـAPI يمرّ بالتذكرة السليمة والمزوّرة. وهنا ما لا يُرسَل من HTTP
 * بسهولة: تذكرةٌ موقَّعةٌ بالسرّ الصحيح ولجمهورها الصحيح، لكنّ مطالباتها ليست
 * مطالبات تذكرة — نوعٌ آخر، أو حسابٌ بلا معرّف، أو جيلٌ ليس عدداً. التوقيع
 * السليم لا يكفي: ما لا يقول «أنا تذكرة لهذا الحساب في هذا الجيل» لا يفتح شيئاً.
 */
import jwt from "jsonwebtoken";

import { config } from "../config/app.config";
import { ALGORITHM, signAccessToken } from "./tokens";
import { issueChallenge, readChallenge } from "./challenge";
import { Roles } from "../enums/role.enum";

/** يوقّع كما توقّع `issueChallenge` بالضبط — إلا المطالبات. */
const signedLikeATicket = (claims: Record<string, unknown>) =>
  jwt.sign(claims, config.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: "5m",
    issuer: config.JWT_ISSUER,
    audience: `${config.JWT_AUDIENCE}:2fa`,
  });

describe("readChallenge", () => {
  it("التذكرة السليمة تُقرأ بحسابها وجيله", () => {
    expect(readChallenge(issueChallenge({ id: "u-1", tokenVersion: 3 }))).toEqual({ userId: "u-1", tokenVersion: 3 });
  });

  it.each([
    ["نوعٌ آخر", { userId: "u-1", tokenVersion: 0, typ: "access" }],
    ["بلا معرّف حساب", { tokenVersion: 0, typ: "2fa" }],
    ["معرّفٌ ليس نصّاً", { userId: 42, tokenVersion: 0, typ: "2fa" }],
    ["جيلٌ ليس عدداً", { userId: "u-1", tokenVersion: "0", typ: "2fa" }],
  ])("موقَّعةٌ صحيحاً لكن %s ⇒ لا شيء", (_label, claims) => {
    expect(readChallenge(signedLikeATicket(claims))).toBeNull();
  });

  /** رمز وصولٍ سليم ليس تذكرة: جمهوره غير جمهورها. */
  it("ورمز وصولٍ سليم يُقدَّم تذكرةً ⇒ لا شيء", () => {
    const access = signAccessToken({ userId: "u-1", role: Roles.ADMIN, refId: "u-1", tokenVersion: 0 });
    expect(readChallenge(access)).toBeNull();
  });

  it("وحمولةٌ ليست كائناً (لو أرجعتها المكتبة يوماً) ⇒ لا شيء", () => {
    jest.spyOn(jwt, "verify").mockReturnValueOnce("just a string" as never);
    expect(readChallenge("anything")).toBeNull();
  });
});
