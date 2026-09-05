import { useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A person's photo, with a default drawn for them when there is none.
 *
 * Three states, in order:
 *   1. the uploaded photo;
 *   2. a silhouette matching the account's gender;
 *   3. a neutral silhouette, when no gender is recorded.
 *
 * Initials are deliberately not one of them. "hh" tells a reader nothing they
 * cannot already see in the name beside it, and it looked like a defect
 * rather than a placeholder.
 *
 * The photo is not the only case the fallback covers: an `avatarUrl` can
 * outlive the file it points at, and a broken <img> leaves a torn icon in the
 * middle of the layout. `onError` steps down to the default instead.
 *
 * `tone` exists because the default green ground disappears when the avatar
 * sits on the brand-green chrome; on those surfaces pass "gold".
 */
export function UserAvatar({
  user,
  size = 32,
  width,
  height,
  radius = "rounded-full",
  tone = "brand",
  className = "",
}: {
  user: any;
  size?: number;
  /** Overrides `size` on one axis — the detail pages use an ID-photo shape. */
  width?: number;
  height?: number;
  /** The rounding utility, so a portrait card is not forced into a circle. */
  radius?: string;
  tone?: "brand" | "gold";
  className?: string;
}) {
  // Remember *which* url failed rather than a boolean: a boolean would need an
  // effect to clear it when the person changes, whereas a url simply stops
  // matching, so the next image gets its fair try with no stale state.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url: string | undefined = user?.avatarUrl;
  const broken = !!url && failedUrl === url;
  const style = { width: width ?? size, height: height ?? size };

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        onError={() => setFailedUrl(url)}
        className={`shrink-0 ${radius} object-cover ring-1 ring-forest/10 ${className}`}
      />
    );
  }

  const groundCls =
    tone === "gold"
      ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep"
      : "bg-linear-to-br from-forest to-forest-deep text-cream";

  const raw: string | undefined = user?.gender;
  const gender: Silhouette =
    raw === "male" || raw === "female" ? raw : "unknown";

  return (
    <span
      style={style}
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden ${radius} ${groundCls} ${className}`}
    >
      <GenderSilhouette gender={gender} />
    </span>
  );
}

type Silhouette = "male" | "female" | "unknown";

/**
 * Head and shoulders, drawn rather than photographed.
 *
 * The variants differ by hair and shoulder width only — the silhouette stays
 * a silhouette, so it reads at 24px as well as at 96px and carries no
 * assumption beyond the one field the administration actually recorded. An
 * account with no gender on file gets the bare head and shoulders: a
 * placeholder that states nothing, rather than a guess.
 *
 * `currentColor` keeps all three on whichever ground they are placed on, in
 * either theme.
 */
function GenderSilhouette({ gender }: { gender: Silhouette }) {
  const female = gender === "female";
  return (
    <svg
      viewBox="0 0 40 40"
      preserveAspectRatio="xMidYMid slice"
      className="size-full"
      fill="currentColor"
      role="presentation"
    >
      {/* Hair first, so the face and shoulders sit on top of it. It is drawn
          wider than the head on the female silhouette: at 24px the interior
          detail is gone and only the outer contour still tells them apart. */}
      {gender !== "unknown" && (
        <path
          opacity="0.7"
          d={
            female
              ? "M20 3.4c-6.6 0-10.8 4.3-10.8 11 0 4.6.5 8.4 1.5 11.5.3 1 1.4 1.5 2.3 1 .8-.4 1.2-1.3 1-2.2-.8-2.7-1.2-6-1.2-9.7 0-4.2 2.7-6.7 7.2-6.7s7.2 2.5 7.2 6.7c0 3.7-.4 7-1.2 9.7-.2.9.2 1.8 1 2.2.9.5 2 0 2.3-1 1-3.1 1.5-6.9 1.5-11.5 0-6.7-4.2-11-10.8-11Z"
              : "M20 4.2c-5.4 0-9 3.2-9 8.2 0 1 1 1.7 1.9 1.2 1.8-.9 3.6-2.2 4.8-3.5 2.2 1.9 5.6 3.2 9 3.5.9.1 1.6-.6 1.6-1.5 0-5-3.5-7.9-8.3-7.9Z"
          }
        />
      )}

      <circle cx="20" cy="15.2" r={female ? 7 : 7.3} />

      {/* Shoulders, clipped by the parent's rounding. The female pair is
          the narrower one, with the hair falling over it. */}
      <path
        opacity="0.95"
        d={
          female
            ? "M20 23.6c-6.6 0-11.6 4-12.8 10.2a1.6 1.6 0 0 0 1.6 1.9h22.4a1.6 1.6 0 0 0 1.6-1.9C31.6 27.6 26.6 23.6 20 23.6Z"
            : "M20 23.4c-7.4 0-13 4.1-14.2 10.4a1.6 1.6 0 0 0 1.6 1.9h25.2a1.6 1.6 0 0 0 1.6-1.9C33 27.5 27.4 23.4 20 23.4Z"
        }
      />
    </svg>
  );
}
