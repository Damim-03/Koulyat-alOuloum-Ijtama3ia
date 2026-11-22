import { matchRanges } from "../../lib/search-text";

/**
 * النصّ وكلمات البحث معلَّمةٌ فيه حيث وقعت — بهمزتها وتشكيلها كما كُتبت
 * في الأصل، ولو كُتبت في البحث بغيرهما. `words` مطويّةٌ (searchWords).
 */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  const ranges = matchRanges(text, words);
  if (!ranges.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const [from, to] of ranges) {
    if (from > at) out.push(text.slice(at, from));
    out.push(
      <mark key={from} className="rounded bg-gold/25 px-0.5 text-inherit">
        {text.slice(from, to)}
      </mark>,
    );
    at = to;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}
