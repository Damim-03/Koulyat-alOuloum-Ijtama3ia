import { Router } from "express";
import {
  studentLoginController,
  professorLoginController,
  adminLoginController,
  adminTwoFactorLoginController,
  refreshTokenController,
  getMeController,
  logoutController,
  logoutAllController,
} from "./auth.controller";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import {
  authLimiter,
  challengeLimiter,
  refreshLimiter,
  emailLinkLimiter,
  studentLookupLimiter,
  passwordRequestLimiter,
  passwordRequestPollLimiter,
} from "../../core/middleware/rateLimit.middleware";
import { activationPhotosUpload } from "../../core/middleware/upload.middleware";
import {
  closePasswordRequestController,
  lookupStudentController,
  passwordRequestStatusController,
  submitPasswordRequestController,
} from "../password-request/password-request";
import { challengeController, verifyCodeController } from "./captcha";
import {
  checkResetController,
  forgotPasswordController,
  resetAvailableController,
  resetPasswordController,
  verifyEmailController,
} from "./email-links.controller";

const authRoutes = Router();

authRoutes.post("/student/login", authLimiter, studentLoginController);
authRoutes.post("/professor/login", authLimiter, professorLoginController);
authRoutes.post("/admin/login", authLimiter, adminLoginController);
// The code from the authenticator app, after the password (see auth.service).
authRoutes.post("/admin/login/2fa", authLimiter, adminTwoFactorLoginController);
// The short check asked of a sign-in after repeated failures (./captcha).
authRoutes.get("/challenge", challengeLimiter, challengeController);
// …and, at its second level, the code read from its picture.
authRoutes.post("/challenge/verify", challengeLimiter, verifyCodeController);
authRoutes.post("/refresh", refreshLimiter, refreshTokenController);

// ── نسيتُ كلمة المرور، وتأكيد البريد: روابط تصل بالبريد (./email-links) ──
// عامّةٌ عمداً: صاحبها لا يستطيع الدخول، أو فتح الرسالة على جهازٍ آخر.
authRoutes.get("/password/available", resetAvailableController);
authRoutes.post("/password/forgot", emailLinkLimiter, forgotPasswordController);
authRoutes.post("/password/reset/check", emailLinkLimiter, checkResetController);
authRoutes.post("/password/reset", emailLinkLimiter, resetPasswordController);
authRoutes.post("/email/verify", emailLinkLimiter, verifyEmailController);
// …وللطالب الذي لا بريد مؤكَّداً لحسابه: طلبٌ إلى الإدارة بصورة البطاقة (../password-request).
authRoutes.post("/password/student", studentLookupLimiter, lookupStudentController);
authRoutes.post("/password/request", passwordRequestLimiter, activationPhotosUpload, submitPasswordRequestController);
authRoutes.post("/password/request/status", passwordRequestPollLimiter, passwordRequestStatusController);
authRoutes.post("/password/request/close", passwordRequestPollLimiter, closePasswordRequestController);
authRoutes.get("/me", authMiddleware, getMeController);
// Signs out this session only. No `authMiddleware`: the session is named by
// the Bearer token *or* the refresh cookie, so signing out still works after
// the access token has expired — and revoking needs no more than proof of the
// session itself.
authRoutes.post("/logout", logoutController);
// Signs out every device on the account.
authRoutes.post("/logout-all", authMiddleware, logoutAllController);

export default authRoutes;
