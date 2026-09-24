import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Ban, ScanLine, XCircle } from "lucide-react";

import { useVerifyDocument } from "../hooks/supervision-hook";
import { isValidEan13 } from "../lib/ean13";
import { LoadingArea } from "../../../components/ui/loading-area";

/**
 * صفحةُ التحقّق من ورقةٍ مطبوعة.
 *
 * عامّةٌ بلا تسجيل دخول، ومبنيّةٌ للهاتف قبل الشاشة: من يقلّب ورقةً مطبوعة
 * لا يفتح لوحة تحكّم. ولا تعرض إلّا ما يُثبت الورقة — لا بريد ولا هاتف ولا
 * معرّفات داخلية؛ وذلك مضمونٌ من الخادم أصلاً، وهذه الصفحة لا تطلب غيره.
 *
 * وبابان إليها: رمزٌ في المسار يصل من قارئٍ شريطيّ أو من رابط، وحقلٌ تُكتب
 * فيه الأرقام الثلاثة عشر باليد — لمن لا قارئ معه، وهو الأغلب.
 */
export function VerifyDocumentPage() {
  const { t } = useTranslation();
  const { lang, token } = useParams<{ lang: string; token: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useVerifyDocument(token ?? null);

  const [typed, setTyped] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);

  /**
   * ما في الحقل: ما كتبته اليد إن كُتب، وإلّا فالرمزُ الذي جاء في المسار.
   *
   * ومشتقٌّ لا مُزامَن بأثر: نسخُ المسار إلى حالةٍ يجعل للقيمة مصدرين
   * يفترقان — ويُعيد الرسم مرّتين لكلّ فتحة صفحة بلا سبب.
   */
  const entry = typed ?? (token && /^\d{13}$/.test(token) ? token : "");

  const state = !token
    ? "idle"
    : isLoading
      ? "loading"
      : isError || !data?.found
        ? "invalid"
        : data.status === "revoked"
          ? "revoked"
          : "valid";

  /**
   * رقمُ التحقّق يُحسب هنا قبل الإرسال.
   *
   * خانةٌ واحدة تُكتب خطأً أشيعُ من رمزٍ مزوَّر، وردُّها في مكانها أوضح
   * من «وثيقة غير صالحة» يخيف صاحب ورقةٍ سليمة.
   */
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const code = entry.replace(/\D/g, "");
    if (!isValidEan13(code)) {
      setRejected(true);
      return;
    }
    setRejected(false);
    navigate(`/${lang || "ar"}/verify/${code}`);
  }

  return (
    <div className="font-body min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_10px_40px_rgba(38,66,61,0.10)]">
          {/* ── الحكم أوّلاً: تُقرأ من مسافة ذراع ── */}
          <div
            className={`px-6 py-7 text-center ${
              state === "valid"
                ? "bg-sage/15"
                : state === "revoked"
                  ? "bg-gold/15"
                  : state === "invalid"
                    ? "bg-brick/10"
                    : ""
            }`}
          >
            {state === "loading" && (
              <LoadingArea size={64} className="py-0" />
            )}
            {state === "idle" && (
              <ScanLine size={44} className="mx-auto text-sage" />
            )}
            {state === "valid" && (
              <BadgeCheck size={44} className="mx-auto text-sage" />
            )}
            {state === "revoked" && (
              <Ban size={44} className="mx-auto text-gold" />
            )}
            {state === "invalid" && (
              <XCircle size={44} className="mx-auto text-brick" />
            )}

            <h1 className="mt-3 font-serif text-xl font-bold text-forest">
              {state === "loading" && t("verify.checking")}
              {state === "idle" && t("verify.promptTitle")}
              {state === "valid" && t("verify.validTitle")}
              {state === "revoked" && t("verify.revokedTitle")}
              {state === "invalid" && t("verify.invalidTitle")}
            </h1>
            <p className="mt-1 text-sm text-clay">
              {state === "idle" && t("verify.promptBody")}
              {state === "valid" && t("verify.validBody")}
              {state === "revoked" && t("verify.revokedBody")}
              {state === "invalid" && t("verify.invalidBody")}
            </p>
          </div>

          {data?.found && (
            <dl className="divide-y divide-forest/8">
              <Row
                label={t("verify.documentNumber")}
                value={data.documentNumber ?? ""}
                ltr
              />
              {data.barcode && (
                <Row label={t("verify.barcode")} value={data.barcode} ltr />
              )}
              <Row label={t("supervision.topic")} value={data.topicTitle ?? ""} />
              <Row
                label={t("supervision.supervisor")}
                value={data.supervisorName ?? ""}
              />
              <div className="px-5 py-3">
                <dt className="text-[11px] text-clay/80">
                  {t("supervision.students")}
                </dt>
                <dd className="mt-1 space-y-1">
                  {(data.students ?? []).map((s) => (
                    <p
                      key={s.registrationNumber}
                      className="flex items-center justify-between gap-3 text-sm text-forest"
                    >
                      <span className="min-w-0 truncate">{s.fullName}</span>
                      <span dir="ltr" className="shrink-0 font-mono text-[12px] text-clay">
                        {s.registrationNumber}
                      </span>
                    </p>
                  ))}
                </dd>
              </div>
              <Row
                label={t("supervision.degree")}
                value={data.level ? t(`admin.level_${data.level}`) : ""}
              />
              <Row
                label={t("pro.academicYear")}
                value={data.academicYear ?? ""}
              />
              <Row
                label={t("verify.issuedAt")}
                value={
                  data.issuedAt
                    ? new Date(data.issuedAt).toLocaleDateString()
                    : ""
                }
              />
              {data.revokedAt && (
                <Row
                  label={t("verify.revokedAt")}
                  value={new Date(data.revokedAt).toLocaleDateString()}
                />
              )}
            </dl>
          )}
        </div>

        {/* ── الأرقام الثلاثة عشر، تُكتب باليد ── */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_6px_24px_rgba(38,66,61,0.07)]"
        >
          <label
            htmlFor="sup-code"
            className="mb-2 block text-sm font-semibold text-forest"
          >
            {t("verify.enterCode")}
          </label>
          <div className="flex gap-2">
            <input
              id="sup-code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              value={entry}
              onChange={(e) => {
                setTyped(e.target.value);
                setRejected(false);
              }}
              placeholder={t("verify.codePlaceholder")}
              className="min-w-0 flex-1 rounded-xl border border-forest/20 bg-cream-2 px-3 py-2.5 text-center font-mono text-lg tracking-widest text-forest outline-none focus:border-sage"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-forest px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-forest-deep"
            >
              {t("verify.check")}
            </button>
          </div>
          {rejected && (
            <p className="mt-2 text-xs font-medium text-brick">
              {t("verify.badCode")}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="px-5 py-3">
      <dt className="text-[11px] text-clay/80">{label}</dt>
      <dd
        dir={ltr ? "ltr" : undefined}
        className={`text-sm font-semibold text-forest ${ltr ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
