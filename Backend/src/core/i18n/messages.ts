import type { Entry } from "./types";
import { common } from "./catalog/common";
import { people } from "./catalog/people";
import { topics } from "./catalog/topics";
import { admin } from "./catalog/admin";
import { validation } from "./catalog/validation";
import { notifications } from "./catalog/notifications";
import { importsKit } from "./catalog/imports-kit";
import { imports } from "./catalog/imports";
import { mail } from "./catalog/mail";

/**
 * الرسائل كلّها، باللغات الثلاث جنباً إلى جنب — مقسّمةً على ملفّات بحسب
 * المجال (catalog/). والمفاتيح أنواعٌ: مفتاحٌ مكتوبٌ خطأً لا يُبنى.
 */
export const MESSAGES = {
  ...common,
  ...people,
  ...topics,
  ...admin,
  ...validation,
  ...notifications,
  ...importsKit,
  ...imports,
  ...mail,
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof MESSAGES;
