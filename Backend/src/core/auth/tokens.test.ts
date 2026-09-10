/**
 * إصدار الرموز والتحقّق منها.
 *
 * تعليق `tokens.ts` يسمّي ثلاثة أعطال أُصلحت: خوارزمية غير مثبَّتة، ولا
 * `iss`/`aud`، ولا نوع للرمز. الأولان هما «خلط الخوارزميات» و«رمزٌ من خدمة
 * أخرى تتشارك السرّ» — وكلاهما يُستغَلّ بصمت.
 *
 * إصلاحٌ بلا اختبار يبقى إصلاحاً حتى يُزيله أحدٌ سهواً. هذه التأكيدات تجعل
 * إزالته تحمرّ.
 */
import jwt from "jsonwebtoken";
import {
  signAccessToken,
  signRefreshToken,
  signTokenPair,
  verifyToken,
  ALGORITHM,
} from "./tokens";
import { config } from "../config/app.config";
import { Roles } from "../enums/role.enum";

const claims = {
  userId: "user-1",
  role: Roles.STUDENT,
  refId: "student-1",
  tokenVersion: 0,
  sid: "session-1",
};

describe("الإصدار والتحقّق في الحالة السليمة", () => {
  it("رمز وصول يُصدَر ويُتحقَّق منه، وتعود كل مطالباته", () => {
    const payload = verifyToken(signAccessToken(claims), "access");

    expect(payload.userId).toBe(claims.userId);
    expect(payload.role).toBe(claims.role);
    expect(payload.refId).toBe(claims.refId);
    expect(payload.tokenVersion).toBe(0);
    expect(payload.sid).toBe(claims.sid);
    expect(payload.typ).toBe("access");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("رمز تحديث كذلك، بنوعه هو", () => {
    expect(verifyToken(signRefreshToken(claims), "refresh").typ).toBe("refresh");
  });

  it("signTokenPair يُصدر الاثنين، وهما مختلفان", () => {
    const pair = signTokenPair(claims);
    expect(pair.accessToken).not.toBe(pair.refreshToken);
    expect(verifyToken(pair.accessToken, "access").typ).toBe("access");
    expect(verifyToken(pair.refreshToken, "refresh").typ).toBe("refresh");
  });
});

describe("الفصل بين نوعَي الرمز", () => {
  it("رمز تحديث مُقدَّم كرمز وصول ⇒ يُرفض", () => {
    expect(() => verifyToken(signRefreshToken(claims), "access")).toThrow(
      jwt.JsonWebTokenError,
    );
  });

  it("رمز وصول مُقدَّم كرمز تحديث ⇒ يُرفض", () => {
    expect(() => verifyToken(signAccessToken(claims), "refresh")).toThrow(
      jwt.JsonWebTokenError,
    );
  });

  /**
   * حتى لو تساوى السرّان — وهو خطأ إعداد وارد — يبقى `typ` مانعاً. هذا هو
   * «الحزام مع الحمّالة» الذي يذكره التعليق، وهنا إثباته.
   */
  it("ويبقى الرفض قائماً لو وُقّع رمز تحديث بسرّ الوصول نفسه", () => {
    const forged = jwt.sign(
      { ...claims, typ: "refresh" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: ALGORITHM,
        expiresIn: "15m",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    expect(() => verifyToken(forged, "access")).toThrow(/Unexpected token type/);
  });
});

describe("رفض الرموز المُزوَّرة", () => {
  it("رمز مُشوَّه ⇒ يُرفض", () => {
    expect(() => verifyToken("not.a.token", "access")).toThrow(
      jwt.JsonWebTokenError,
    );
  });

  it("رمز موقَّع بسرّ آخر ⇒ يُرفض", () => {
    const forged = jwt.sign({ ...claims, typ: "access" }, "a-different-secret", {
      algorithm: ALGORITHM,
      expiresIn: "15m",
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });

    expect(() => verifyToken(forged, "access")).toThrow(jwt.JsonWebTokenError);
  });

  /**
   * خلط الخوارزميات: ترويسة الرمز تقول بأي خوارزمية وُقّع، فإن صدّقها
   * التحقّق تَبِع المهاجم في اختياره. التثبيت على HS256 يجعل الترويسة بلا
   * أثر.
   *
   * وهذا الاختبار يقيس **التثبيت نفسه**: نفس السرّ، ونفس المُصدِر والجمهور،
   * وخوارزمية HMAC أخرى صالحة تماماً. لا شيء يرفضه إلا `algorithms: [HS256]`.
   * (تحقّقتُ: إزالة التثبيت تُحمِّر هذا السطر وحده.)
   */
  it("رمز موقَّع بخوارزمية HMAC أخرى بنفس السرّ ⇒ يُرفض", () => {
    const other = jwt.sign(
      { ...claims, typ: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: "HS512", // صالحة، لكنها ليست المثبَّتة
        expiresIn: "15m",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    expect(() => verifyToken(other, "access")).toThrow(jwt.JsonWebTokenError);
  });

  /**
   * و`alg: none` يُرفض كذلك — لكن ليس بفضل التثبيت: مكتبة jsonwebtoken ترفض
   * الرموز غير الموقَّعة من تلقائها حين يُمرَّر سرّ. يبقى التأكيد نافعاً لأنه
   * يحرس السلوك، لا لأنه يحرس التثبيت.
   */
  it('رمز بخوارزمية "none" ⇒ يُرفض', () => {
    const unsigned = jwt.sign({ ...claims, typ: "access" }, "", {
      algorithm: "none",
      expiresIn: "15m",
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });

    expect(() => verifyToken(unsigned, "access")).toThrow(
      jwt.JsonWebTokenError,
    );
  });

  it("رمز من مُصدِر آخر يتشارك السرّ ⇒ يُرفض", () => {
    const foreign = jwt.sign(
      { ...claims, typ: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: ALGORITHM,
        expiresIn: "15m",
        issuer: "another-service",
        audience: config.JWT_AUDIENCE,
      },
    );

    expect(() => verifyToken(foreign, "access")).toThrow(jwt.JsonWebTokenError);
  });

  it("رمز لجمهور آخر ⇒ يُرفض", () => {
    const foreign = jwt.sign(
      { ...claims, typ: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: ALGORITHM,
        expiresIn: "15m",
        issuer: config.JWT_ISSUER,
        audience: "another-audience",
      },
    );

    expect(() => verifyToken(foreign, "access")).toThrow(jwt.JsonWebTokenError);
  });

  it("رمز منتهي ⇒ يُرفض بـ TokenExpiredError تحديداً", () => {
    const expired = jwt.sign(
      { ...claims, typ: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: ALGORITHM,
        expiresIn: "-1s",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    // النوع مهمّ: الميدل-وير يميّز «منتهي» عن «غير صالح» ليردّ رسالتين
    // مختلفتين، فيعرف العميل متى يُجدّد ومتى يُخرج المستخدم.
    expect(() => verifyToken(expired, "access")).toThrow(jwt.TokenExpiredError);
  });

  it("حمولة ناقصة (بلا userId أو role) ⇒ تُرفض", () => {
    for (const partial of [
      { role: Roles.STUDENT, refId: "r", tokenVersion: 0 },
      { userId: "u", refId: "r", tokenVersion: 0 },
    ]) {
      const token = jwt.sign(
        { ...partial, typ: "access" },
        config.JWT_ACCESS_SECRET,
        {
          algorithm: ALGORITHM,
          expiresIn: "15m",
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
        },
      );
      expect(() => verifyToken(token, "access")).toThrow(
        /Incomplete token payload/,
      );
    }
  });
});

describe("ما يُوضَع في الرمز", () => {
  /**
   * الرمز موقَّع لا مشفَّر: من يملكه يقرأ محتواه بلا سرّ. فما يوضع فيه يُقرأ.
   */
  it("لا كلمة سرّ ولا بريد ولا اسم داخل الرمز", () => {
    const decoded = jwt.decode(signAccessToken(claims)) as Record<
      string,
      unknown
    >;

    for (const leaky of ["password", "email", "firstName", "lastName", "hash"]) {
      expect(decoded).not.toHaveProperty(leaky);
    }
    expect(Object.keys(decoded).sort()).toEqual(
      ["aud", "exp", "iat", "iss", "refId", "role", "sid", "tokenVersion", "typ", "userId"].sort(),
    );
  });
});
