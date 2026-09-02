import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";

export interface Crumb {
  label?: string | null;
  /** Absolute path (the language prefix is added). The last crumb has none. */
  to?: string;
}

/**
 * The header of a hierarchy page: faculty → department → domain → filiere.
 *
 * Everything that identifies the page — where you are, how to go back, what
 * this page is, and the one action it offers — sits in a single dark panel,
 * each part on its own line. Before this they were three separate blocks that
 * ran into each other at the top of the page.
 */
export function HierarchyHeader({
  crumbs,
  backLabel,
  backTo,
  icon: Icon,
  title,
  subtitle,
  code,
  badges,
  action,
  coverUrl,
}: {
  crumbs: Crumb[];
  backLabel: string;
  backTo: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  code?: string | null;
  /** Count chips, e.g. "3 ميادين". */
  badges?: ReactNode;
  /** The page's primary action, e.g. "إضافة قسم". */
  action?: ReactNode;
  /** The entry's cover image, shown behind the panel when there is one. */
  coverUrl?: string | null;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-linear-to-l from-forest-deep to-forest text-cream shadow-[0_10px_30px_rgba(38,66,61,0.18)]">
      {/* The chosen cover, behind everything.
          A cover can be any picture the admin uploads, so it is treated as
          atmosphere rather than content: slightly blurred and desaturated
          under two washes — a flat one, and a stronger one on the side the
          text starts from. The blur is why the image is scaled up: it keeps
          the softened edges outside the panel. */}
      {coverUrl && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img
            src={coverUrl}
            alt=""
            className="size-full scale-110 object-cover blur-[2px] saturate-75"
          />
          <div className="absolute inset-0 bg-forest-deep/80" />
          <div className="absolute inset-0 bg-linear-to-l from-forest-deep/95 via-forest-deep/70 to-forest-deep/45" />
        </div>
      )}

      {/* Trail + back, on their own strip so they never crowd the title. */}
      <HeaderTrail
        crumbs={crumbs}
        backLabel={backLabel}
        backTo={backTo}
        className="relative border-b border-cream/10"
      />

      {/* Identity + action */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cream/10 text-gold backdrop-blur-sm">
            <Icon size={26} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-serif text-2xl font-bold text-cream">
                {title}
              </h1>
              {code && (
                <span
                  className="rounded-full bg-cream/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-gold"
                  dir="ltr"
                >
                  {code}
                </span>
              )}
              {badges}
            </div>
            <p className="mt-1 text-sm text-cream/70">{subtitle}</p>
          </div>
        </div>

        {action}
      </div>
    </div>
  );
}

/** A count chip for the header, styled for the dark panel. */
export function HeaderBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-cream/10 px-2.5 py-0.5 text-[11px] font-medium text-cream/80">
      {children}
    </span>
  );
}

/**
 * The trail strip: where you are, and one tap back to where you came from.
 *
 * Lives on a dark surface — the hierarchy panel, or the banner of a person's
 * profile card — so every detail page in the admin opens the same way.
 */
export function HeaderTrail({
  crumbs,
  backLabel,
  backTo,
  className = "",
}: {
  crumbs: Crumb[];
  backLabel: string;
  backTo: string;
  className?: string;
}) {
  const navigate = useLangNavigate();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${className}`}
    >
      <nav className="flex flex-wrap items-center gap-1.5 text-xs">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronLeft size={12} className="text-cream/30 ltr:rotate-180" />}
              {c.to && !last ? (
                <button
                  onClick={() => navigate(c.to as string)}
                  className="text-cream/60 transition hover:text-gold"
                >
                  {c.label ?? "…"}
                </button>
              ) : (
                <span className="font-semibold text-gold">{c.label ?? "…"}</span>
              )}
            </span>
          );
        })}
      </nav>

      <button
        onClick={() => navigate(backTo)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cream/10 px-3 py-1.5 text-xs font-semibold text-cream/90 transition hover:bg-cream/20 hover:text-cream"
      >
        <ChevronRight size={14} className="ltr:rotate-180" />
        {backLabel}
      </button>
    </div>
  );
}
