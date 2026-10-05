import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { adminOnly } from "../../core/utils/roleGuard";
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

// ── الإرسال ──
// بثّ جماعي بجمهورٍ دقيق، ومعاينة عدده قبل الإرسال — للإدارة فقط.
messagesRoutes.get("/audience", adminOnly(), audiencePreviewController);
messagesRoutes.post("/broadcast", adminOnly(), broadcastMessageController);
// رسالة مباشرة — لكل الأدوار (القيود حسب العلاقة داخل الخدمة).
messagesRoutes.post("/", sendMessageController);
// ردٌّ في المحادثة نفسها.
messagesRoutes.post("/:id/reply", replyMessageController);

// ── رسالة واحدة (بمحادثتها) / حذف من الوارد ──
messagesRoutes.get("/:id", getMessageController);
messagesRoutes.delete("/:id", deleteInboxMessageController);

export default messagesRoutes;
