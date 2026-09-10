import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { BACKEND, ACCOUNTS_FILE } from "./global-setup";

/**
 * لا يبقى من تشغيل المتصفّح أثرٌ في القاعدة ولا على القرص.
 *
 * وهو نفس `teardown` الذي تستعمله اختبارات الخلفية — يمسح ما يحمل الوسم
 * وحده، فلو شُغِّل على قاعدةٍ فيها بياناتٌ أخرى لم يمسّها.
 */
export default function globalTeardown() {
  try {
    execFileSync("npm", ["run", "--silent", "e2e:teardown"], {
      cwd: BACKEND,
      stdio: "inherit",
      shell: true,
    });
  } finally {
    if (fs.existsSync(ACCOUNTS_FILE)) fs.unlinkSync(ACCOUNTS_FILE);
  }
}
