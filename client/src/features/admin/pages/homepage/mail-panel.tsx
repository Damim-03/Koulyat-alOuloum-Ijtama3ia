import { useMemo, useRef, useState, type FormEvent } from "react";
import universitySeal from "../../../../assets/university-logo.png";
import facultySeal from "../../../../assets/Faculty.png";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BellRing,
  Braces,
  Check,
  ImagePlus,
  KeyRound,
  Layers,
  Loader2,
  Mail,
  MailCheck,
  MonitorPlay,
  Palette,
  RotateCcw,
  Send,
  ShieldCheck,
  Stamp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { SiteLang } from "../../../../types/site.types";
import {
  useMailPreview,
  useMailTemplates,
  useSaveMailTemplates,
  useSendTestMail,
  type LogoChoice,
  type MailDraw,
  type MailGroup,
  type MailLook,
  type MailTemplates,
  type MailTemplatesData,
  type MailTexts,
} from "../../api/mail-templates.api";
import { Field, inputClass } from "../../components/form/form-dialog";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { assetUrl } from "../../../../lib/asset-url";
import { useUploadImage } from "../../hooks/admin-hook";
import { PanelBar } from "./panel-kit";
import { SaveActions, UnsavedBar } from "./content-kit";
import { CONTENT_LANGS, langDir, useUnsavedWarning } from "./content-utils";

/**
 * تبويب «رسائل البريد»: ما تقوله الرسائل التي ترسلها المنصة — استعادة كلمة
 * المرور، وتأكيد البريد، وتغيّر كلمة المرور، والدخول من جهازٍ جديد — بكلّ
 * لغة، وما يتكرّر فيها، وشكلها: لونا الرأس والزرّ، وختم الجامعة.
 *
 * وكلّ حقلٍ يبدأ بنصّ المنصة: ما يُكتب فيه يحلّ محلّه، وما يُفرَّغ أو يُعاد
 * إلى الأصل يعود نصَّ المنصة. والقيم (`{{account}}`…) تُدرج بأزرارها، ولا
 * يُقبل غيرها — يقولها الخادم لكلّ نصّ. والمعاينة يرسمها الخادم بالدالّة
 * التي يرسل بها، ممّا يُكتب ولم يُحفظ بعد؛ والتجربة تذهب إلى بريد المسؤول
 * المؤكَّد وحده.
 */

const GROUPS: { id: MailGroup; icon: LucideIcon }[] = [
  { id: "common", icon: Layers },
  { id: "reset", icon: KeyRound },
  { id: "verify", icon: MailCheck },
  { id: "passwordChanged", icon: ShieldCheck },
  { id: "newDevice", icon: BellRing },
];

const HEADER_SWATCHES = ["#26423d", "#1f3a5f", "#5b1f2a", "#3d2c5c", "#2b2b2b"];
const ACCENT_SWATCHES = ["#c1965a", "#d4a017", "#2f855a", "#c05621", "#4a90b8"];
const HEX = /^#[0-9a-f]{6}$/i;
const VAR = /\{\{\s*(\w+)\s*\}\}/g;

/** The texts kept: written, and not the platform's own words again. */
function cleanTexts(texts: MailTexts, defaults: MailTexts): MailTexts {
  return Object.fromEntries(
    Object.entries(texts)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([k, v]) => v && v !== defaults[k]?.trim()),
  );
}

const clean = (d: MailTemplates, data: MailTemplatesData): MailTemplates => ({
  ar: cleanTexts(d.ar, data.defaults.ar),
  en: cleanTexts(d.en, data.defaults.en),
  fr: cleanTexts(d.fr, data.defaults.fr),
  look: { ...d.look, header: d.look.header.toLowerCase(), accent: d.look.accent.toLowerCase() },
});

const fieldName = (key: string) => key.split(".").pop()!;

export function MailPanel() {
  const { data, isLoading, isError, refetch } = useMailTemplates();
  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError || !data) return <ErrorRetry onRetry={() => refetch()} />;
  return <MailForm data={data} />;
}

function MailForm({ data }: { data: MailTemplatesData }) {
  const { t } = useTranslation();
  const save = useSaveMailTemplates();
  const test = useSendTestMail();

  const initial: MailTemplates = data.templates ?? { ar: {}, en: {}, fr: {}, look: data.look };
  const [draft, setDraft] = useState<MailTemplates>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(clean(initial, data)));
  const [group, setGroup] = useState<MailGroup>("common");
  const [lang, setLang] = useState<SiteLang>("ar");
  const [byAdmin, setByAdmin] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const cleaned = clean(draft, data);
  const dirty = JSON.stringify(cleaned) !== baseline;
  useUnsavedWarning(dirty);

  /** What is wrong with a text, as the server would say it — or nothing. */
  const problemOf = (key: string, value: string): string | undefined => {
    const allowed = data.fields[key]?.vars ?? [];
    for (const [, name] of value.matchAll(VAR))
      if (!allowed.includes(name!))
        return allowed.length
          ? t("admin.mailTemplates.unknownVar", { name: `{{${name}}}`, list: allowed.map((v) => `{{${v}}}`).join(" ") })
          : t("admin.mailTemplates.noVars", { name: `{{${name}}}` });
    return undefined;
  };
  const problems = CONTENT_LANGS.flatMap((l) =>
    Object.entries(draft[l.code]).flatMap(([k, v]) => (problemOf(k, v) ? [{ lang: l.code, key: k }] : [])),
  );
  const lookOk = HEX.test(draft.look.header) && HEX.test(draft.look.accent);
  const valid = problems.length === 0 && lookOk;

  // The preview follows the writing, a moment after it stops — and only what the server would accept.
  const kind = group === "common" ? "reset" : group;
  const drawJson = valid ? JSON.stringify({ templates: cleaned, kind, lang, byAdmin: kind === "passwordChanged" && byAdmin }) : "";
  const settled = useDebouncedValue(drawJson, 400);
  const draw = useMemo(() => (settled ? (JSON.parse(settled) as MailDraw) : null), [settled]);
  const preview = useMailPreview(draw);

  const valueOf = (key: string) => draft[lang][key] ?? data.defaults[lang][key] ?? "";
  const changed = (l: SiteLang, key: string) => key in cleaned[l];
  const setText = (key: string, value: string) => setDraft((d) => ({ ...d, [lang]: { ...d[lang], [key]: value } }));
  const restore = (key: string) =>
    setDraft((d) => {
      const next = { ...d[lang] };
      delete next[key];
      return { ...d, [lang]: next };
    });
  const setLook = (patch: Partial<MailLook>) => setDraft((d) => ({ ...d, look: { ...d.look, ...patch } }));

  /** A value dropped where the cursor stands, in the field it belongs to. */
  function insertVar(key: string, name: string) {
    const el = refs.current[key];
    const value = valueOf(key);
    const token = `{{${name}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setText(key, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const groupChanged = (g: MailGroup) =>
    (g === "common" && JSON.stringify(cleaned.look) !== JSON.stringify(data.look)) ||
    data.groups[g].some((k) => CONTENT_LANGS.some((l) => changed(l.code, k)));
  const langChanged = (l: SiteLang) => data.groups[group].filter((k) => changed(l, k)).length;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      const first = problems[0];
      if (first) {
        setLang(first.lang);
        setGroup((Object.keys(data.groups) as MailGroup[]).find((g) => data.groups[g].includes(first.key)) ?? group);
      }
      return;
    }
    save.mutate(cleaned, {
      onSuccess: (saved) => {
        const next = saved ?? { ar: {}, en: {}, fr: {}, look: data.look };
        setDraft(next);
        setBaseline(JSON.stringify(clean(next, data)));
      },
    });
  }

  const undo = () => setDraft(JSON.parse(baseline));
  const resetAll = () => setDraft({ ar: {}, en: {}, fr: {}, look: data.look });
  const dir = langDir(lang);

  return (
    <form onSubmit={handleSubmit} data-testid="mail-panel">
      <PanelBar
        icon={Mail}
        title={t("admin.mailTemplates.title")}
        hint={t("admin.mailTemplates.subtitle")}
        actions={
          <SaveActions dirty={dirty} saving={save.isPending} disabled={!valid} onUndo={undo} saveLabel={t("admin.mailTemplates.save")} />
        }
      />

      {!data.mailEnabled && (
        <p
          data-testid="mail-off"
          className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t("admin.mailTemplates.mailOff")}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
          {/* ── الرسائل ── */}
          <div role="tablist" className="flex flex-wrap gap-1.5 border-b border-forest/10 px-3 py-2.5">
            {GROUPS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={group === id}
                data-testid={`mail-group-${id}`}
                onClick={() => setGroup(id)}
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition ${
                  group === id ? "bg-gold/15 text-forest ring-1 ring-gold/50" : "text-forest/75 hover:bg-forest/6 hover:text-forest"
                }`}
              >
                <Icon size={15} className="text-gold" />
                {t(`admin.mailTemplates.group.${id}`)}
                {groupChanged(id) && <span className="size-1.5 rounded-full bg-gold" aria-label={t("admin.mailTemplates.changed")} />}
              </button>
            ))}
          </div>

          {/* ── اللغات ── */}
          <div role="tablist" className="flex flex-wrap items-center gap-1.5 border-b border-forest/10 bg-cream-2/40 px-3 py-2">
            {CONTENT_LANGS.map((l) => {
              const n = langChanged(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  role="tab"
                  aria-selected={lang === l.code}
                  data-testid={`mail-lang-${l.code}`}
                  onClick={() => setLang(l.code)}
                  className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold transition ${
                    lang === l.code ? "bg-cream-card text-forest shadow-sm ring-1 ring-forest/10" : "text-forest/70 hover:text-forest"
                  }`}
                >
                  {l.label}
                  <span
                    className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                      n ? "bg-gold/20 text-forest" : "bg-forest/8 text-clay"
                    }`}
                  >
                    {n ? t("admin.mailTemplates.rewritten", { count: n }) : t("admin.mailTemplates.asPlatform")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-5 p-5">
            <p className="flex items-start gap-2 rounded-xl bg-gold/8 px-3.5 py-2.5 text-[12px] leading-relaxed text-forest/80">
              <Braces size={15} className="mt-0.5 shrink-0 text-gold" />
              {t(`admin.mailTemplates.groupHint.${group}`)}
            </p>

            {/* ── الشكل: مع ما يتكرّر في كلّ رسالة ── */}
            {group === "common" && (
              <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4" data-testid="mail-look">
                <legend className="flex items-center gap-1.5 px-1.5 text-sm font-bold text-forest">
                  <Palette size={15} className="text-gold" />
                  {t("admin.mailTemplates.look")}
                </legend>
                <ColourRow
                  label={t("admin.mailTemplates.header")}
                  value={draft.look.header}
                  swatches={HEADER_SWATCHES}
                  onChange={(header) => setLook({ header })}
                  testId="mail-look-header"
                />
                <ColourRow
                  label={t("admin.mailTemplates.accent")}
                  value={draft.look.accent}
                  swatches={ACCENT_SWATCHES}
                  onChange={(accent) => setLook({ accent })}
                  testId="mail-look-accent"
                />
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-forest">
                    <Stamp size={14} className="text-gold" />
                    {t("admin.mailTemplates.logos")}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-clay">{t("admin.mailTemplates.logosHint")}</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <LogoPicker
                    slot="university"
                    value={draft.look.universityLogo}
                    platform={universitySeal}
                    onChange={(universityLogo) => setLook({ universityLogo })}
                  />
                  <LogoPicker
                    slot="faculty"
                    value={draft.look.facultyLogo}
                    platform={facultySeal}
                    onChange={(facultyLogo) => setLook({ facultyLogo })}
                  />
                </div>
                {JSON.stringify(cleaned.look) !== JSON.stringify(data.look) && (
                  <button
                    type="button"
                    onClick={() => setLook(data.look)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold hover:underline"
                  >
                    <RotateCcw size={13} />
                    {t("admin.mailTemplates.restoreLook")}
                  </button>
                )}
              </fieldset>
            )}

            {/* ── النصوص ── */}
            <div className="space-y-4">
              {data.groups[group].map((key) => {
                const f = data.fields[key]!;
                const value = valueOf(key);
                const problem = problemOf(key, value);
                const common = {
                  dir,
                  value,
                  maxLength: f.max,
                  placeholder: t("admin.mailTemplates.emptyIsPlatform"),
                  onChange: (e: { target: { value: string } }) => setText(key, e.target.value),
                  "data-testid": `mail-field-${key}`,
                  "aria-invalid": !!problem,
                };
                return (
                  <Field
                    key={`${lang}-${key}`}
                    label={t(`admin.mailTemplates.field.${fieldName(key)}`)}
                    note={changed(lang, key) ? t("admin.mailTemplates.changed") : undefined}
                    error={problem}
                  >
                    {f.oneLine ? (
                      <input
                        {...common}
                        ref={(el) => {
                          refs.current[key] = el;
                        }}
                        className={inputClass}
                      />
                    ) : (
                      <textarea
                        {...common}
                        ref={(el) => {
                          refs.current[key] = el;
                        }}
                        rows={Math.min(5, Math.max(2, Math.ceil(value.length / 70)))}
                        className={`${inputClass} resize-y leading-relaxed`}
                      />
                    )}
                    {(f.vars.length > 0 || changed(lang, key)) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {f.vars.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertVar(key, v)}
                            data-testid={`mail-var-${key}-${v}`}
                            title={t(`admin.mailTemplates.var.${v}`, { defaultValue: v })}
                            className="inline-flex h-6 items-center gap-1 rounded-md border border-gold/35 bg-gold/8 px-1.5 font-mono text-[11px] text-forest transition hover:border-gold hover:bg-gold/15"
                          >
                            <bdi dir="ltr">{`{{${v}}}`}</bdi>
                            <span className="font-sans text-[10.5px] text-clay">{t(`admin.mailTemplates.var.${v}`, { defaultValue: "" })}</span>
                          </button>
                        ))}
                        {changed(lang, key) && (
                          <button
                            type="button"
                            onClick={() => restore(key)}
                            data-testid={`mail-restore-${key}`}
                            className="ms-auto inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-semibold text-gold transition hover:bg-gold/10"
                          >
                            <RotateCcw size={12} />
                            {t("admin.mailTemplates.restore")}
                          </button>
                        )}
                      </div>
                    )}
                  </Field>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-forest/8 pt-4">
              <button
                type="button"
                onClick={resetAll}
                data-testid="mail-reset-all"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-clay transition hover:bg-brick/8 hover:text-brick"
              >
                <RotateCcw size={13} />
                {t("admin.mailTemplates.resetAll")}
              </button>
            </div>
          </div>
        </section>

        {/* ── المعاينة: الرسالة كما تصل، ممّا يُكتب ── */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forest/10 px-4 py-3">
              <span className="flex items-center gap-2">
                <MonitorPlay size={16} className="text-gold" />
                <b className="text-sm text-forest">{t("admin.mailTemplates.preview")}</b>
                {preview.isFetching && <Loader2 size={14} className="animate-spin text-clay" />}
              </span>
              {kind === "passwordChanged" && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-forest/80">
                  <input
                    type="checkbox"
                    checked={byAdmin}
                    onChange={(e) => setByAdmin(e.target.checked)}
                    data-testid="mail-by-admin"
                    className="size-3.5 accent-[var(--color-gold)]"
                  />
                  {t("admin.mailTemplates.byAdmin")}
                </label>
              )}
            </div>

            <div className="border-b border-forest/8 bg-cream-2/50 px-4 py-2.5 text-[12px]">
              <span className="text-clay">{t("admin.mailTemplates.subject")}: </span>
              <b dir="auto" data-testid="mail-preview-subject" className="text-forest">
                {preview.data?.subject ?? "…"}
              </b>
            </div>

            {!valid && (
              <p className="flex items-center gap-1.5 bg-brick/8 px-4 py-2 text-[11.5px] text-brick">
                <AlertTriangle size={13} />
                {t("admin.mailTemplates.previewPaused")}
              </p>
            )}

            {preview.data ? (
              <iframe
                title={t("admin.mailTemplates.preview")}
                srcDoc={preview.data.html}
                sandbox=""
                data-testid="mail-preview-frame"
                className={`block h-[36rem] w-full bg-[#f5f0e6] transition-opacity ${preview.isFetching ? "opacity-70" : ""}`}
              />
            ) : (
              <div className="grid h-[36rem] place-items-center">
                {preview.isError ? (
                  <p className="px-6 text-center text-[12px] text-brick">{t("admin.mailTemplates.previewFailed")}</p>
                ) : (
                  <Loader2 size={22} className="animate-spin text-gold" />
                )}
              </div>
            )}

            <div className="space-y-2 border-t border-forest/10 px-4 py-3">
              <button
                type="button"
                disabled={!draw || !data.testTo || !data.mailEnabled || test.isPending}
                onClick={() => draw && test.mutate(draw)}
                data-testid="mail-test"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-gold/50 bg-gold/10 text-[13px] font-bold text-forest transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {test.isPending ? <Loader2 size={15} className="animate-spin" /> : test.isSuccess ? <Check size={15} /> : <Send size={15} className="rtl:-scale-x-100" />}
                {t("admin.mailTemplates.test")}
              </button>
              <p className="text-[11px] leading-relaxed text-clay" data-testid="mail-test-hint">
                {data.testTo ? (
                  <>
                    {t("admin.mailTemplates.testTo")}{" "}
                    <bdi dir="ltr" className="font-semibold text-forest">
                      {data.testTo}
                    </bdi>
                  </>
                ) : (
                  t("admin.mailTemplates.testNoAddress")
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <UnsavedBar dirty={dirty} saving={save.isPending} disabled={!valid} onUndo={undo} saveLabel={t("admin.mailTemplates.save")} />
    </form>
  );
}

/** The largest picture a logo becomes before it is uploaded: shown 44 px high, sharp on a phone's screen. */
const LOGO_MAX_HEIGHT = 160;
const LOGO_MAX_WIDTH = 480;
/** What the server takes for a logo in a message (Backend core/mail/mail-images). */
const LOGO_MAX_BYTES = 512 * 1024;

/**
 * A picture made fit for a message: shrunk to a few kilobytes and turned into
 * a PNG, which every mail app draws (a WebP is not). Where the browser cannot
 * draw it, the file goes as it is — if it is already a small PNG or JPEG.
 */
async function forMail(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LOGO_MAX_HEIGHT / bitmap.height, LOGO_MAX_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) return new File([blob], "mail-logo.png", { type: "image/png" });
  } catch {
    // Drawn nowhere: the file itself, below.
  }
  return /^image\/(png|jpeg)$/.test(file.type) && file.size <= LOGO_MAX_BYTES ? file : null;
}

/** One logo of the band: none, the platform's own, or a picture uploaded here. */
function LogoPicker({
  slot,
  value,
  platform,
  onChange,
}: {
  slot: "university" | "faculty";
  value: LogoChoice;
  /** The platform's own logo, to show what «the platform's» means. */
  platform: string;
  onChange: (choice: LogoChoice) => void;
}) {
  const { t } = useTranslation();
  const upload = useUploadImage();
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantsUpload, setWantsUpload] = useState(false);
  const mode = value === null ? "none" : value === "platform" ? "platform" : "upload";
  // «Upload» stays chosen while the picture is being picked, before there is one.
  const shownMode = mode === "upload" || wantsUpload ? "upload" : mode;
  const src = mode === "platform" ? platform : mode === "upload" ? assetUrl(value) : undefined;

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    const ready = await forMail(f);
    if (!ready) {
      setError(t("admin.mailTemplates.logoUnfit"));
      return;
    }
    upload.mutate(ready, { onSuccess: (url) => onChange(url) });
  }

  function choose(next: "none" | "platform" | "upload") {
    setError(null);
    setWantsUpload(next === "upload");
    if (next === "none") onChange(null);
    else if (next === "platform") onChange("platform");
    else if (mode !== "upload") file.current?.click();
  }

  return (
    <div className="rounded-xl border border-forest/10 bg-cream-2/50 p-3" data-testid={`mail-logo-${slot}`}>
      <p className="mb-2 text-xs font-semibold text-forest">{t(`admin.mailTemplates.logo.${slot}`)}</p>
      <div
        role="radiogroup"
        aria-label={t(`admin.mailTemplates.logo.${slot}`)}
        className="mb-3 inline-flex rounded-lg border border-forest/10 bg-cream-card p-0.5"
      >
        {(["none", "platform", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={shownMode === m}
            onClick={() => choose(m)}
            data-testid={`mail-logo-${slot}-${m}`}
            className={`h-7 rounded-md px-2.5 text-[11.5px] font-semibold transition ${
              shownMode === m ? "bg-gold/15 text-forest ring-1 ring-gold/50" : "text-forest/70 hover:text-forest"
            }`}
          >
            {t(`admin.mailTemplates.logoMode.${m}`)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-forest/10 bg-[#fbf6ea]">
          {upload.isPending ? (
            <Loader2 size={18} className="animate-spin text-gold" />
          ) : src ? (
            <img src={src} alt="" className="max-h-14 max-w-[4.5rem] object-contain" data-testid={`mail-logo-${slot}-image`} />
          ) : (
            <span className="text-[10.5px] text-clay">{t("admin.mailTemplates.logoMode.none")}</span>
          )}
        </span>
        {shownMode === "upload" && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => file.current?.click()}
              disabled={upload.isPending}
              data-testid={`mail-logo-${slot}-pick`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-forest/15 bg-cream-card px-2.5 text-[11.5px] font-semibold text-forest transition hover:border-gold hover:text-gold disabled:opacity-50"
            >
              <ImagePlus size={14} />
              {mode === "upload" ? t("admin.mailTemplates.logoReplace") : t("admin.mailTemplates.logoUpload")}
            </button>
            {mode === "upload" && (
              <button
                type="button"
                onClick={() => choose("none")}
                aria-label={t("admin.mailTemplates.logoRemove")}
                title={t("admin.mailTemplates.logoRemove")}
                className="grid size-8 place-items-center rounded-lg border border-forest/10 text-brick transition hover:border-brick/40 hover:bg-brick/10"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-testid={`mail-logo-${slot}-file`}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/** A colour: the picker, its code, and a few that suit the university's colours. */
function ColourRow({
  label,
  value,
  swatches,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (hex: string) => void;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 shrink-0 text-xs font-medium text-forest">{label}</span>
      <input
        type="color"
        value={HEX.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        aria-label={label}
        className="h-9 w-12 cursor-pointer rounded-lg border border-forest/15 bg-cream-2 p-1"
      />
      <bdi dir="ltr" className="font-mono text-[12px] text-clay">
        {value}
      </bdi>
      <span className="flex flex-wrap gap-1.5">
        {swatches.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-label={`${label} ${s}`}
            title={s}
            className={`size-6 rounded-full ring-offset-2 ring-offset-cream-card transition ${
              value.toLowerCase() === s ? "ring-2 ring-gold" : "ring-1 ring-forest/15 hover:ring-gold/60"
            }`}
            style={{ background: s }}
          />
        ))}
      </span>
      <span className="sr-only">{t("admin.mailTemplates.colourHint")}</span>
    </div>
  );
}
