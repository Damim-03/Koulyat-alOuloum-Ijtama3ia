import { useTranslation } from "react-i18next";
import { AlertTriangle, FileStack } from "lucide-react";
import type { TopicQuota } from "../../../types/professor.types";

/**
 * حدّ المواضيع الذي قرّرته الإدارة للسنة، كما يراه الأستاذ في نموذج الاقتراح:
 * كم له منه — «2 من 3» —، أو أنّه بلغه فلا يُرسل جديدٌ لهذه السنة. ولا شيء
 * حين لا حدّ. والمرفوض لا يُحسب (core/academic/topic-quota في الخادم).
 */
export function TopicQuotaLine({ quota, className = "" }: { quota: TopicQuota; className?: string }) {
  const { t } = useTranslation();
  if (quota.max === null || !quota.year) return null;
  const full = quota.used >= quota.max;
  return (
    <p
      role={full ? "alert" : "status"}
      data-testid="topic-quota-line"
      data-full={full || undefined}
      className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
        full
          ? "border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
          : "bg-gold/8 text-forest/80"
      } ${className}`}
    >
      {full ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <FileStack size={14} className="mt-0.5 shrink-0 text-gold" />}
      {full
        ? t("pro.quota.full", { year: quota.year.title, max: quota.max, used: quota.used })
        : t("pro.quota.left", { year: quota.year.title, max: quota.max, used: quota.used })}
    </p>
  );
}
