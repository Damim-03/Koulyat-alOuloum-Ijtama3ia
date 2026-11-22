import type { CSSProperties } from "react";
import { UserRound } from "lucide-react";
import blankCard from "../../assets/student-card-blank.jpg";
import { assetUrl } from "../../lib/asset-url";
import { cn } from "../../lib/utils";

/**
 * The university's student card (assets/ID-STUDENT-CARD.jpg — and its copy
 * with the sample text erased, student-card-blank.jpg), filled from an account:
 * what the card of this student should say. Shown beside the photo a student
 * sent, so the administration compares the two at a glance.
 *
 * The fields sit where the card prints them, measured on the template (the
 * card itself: 1264×794, its white margin cropped) and kept as percentages;
 * the text is sized on the card's own width (container units), so it stays in
 * place at any size. The card is in Arabic whatever the page's language.
 */
export interface StudentCardData {
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  registrationNumber: string;
  /** «الميدان» */
  domain: string | null;
  /** «الفرع» */
  filiere: string | null;
  avatarUrl?: string | null;
}

/** A line of the card: to the left of its printed label, centred on it. */
function Line({ top, right, value, testId }: { top: string; right: string; value: string; testId: string }) {
  return (
    <span
      data-testid={testId}
      className="absolute left-[24.4%] block -translate-y-1/2 truncate text-right font-bold text-[#17241f]"
      style={{ top, right, fontSize: "2.3cqw", lineHeight: 1.25 }}
    >
      {value}
    </span>
  );
}

export function StudentCard({ s, className, label }: { s: StudentCardData; className?: string; label?: string }) {
  const last = s.lastName || s.lastNameLatin || "—";
  const first = s.firstName || s.firstNameLatin || "—";
  const photo = assetUrl(s.avatarUrl);
  const container: CSSProperties = { containerType: "inline-size", aspectRatio: "1264 / 794" };

  return (
    <figure
      dir="rtl"
      aria-label={label}
      data-testid="student-card"
      className={cn(
        "group/card relative m-0 w-full overflow-hidden rounded-[2.9%/4.6%] bg-[#e9efea] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-1 ring-black/10",
        className,
      )}
      style={container}
    >
      <img src={blankCard} alt="" draggable={false} className="absolute inset-0 size-full select-none object-cover" />

      <Line top="37.2%" right="40%" value={last} testId="student-card-last" />
      <Line top="47.7%" right="40%" value={first} testId="student-card-first" />
      {/* Not kept by the platform: the card's line, empty. */}
      <Line top="56.5%" right="49.9%" value="—" testId="student-card-birth" />
      <Line top="66.4%" right="40%" value={s.domain || "—"} testId="student-card-domain" />
      <Line top="76.4%" right="40%" value={s.filiere || "—"} testId="student-card-filiere" />

      {/* The photo's box, as printed. */}
      <span className="absolute grid place-items-center overflow-hidden bg-[#eef1f3]" style={{ left: "70.2%", top: "35.8%", width: "24.1%", height: "45%" }}>
        {photo ? (
          <img src={photo} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <UserRound className="size-1/2 text-[#9aa7a2]" strokeWidth={1.4} />
        )}
      </span>

      <bdi
        dir="ltr"
        data-testid="student-card-number"
        className="absolute -translate-y-1/2 font-['Arial',sans-serif] tracking-[0.02em] text-[#111]"
        style={{ left: "6.8%", top: "92.1%", fontSize: "2.85cqw" }}
      >
        {s.registrationNumber}
      </bdi>

      {/* A band of light crossing the card on hover — a printed card, not a flat picture. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.35)_50%,transparent_65%)] opacity-0 transition duration-700 group-hover/card:translate-x-1/3 group-hover/card:opacity-100"
      />
    </figure>
  );
}
