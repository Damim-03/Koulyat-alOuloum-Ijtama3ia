import { useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A person's photo, falling back to their initials.
 *
 * The fallback is not only for accounts without a picture: an `avatarUrl` can
 * outlive the file it points at, and a broken <img> leaves a torn icon in the
 * middle of the layout. `onError` swaps it for the initials instead.
 */
export function UserAvatar({
  user,
  size = 32,
  className = "",
}: {
  user: any;
  size?: number;
  className?: string;
}) {
  // Remember *which* url failed rather than a boolean: a boolean would need an
  // effect to clear it when the person changes, whereas a url simply stops
  // matching, so the next image gets its fair try with no stale state.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url: string | undefined = user?.avatarUrl;
  const broken = !!url && failedUrl === url;
  const style = { width: size, height: size };

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        onError={() => setFailedUrl(url)}
        className={`shrink-0 rounded-full object-cover ring-1 ring-forest/10 ${className}`}
      />
    );
  }

  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "؟";

  return (
    <span
      style={style}
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep font-bold text-cream ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.34) }}>{initials}</span>
    </span>
  );
}
