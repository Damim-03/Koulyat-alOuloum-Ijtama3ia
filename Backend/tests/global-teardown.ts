/** يفكّ قفل التشغيل (tests/global-setup.ts) ويغلق اتّصاله. */
import { RUN_LOCK } from "./global-setup";

export default async function globalTeardown() {
  const conn = globalThis.__testRunLock;
  if (!conn) return;
  globalThis.__testRunLock = undefined;
  try {
    await conn.query("SELECT RELEASE_LOCK(?)", [RUN_LOCK]);
  } finally {
    await conn.end();
  }
}
