/**
 * أصناف الأخطاء المقصودة — ما يصل معالج الأخطاء فيُردّ برسالته وحالته ورمزه.
 *
 * كلّ صنفٍ يحمل حالته ورمزاً افتراضياً، ويقبل رمزاً أدقّ مكانه. وما يُختبر هنا
 * هو الافتراضيّ والمُمرَّر معاً: رمزٌ ضائع يجعل الواجهة تعرض رسالةً عامّة بدل
 * الشاشة المقصودة (تغيير كلمة المرور، الحساب المقفل…).
 */
import {
  AppError,
  BadRequestException,
  HttpException,
  InternalServerException,
  NotFoundException,
  UnauthorizedException,
} from "./appErros";
import { HTTPSTATUS } from "../config/http/http.config";
import { ErrorCodeEnum } from "../enums/error-code.enum";

describe("AppError", () => {
  it("بلا حالة ⇒ 500، وبلا رمز ⇒ لا رمز", () => {
    const e = new AppError("x");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("x");
    expect(e.statusCode).toBe(HTTPSTATUS.INTERNAL_SERVER_ERROR);
    expect(e).not.toHaveProperty("errorCode");
    // والمكدّس يبدأ بمن رماه، لا بالمُنشئ.
    expect(e.stack).toContain("appErros.test");
  });

  it("وبحالته ورمزه حين يُعطيان", () => {
    const e = new AppError("x", HTTPSTATUS.CONFLICT, ErrorCodeEnum.VALIDATION_ERROR);
    expect(e.statusCode).toBe(409);
    expect(e.errorCode).toBe(ErrorCodeEnum.VALIDATION_ERROR);
  });
});

describe("الأصناف المسمّاة: الحالة ثابتة، والرسالة والرمز لهما افتراضيّ", () => {
  it.each([
    ["NotFoundException", NotFoundException, 404, "Resource not found", ErrorCodeEnum.RESOURCE_NOT_FOUND],
    ["BadRequestException", BadRequestException, 400, "Bad Request", ErrorCodeEnum.VALIDATION_ERROR],
    ["UnauthorizedException", UnauthorizedException, 401, "Unauthorized Access", ErrorCodeEnum.ACCESS_UNAUTHORIZED],
    ["InternalServerException", InternalServerException, 500, "Internal Server Error", ErrorCodeEnum.INTERNAL_SERVER_ERROR],
  ] as const)("%s", (_name, Cls, status, message, code) => {
    const plain = new Cls();
    expect(plain).toBeInstanceOf(AppError);
    expect(plain.statusCode).toBe(status);
    expect(plain.message).toBe(message);
    expect(plain.errorCode).toBe(code);

    const precise = new Cls("رسالةٌ للمستخدم", ErrorCodeEnum.AUTH_INVALID_TOKEN);
    expect(precise.message).toBe("رسالةٌ للمستخدم");
    expect(precise.errorCode).toBe(ErrorCodeEnum.AUTH_INVALID_TOKEN);
  });

  it("HttpException: الحالة يختارها صاحبها، والرسالة لها افتراضيّ", () => {
    const plain = new HttpException(undefined, HTTPSTATUS.TOO_MANY_REQUESTS);
    expect(plain.message).toBe("Http Exception Error");
    expect(plain.statusCode).toBe(429);
    expect(plain).not.toHaveProperty("errorCode");

    const precise = new HttpException("مقفل", HTTPSTATUS.FORBIDDEN, ErrorCodeEnum.ACCESS_UNAUTHORIZED);
    expect(precise.statusCode).toBe(403);
    expect(precise.errorCode).toBe(ErrorCodeEnum.ACCESS_UNAUTHORIZED);
  });
});
