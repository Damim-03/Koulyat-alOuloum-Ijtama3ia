import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { toast } from "sonner";
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Heading,
  ImagePlus,
  Loader2,
  MessageSquareQuote,
  Pilcrow,
  Quote,
  RefreshCw,
  RotateCcw,
  UserRound,
} from "lucide-react";
import type { DirectorBlock, DirectorMessage, SiteLang } from "../../../../types/site.types";
import {
  useAdminDirectorMessage,
  useSaveDirectorMessage,
} from "../../hooks/site-content-hook";
import { adminApi } from "../../api/admin.api";
import { SLIDE_ACCEPT, prepareSlideImage } from "../../components/dialog/home-slide/slide-kit";
import { VisibilityToggle } from "../../components/dialog/home-slide/slide-parts";
import { Field, inputClass } from "../../components/form/form-dialog";
import { DEFAULT_DIRECTOR_PHOTO } from "../../../home/components/director-message";
import { defaultDirectorMessage, initialsOf } from "../../../home/lib/site-content";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { assetUrl } from "../../../../lib/asset-url";
import { serverMessage } from "../../../../lib/api/error";
import { PanelBar, StatChip } from "./panel-kit";
import { LangTabs, ListEditor, SaveActions, TranslationNote, UnsavedBar } from "./content-kit";
import { langDir, useUnsavedWarning, type LangStatus } from "./content-utils";

const MAX_PARAGRAPHS = 8;

type TextKey = Exclude<keyof DirectorBlock, "paragraphs">;

/** ما يُحفظ: بلا فقراتٍ فارغة. */
const clean = (d: DirectorMessage): DirectorMessage => {
  const block = (b: DirectorBlock): DirectorBlock => ({
    ...b,
    paragraphs: b.paragraphs.map((p) => p.trim()).filter(Boolean),
  });
  return { ...d, ar: block(d.ar), fr: block(d.fr), en: block(d.en) };
};

/** حقول العربية المطلوبة الناقصة — يطابق ما يردّه الخادم. */
function missingArabic(ar: DirectorBlock): Set<string> {
  const miss = new Set<string>();
  for (const k of ["sectionTitle", "title", "fullName", "role"] as const)
    if (!ar[k].trim()) miss.add(k);
  if (!ar.paragraphs.some((p) => p.trim())) miss.add("paragraphs");
  return miss;
}

/** كم حقلاً تُرجم — لشارة اللغة. */
function filledCount(b: DirectorBlock) {
  const keys: TextKey[] = ["sectionTitle", "title", "quote", "fullName", "role"];
  return keys.filter((k) => b[k].trim()).length + (b.paragraphs.some((p) => p.trim()) ? 1 : 0);
}

/**
 * تبويب «كلمة رئيس القسم»: كلّ ما في القسم قابلٌ للتحرير — عنوانه، والعنوان
 * الرئيسيّ، والفقرات، والاقتباس، والاسم والصفة، والصورة، وظهوره أصلاً.
 *
 * والعربية أصل؛ وكلّ حقلٍ يُترك فارغاً في الفرنسية أو الإنجليزية يُعرض
 * بالعربية. وما لم يُحفظ شيءٌ بعد، يبدأ النموذج بالنصّ الافتراضيّ.
 */
export function DirectorPanel() {
  const { data, isLoading, isError, refetch } = useAdminDirectorMessage();

  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError) return <ErrorRetry onRetry={() => refetch()} />;
  return <DirectorForm initial={data ?? defaultDirectorMessage()} />;
}

function DirectorForm({ initial }: { initial: DirectorMessage }) {
  const { t } = useTranslation();
  const save = useSaveDirectorMessage();
  const photoInput = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<DirectorMessage>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(clean(initial)));
  const [lang, setLang] = useState<SiteLang>("ar");
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const dirty = JSON.stringify(clean(draft)) !== baseline;
  const missing = missingArabic(draft.ar);
  const block = draft[lang];
  const dir = langDir(lang);
  const isAr = lang === "ar";
  useUnsavedWarning(dirty);

  const statusOf = (l: SiteLang): LangStatus => {
    if (l === "ar") return missing.size ? "missing" : "done";
    const filled = filledCount(draft[l]);
    return filled === 0 ? "empty" : filled >= 6 ? "done" : "partial";
  };

  const setField = (k: TextKey, v: string) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [k]: v } }));

  const setParagraphs = (paragraphs: string[]) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], paragraphs } }));

  async function pickPhoto(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await adminApi.uploadImage(await prepareSlideImage(file));
      setDraft((d) => ({ ...d, photoUrl: url }));
    } catch (e) {
      toast.error(
        axios.isAxiosError(e) ? serverMessage(e, t("toast.imageUploadFailed")) : (e as Error).message,
      );
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (missing.size) {
      setShowErrors(true);
      setLang("ar");
      toast.error(t("admin.director.arabicRequired"));
      return;
    }
    const payload = clean(draft);
    save.mutate(payload, {
      onSuccess: (saved) => {
        const next = saved ?? payload;
        setDraft(next);
        setBaseline(JSON.stringify(clean(next)));
        setShowErrors(false);
      },
    });
  }

  function undo() {
    setDraft(JSON.parse(baseline));
    setShowErrors(false);
  }

  /** خطأ الحقل في العربية وحدها، وبعد محاولة حفظ. */
  const err = (k: string) =>
    isAr && showErrors && missing.has(k) ? t("admin.site.required") : undefined;
  /** في الترجمة: الفارغ يُعرض بالعربية — فيُقال ذلك في مكانه. */
  const placeholderFor = (k: TextKey) =>
    isAr ? undefined : draft.ar[k] ? `${t("admin.site.fallsBackTo")} ${draft.ar[k]}` : "";

  const textInput = (k: TextKey, max: number, extra?: { multiline?: boolean }) =>
    extra?.multiline ? (
      <textarea
        dir={dir}
        value={block[k]}
        maxLength={max}
        onChange={(e) => setField(k, e.target.value)}
        placeholder={placeholderFor(k)}
        rows={2}
        className={`${inputClass} resize-y leading-relaxed`}
      />
    ) : (
      <input
        dir={dir}
        value={block[k]}
        maxLength={max}
        onChange={(e) => setField(k, e.target.value)}
        placeholder={placeholderFor(k)}
        className={inputClass}
      />
    );

  const photoSrc = assetUrl(draft.photoUrl) ?? DEFAULT_DIRECTOR_PHOTO;

  return (
    <form onSubmit={handleSubmit}>
      <PanelBar
        icon={Quote}
        title={t("admin.director.title")}
        hint={t("admin.director.subtitle")}
        stats={
          draft.isVisible ? (
            <StatChip icon={Eye} label={t("admin.director.statShown")} tone="good" />
          ) : (
            <StatChip icon={EyeOff} label={t("admin.director.statHiddenSection")} tone="muted" />
          )
        }
        actions={
          <SaveActions
            dirty={dirty}
            saving={save.isPending}
            disabled={uploading}
            onUndo={undo}
            saveLabel={t("admin.director.save")}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── الصورة والظهور ── */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-forest/10 px-4 py-3">
              <ImagePlus size={16} className="text-gold" />
              <b className="text-sm text-forest">{t("admin.director.photo")}</b>
            </div>
            <div className="p-4">
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void pickPhoto(e.dataTransfer.files?.[0]);
                }}
                title={t("admin.director.changePhoto")}
                className="group relative block aspect-4/5 w-full overflow-hidden rounded-xl border border-forest/12 bg-forest-deep"
              >
                <img src={photoSrc} alt="" className="absolute inset-0 size-full object-cover" />
                <span
                  className={`absolute inset-0 grid place-items-center bg-black/45 transition ${
                    uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {uploading ? (
                    <Loader2 size={28} className="animate-spin text-white" />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-[11.5px] font-bold text-[#1a312d]">
                      <RefreshCw size={13} />
                      {t("admin.director.changePhoto")}
                    </span>
                  )}
                </span>
                {!draft.photoUrl && (
                  <span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/55 px-2 py-1 text-center text-[10.5px] text-white">
                    {t("admin.director.defaultPhoto")}
                  </span>
                )}
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-forest/12 px-2.5 text-[11.5px] font-semibold text-forest transition hover:border-gold hover:text-gold disabled:opacity-60"
                >
                  <RefreshCw size={13} />
                  {t("admin.director.changePhoto")}
                </button>
                {draft.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, photoUrl: null }))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-forest/12 px-2.5 text-[11.5px] font-semibold text-clay transition hover:border-brick/40 hover:text-brick"
                  >
                    <RotateCcw size={13} />
                    {t("admin.director.resetPhoto")}
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-clay">{t("admin.director.photoHint")}</p>
              <input
                ref={photoInput}
                type="file"
                accept={SLIDE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  void pickPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <VisibilityToggle
            on={draft.isVisible}
            onChange={(v) => setDraft((d) => ({ ...d, isVisible: v }))}
            labels={{
              on: t("admin.director.sectionShown"),
              off: t("admin.director.sectionHidden"),
              onHint: t("admin.director.sectionShownHint"),
              offHint: t("admin.director.sectionHiddenHint"),
            }}
          />
        </aside>

        {/* ── النصوص ── */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
          <LangTabs value={lang} onChange={setLang} statusOf={statusOf} />

          <div className="space-y-5 p-5">
            <TranslationNote lang={lang} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.director.sectionTitle")} icon={Heading} hint={isAr ? t("admin.director.sectionTitleHint") : undefined} error={err("sectionTitle")}>
                {textInput("sectionTitle", 80)}
              </Field>
              <Field label={t("admin.director.initials")} icon={UserRound} note={t("admin.optional")} hint={t("admin.director.initialsHint", { letter: initialsOf(block.fullName || draft.ar.fullName) })}>
                {textInput("initials", 3)}
              </Field>
            </div>

            <Field label={t("admin.director.heading")} icon={Heading} error={err("title")}>
              {textInput("title", 220, { multiline: true })}
            </Field>

            <ListEditor
              label={t("admin.director.paragraphs")}
              icon={Pilcrow}
              items={block.paragraphs}
              onChange={setParagraphs}
              max={MAX_PARAGRAPHS}
              make={() => ""}
              addLabel={t("admin.director.addParagraph")}
              empty={isAr ? t("admin.director.noParagraphs") : t("admin.director.paragraphsFallback")}
              error={err("paragraphs")}
              render={(p, update) => (
                <textarea
                  dir={dir}
                  value={p}
                  maxLength={1500}
                  rows={3}
                  onChange={(e) => update(e.target.value)}
                  className={`${inputClass} resize-y leading-relaxed`}
                />
              )}
            />

            <Field label={t("admin.director.quote")} icon={MessageSquareQuote} note={t("admin.optional")} hint={isAr ? t("admin.director.quoteHint") : undefined}>
              {textInput("quote", 400, { multiline: true })}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.director.fullName")} icon={UserRound} error={err("fullName")}>
                {textInput("fullName", 120)}
              </Field>
              <Field label={t("admin.director.role")} icon={BadgeCheck} error={err("role")}>
                {textInput("role", 160)}
              </Field>
            </div>
          </div>
        </section>
      </div>

      <UnsavedBar
        dirty={dirty}
        saving={save.isPending}
        disabled={uploading}
        onUndo={undo}
        saveLabel={t("admin.director.save")}
      />
    </form>
  );
}
