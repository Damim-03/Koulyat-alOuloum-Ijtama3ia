import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { adminOrOwner } from "../../core/utils/roleGuard";
import {
    sendMessageController,
    broadcastMessageController,
    listInboxController,
    listSentController,
    unreadCountController,
    markMessageReadController,
    markAllReadController,
    getMessageController,
    deleteInboxMessageController,
} from "./messages.controller";

const messagesRoutes = Router();

// كل المسارات تتطلّب تسجيل الدخول (لكل الأدوار).
messagesRoutes.use(authMiddleware);

// ── الوارد / الصادر ──
messagesRoutes.get("/inbox", listInboxController);
messagesRoutes.get("/sent", listSentController);
messagesRoutes.get("/unread-count", unreadCountController);

// ── القراءة ──
messagesRoutes.patch("/read-all", markAllReadController);
messagesRoutes.patch("/:id/read", markMessageReadController);

// ── الإرسال ──
// بثّ جماعي (الكل / كل الطلبة / كل الأساتذة / تخصّص) — للإدارة فقط.
messagesRoutes.post("/broadcast", adminOrOwner(), broadcastMessageController);
// رسالة مباشرة — لكل الأدوار (القيود حسب العلاقة داخل الخدمة).
messagesRoutes.post("/", sendMessageController);

// ── رسالة واحدة / حذف من الوارد ──
messagesRoutes.get("/:id", getMessageController);
messagesRoutes.delete("/:id", deleteInboxMessageController);

export default messagesRoutes;