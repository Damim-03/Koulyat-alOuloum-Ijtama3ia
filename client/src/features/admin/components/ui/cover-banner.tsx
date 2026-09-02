/**
 * The cover image of a faculty / department / domain / filiere /
 * specialization, as a band across the top of its card.
 *
 * Covers are optional, so this renders nothing at all when there is none and
 * the card keeps its original layout. The band bleeds past the card's padding
 * and fades into the card colour at the bottom, so the text below stays
 * readable over any image.
 */
export function CoverBanner({
  src,
  className = "",
}: {
  src?: string | null;
  className?: string;
}) {
  if (!src) return null;

  return (
    <div
      className={`relative -mx-5 -mt-5 mb-4 h-24 overflow-hidden ${className}`}
    >
      <img src={src} alt="" className="size-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-cream-card via-cream-card/25 to-transparent" />
    </div>
  );
}
