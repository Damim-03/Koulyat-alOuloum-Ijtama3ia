/**
 * أين العنوان — بلا قواعد حقيقية (نحو 140MB): القارئ مُقلَّد.
 *
 * يُقرأ الأحدث من كلّ نوع في المجلّد؛ ولا يُفتح شيءٌ لعنوانٍ لا مكان له على
 * الخريطة (الجهاز نفسه، شبكةٌ داخلية)؛ وغياب الملفّات أو عطبها لا يُسقط شيئاً.
 */
jest.mock("maxmind", () => ({ open: jest.fn() }));
jest.mock("node:fs", () => ({ __esModule: true, default: { existsSync: jest.fn(), readdirSync: jest.fn() } }));

import fs from "node:fs";
import path from "node:path";
import { open } from "maxmind";

import { config } from "../config/app.config";
import { geoOf, isLocalAddress, resetGeo } from "./geo";

const opened = open as unknown as jest.Mock;
const files = fs as unknown as { existsSync: jest.Mock; readdirSync: jest.Mock };
const mutable = config as { GEOIP_DIR: string };
const was = mutable.GEOIP_DIR;

const reader = (table: Record<string, unknown>) => ({ get: (ip: string) => table[ip] ?? null });
const CITY = {
  "41.100.1.1": {
    country: { iso_code: "DZ" },
    subdivisions: [{ names: { en: "Tlemcen" } }],
    city: { names: { en: "Remchi" } },
  },
  "8.8.4.4": { country: { iso_code: "US" } },
};
const ASN = {
  "41.100.1.1": { autonomous_system_organization: "Telecom Algeria" },
  "2001:4860::1": { autonomous_system_organization: "Google LLC" },
};

/** A folder holding these files; `open` answers by file name. */
function folder(names: string[]) {
  files.existsSync.mockReturnValue(true);
  files.readdirSync.mockReturnValue(names);
  opened.mockImplementation(async (file: string) => (file.includes("city") ? reader(CITY) : reader(ASN)));
}

beforeEach(() => {
  resetGeo();
  mutable.GEOIP_DIR = "/srv/geo";
  opened.mockReset();
  files.existsSync.mockReset();
  files.readdirSync.mockReset();
});
afterAll(() => {
  mutable.GEOIP_DIR = was;
});

describe("geoOf", () => {
  it("country, wilaya, city and network — the newest file of each kind", async () => {
    folder(["dbip-city-lite-2026-10.mmdb", "dbip-city-lite-2026-11.mmdb", "dbip-asn-lite-2026-11.mmdb", "README.md"]);
    expect(await geoOf("41.100.1.1")).toEqual({ country: "DZ", region: "Tlemcen", city: "Remchi", isp: "Telecom Algeria" });
    expect(opened.mock.calls.map((c) => c[0])).toEqual([
      path.join("/srv/geo", "dbip-city-lite-2026-11.mmdb"),
      path.join("/srv/geo", "dbip-asn-lite-2026-11.mmdb"),
    ]);
    // Opened once, for every address after.
    expect(await geoOf("::ffff:41.100.1.1")).toMatchObject({ country: "DZ" });
    expect(opened).toHaveBeenCalledTimes(2);
  });

  it("what one file knows and the other does not; and an address neither knows", async () => {
    folder(["dbip-city-lite-2026-11.mmdb", "dbip-asn-lite-2026-11.mmdb"]);
    expect(await geoOf("8.8.4.4")).toEqual({ country: "US", region: null, city: null, isp: null });
    expect(await geoOf("2001:4860::1")).toEqual({ country: null, region: null, city: null, isp: "Google LLC" });
    expect(await geoOf("203.0.113.9")).toBeNull();
  });

  it("this machine, a private network, nothing, not an address: nothing opened", async () => {
    folder(["dbip-city-lite-2026-11.mmdb"]);
    for (const ip of ["::1", "127.0.0.1", "::ffff:127.0.0.1", "10.0.0.5", "192.168.1.2", "172.20.0.1", "fd00::1", "fe80::1", null, "", "not-an-ip"]) {
      expect(await geoOf(ip)).toBeNull();
    }
    expect(opened).not.toHaveBeenCalled();
  });

  it("only one kind there: the other says nothing", async () => {
    folder(["dbip-asn-lite-2026-11.mmdb"]);
    expect(await geoOf("41.100.1.1")).toEqual({ country: null, region: null, city: null, isp: "Telecom Algeria" });
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("no folder, an empty one, or turned off: nothing, and nothing fails", async () => {
    files.existsSync.mockReturnValue(false);
    expect(await geoOf("41.100.1.1")).toBeNull();

    resetGeo();
    folder([]);
    expect(await geoOf("41.100.1.1")).toBeNull();

    resetGeo();
    mutable.GEOIP_DIR = "";
    expect(await geoOf("41.100.1.1")).toBeNull();
    expect(opened).not.toHaveBeenCalled();
  });

  it("a broken file is said once in the server log; the log carries on without places", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      folder(["dbip-city-lite-2026-11.mmdb"]);
      opened.mockRejectedValue(new Error("Unknown type"));
      expect(await geoOf("41.100.1.1")).toBeNull();
      expect(await geoOf("8.8.4.4")).toBeNull();
      expect(logged).toHaveBeenCalledTimes(1);
      expect(JSON.parse(logged.mock.calls[0]![0] as string)).toEqual({ level: "error", scope: "geo", message: "Unknown type" });
    } finally {
      logged.mockRestore();
    }
  });
});

describe("isLocalAddress", () => {
  it("this machine and private networks — and nothing else", () => {
    for (const ip of ["::1", "127.0.0.1", "::ffff:127.0.0.1", "10.1.2.3", "192.168.0.1", "169.254.1.1", "172.16.0.1", "172.31.0.1", "fc00::1", "fe80::1"]) {
      expect(isLocalAddress(ip)).toBe(true);
    }
    for (const ip of ["41.100.1.1", "172.32.0.1", "8.8.8.8", "2001:db8::1"]) expect(isLocalAddress(ip)).toBe(false);
  });
});
