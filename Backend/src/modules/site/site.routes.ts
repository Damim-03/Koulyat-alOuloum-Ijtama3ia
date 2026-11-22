import { Router } from "express";

import {
  getAboutPageController,
  getLoginPageController,
  getPublicDirectorMessageController,
  getSiteTextsController,
  listPublicHomeSlidesController,
  listPublicNewsController,
} from "./site.controller";

/**
 * محتوى واجهة الموقع — ما يراه الزائر قبل أن يسجّل دخوله.
 *
 * بلا `authMiddleware` عمداً، خلافاً لـ`/public` الذي يحرس المواضيع: الصفحة
 * الرئيسية تُعرض لكلّ أحد، فما تقرؤه يجب أن يُقرأ لكلّ أحد. ولذلك لا يُعاد
 * من هنا إلّا ما يُعرض فعلاً — والإدارة تكتبه من مسارات `/admin/home-slides`
 * و`/admin/news` و`/admin/director-message` و`/admin/about-page`
 * و`/admin/login-page` و`/admin/site-texts`. وصور معرض «عن المنصة» من
 * `/home-slides?placement=about` وخلفية رأسها من `placement=aboutHero`،
 * وخلفية صفحة الدخول من `/home-slides?placement=login`.
 */
const siteRoutes: Router = Router();

siteRoutes.get("/home-slides", listPublicHomeSlidesController);
siteRoutes.get("/news", listPublicNewsController);
siteRoutes.get("/director-message", getPublicDirectorMessageController);
siteRoutes.get("/about-page", getAboutPageController);
siteRoutes.get("/login-page", getLoginPageController);
siteRoutes.get("/texts", getSiteTextsController);

export default siteRoutes;
