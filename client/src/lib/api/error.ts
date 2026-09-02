import axios from "axios";
import { t } from "i18next";

export interface AppError {
  status: number;
  code: string;
  message: string;
}

// Maps the backend ErrorCodeEnum to user-facing copy.
// NOTE: confirm the field name your errorHandler returns ("errorCode" vs
// "code") and adjust readCode() below if needed.
const MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: t("apiError.badCredentials"),
  AUTH_ACCOUNT_SUSPENDED: t("apiError.suspended"),
  AUTH_INVALID_TOKEN: t("apiError.sessionExpired"),
  AUTH_USER_NOT_FOUND: t("apiError.accountGone"),
  VALIDATION_ERROR: t("apiError.checkInput"),
  RESOURCE_NOT_FOUND: t("apiError.notFound"),
  ACCESS_UNAUTHORIZED: t("apiError.forbidden"),
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

export function normalizeError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const code = readCode(data);
    const fallback =
      (data as { message?: string } | undefined)?.message ??
      t("apiError.unexpected");
    return { status, code, message: MESSAGES[code] ?? fallback };
  }
  return { status: 0, code: "UNKNOWN", message: t("apiError.unexpected") };
}
