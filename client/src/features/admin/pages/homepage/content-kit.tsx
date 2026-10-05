import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, Undo2 } from "lucide-react";
import type { SiteLang } from "../../../../types/site.types";
import { PrimaryAction } from "./panel-kit";
import { CONTENT_LANGS, type LangStatus } from "./content-utils";

/**
 * أدوات النماذج النصّية في «واجهة الموقع» — كلمة رئيس القسم وصفحة «عن
 * المنصة» تتشاركانها: تبويبات اللغات، ومحرّر القوائم، وشريط الحفظ.
 */

export function LangTabs({
  value,
  onChange,
  statusOf,
}: {
  value: SiteLang;
  onChange: (lang: SiteLang) => void;
  statusOf: (lang: SiteLang) => LangStatus;
}) {
  const { t } = useTranslation();
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-1.5 border-b border-forest/10 px-3 py-2.5">
      {CONTENT_LANGS.map((l) => {
        const status = statusOf(l.code);
        const label =
          l.code === "ar"
            ? status === "done"
              ? t("admin.site.complete")
              : t("admin.site.incomplete")
            : status === "done"
              ? t("admin.site.translated")
              : status === "partial"
                ? t("admin.site.partial")
                : t("admin.site.notTranslated");
        return (
          <button
            key={l.code}
            type="button"
            role="tab"
            aria-selected={value === l.code}
            onClick={() => onChange(l.code)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${
              value === l.code
                ? "bg-gold/15 text-forest ring-1 ring-gold/50"
                : "text-forest/75 hover:bg-forest/6 hover:text-forest"
            }`}
          >
            {l.label}
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                status === "done"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                  : status === "missing"
                    ? "bg-brick/20 text-brick"
                    : status === "partial"
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : "bg-forest/10 text-clay"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * قائمةٌ قابلةٌ للترتيب: فقرات، مزايا، أرقام. لكلّ عنصرٍ تقديمٌ وتأخيرٌ
 * وحذف، وزرّ إضافةٍ يقف عند السقف.
 */
export function ListEditor<T>({
  label,
  icon: Icon,
  items,
  onChange,
  max,
  make,
  addLabel,
  empty,
  error,
  render,
}: {
  label: string;
  icon: typeof Plus;
  items: T[];
  onChange: (items: T[]) => void;
  max: number;
  /** عنصرٌ فارغٌ جديد. */
  make: () => T;
  addLabel: string;
  /** ما يُقال حين لا عناصر. */
  empty: string;
  error?: string;
  render: (item: T, update: (next: T) => void, index: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const move = (from: number, to: number) => {
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-forest">
          <Icon size={14} className="text-clay" />
          {label}
          <span className="text-[10px] font-normal text-clay">
            ({items.length}/{max})
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange([...items, make()])}
          disabled={items.length >= max}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-forest/12 px-2.5 text-[11.5px] font-semibold text-forest transition hover:border-gold hover:text-gold disabled:opacity-50"
        >
          <Plus size={13} />
          {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-forest/15 px-4 py-5 text-center text-[12px] text-clay">
          {empty}
        </p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2.5 grid size-6 shrink-0 place-items-center rounded-full bg-forest/8 text-[10.5px] font-bold text-forest">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))), i)}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <MiniAction label={t("admin.site.moveUp")} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp size={13} />
                </MiniAction>
                <MiniAction
                  label={t("admin.site.moveDown")}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={13} />
                </MiniAction>
                <MiniAction
                  label={t("admin.site.remove")}
                  danger
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash2 size={13} />
                </MiniAction>
              </div>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

export function MiniAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-7 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? "border-forest/10 text-brick hover:border-brick/40 hover:bg-brick/10"
          : "border-forest/10 text-forest hover:border-gold hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}

/** زرّا «تراجع» و«حفظ» — في رأس التبويب وفي الشريط السفليّ. */
export function SaveActions({
  dirty,
  saving,
  disabled,
  onUndo,
  saveLabel,
}: {
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  onUndo: () => void;
  saveLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      {dirty && (
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-forest/15 px-3 text-sm font-semibold text-forest transition hover:bg-forest/5"
        >
          <Undo2 size={15} />
          {t("admin.site.undo")}
        </button>
      )}
      <PrimaryAction
        type="submit"
        icon={saving ? Loader2 : Save}
        label={saving ? t("admin.saving") : saveLabel}
        disabled={!dirty || saving || disabled}
      />
    </>
  );
}

/** الشريط السفليّ ما دامت هناك تغييراتٌ لم تُحفظ. */
export function UnsavedBar(props: Parameters<typeof SaveActions>[0]) {
  const { t } = useTranslation();
  if (!props.dirty) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-cream-card/95 px-5 py-3 shadow-xl backdrop-blur">
      <span className="text-sm font-semibold text-forest">{t("admin.site.unsaved")}</span>
      <div className="flex items-center gap-2">
        <SaveActions {...props} />
      </div>
    </div>
  );
}

/** إطارُ نموذجٍ نصّيّ: تبويبات اللغات فوق الحقول، وتنبيه الترجمة تحتها. */
export function TranslationNote({ lang }: { lang: SiteLang }) {
  const { t } = useTranslation();
  if (lang === "ar") return null;
  return (
    <p className="rounded-xl bg-gold/8 px-3.5 py-2.5 text-[12px] leading-relaxed text-forest/80">
      {t("admin.site.translationHint")}
    </p>
  );
}
