import { parseUserAgent } from "./device";

describe("parseUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      { type: "desktop", os: "Windows", browser: "Chrome" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      { type: "desktop", os: "Windows", browser: "Edge" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { type: "mobile", os: "iOS", browser: "Safari" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
      { type: "mobile", os: "Android", browser: "Samsung Internet" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      { type: "tablet", os: "Android", browser: "Chrome" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0",
      { type: "desktop", os: "macOS", browser: "Firefox" },
    ],
  ])("%s", (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });

  it("knows nothing about a missing or unrecognised agent", () => {
    expect(parseUserAgent(null)).toEqual({ type: "unknown", os: null, browser: null });
    expect(parseUserAgent("curl/8.0")).toEqual({ type: "unknown", os: null, browser: null });
  });
});
