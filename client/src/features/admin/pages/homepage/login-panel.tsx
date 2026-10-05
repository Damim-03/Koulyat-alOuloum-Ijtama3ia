import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlignLeft,
  FileText,
  Hand,
  Images,
  Landmark,
  LogIn,
  MonitorPlay,
  Sparkles,
  StickyNote,
  Type,
} from "lucide-react";
import type {
  LoginBlock,
  LoginContent,
  SiteLang,
} from "../../../../types/site.types";
import {
  useAdminLoginContent,
  useSaveLoginContent,
} from "../../hooks/site-content-hook";
import { useAdminHomeSlides } from "../../hooks/home-slides-hook";
import { Field, inputClass } from "../../components/form/form-dialog";
import {
  defaultLoginContent,
  resolveLogin,
} from "../../../home/lib/site-content";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { useLanguage } from "../../../../hooks/use-language";
import { PanelBar, PartTabs } from "./panel-kit";
import {
  LangTabs,
  SaveActions,
  TranslationNote,
  UnsavedBar,
} from "./content-kit";
import {
  langDir,
  usePart,
  useUnsavedWarning,
  type LangStatus,
} from "./content-utils";
import { SlidesPanel } from "./slides-panel";
import { LoginPreview } from "./login-preview";

const KEYS: (keyof LoginBlock)[] = [
  "university",
  "platform",
  "welcome",
  "highlight",
  "body",
  "note",
];
/** ما لا بدّ منه بالعربية — يطابق ما يردّه الخادم. */
const REQUIRED: (keyof LoginBlock)[] = ["university", "platform", "welcome"];
const MAX: Record<keyof LoginBlock, number> = {
  university: 120,
  platform: 80,
  welcome: 80,
  highlight: 80,
  body: 400,
  note: 200,
};

const cleanBlock = (b: LoginBlock): LoginBlock =>
  Object.fromEntries(
    KEYS.map((k) => [k, b[k].trim()]),
  ) as unknown as LoginBlock;

const clean = (d: LoginContent): LoginContent => ({
  ar: cleanBlock(d.ar),
  fr: cleanBlock(d.fr),
  en: cleanBlock(d.en),
});

/**
 * تبويب «صفحة الدخول»: نصوص لوحة الترحيب، وخلفيتها — جزءان في تبويبٍ واحد،
 * كـ«عن المنصة».
 *
 * والجزءان مرسومان معاً والظاهر واحد، فنصٌّ لم يُحفظ لا يضيع بالانتقال إلى
 * الخلفية والعودة.
 */
export function LoginPanel() {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const [part, select] = usePart(["texts", "images"] as const);
  const { data: slides } = useAdminHomeSlides("login");

  const parts = [
    {
      id: "texts" as const,
      icon: FileText,
      label: t("admin.loginPage.partTexts"),
    },
    {
      id: "images" as const,
      icon: Images,
      label: t("admin.loginPage.partImages"),
      badge: slides
        ? String(slides.filter((s) => s.isActive).length)
        : undefined,
    },
  ];

  return (
    <div>
      <PartTabs
        parts={parts}
        value={part}
        onChange={select}
        link={{
          href: localePath("/login"),
          label: t("admin.loginPage.openPage"),
        }}
      />
      <div hidden={part !== "texts"}>
        <LoginTexts />
      </div>
      <div hidden={part !== "images"}>
        <SlidesPanel placement="login" />
      </div>
    </div>
  );
}

function LoginTexts() {
  const { data, isLoading, isError, refetch } = useAdminLoginContent();
  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError) return <ErrorRetry onRetry={() => refetch()} />;
  return <LoginForm initial={data ?? defaultLoginContent()} />;
}

function LoginForm({ initial }: { initial: LoginContent }) {
  const { t } = useTranslation();
  const save = useSaveLoginContent();
  const { data: allSlides } = useAdminHomeSlides("login");
  const slides = useMemo(
    () => (allSlides ?? []).filter((s) => s.isActive),
    [allSlides],
  );

  const [draft, setDraft] = useState<LoginContent>(initial);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(clean(initial)),
  );
  const [lang, setLang] = useState<SiteLang>("ar");
  const [showErrors, setShowErrors] = useState(false);

  const dirty = JSON.stringify(clean(draft)) !== baseline;
  const missing = new Set(REQUIRED.filter((k) => !draft.ar[k].trim()));
  const block = draft[lang];
  const dir = langDir(lang);
  const isAr = lang === "ar";
  useUnsavedWarning(dirty);

  const statusOf = (l: SiteLang): LangStatus => {
    if (l === "ar") return missing.size ? "missing" : "done";
    const filled = KEYS.filter((k) => draft[l][k].trim()).length;
    return filled === 0 ? "empty" : filled === KEYS.length ? "done" : "partial";
  };

  const set = (k: keyof LoginBlock, v: string) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [k]: v } }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (missing.size) {
      setShowErrors(true);
      setLang("ar");
      toast.error(t("admin.loginPage.arabicRequired"));
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

  const err = (k: keyof LoginBlock) =>
    isAr && showErrors && missing.has(k) ? t("admin.site.required") : undefined;
  // في الترجمة: ما يُعرض إن تُرك الحقل فارغاً.
  const placeholderFor = (k: keyof LoginBlock) =>
    isAr
      ? undefined
      : draft.ar[k]
        ? `${t("admin.site.fallsBackTo")} ${draft.ar[k]}`
        : "";

  const text = (k: keyof LoginBlock, rows = 0) =>
    rows ? (
      <textarea
        dir={dir}
        value={block[k]}
        maxLength={MAX[k]}
        rows={rows}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholderFor(k)}
        className={`${inputClass} resize-y leading-relaxed`}
      />
    ) : (
      <input
        dir={dir}
        value={block[k]}
        maxLength={MAX[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholderFor(k)}
        className={inputClass}
      />
    );

  const optional = t("admin.optional");

  return (
    <form onSubmit={handleSubmit}>
      <PanelBar
        icon={LogIn}
        title={t("admin.loginPage.title")}
        hint={t("admin.loginPage.subtitle")}
        actions={
          <SaveActions
            dirty={dirty}
            saving={save.isPending}
            onUndo={undo}
            saveLabel={t("admin.loginPage.save")}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
          <LangTabs value={lang} onChange={setLang} statusOf={statusOf} />

          <div className="space-y-6 p-5">
            <TranslationNote lang={lang} />

            {/* ── الهوية ── */}
            <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
              <legend className="px-1.5 text-sm font-bold text-forest">
                {t("admin.loginPage.groupBrand")}
              </legend>
              <p className="-mt-2 text-[11.5px] text-clay">
                {t("admin.loginPage.groupBrandHint")}
              </p>
              <Field
                label={t("admin.loginPage.university")}
                icon={Landmark}
                error={err("university")}
              >
                {text("university")}
              </Field>
              <Field
                label={t("admin.loginPage.platform")}
                icon={Sparkles}
                error={err("platform")}
              >
                {text("platform")}
              </Field>
            </fieldset>

            {/* ── الترحيب ── */}
            <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
              <legend className="px-1.5 text-sm font-bold text-forest">
                {t("admin.loginPage.groupWelcome")}
              </legend>
              <Field
                label={t("admin.loginPage.welcome")}
                icon={Hand}
                error={err("welcome")}
              >
                {text("welcome")}
              </Field>
              <Field
                label={t("admin.loginPage.highlight")}
                icon={Type}
                note={optional}
                hint={isAr ? t("admin.loginPage.highlightHint") : undefined}
              >
                {text("highlight")}
              </Field>
              <Field
                label={t("admin.loginPage.body")}
                icon={AlignLeft}
                note={optional}
              >
                {text("body", 3)}
              </Field>
              <Field
                label={t("admin.loginPage.note")}
                icon={StickyNote}
                note={optional}
                hint={isAr ? t("admin.loginPage.noteHint") : undefined}
              >
                {text("note", 2)}
              </Field>
            </fieldset>
          </div>
        </section>

        {/* ── المعاينة: تتبع الكتابة واللغة المختارة ── */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-forest/10 px-4 py-3">
              <MonitorPlay size={16} className="text-gold" />
              <b className="text-sm text-forest">
                {t("admin.loginBg.previewTitle")}
              </b>
            </div>
            <LoginPreview
              slides={slides}
              texts={resolveLogin(draft, lang)}
              dir={dir}
            />
            <p className="px-4 py-3 text-[11.5px] leading-relaxed text-clay">
              {t("admin.loginPage.previewHint")}
            </p>
          </div>
        </aside>
      </div>

      <UnsavedBar
        dirty={dirty}
        saving={save.isPending}
        onUndo={undo}
        saveLabel={t("admin.loginPage.save")}
      />
    </form>
  );
}
