import axios from "axios";

export interface AppError {
  status: number;
  code: string;
  message: string;
}

// Maps the backend ErrorCodeEnum to user-facing copy.
// NOTE: confirm the field name your errorHandler returns ("errorCode" vs
// "code") and adjust readCode() below if needed.
const MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "بيانات الدخول غير صحيحة",
  AUTH_ACCOUNT_SUSPENDED: "تم تعليق حسابك. يرجى التواصل مع الإدارة.",
  AUTH_INVALID_TOKEN: "انتهت الجلسة. يرجى تسجيل الدخول من جديد.",
  AUTH_USER_NOT_FOUND: "الحساب لم يعد موجوداً.",
  VALIDATION_ERROR: "تحقق من صحة البيانات المدخلة.",
  RESOURCE_NOT_FOUND: "العنصر المطلوب غير موجود.",
  ACCESS_UNAUTHORIZED: "ليست لديك صلاحية للقيام بهذا الإجراء.",
};

function readCode(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return (d.errorCode as string) ?? (d.code as string) ?? "UNKNOWN";
  }
  return "UNKNOWN";
}

export function normalizeError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const code = readCode(data);
    const fallback =
      (data as { message?: string } | undefined)?.message ??
      "حدث خطأ غير متوقع.";
    return { status, code, message: MESSAGES[code] ?? fallback };
  }
  return { status: 0, code: "UNKNOWN", message: "حدث خطأ غير متوقع." };
}
