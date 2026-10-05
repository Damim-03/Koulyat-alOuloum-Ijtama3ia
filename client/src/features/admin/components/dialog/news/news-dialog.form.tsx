import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Languages, Link2, Megaphone, Save, Type } from "lucide-react";
import type { NewsItem } from "../../../../../types/site.types";
import { useCreateNews, useUpdateNews } from "../../../hooks/site-content-hook";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { VisibilityToggle } from "../home-slide/slide-parts";

const TEXT_MAX = 300;

/** اليوم بالتوقيت المحلّيّ، بصيغة حقل التاريخ. */
const today = () => new Date().toLocaleDateString("en-CA");

/** نفس قاعدة الخادم: مسارٌ داخليّ أو http(s) مطلق. */
function linkError(v: string) {
  if (!v) return false;
  if (/\s/.test(v)) return true;
  if (v.startsWith("/")) return v.startsWith("//");
  try {
    const u = new URL(v);
    return u.protocol !== "http:" && u.protocol !== "https:";
  } catch {
    return true;
  }
}

/**
 * إضافة خبرٍ إلى شريط «آخر الأخبار» أو تعديله.
 *
 * العربية مطلوبة؛ والفرنسية والإنجليزية اختياريّتان — ما تُرك فارغاً يُعرض
 * بالعربية لمن يتصفّح بغيرها.
 */
export function NewsDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  /** `null` لخبرٍ جديد. */
  item: NewsItem | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateNews();
  const update = useUpdateNews();

  const [text, setText] = useState("");
  const [textFr, setTextFr] = useState("");
  const [textEn, setTextEn] = useState("");
  const [date, setDate] = useState(today);
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const saving = create.isPending || update.isPending;
  const badLink = linkError(linkUrl.trim());

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setText(item?.text ?? "");
    setTextFr(item?.textFr ?? "");
    setTextEn(item?.textEn ?? "");
    setDate(item ? item.date.slice(0, 10) : today());
    setLinkUrl(item?.linkUrl ?? "");
    setIsActive(item?.isActive ?? true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, item]);

  const canSave = text.trim() !== "" && !!date && !badLink && !saving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const data = {
      text: text.trim(),
      textFr: textFr.trim() || null,
      textEn: textEn.trim() || null,
      date,
      linkUrl: linkUrl.trim() || null,
      isActive,
    };
    try {
      if (item) await update.mutateAsync({ id: item.id, data });
      else await create.mutateAsync(data);
      onClose();
    } catch {
      // الخطأ يظهر عبر toast داخل الـhook
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? t("admin.news.editTitle") : t("admin.news.addTitle")}
      subtitle={t("admin.news.dialogSubtitle")}
      icon={Megaphone}
      footer={
        <>
          <button
            type="submit"
            form="news-form"
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? t("admin.saving") : item ? t("admin.slides.saveChanges") : t("admin.news.publish")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <form id="news-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label={t("admin.news.text")} icon={Type} hint={t("admin.news.textHint")}>
          <div className="relative">
            <input
              autoFocus
              dir="auto"
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => setText(e.target.value)}
              className={`${inputClass} pe-16`}
              placeholder={t("admin.news.textPlaceholder")}
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-[10px] tabular-nums text-clay">
              {text.length}/{TEXT_MAX}
            </span>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <Field label={t("admin.news.date")} icon={CalendarDays}>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label={t("admin.news.link")}
            icon={Link2}
            note={t("admin.optional")}
            hint={t("admin.news.linkHint")}
            error={badLink ? t("admin.news.linkInvalid") : undefined}
          >
            <input
              dir="ltr"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className={inputClass}
              placeholder="/topics  ·  https://…"
            />
          </Field>
        </div>

        {/* ── الترجمات ── */}
        <fieldset className="rounded-xl border border-forest/12 p-4">
          <legend className="flex items-center gap-1.5 px-1.5 text-xs font-medium text-forest">
            <Languages size={14} className="text-clay" />
            {t("admin.news.translations")}
            <span className="text-[10px] font-normal text-clay/80">({t("admin.optional")})</span>
          </legend>
          <p className="mb-3 text-[11px] text-clay">{t("admin.news.translationsHint")}</p>
          <div className="space-y-3">
            {(
              [
                ["FR", textFr, setTextFr, "Français"],
                ["EN", textEn, setTextEn, "English"],
              ] as const
            ).map(([code, value, set, name]) => (
              <label key={code} className="flex items-center gap-2">
                <span className="w-9 shrink-0 rounded-md bg-forest/8 py-1 text-center text-[10.5px] font-bold text-forest">
                  {code}
                </span>
                <input
                  dir="ltr"
                  value={value}
                  maxLength={TEXT_MAX}
                  onChange={(e) => set(e.target.value)}
                  className={inputClass}
                  placeholder={name}
                  aria-label={name}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <VisibilityToggle
          on={isActive}
          onChange={setIsActive}
          labels={{
            on: t("admin.news.published"),
            off: t("admin.news.hidden"),
            onHint: t("admin.news.publishedHint"),
            offHint: t("admin.news.hiddenHint"),
          }}
        />
      </form>
    </FormDialog>
  );
}
