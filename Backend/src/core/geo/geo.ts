import fs from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import { open, type AsnResponse, type CityResponse, type Reader } from "maxmind";

import { config } from "../config/app.config";

/**
 * ============================================================
 * WHERE AN ADDRESS IS
 * ============================================================
 *
 * The country, region and city of an internet address, and the network it
 * belongs to (Telecom Algeria, Djezzy, Mobilis…) — for the audit log.
 *
 * Read from databases kept on this server (DB-IP "lite", CC BY 4.0: the page
 * that shows them says so), never asked of a service elsewhere: the addresses
 * of the platform's users go nowhere. The newest file of each kind in
 * `GEOIP_DIR` is read — DB-IP names them by month, so this month's file put
 * beside last month's is the one used after a restart. None there: nothing
 * is said, and nothing fails.
 *
 * The country is reliable; the city is a guess, often the city of the
 * operator's equipment rather than the person's: a phone in El Oued may read
 * as Algiers. The operator says what the city cannot.
 */

export interface Geo {
  /** ISO 3166 code: `DZ`. */
  country: string | null;
  /** The first subdivision — in Algeria, the wilaya. */
  region: string | null;
  city: string | null;
  /** The network the address belongs to. */
  isp: string | null;
}

interface Readers {
  city: Reader<CityResponse> | null;
  asn: Reader<AsnResponse> | null;
}

let loading: Promise<Readers> | null = null;

/** The newest file of a kind in the folder: their names end with the month. */
const newest = (files: string[], kind: string) =>
  files
    .filter((f) => f.endsWith(".mmdb") && f.toLowerCase().includes(kind))
    .sort()
    .pop();

async function load(dir: string): Promise<Readers> {
  if (!dir) return { city: null, asn: null };
  try {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const city = newest(files, "city");
    const asn = newest(files, "asn");
    const [cityReader, asnReader] = await Promise.all([
      city ? open<CityResponse>(path.join(dir, city)) : null,
      asn ? open<AsnResponse>(path.join(dir, asn)) : null,
    ]);
    return { city: cityReader, asn: asnReader };
  } catch (error) {
    // A broken file is said once, then the log carries on without places.
    console.error(JSON.stringify({ level: "error", scope: "geo", message: (error as Error)?.message }));
    return { city: null, asn: null };
  }
}

/** Opened once, at the first address there is to place — never for this machine's own requests. */
const readers = () => (loading ??= load(config.GEOIP_DIR));

/** Forgets the open databases: the next address opens them again (a new month's file). */
export function resetGeo() {
  loading = null;
}

/**
 * An address that is on no map: this machine, a private network, a link —
 * the requests of a trial, and of the university's own network.
 */
export function isLocalAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, "");
  return (
    v4 === "::1" ||
    v4.startsWith("127.") ||
    /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v4) ||
    /^(f[cd][0-9a-f]{2}|fe80):/i.test(v4)
  );
}

/** Where an address is, as far as the databases know — or null: none, local, unknown. */
export async function geoOf(ip: string | null | undefined): Promise<Geo | null> {
  const address = ip?.trim().replace(/^::ffff:(?=\d+\.)/i, "");
  if (!address || !isIP(address) || isLocalAddress(address)) return null;
  const { city, asn } = await readers();
  const place = city?.get(address) ?? null;
  const network = asn?.get(address) ?? null;
  if (!place && !network) return null;
  return {
    country: place?.country?.iso_code ?? null,
    region: place?.subdivisions?.[0]?.names?.en ?? null,
    city: place?.city?.names?.en ?? null,
    isp: network?.autonomous_system_organization ?? null,
  };
}
