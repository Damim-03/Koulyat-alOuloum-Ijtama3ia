import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";

import { deeper } from "../../lib/topic-extras";
import { personName } from "../../lib/person-name";
import type { TopicExtrasRead, TopicTypeBadge as TypeBadgeData } from "../../types/topic-extras";

/** A topic's type: its colour, its code and its name. */
export function TopicTypeBadge({ type, className = "" }: { type: TypeBadgeData; className?: string }) {
  return (
    <span
      data-testid="topic-type-badge"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-[#1f2a28] ${className}`}
      style={{ background: type.color, boxShadow: `inset 0 0 0 1px ${deeper(type.color)}` }}
    >
      <span dir="ltr" className="font-mono text-[10.5px] opacity-75">
        {type.code}
      </span>
      <span className="truncate">{type.name}</span>
    </span>
  );
}

/**
 * The type, the co-supervisor and the short description of a topic, where
 * its page shows who supervises it. Nothing when it has none of them.
 */
export function TopicExtrasView({ topic, showSummary = true }: { topic: TopicExtrasRead; showSummary?: boolean }) {
  const { t } = useTranslation();
  const co = topic.coSupervisor;
  const summary = showSummary ? topic.summary?.trim() : "";
  if (!topic.type && !co && !summary) return null;
  return (
    <div className="space-y-2" data-testid="topic-extras-view">
      {(topic.type || co) && (
        <div className="flex flex-wrap items-center gap-2">
          {topic.type && <TopicTypeBadge type={topic.type} />}
          {co && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/6 px-2.5 py-0.5 text-[12px] text-forest" data-testid="topic-co-supervisor">
              <UserPlus size={13} className="text-clay" />
              <span className="text-clay">{t("topicExtras.coSupervisor")}:</span>
              <span className="font-semibold">{personName(co.user)}</span>
            </span>
          )}
        </div>
      )}
      {summary && (
        <p className="text-[13px] leading-relaxed text-forest/85" data-testid="topic-summary-view">
          {summary}
        </p>
      )}
    </div>
  );
}
