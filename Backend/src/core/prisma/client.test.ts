/**
 * عميل Prisma — ما يُقرَّر لحظة تحميله.
 *
 * يُحمَّل مرّةً لكلّ عملية، فلا يرى اختبارٌ عاديّ إلا فرعاً واحداً منه: بيئة
 * الاختبار، وقاعدةٌ مضبوطة. وهنا يُحمَّل معزولاً بإعدادٍ مزيّف: بلا قاعدةٍ
 * يرفض أن يبدأ ويقول أين يُضبط الرابط؛ وخارج الاختبار يكتب أخطاءه كاملة.
 */
const PrismaClient = jest.fn();

function load(config: { DATABASE_URL?: string; NODE_ENV: string }) {
  let mod: typeof import("./client") | undefined;
  jest.isolateModules(() => {
    jest.doMock("../config/app.config", () => ({ config }));
    jest.doMock("@prisma/adapter-mariadb", () => ({ PrismaMariaDb: jest.fn() }));
    jest.doMock("../../generated/prisma", () => ({ PrismaClient }));
    mod = require("./client");
  });
  return mod!;
}

describe("core/prisma/client", () => {
  it("بلا DATABASE_URL ⇒ يرفض أن يبدأ، ويقول أين يُضبط", () => {
    expect(() => load({ NODE_ENV: "production" })).toThrow(/DATABASE_URL is not set\. Add it to Backend\/\.env/);
    expect(PrismaClient).not.toHaveBeenCalled();
  });

  /** الصيغة المختصرة للاختبارات وحدها: خارجها يُكتب الخطأ كاملاً بلا ألوان. */
  it.each([
    ["test", "minimal"],
    ["development", "colorless"],
    ["production", "colorless"],
  ])("NODE_ENV=%s ⇒ errorFormat «%s»", (env, format) => {
    load({ DATABASE_URL: "mysql://u:p@127.0.0.1:3306/db_test", NODE_ENV: env });
    expect(PrismaClient.mock.lastCall![0]).toMatchObject({ errorFormat: format });
  });
});
