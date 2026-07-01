// يحوّل المسار النسبي القادم من الخادم إلى رابط كامل قابل للعرض.
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path; // رابط مطلق أصلًا
  const origin = import.meta.env.VITE_API_ORIGIN ?? "";
  return `${origin}${path}`;
}
