/**
 * يضع المكان على صفوف سجلّ العمليات التي كُتبت قبل قواعد العناوين (core/geo):
 * البلد والولاية والمدينة والمشغّل، من عنوان كلّ صفّ.
 *
 * يُشغَّل مرّةً بعد وضع القواعد في `Backend/geo`:  npm run backfill:geo
 * ولا يمسّ إلّا صفّاً له عنوان ولا بلد له؛ فتشغيله ثانيةً لا يغيّر شيئاً —
 * إلّا ما لم تعرفه القواعد في المرّة الأولى، يُسأل عنه من جديد.
 */
import { prisma } from "../src/core/prisma/client";
import { geoOf } from "../src/core/geo/geo";

const BATCH = 500;

async function main() {
  let after = "";
  let placed = 0;
  let seen = 0;
  for (;;) {
    const rows = await prisma.auditLog.findMany({
      where: { ip: { not: null }, country: null, id: { gt: after } },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, ip: true },
    });
    if (!rows.length) break;
    after = rows[rows.length - 1]!.id;
    seen += rows.length;
    for (const row of rows) {
      const geo = await geoOf(row.ip);
      if (!geo) continue;
      await prisma.auditLog.update({
        where: { id: row.id },
        data: {
          country: geo.country,
          region: geo.region?.slice(0, 100) ?? null,
          city: geo.city?.slice(0, 100) ?? null,
          isp: geo.isp?.slice(0, 120) ?? null,
        },
      });
      placed++;
    }
  }
  console.log(`${seen} rows with an address and no place; ${placed} placed (the rest are local or unknown).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
