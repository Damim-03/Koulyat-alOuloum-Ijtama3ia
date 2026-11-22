import axios from "axios";
import { t } from "i18next";
import { fallbackFor } from "./localize";

export interface AppError {
  status: number;
  code: string;
  message: string;
}

// Maps the backend ErrorCodeEnum to user-facing copy — as translation KEYS,
// read when the error is shown. They used to be strings translated once when
// this module loaded, so they stayed in that language after a switch.
const MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "apiError.badCredentials",
  AUTH_ACCOUNT_SUSPENDED: "apiError.suspended",
  AUTH_INVALID_TOKEN: "apiError.sessionExpired",
  AUTH_USER_NOT_FOUND: "apiError.accountGone",
  VALIDATION_ERROR: "apiError.checkInput",
  RESOURCE_NOT_FOUND: "apiError.notFound",
  ACCESS_UNAUTHORIZED: "apiError.forbidden",
};

function readCode(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return (d.errorCode as string) ?? (d.code as string) ?? "UNKNOWN";
  }
  return "UNKNOWN";
}

/**
 * The server's own message, verbatim.
 *
 * normalizeError() replaces VALIDATION_ERROR with generic copy, which is right
 * for form-level errors but wrong when the backend explains something the user
 * cannot guess ("this domain is used by 3 professors"). Use this there.
 */
export function serverMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

/**
 * Too many failures. The account lock says for how long (the server writes the
 * minutes into its message); the per-address limiter does not.
 */
function tooMany(code: string, data: unknown): string {
  if (code === "AUTH_TOO_MANY_ATTEMPTS") {
    // الخادم يرسل الدقائق رقماً (retryAfterMinutes)؛ والنصّ الإنجليزيّ القديم احتياط.
    const d = data as { message?: string; originalMessage?: string; retryAfterMinutes?: number } | undefined;
    const text = d?.originalMessage ?? d?.message ?? "";
    const minutes = Number(d?.retryAfterMinutes ?? /(\d+)\s*minute/i.exec(text)?.[1]);
    if (minutes > 0) return t("apiError.accountLocked", { count: minutes });
  }
  return t("apiError.tooManyRequests");
}

export function normalizeError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const code = readCode(data);
    if (status === 429) return { status, code, message: tooMany(code, data) };
    const fallback =
      (data as { message?: string } | undefined)?.message ?? fallbackFor(status, code);
    return { status, code, message: MESSAGES[code] ? t(MESSAGES[code]) : fallback };
  }
  return { status: 0, code: "UNKNOWN", message: t("apiError.unexpected") };
}
