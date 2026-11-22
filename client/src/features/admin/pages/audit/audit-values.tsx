import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { useDates } from "../../../../hooks/use-dates";
import { assetUrl } from "../../../../lib/asset-url";
import { fieldLabel } from "./audit-catalog";

/**
 * A field and its value, as a person reads them: «الهاتف», not `phone`;
 * «معلّق», not `suspended`; a date as a date, a picture as a picture, an
 * empty field said to be empty.
 */

/** Fields whose values are names the platform gives things: a status, a role, a level… */
const NAMED = new Set(["status", "role", "gender", "level", "placement", "request", "secondFactor", "as"]);
/** A field holding a picture. A link is a link. */
const PICTURE = /(avatar|cover|icon|image|photo)Url$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MIDNIGHT = /T00:00:00(\.000)?Z$/;
/** A committee member as the server writes them: «name (role)». */
const COMMITTEE = /^(.*) \((president|supervisor|examiner)\)$/;

export function AuditValue({ field, value }: { field: string; value: unknown }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const leaf = field.split(".").pop() ?? field;

  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) {
    return <span className="text-clay/70 italic">{t("admin.audit.emptyValue")}</span>;
  }
  if (value === "[hidden]") {
    return (
      <span className="inline-flex items-center gap-1 text-clay">
        <Lock size={11} /> {t("admin.audit.hiddenValue")}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${value ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-forest/8 text-forest/70"}`}>
        {t(value ? "admin.audit.yes" : "admin.audit.no")}
      </span>
    );
  }
  if (typeof value === "number") return <bdi dir="ltr">{value.toLocaleString()}</bdi>;
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <span key={i} className="rounded-lg bg-forest/6 px-1.5 py-0.5">
            <AuditValue field={leaf} value={item} />
          </span>
        ))}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <span className="flex flex-col gap-0.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <span key={k}>
            <span className="text-clay">{fieldLabel(t, k)}: </span>
            <AuditValue field={k} value={v} />
          </span>
        ))}
      </span>
    );
  }

  const text = String(value);
  if (ISO.test(text)) return <time dateTime={text}>{fmtDate(text, !MIDNIGHT.test(text))}</time>;
  if (PICTURE.test(leaf) && /^(\/|https?:)/.test(text)) {
    return (
      <a href={assetUrl(text)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline">
        <img src={assetUrl(text)} alt="" className="h-9 w-14 rounded-md border border-forest/10 object-cover" loading="lazy" />
        <bdi dir="ltr" className="max-w-40 truncate text-[11px] text-clay">
          {text.split("/").pop()}
        </bdi>
      </a>
    );
  }
  if (leaf === "reason") return <>{t(`admin.audit.reason.${text}`, { defaultValue: text })}</>;
  if (NAMED.has(leaf)) return <>{t(`admin.audit.value.${text}`, { defaultValue: text })}</>;
  const member = COMMITTEE.exec(text);
  if (member) return <>{`${member[1]} (${t(`admin.audit.value.${member[2]}`)})`}</>;
  return (
    <span dir="auto" className="break-words whitespace-pre-wrap">
      {text}
    </span>
  );
}
