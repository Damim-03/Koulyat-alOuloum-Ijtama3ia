import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BarChart3,
  FileText,
  Heading,
  Images,
  Info,
  LayoutGrid,
  Pilcrow,
  Text,
  Wallpaper,
} from "lucide-react";
import type { AboutBlock, AboutPage, SiteLang } from "../../../../types/site.types";
import { useAdminAboutPage, useSaveAboutPage } from "../../hooks/site-content-hook";
import { useAdminHomeSlides } from "../../hooks/home-slides-hook";
import { Field, inputClass } from "../../components/form/form-dialog";
import { defaultAboutPage } from "../../../home/lib/site-content";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { useLanguage } from "../../../../hooks/use-language";
import { PanelBar, PartTabs } from "./panel-kit";
import { LangTabs, ListEditor, SaveActions, TranslationNote, UnsavedBar } from "./content-kit";
import { langDir, usePart, useUnsavedWarning, type LangStatus } from "./content-utils";
import { SlidesPanel } from "./slides-panel";

const MAX_INTRO = 8;
const MAX_FEATURES = 8;
const MAX_STATS = 4;

type TextKey = "title" | "subtitle" | "introTitle" | "galleryTitle" | "featuresTitle";

/** ما يُحفظ: بلا فقراتٍ فارغة، ولا مزايا ولا أرقامٍ فارغةٍ كلّها. */
function cleanBlock(b: AboutBlock): AboutBlock {
  return {
    ...b,
    intro: b.intro.map((p) => p.trim()).filter(Boolean),
    features: b.features
      .map((f) => ({ title: f.title.trim(), desc: f.desc.trim() }))
      .filter((f) => f.title || f.desc),
    stats: b.stats
      .map((s) => ({ value: s.value.trim(), label: s.label.trim() }))
      .filter((s) => s.value || s.label),
  };
}

const clean = (d: AboutPage): AboutPage => ({
  ar: cleanBlock(d.ar),
  fr: cleanBlock(d.fr),
  en: cleanBlock(d.en),
});

/** ما ينقص العربية — يطابق ما يردّه الخادم. */
function missingArabic(raw: AboutBlock): Set<string> {
  const ar = cleanBlock(raw);
  const miss = new Set<string>();
  if (!ar.title.trim()) miss.add("title");
  if (!ar.introTitle.trim()) miss.add("introTitle");
  if (!ar.intro.length) miss.add("intro");
  if (ar.features.some((f) => !f.title)) miss.add("features");
  if (ar.stats.some((s) => !s.value || !s.label)) miss.add("stats");
  return miss;
}

function filledCount(b: AboutBlock) {
  const texts: TextKey[] = ["title", "subtitle", "introTitle", "galleryTitle", "featuresTitle"];
  return (
    texts.filter((k) => b[k].trim()).length +
    (b.intro.some((p) => p.trim()) ? 1 : 0) +
    (b.features.some((f) => f.title.trim()) ? 1 : 0) +
    (b.stats.some((s) => s.value.trim() && s.label.trim()) ? 1 : 0)
  );
}

/**
 * تبويب «عن المنصة»: نصوص الصفحة، وصور معرضها، وخلفية رأسها — ثلاثة أجزاء
 * في تبويبٍ واحد.
 *
 * والجزءان مرسومان معاً والظاهر واحد، فنصٌّ لم يُحفظ لا يضيع بالانتقال إلى
 * الصور والعودة.
 */
export function AboutPanel() {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const [part, select] = usePart(["texts", "images", "background"] as const);
  const { data: slides } = useAdminHomeSlides("about");
  const { data: backdrop } = useAdminHomeSlides("aboutHero");

  const parts = [
    { id: "texts" as const, icon: FileText, label: t("admin.about.partTexts") },
    {
      id: "images" as const,
      icon: Images,
      label: t("admin.about.partImages"),
      badge: slides ? String(slides.filter((s) => s.isActive).length) : undefined,
    },
    {
      id: "background" as const,
      icon: Wallpaper,
      label: t("admin.about.partBackground"),
      badge: backdrop ? String(backdrop.filter((s) => s.isActive).length) : undefined,
    },
  ];

  return (
    <div>
      <PartTabs
        parts={parts}
        value={part}
        onChange={select}
        link={{ href: localePath("/about"), label: t("admin.about.openPage") }}
      />

      <div hidden={part !== "texts"}>
        <AboutTexts />
      </div>
      <div hidden={part !== "images"}>
        <SlidesPanel placement="about" />
      </div>
      <div hidden={part !== "background"}>
        <SlidesPanel placement="aboutHero" />
      </div>
    </div>
  );
}

function AboutTexts() {
  const { data, isLoading, isError, refetch } = useAdminAboutPage();
  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError) return <ErrorRetry onRetry={() => refetch()} />;
  return <AboutForm initial={data ?? defaultAboutPage()} />;
}

function AboutForm({ initial }: { initial: AboutPage }) {
  const { t } = useTranslation();
  const save = useSaveAboutPage();

  const [draft, setDraft] = useState<AboutPage>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(clean(initial)));
  const [lang, setLang] = useState<SiteLang>("ar");
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
    return filled === 0 ? "empty" : filled >= 7 ? "done" : "partial";
  };

  const set = <K extends keyof AboutBlock>(k: K, v: AboutBlock[K]) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [k]: v } }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (missing.size) {
      setShowErrors(true);
      setLang("ar");
      toast.error(t("admin.about.arabicRequired"));
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

  const err = (k: string, msg = t("admin.site.required")) =>
    isAr && showErrors && missing.has(k) ? msg : undefined;
  const placeholderFor = (k: TextKey) =>
    isAr ? undefined : draft.ar[k] ? `${t("admin.site.fallsBackTo")} ${draft.ar[k]}` : "";
  const listEmpty = (key: string) => (isAr ? t(`admin.about.${key}Empty`) : t("admin.about.listFallback"));

  const text = (k: TextKey, max: number, multiline = false) =>
    multiline ? (
      <textarea
        dir={dir}
        value={block[k]}
        maxLength={max}
        rows={2}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholderFor(k)}
        className={`${inputClass} resize-y leading-relaxed`}
      />
    ) : (
      <input
        dir={dir}
        value={block[k]}
        maxLength={max}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholderFor(k)}
        className={inputClass}
      />
    );

  return (
    <form onSubmit={handleSubmit}>
      <PanelBar
        icon={Info}
        title={t("admin.about.title")}
        hint={t("admin.about.subtitle")}
        actions={
          <SaveActions dirty={dirty} saving={save.isPending} onUndo={undo} saveLabel={t("admin.about.save")} />
        }
      />

      <section className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
        <LangTabs value={lang} onChange={setLang} statusOf={statusOf} />

        <div className="space-y-6 p-5">
          <TranslationNote lang={lang} />

          {/* ── الرأس ── */}
          <Group title={t("admin.about.groupHeader")}>
            <Field label={t("admin.about.pageTitle")} icon={Heading} error={err("title")}>
              {text("title", 80)}
            </Field>
            <Field label={t("admin.about.pageSubtitle")} icon={Text} note={t("admin.optional")}>
              {text("subtitle", 300, true)}
            </Field>
          </Group>

          {/* ── التعريف ── */}
          <Group title={t("admin.about.groupIntro")}>
            <Field label={t("admin.about.introTitle")} icon={Heading} error={err("introTitle")}>
              {text("introTitle", 120)}
            </Field>
            <ListEditor
              label={t("admin.about.intro")}
              icon={Pilcrow}
              items={block.intro}
              onChange={(v) => set("intro", v)}
              max={MAX_INTRO}
              make={() => ""}
              addLabel={t("admin.about.addParagraph")}
              empty={listEmpty("intro")}
              error={err("intro", t("admin.about.introRequired"))}
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
          </Group>

          {/* ── الأرقام ── */}
          <Group title={t("admin.about.groupStats")} hint={t("admin.about.statsHint")}>
            <ListEditor
              label={t("admin.about.stats")}
              icon={BarChart3}
              items={block.stats}
              onChange={(v) => set("stats", v)}
              max={MAX_STATS}
              make={() => ({ value: "", label: "" })}
              addLabel={t("admin.about.addStat")}
              empty={listEmpty("stats")}
              error={err("stats", t("admin.about.statsIncomplete"))}
              render={(s, update) => (
                <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                  <input
                    dir="ltr"
                    value={s.value}
                    maxLength={20}
                    onChange={(e) => update({ ...s, value: e.target.value })}
                    placeholder="+2000"
                    aria-label={t("admin.about.statValue")}
                    className={`${inputClass} text-center font-serif font-bold`}
                  />
                  <input
                    dir={dir}
                    value={s.label}
                    maxLength={60}
                    onChange={(e) => update({ ...s, label: e.target.value })}
                    placeholder={t("admin.about.statLabel")}
                    aria-label={t("admin.about.statLabel")}
                    className={inputClass}
                  />
                </div>
              )}
            />
          </Group>

          {/* ── المعرض ── */}
          <Group title={t("admin.about.groupGallery")}>
            <Field
              label={t("admin.about.galleryTitle")}
              icon={Images}
              note={t("admin.optional")}
              hint={isAr ? t("admin.about.galleryTitleHint") : undefined}
            >
              {text("galleryTitle", 120)}
            </Field>
          </Group>

          {/* ── المزايا ── */}
          <Group title={t("admin.about.groupFeatures")}>
            <Field label={t("admin.about.featuresTitle")} icon={Heading} note={t("admin.optional")}>
              {text("featuresTitle", 120)}
            </Field>
            <ListEditor
              label={t("admin.about.features")}
              icon={LayoutGrid}
              items={block.features}
              onChange={(v) => set("features", v)}
              max={MAX_FEATURES}
              make={() => ({ title: "", desc: "" })}
              addLabel={t("admin.about.addFeature")}
              empty={listEmpty("features")}
              error={err("features", t("admin.about.featureNeedsTitle"))}
              render={(f, update) => (
                <div className="space-y-2 rounded-xl border border-forest/10 bg-cream-2/50 p-2.5">
                  <input
                    dir={dir}
                    value={f.title}
                    maxLength={80}
                    onChange={(e) => update({ ...f, title: e.target.value })}
                    placeholder={t("admin.about.featureTitle")}
                    aria-label={t("admin.about.featureTitle")}
                    className={`${inputClass} font-semibold`}
                  />
                  <textarea
                    dir={dir}
                    value={f.desc}
                    maxLength={400}
                    rows={2}
                    onChange={(e) => update({ ...f, desc: e.target.value })}
                    placeholder={t("admin.about.featureDesc")}
                    aria-label={t("admin.about.featureDesc")}
                    className={`${inputClass} resize-y leading-relaxed`}
                  />
                </div>
              )}
            />
          </Group>
        </div>
      </section>

      <UnsavedBar dirty={dirty} saving={save.isPending} onUndo={undo} saveLabel={t("admin.about.save")} />
    </form>
  );
}

/** مجموعة حقولٍ بعنوان — كلّ قسمٍ من أقسام الصفحة. */
function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
      <legend className="px-1.5 text-sm font-bold text-forest">{title}</legend>
      {hint && <p className="-mt-2 text-[11.5px] text-clay">{hint}</p>}
      {children}
    </fieldset>
  );
}
