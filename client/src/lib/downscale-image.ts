/**
 * يصغّر الصورة في المتصفّح قبل رفعها.
 *
 * صورةُ هاتفٍ حديث أربعة آلاف بكسل وخمسة ميغابايت أو أكثر، والخادم يقف عند
 * اثنين (`upload.middleware.ts`). وما يُعرض خلف عنوانٍ لا يحتاج أكثر من عرض
 * شاشةٍ عريضة — وكلّ ميغابايتٍ زائد يحمّله كلّ زائرٍ للصفحة الرئيسية.
 *
 * فتُرسم على لوحةٍ بأبعادٍ قصوى وتُرمَّز JPEG. والصورة التي في الحدود أصلاً
 * وخفيفة تُرفع كما هي، بلا إعادة ترميزٍ تُنقص جودتها لغير سبب.
 */
export async function downscaleImage(
  file: File,
  { maxSide = 1920, quality = 0.85, keepUnder = 1.5 * 1024 * 1024 } = {},
): Promise<File> {
  const img = await loadImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;
  const scale = Math.min(1, maxSide / Math.max(w, h));

  if (scale === 1 && file.size <= keepUnder) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  // JPEG لا شفافية فيه: ما كان شفّافاً يصير أسودَ إن لم يُملأ قبل الرسم.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unreadable image"));
    };
    img.src = url;
  });
}
