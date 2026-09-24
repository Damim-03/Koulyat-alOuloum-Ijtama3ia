import { Router } from "express";

import { authMiddleware } from "../../core/middleware/auth.middleware";
import { verifyLimiter } from "../../core/middleware/rateLimit.middleware";
import { adminOnly } from "../../core/utils/roleGuard";
import {
  getSupervisionDocumentController,
  issueSupervisionDocumentController,
  listSupervisionDocumentsController,
  previewSupervisionDocumentController,
  revokeSupervisionDocumentController,
  verifySupervisionDocumentController,
} from "./supervision.controller";

/**
 * مسارات «طلب الموافقة على الإشراف».
 *
 * ولا نظام صلاحياتٍ جديد: `authMiddleware` نفسه، ثمّ تُفحص العلاقة بالموضوع
 * في الخدمة — الإدارة لكلّ موضوع، والأستاذ لمواضيعه، والطالب لمشروعه.
 * والقائمة والإلغاء للإدارة وحدها، وذلك حارسٌ في الطبقة نفسها.
 */
const supervisionRoutes: Router = Router();

supervisionRoutes.use(authMiddleware);

// قائمة الإدارة وإلغاؤها — قبل `/:id` كي لا يبتلعها المسار المتغيّر.
supervisionRoutes.get("/", adminOnly(), listSupervisionDocumentsController);
supervisionRoutes.patch(
  "/:id/revoke",
  adminOnly(),
  revokeSupervisionDocumentController,
);

supervisionRoutes.get(
  "/topics/:topicId/preview",
  previewSupervisionDocumentController,
);
supervisionRoutes.post(
  "/topics/:topicId",
  issueSupervisionDocumentController,
);

supervisionRoutes.get("/:id", getSupervisionDocumentController);

export default supervisionRoutes;

/**
 * التحقّق العامّ — بلا تسجيل دخول، وهو المقصود.
 *
 * من يمسح رمز الاستجابة على ورقةٍ مطبوعة ليس له حساب في النظام غالباً:
 * موظّفُ أرشيف، أو لجنة مناقشة، أو جهةٌ خارجية. ولذلك يعيش في موجّهٍ
 * منفصل بلا `authMiddleware`، ولا يُعيد إلّا ما يُثبت صحّة الورقة.
 */
export const verifyRoutes: Router = Router();

// وحدٌّ على المعدّل: الرمز الشريطيّ ثلاثة عشر رقماً، وبابٌ مفتوحٌ بلا حدٍّ
// على رمزٍ قصير بابُ تخمين.
verifyRoutes.get("/:token", verifyLimiter, verifySupervisionDocumentController);
