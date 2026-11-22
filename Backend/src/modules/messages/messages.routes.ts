import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { adminOnly } from "../../core/utils/roleGuard";
import { attachmentLimiter, messageLimiter } from "../../core/middleware/rateLimit.middleware";
import { messageFileUpload } from "./attachments";
import {
  sendMessageController,
  replyMessageController,
  broadcastMessageController,
  audiencePreviewController,
  contactsController,
  listInboxController,
  listSentController,
  unreadCountController,
  summaryController,
  markMessageReadController,
  markMessageUnreadController,
  markAllReadController,
  getMessageController,
  deleteInboxMessageController,
  conversationsController,
  chatController,
  markChatReadController,
  presenceController,
  uploadAttachmentController,
  deleteAttachmentController,
  openAttachmentController,
  editMessageController,
  deleteForEveryoneController,
} from "./messages.controller";

const messagesRoutes = Router();

// كل المسارات تتطلّب تسجيل الدخول (لكل الأدوار).
messagesRoutes.use(authMiddleware);

// ── الوارد / الصادر / العدّادات ──
messagesRoutes.get("/inbox", listInboxController);
messagesRoutes.get("/sent", listSentController);
messagesRoutes.get("/unread-count", unreadCountController);
messagesRoutes.get("/summary", summaryController);

// ── المحادثات: شخصٌ شخص، كما في أيّ تطبيق مراسلة ──
messagesRoutes.get("/conversations", conversationsController);
messagesRoutes.get("/presence", presenceController);
messagesRoutes.get("/chat/:userId", chatController);
messagesRoutes.patch("/chat/:userId/read", markChatReadController);

// ── من أستطيع مراسلته (بقواعد الدور نفسها التي يطبّقها الإرسال) ──
messagesRoutes.get("/contacts", contactsController);

// ── القراءة ──
messagesRoutes.patch("/read-all", markAllReadController);
messagesRoutes.patch("/:id/read", markMessageReadController);
messagesRoutes.patch("/:id/unread", markMessageUnreadController);

// ── الملفات المرفقة: تُرفع قبل الإرسال واحداً واحداً، وتُفتح لمن يقرأ رسالتها ──
messagesRoutes.post("/attachments", attachmentLimiter, messageFileUpload, uploadAttachmentController);
messagesRoutes.get("/attachments/:id", openAttachmentController);
messagesRoutes.delete("/attachments/:id", deleteAttachmentController);

// ── الإرسال ──
// بثّ جماعي بجمهورٍ دقيق، ومعاينة عدده قبل الإرسال — للإدارة فقط.
messagesRoutes.get("/audience", adminOnly(), audiencePreviewController);
messagesRoutes.post("/broadcast", adminOnly(), messageLimiter, broadcastMessageController);
// رسالة مباشرة — لكل الأدوار (القيود حسب العلاقة داخل الخدمة).
// والحدّ لكلّ حساب: كلّ رسالةٍ تصل صناديق غيره.
messagesRoutes.post("/", messageLimiter, sendMessageController);
// ردٌّ في المحادثة نفسها.
messagesRoutes.post("/:id/reply", messageLimiter, replyMessageController);

// ── رسالة واحدة (بمحادثتها) / حذف من الوارد ──
messagesRoutes.get("/:id", getMessageController);
messagesRoutes.delete("/:id", deleteInboxMessageController);

// ── تعديل المرسِل نصَّ رسالته بعد إرسالها بقليل — لكل الأدوار ──
// بعد مسارات PATCH الأخرى: «/read-all» مقطعٌ واحد كـ«/:id»، وأوّلُ مطابِقٍ يُجيب.
messagesRoutes.patch("/:id", messageLimiter, editMessageController);
// ── سحبُ الإدارة رسالتها من عند الجميع ──
messagesRoutes.delete("/:id/for-everyone", adminOnly(), deleteForEveryoneController);

export default messagesRoutes;
