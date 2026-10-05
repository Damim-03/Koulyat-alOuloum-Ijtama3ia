import { t } from "i18next";
import { downscaleImage } from "../../../../../lib/downscale-image";
import type { SlidePlacement } from "../../../../../types/site.types";

/** حدّ الخادم بعد التصغير (`upload.middleware.ts`). */
const SERVER_MAX = 2 * 1024 * 1024;
/** وقبله: ما يُعقَل أن يُختار من هاتفٍ أو كاميرا. */
const PICK_MAX = 25 * 1024 * 1024;

export const SLIDE_ACCEPT = "image/png,image/jpeg,image/webp";
export const CAPTION_MAX = 160;

/** يطابق `MAX_HOME_SLIDES` في الخادم. */
export const MAX_SLIDES = 12;

/** أين تجد المواضع الأخرى نصوصها؛ والرئيسية على `admin.slides.*`. */
export const COPY_NS: Partial<Record<SlidePlacement, string>> = {
  about: "admin.aboutGallery",
  login: "admin.loginBg",
  aboutHero: "admin.aboutBg",
};

/**
 * الخلفيّات — خلف لوحة الدخول ورأس «عن المنصة» — بلا سطر: لا يُقرأ فوقها شيءٌ
 * منها، فلا يُطلب.
 */
export const isBackdrop = (placement: SlidePlacement) =>
  placement === "login" || placement === "aboutHero";

/**
 * يجهّز الملفّ المختار للرفع: يتحقّق من نوعه وحجمه، ويصغّره.
 * ويرمي خطأً رسالتُه جاهزةٌ للعرض.
 */
export async function prepareSlideImage(file: File): Promise<File> {
  if (!SLIDE_ACCEPT.split(",").includes(file.type))
    throw new Error(t("admin.slides.badType"));
  if (file.size > PICK_MAX) throw new Error(t("admin.slides.tooLarge"));

  let ready: File;
  try {
    ready = await downscaleImage(file);
  } catch {
    throw new Error(t("admin.slides.unreadable"));
  }
  if (ready.size > SERVER_MAX) throw new Error(t("admin.slides.tooLarge"));
  return ready;
}

/**
 * ما سُحب أو اختير، كما هو. ولا يُصفّى هنا: ملفٌّ غير مدعوم يظهر في النافذة
 * بسببه، بدل أن يختفي فلا يُعرف لماذا لم يُضف.
 */
export const filesOf = (list: FileList | null | undefined) => Array.from(list ?? []);
