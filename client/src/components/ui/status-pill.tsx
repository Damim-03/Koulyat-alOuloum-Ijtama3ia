import { useTranslation } from "react-i18next";
import { STATUS_TONE } from "../../lib/status-tone";

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status] ?? STATUS_TONE.archived;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone.pill}`}
    >
      <span className={`size-1.5 rounded-full ${tone.dot}`} />
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}
