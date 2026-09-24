import { z } from "zod";

const entityId = z.string().uuid();

export const topicIdParamSchema = z.object({ topicId: entityId });
export const documentIdParamSchema = z.object({ id: entityId });

/**
 * رمزُ التحقّق كما يصل من الورقة — بصيغتيه.
 *
 * إمّا ثلاثة عشر رقماً هي الرمز الشريطيّ أسفل الورقة، يُمسح بقارئٍ أو
 * يُكتب باليد؛ وإمّا الرمز الطويل `base64url` من ٣٢ بايتاً = ٤٣ حرفاً.
 * والحدّ الأعلى يمنع جسماً ضخماً في مسارٍ عامٍّ بلا تسجيل دخول.
 *
 * وما عداهما يُردّ قبل أن يمسّ القاعدة، فلا يُستعمل المسارُ العامّ مِجسّاً.
 */
export const verifyParamSchema = z.object({
  token: z
    .string()
    .trim()
    .max(128)
    .regex(/^(?:\d{13}|[A-Za-z0-9_-]{20,128})$/),
});

export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "revoked"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListDocumentsDTO = z.infer<typeof listDocumentsSchema>;
