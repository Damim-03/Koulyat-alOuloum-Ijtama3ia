import os from "node:os";
import { Worker } from "node:worker_threads";
import bcrypt from "bcryptjs";

/**
 * يُجزّئ كلمات مرورٍ كثيرة على أنوية الجهاز كلّها.
 *
 * `bcryptjs` جافاسكربت صرفة: الإجزاء الواحد بـ١٢ جولة نحو ٣٠٠ ملّي‌ثانية،
 * ولا يتوازى في الخيط الرئيسيّ ولو كان غير متزامن. فثلاثمئة طالب في دفعةٍ
 * واحدة تسعون ثانيةً — طلبٌ يُقطع قبل أن يكتمل. وتخفيض الجولات للمستورَدين
 * يُضعف حساباتهم وحدها بلا سبب.
 *
 * فتتوزّع الدفعة على عمّالٍ بعدد الأنوية ناقص واحد (يبقى الخادم يجيب غيرها)،
 * كلٌّ يأخذ شريحةً متّصلة، فيبقى الترتيب كما دخل. والجولات نفسها: الحساب
 * المستورَد كالمُنشأ باليد.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const bcrypt = require(workerData.bcryptPath);
parentPort.postMessage(
  workerData.items.map((p) => bcrypt.hashSync(p, workerData.rounds)),
);
`;

/** دون هذا العدد لا يستحقّ تشغيلُ العمّال كلفتَه. */
const INLINE_BELOW = 4;

export async function hashMany(
  passwords: string[],
  rounds: number,
): Promise<string[]> {
  if (passwords.length < INLINE_BELOW)
    return Promise.all(passwords.map((p) => bcrypt.hash(p, rounds)));

  const workers = Math.max(
    1,
    Math.min(os.availableParallelism?.() ?? os.cpus().length, passwords.length) - 1,
  );
  const size = Math.ceil(passwords.length / workers);
  const bcryptPath = require.resolve("bcryptjs");

  const chunks: string[][] = [];
  for (let i = 0; i < passwords.length; i += size)
    chunks.push(passwords.slice(i, i + size));

  const results = await Promise.all(
    chunks.map(
      (items) =>
        new Promise<string[]>((resolve, reject) => {
          const w = new Worker(WORKER_SOURCE, {
            eval: true,
            workerData: { items, rounds, bcryptPath },
          });
          w.once("message", (hashes: string[]) => {
            resolve(hashes);
            void w.terminate();
          });
          w.once("error", reject);
          w.once("exit", (code) => {
            if (code !== 0) reject(new Error(`hash worker exited with ${code}`));
          });
        }),
    ),
  );
  return results.flat();
}
