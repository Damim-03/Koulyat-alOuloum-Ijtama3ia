import { noneText } from "./none-text";

/** الفراغ مكتوباً ومُخفَتاً — انظر `none-text.ts`. */
export function None({ fem = false }: { fem?: boolean }) {
  return <span className="text-clay/75">{noneText(fem)}</span>;
}
