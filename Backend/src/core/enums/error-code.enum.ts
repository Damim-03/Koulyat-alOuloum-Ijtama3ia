export const ErrorCodeEnum = {
  AUTH_EMAIL_ALREADY_EXISTS: "AUTH_EMAIL_ALREADY_EXISTS",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",

  AUTH_NOT_FOUND: "AUTH_NOT_FOUND",
  AUTH_TOO_MANY_ATTEMPTS: "AUTH_TOO_MANY_ATTEMPTS",
  AUTH_UNAUTHORIZED_ACCESS: "AUTH_UNAUTHORIZED_ACCESS",
  AUTH_TOKEN_NOT_FOUND: "AUTH_TOKEN_NOT_FOUND",

  // Access Control Errors
  ACCESS_UNAUTHORIZED: "ACCESS_UNAUTHORIZED",

  // Add to existing ErrorCodeEnum
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCOUNT_SUSPENDED: "AUTH_ACCOUNT_SUSPENDED",
  /** The six-digit (or recovery) code of a two-step sign-in was wrong. */
  AUTH_INVALID_CODE: "AUTH_INVALID_CODE",
  /** This sign-in must carry a solved check (modules/auth/captcha); the client shows it and retries. */
  AUTH_CAPTCHA_REQUIRED: "AUTH_CAPTCHA_REQUIRED",
  // The account must be put right before anything else can be done with it:
  // a handed-out password replaced, an administrator's two-step verification
  // set up. The client shows that screen instead of the page asked for.
  PASSWORD_CHANGE_REQUIRED: "PASSWORD_CHANGE_REQUIRED",
  TWO_FACTOR_SETUP_REQUIRED: "TWO_FACTOR_SETUP_REQUIRED",

  // Validation and Resource Errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  // موضوعٌ محجوز لفريقٍ آخر: الواجهة تعرض له شاشته الخاصّة لا خطأً عامّاً.
  TOPIC_RESERVED: "TOPIC_RESERVED",
  // طالبٌ له مذكرة يفتح موضوعاً غير موضوعها: الواجهة تعرض قفلها لا خطأً عامّاً.
  TOPIC_PLACED: "TOPIC_PLACED",
  // فترة اقتراح المواضيع لم تبدأ أو انتهت: الواجهة تعرض الفترة لا خطأً عامّاً.
  TOPIC_PROPOSALS_CLOSED: "TOPIC_PROPOSALS_CLOSED",
  // مهلة اختيار المواضيع لم تبدأ أو انتهت: الواجهة تعرض المهلة لا خطأً عامّاً.
  TOPIC_SELECTION_CLOSED: "TOPIC_SELECTION_CLOSED",
  // A topic's number of students other than the one the administration set for its year.
  TOPIC_TEAM_SIZE: "TOPIC_TEAM_SIZE",
  // A professor who has sent as many topics for the year as the administration allows.
  TOPIC_QUOTA_REACHED: "TOPIC_QUOTA_REACHED",
  // A supervision sheet changed after the screen read it, before its first print: it is shown again first.
  DOCUMENT_CHANGED: "DOCUMENT_CHANGED",

  // System Errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCodeEnumType = keyof typeof ErrorCodeEnum;
