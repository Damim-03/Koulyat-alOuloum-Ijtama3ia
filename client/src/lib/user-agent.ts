/** "Chrome · Windows" from a User-Agent — enough to recognise a machine. */
export function deviceOf(ua: string | null): string | null {
  if (!ua) return null;
  const browser =
    /Edg(e|A|iOS)?\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Firefox\/|FxiOS\//.test(ua) ? "Firefox" :
    /CriOS\/|Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : null;
  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : null;
  return [browser, os].filter(Boolean).join(" · ") || null;
}
