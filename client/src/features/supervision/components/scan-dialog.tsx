import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Ban,
  BookText,
  CalendarDays,
  GraduationCap,
  RotateCcw,
  ScanLine,
  SearchX,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { useSupervisionByCode } from "../hooks/supervision-hook";
import { isValidEan13 } from "../lib/ean13";
import { LoadingArea } from "../../../components/ui/loading-area";

/** طولُ الرمز الشريطيّ — عنده يُرسل من تلقائه بلا ضغط زرّ. */
const CODE_LENGTH = 13;

/**
 * نافذةُ مسح رمز الورقة.
 *
 * القارئُ الشريطيّ لوحةُ مفاتيح في حقيقته: يطبع الأرقام دفعةً ثمّ يرسل
 * `Enter`. فلا تحتاج هذه الشاشة كاميرا ولا إذناً ولا حزمةً جديدة — تحتاج
 * حقلاً مركَّزاً عليه. ولذلك يُركَّز عند الفتح وبعد كلّ نتيجة، فيُمسح رمزٌ
 * بعد رمزٍ بلا لمس الفأرة.
 *
 * ويُرسل الرمز من تلقائه عند الخانة الثالثة عشرة لمن يكتب باليد ولمن
 * يستعمل قارئاً لا يُرسل `Enter` — وهما حالتان لا يعرف المستعمل أيَّهما
 * عنده حتى يقف أمام حقلٍ لا يستجيب.
 */
export function ScanDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { lang } = useParams<{ lang: string }>();

  const [entry, setEntry] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: doc, isFetching } = useSupervisionByCode(code);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) =>
      e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** يعيد التركيز بعد كلّ نتيجة، فيكون الحقل جاهزاً للمسحة التالية. */
  function focusField() {
    inputRef.current?.focus();
  }

  useEffect(focusField, [code, isFetching]);

  function submit(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!isValidEan13(digits)) {
      setRejected(true);
      setCode(null);
      return;
    }
    setRejected(false);
    setCode(digits);
  }

  function onChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setEntry(digits);
    setRejected(false);
    if (digits.length === CODE_LENGTH) submit(digits);
    else setCode(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(entry);
    }
  }

  function reset() {
    setEntry("");
    setCode(null);
    setRejected(false);
    focusField();
  }

  const snapshot = doc?.snapshot ?? null;
  const notFound = !!code && !isFetching && !doc;

  const body = (
    <div
      className="fixed inset-0 z-100 grid place-items-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={t("supervision.scanTitle")}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-forest-deep/55 backdrop-blur-sm"
      />

      <div className="relative z-10 flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-cream-card ring-1 ring-forest/10 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        {/* ── الرأس ── */}
        <div className="flex shrink-0 items-center gap-3.5 bg-linear-to-l from-forest to-forest-deep px-5 py-4 text-cream sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream/10 ring-1 ring-cream/15">
            <ScanLine size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-bold">
              {t("supervision.scanTitle")}
            </h2>
            <p className="text-[13px] text-cream/70">
              {t("supervision.scanSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.cancel")}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/10"
          >
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {/* ── الحقل ── */}
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-sage/50 bg-cream-2 px-5 py-4">
            <ScanLine
              size={30}
              className={`shrink-0 text-sage ${isFetching ? "animate-pulse" : ""}`}
            />
            <div className="min-w-0 flex-1">
              <input
                ref={inputRef}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={entry}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="0000000000000"
                className="w-full bg-transparent text-center font-mono text-2xl font-bold tracking-[0.3em] text-forest outline-none placeholder:text-clay/30 sm:text-3xl"
              />
              <div className="mt-1.5 h-px w-full bg-forest/15" />
              <p className="mt-1.5 text-center text-xs text-clay">
                {t("supervision.scanHint")}
              </p>
            </div>
          </div>

          {rejected && (
            <p className="mt-3 rounded-xl border border-brick/30 bg-brick/8 p-3 text-center text-[13px] font-medium text-brick">
              {t("verify.badCode")}
            </p>
          )}

          {isFetching && (
            <LoadingArea
              size={64}
              label={t("verify.checking")}
              className="mt-4 py-6"
            />
          )}

          {notFound && (
            <div className="mt-4 rounded-2xl border border-brick/30 bg-brick/8 p-5 text-center">
              <SearchX size={28} className="mx-auto mb-2 text-brick" />
              <p className="text-sm font-semibold text-brick">
                {t("supervision.scanNotFound")}
              </p>
            </div>
          )}

          {/* ── الورقة ومشروعها ── */}
          {doc && snapshot && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cream-2 px-4 py-3 ring-1 ring-forest/10">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-bold ${
                    doc.status === "active"
                      ? "bg-sage/20 text-sage"
                      : "bg-brick/15 text-brick"
                  }`}
                >
                  {doc.status === "active" ? (
                    <ShieldCheck size={15} />
                  ) : (
                    <Ban size={15} />
                  )}
                  {t(
                    doc.status === "active"
                      ? "supervision.statusActive"
                      : "supervision.statusRevoked",
                  )}
                </span>
                <span dir="ltr" className="font-mono text-sm text-clay">
                  {doc.documentNumber}
                </span>
              </div>

              {/*
                عمودان على الشاشة الواسعة: البياناتُ والطلبةُ جنباً إلى جنب
                بدل أن يتلوَ أحدُهما الآخر فتطول النافذة حتى تحتاج تمريراً.
              */}
              <div className="grid gap-3 md:grid-cols-2">
                <dl className="h-fit divide-y divide-forest/8 overflow-hidden rounded-2xl bg-cream-2 ring-1 ring-forest/10">
                  <Row
                    icon={<BookText size={15} />}
                    label={t("supervision.topic")}
                    value={snapshot.topicTitle}
                  />
                  <Row
                    icon={<GraduationCap size={15} />}
                    label={t("supervision.supervisor")}
                    value={snapshot.supervisorName}
                  />
                  <Row
                    icon={<Award size={15} />}
                    label={t("supervision.degree")}
                    value={t(`admin.level_${snapshot.level}`)}
                  />
                  <Row
                    icon={<CalendarDays size={15} />}
                    label={t("pro.academicYear")}
                    value={snapshot.academicYear}
                  />
                </dl>

                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold text-clay">
                    <Users size={14} />
                    {t("supervision.students")}
                    <span className="rounded-full bg-forest/8 px-2 py-0.5 font-mono text-[11px] text-forest">
                      {snapshot.students.length}
                    </span>
                  </p>
                  <ul className="space-y-1.5">
                    {snapshot.students.map((s, i) => (
                      <li
                        key={s.registrationNumber}
                        className="flex items-center gap-3 rounded-xl bg-cream-2 px-3 py-2.5 ring-1 ring-forest/10"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-gold/20 font-mono text-[12px] font-bold text-gold">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] text-forest">
                          {s.fullName}
                        </span>
                        <span
                          dir="ltr"
                          className="shrink-0 font-mono text-[13px] text-clay"
                        >
                          {s.registrationNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── الذيل ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-forest/10 bg-cream-2/50 px-5 py-3.5 sm:px-6">
          {code && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
            >
              <RotateCcw size={15} />
              {t("supervision.scanAgain")}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>

          {doc && (
            <Link
              to={`/${lang || "ar"}/admin/topics/${doc.topicId}`}
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-95"
            >
              <ArrowRight size={16} className="rtl:rotate-180" />
              {t("supervision.openTopic")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function Row({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-forest/8 text-sage">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium text-clay/90">{label}</dt>
        <dd className="text-[15px] leading-snug font-semibold text-forest">
          {value || "—"}
        </dd>
      </div>
    </div>
  );
}
