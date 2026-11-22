import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, PenLine, RotateCcw, Search, Type, X } from "lucide-react";
import { useAdminSiteTexts, useSaveSiteTexts } from "../../hooks/site-content-hook";
import { inputClass } from "../../components/form/form-dialog";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { useLanguage } from "../../../../hooks/use-language";
import {
  TEXT_LANGS,
  defaultText,
  looksLikeEmail,
  safeHttpUrl,
  type SiteTexts,
  type TextLang,
} from "../../../../i18n/site-texts";
import { PanelBar, StatChip } from "./panel-kit";
import { SaveActions, UnsavedBar } from "./content-kit";
import { CONTENT_LANGS, langDir, usePart, useUnsavedWarning } from "./content-utils";
import {
  ALL_TEXT_FIELDS,
  HIDEABLE_IDS,
  TEXT_SECTIONS,
  type SectionId,
  type TextField,
  type TextGroup,
  type TextSection,
} from "./texts-registry";

const SECTION_IDS = TEXT_SECTIONS.map((s) => s.id) as [SectionId, ...SectionId[]];

/**
 * ما يُحفظ: لكلّ لغةٍ ما خالف نصّه الأصليّ وحده، بلا مسافاتٍ في طرفيه. فالحقل
 * الذي أُعيد إلى أصله، أو تُرك فارغاً، لا يُحفظ — ويعود الموقع إلى نصّه.
 * والمخفيّ قائمةٌ مرتّبة بلا تكرار. ومفاتيح لا يعرضها المحرّر (من إصدارٍ
 * أقدم) تبقى كما هي.
 */
function clean(d: SiteTexts): SiteTexts {
  const out = { hidden: [...new Set(d.hidden)].sort() } as SiteTexts;
  for (const lang of TEXT_LANGS) {
    const kept = Object.entries(d[lang] ?? {})
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([k, v]) => v && v !== defaultText(lang, k))
      .sort(([a], [b]) => a.localeCompare(b));
    out[lang] = Object.fromEntries(kept);
  }
  return out;
}

/** خطأ الحقل — للروابط والبريد وحدها؛ والفارغ ليس خطأً (يعود الأصل). */
function problemOf(field: TextField, value: string): "url" | "email" | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (field.kind === "url" && !safeHttpUrl(v)) return "url";
  if (field.kind === "email" && !looksLikeEmail(v)) return "email";
  return undefined;
}

/**
 * تبويب «النصوص»: عبارات الموقع كلّها بمكانها — الرأس، والصفحة الرئيسية،
 * والمواضيع، و«عن المنصة»، والتذييل، والقوائم الجانبية — لكلّ لغة، وما
 * يُخفى منها أو يُظهر (للّغات كلّها).
 */
export function TextsPanel() {
  const { data, isLoading, isError, refetch } = useAdminSiteTexts();
  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError || !data) return <ErrorRetry onRetry={() => refetch()} />;
  return <TextsForm initial={data} />;
}

function TextsForm({ initial }: { initial: SiteTexts }) {
  const { t, i18n } = useTranslation();
  const { localePath } = useLanguage();
  const save = useSaveSiteTexts();
  const uiLang = (TEXT_LANGS as string[]).includes(i18n.language) ? (i18n.language as TextLang) : "ar";

  const [draft, setDraft] = useState<SiteTexts>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(clean(initial)));
  const [lang, setLang] = useState<TextLang>("ar");
  const [sectionId, selectSection] = usePart(SECTION_IDS);
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const cleaned = useMemo(() => clean(draft), [draft]);
  const dirty = JSON.stringify(cleaned) !== baseline;
  useUnsavedWarning(dirty);

  const hiddenSet = useMemo(() => new Set(draft.hidden), [draft.hidden]);
  const isHidden = (id?: string) => !!id && hiddenSet.has(id);
  const toggleHidden = (id: string) =>
    setDraft((d) => ({
      ...d,
      hidden: d.hidden.includes(id) ? d.hidden.filter((x) => x !== id) : [...d.hidden, id],
    }));

  const valueOf = (l: TextLang, key: string) => draft[l][key] ?? defaultText(l, key) ?? "";
  const changed = (l: TextLang, key: string) => key in cleaned[l];
  const changedIn = (l: TextLang, fields: TextField[]) => fields.filter((x) => changed(l, x.key)).length;
  const sectionFields = (s: TextSection) => s.groups.flatMap((g) => g.fields);
  const hiddenIn = (s: TextSection) =>
    s.groups.reduce((n, g) => n + (isHidden(g.hide) ? 1 : 0) + g.fields.filter((x) => isHidden(x.hide)).length, 0);

  const labelOf = (field: TextField) =>
    field.label
      ? t(`admin.texts.f.${field.label}`, { n: field.n })
      : (defaultText(uiLang, field.key) ?? field.key);

  const set = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [key]: value } }));
  const reset = (key: string) =>
    setDraft((d) => {
      const next = { ...d[lang] };
      delete next[key];
      return { ...d, [lang]: next };
    });

  // البحث في الأقسام كلّها: باسم الحقل، وبنصّه الأصليّ، وبما كُتب فيه.
  // و«المعدَّلة والمخفيّة»: ما غُيّر نصّه بهذه اللغة، أو أُخفي هو أو قسمه.
  const q = query.trim().toLowerCase();
  const matches = (field: TextField, group: TextGroup) =>
    (!onlyChanged ||
      changed(lang, field.key) ||
      isHidden(field.hide) ||
      isHidden(field.hiddenWith) ||
      isHidden(group.hide)) &&
    (!q ||
      [labelOf(field), defaultText(lang, field.key) ?? "", valueOf(lang, field.key), field.key].some((s) =>
        s.toLowerCase().includes(q),
      ));
  const searching = !!q || onlyChanged;
  const visibleSections = searching ? TEXT_SECTIONS : TEXT_SECTIONS.filter((s) => s.id === sectionId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    for (const l of TEXT_LANGS)
      for (const s of TEXT_SECTIONS)
        for (const field of sectionFields(s))
          if (problemOf(field, draft[l][field.key] ?? "")) {
            setShowErrors(true);
            setLang(l);
            setQuery("");
            setOnlyChanged(false);
            selectSection(s.id);
            toast.error(t("admin.texts.fixErrors"));
            return;
          }
    save.mutate(cleaned, {
      onSuccess: (saved) => {
        setDraft(saved);
        setBaseline(JSON.stringify(clean(saved)));
        setShowErrors(false);
      },
    });
  }

  function undo() {
    setDraft(JSON.parse(baseline));
    setShowErrors(false);
  }

  const totalChanged = TEXT_LANGS.reduce((n, l) => n + changedIn(l, ALL_TEXT_FIELDS), 0);
  const totalHidden = HIDEABLE_IDS.filter((id) => hiddenSet.has(id)).length;
  const saveLabel = t("admin.texts.save");

  return (
    <form onSubmit={handleSubmit}>
      <PanelBar
        icon={Type}
        title={t("admin.texts.title")}
        hint={t("admin.texts.subtitle")}
        stats={
          <>
            <StatChip icon={PenLine} label={t("admin.texts.changedTotal")} value={totalChanged} />
            <StatChip
              icon={EyeOff}
              label={t("admin.texts.hiddenTotal")}
              value={totalHidden}
              tone={totalHidden ? "default" : "muted"}
            />
          </>
        }
        actions={<SaveActions dirty={dirty} saving={save.isPending} onUndo={undo} saveLabel={saveLabel} />}
      />

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* ── الأقسام ── */}
        <nav
          aria-label={t("admin.texts.sections")}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:p-0"
        >
          {TEXT_SECTIONS.map((s) => {
            const active = !searching && s.id === sectionId;
            const count = changedIn(lang, sectionFields(s));
            const hiddenCount = hiddenIn(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  setOnlyChanged(false);
                  selectSection(s.id);
                }}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition ${
                  active
                    ? "border-gold/50 bg-gold/12 text-forest"
                    : "border-forest/10 bg-cream-card text-forest/75 hover:border-gold/40 hover:text-forest"
                }`}
              >
                <s.icon size={16} className="shrink-0 text-gold" />
                <span className="flex-1">{t(`admin.texts.section.${s.id}.title`)}</span>
                {hiddenCount > 0 && (
                  <span
                    title={t("admin.texts.hiddenTotal")}
                    className="inline-flex items-center gap-0.5 rounded-full bg-forest/10 px-1.5 py-px text-[10.5px] font-bold tabular-nums text-clay"
                  >
                    <EyeOff size={10} />
                    {hiddenCount}
                  </span>
                )}
                {count > 0 && (
                  <span className="rounded-full bg-gold/20 px-1.5 py-px text-[10.5px] font-bold tabular-nums text-forest">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
          {/* ── اللغة ── */}
          <div role="tablist" className="flex flex-wrap items-center gap-1.5 border-b border-forest/10 px-3 py-2.5">
            {CONTENT_LANGS.map((l) => {
              const count = changedIn(l.code, ALL_TEXT_FIELDS);
              return (
                <button
                  key={l.code}
                  type="button"
                  role="tab"
                  aria-selected={lang === l.code}
                  onClick={() => setLang(l.code)}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${
                    lang === l.code
                      ? "bg-gold/15 text-forest ring-1 ring-gold/50"
                      : "text-forest/75 hover:bg-forest/6 hover:text-forest"
                  }`}
                >
                  {l.label}
                  <span
                    className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                      count ? "bg-gold/25 text-forest" : "bg-forest/10 text-clay"
                    }`}
                  >
                    {count ? t("admin.texts.changedN", { count }) : t("admin.texts.asIs")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── البحث ── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-forest/10 px-4 py-3">
            <label className="relative min-w-[220px] flex-1">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-clay" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin.texts.search")}
                aria-label={t("admin.texts.search")}
                className={`${inputClass} h-10 py-0 ps-9 pe-9`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("admin.texts.clearSearch")}
                  className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-clay hover:text-forest"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              type="button"
              aria-pressed={onlyChanged}
              onClick={() => setOnlyChanged((v) => !v)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${
                onlyChanged
                  ? "border-gold/60 bg-gold/15 text-forest ring-1 ring-gold/40"
                  : "border-forest/12 text-forest/75 hover:border-gold/40 hover:text-forest"
              }`}
            >
              <PenLine size={15} className="text-gold" />
              {t("admin.texts.onlyChanged")}
            </button>
          </div>

          <div className="space-y-8 p-5">
            {lang !== uiLang && (
              <p className="rounded-xl bg-gold/8 px-3.5 py-2.5 text-[12px] leading-relaxed text-forest/80">
                {t("admin.texts.langNote", { lang: CONTENT_LANGS.find((l) => l.code === lang)?.label })}
              </p>
            )}

            {visibleSections.map((s) => {
              const groups = s.groups
                .map((g) => ({ group: g, fields: g.fields.filter((x) => matches(x, g)) }))
                .filter((x) => x.fields.length);
              if (searching && !groups.length) return null;
              return (
                <div key={s.id} className="space-y-5">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
                        <s.icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-serif text-base font-bold text-forest">
                          {t(`admin.texts.section.${s.id}.title`)}
                        </h3>
                        <p className="text-[12px] leading-relaxed text-clay">{t(`admin.texts.section.${s.id}.hint`)}</p>
                      </div>
                    </div>
                    {s.page && (
                      <a
                        href={localePath(s.page)}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-forest/12 px-2.5 text-[12px] font-semibold text-forest transition hover:border-gold hover:text-gold"
                      >
                        <ExternalLink size={13} />
                        {t("admin.texts.openPage")}
                      </a>
                    )}
                  </header>

                  {!groups.length && (
                    <p className="rounded-xl border border-dashed border-forest/15 px-4 py-6 text-center text-[12.5px] text-clay">
                      {t("admin.texts.noChanged")}
                    </p>
                  )}

                  {groups.map(({ group: g, fields }) => {
                    const groupHidden = isHidden(g.hide);
                    return (
                      <fieldset
                        key={g.id}
                        className={`rounded-2xl border p-4 transition ${
                          groupHidden ? "border-dashed border-forest/20 bg-forest/3" : "border-forest/10"
                        }`}
                      >
                        <legend className="px-1.5 text-sm font-bold text-forest">{t(`admin.texts.group.${g.id}`)}</legend>
                        {g.hide && (
                          <div
                            className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px] ${
                              groupHidden ? "bg-brick/8 text-brick" : "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              {groupHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                              {groupHidden ? t("admin.texts.groupHidden") : t("admin.texts.groupShown")}
                            </span>
                            <VisibilityToggle hidden={groupHidden} onToggle={() => toggleHidden(g.hide!)} />
                          </div>
                        )}
                        <div className={`grid gap-4 md:grid-cols-2 ${groupHidden ? "opacity-60" : ""}`}>
                          {fields.map((field) => (
                            <TextRow
                              key={field.key}
                              field={field}
                              label={labelOf(field)}
                              lang={lang}
                              value={valueOf(lang, field.key)}
                              original={defaultText(lang, field.key) ?? ""}
                              changed={changed(lang, field.key)}
                              hidden={isHidden(field.hide) || isHidden(field.hiddenWith)}
                              onToggleHidden={field.hide ? () => toggleHidden(field.hide!) : undefined}
                              showError={showErrors}
                              onChange={(v) => set(field.key, v)}
                              onReset={() => reset(field.key)}
                            />
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              );
            })}

            {searching && !TEXT_SECTIONS.some((s) => s.groups.some((g) => g.fields.some((x) => matches(x, g)))) && (
              <p className="py-10 text-center text-sm text-clay">
                {onlyChanged && !q ? t("admin.texts.noneChanged") : t("admin.texts.noMatch")}
              </p>
            )}
          </div>
        </section>
      </div>

      <UnsavedBar dirty={dirty} saving={save.isPending} onUndo={undo} saveLabel={saveLabel} />
    </form>
  );
}

/** «ظاهر / مخفيّ» — للّغات كلّها. */
function VisibilityToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!hidden}
      onClick={onToggle}
      title={hidden ? t("admin.texts.showTitle") : t("admin.texts.hideTitle")}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition ${
        hidden
          ? "border-brick/30 bg-brick/10 text-brick hover:bg-brick/15"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
      }`}
    >
      {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
      {hidden ? t("admin.texts.hidden") : t("admin.texts.shown")}
    </button>
  );
}

function TextRow({
  field,
  label,
  lang,
  value,
  original,
  changed,
  hidden,
  onToggleHidden,
  showError,
  onChange,
  onReset,
}: {
  field: TextField;
  label: string;
  lang: TextLang;
  value: string;
  original: string;
  changed: boolean;
  hidden: boolean;
  /** حاضرٌ إن كان عنصر الحقل يُخفى. */
  onToggleHidden?: () => void;
  showError: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const long = field.kind === "long";
  const ltr = field.kind === "url" || field.kind === "email" || field.kind === "phone";
  const problem = problemOf(field, value);
  const error = problem && (showError || changed) ? t(`admin.texts.invalid.${problem}`) : undefined;
  const ring = error
    ? "border-brick/60 focus:border-brick focus:ring-brick/20"
    : changed
      ? "border-gold/60 bg-gold/5"
      : "";
  const props = {
    dir: ltr ? "ltr" : langDir(lang),
    value,
    maxLength: long ? 1500 : 300,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-invalid": !!error,
    "aria-label": label,
    className: `${inputClass} ${ring} ${hidden ? "opacity-55" : ""}`,
  } as const;
  const nav = field.hide?.startsWith("sidebar.");

  return (
    <div className={long ? "md:col-span-2" : undefined}>
      <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-forest">
          <span className={`truncate ${hidden ? "text-clay line-through decoration-clay/50" : ""}`}>{label}</span>
          {changed && (
            <span className="shrink-0 rounded-full bg-gold/20 px-1.5 py-px text-[10px] font-bold text-forest">
              {t("admin.texts.changed")}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value !== original && (
            <button
              type="button"
              onClick={onReset}
              title={t("admin.texts.reset")}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-clay transition hover:bg-forest/6 hover:text-forest"
            >
              <RotateCcw size={12} />
              {t("admin.texts.reset")}
            </button>
          )}
          {onToggleHidden && <VisibilityToggle hidden={hidden} onToggle={onToggleHidden} />}
        </span>
      </div>
      {long ? (
        <textarea {...props} rows={3} className={`${props.className} resize-y leading-relaxed`} />
      ) : (
        // Plain text, not type=url/email: the browser's own check would block
        // the submit on a field in a hidden section, with no message in view.
        <input
          {...props}
          type="text"
          inputMode={field.kind === "email" ? "email" : field.kind === "url" ? "url" : field.kind === "phone" ? "tel" : "text"}
        />
      )}
      {error ? (
        <p className="mt-1 text-[11px] text-brick">{error}</p>
      ) : hidden ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-brick/90">
          <EyeOff size={11} className="shrink-0" />
          {nav ? t("admin.texts.navHiddenNote") : t("admin.texts.fieldHiddenNote")}
        </p>
      ) : !value.trim() ? (
        <p className="mt-1 text-[11px] text-clay">{t("admin.texts.emptyFallsBack")}</p>
      ) : changed && original ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-clay" dir={ltr ? "ltr" : langDir(lang)}>
          <span className="font-semibold">{t("admin.texts.original")}</span> {original}
        </p>
      ) : null}
    </div>
  );
}
