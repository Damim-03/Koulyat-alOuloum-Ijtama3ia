import crypto from "node:crypto";
import { prisma } from "../../../core/prisma/client";
import type { ImportColumn } from "./columns";
import type { ParsedFile } from "./parser";
import { annotateImportFile } from "./files";
import { columnsOf, summarize, type ImportReport, type ReportRow } from "./report";

/**
 * خطوات الاستيراد المشتركة، حول الحكم الخاصّ بكلّ نوع:
 *
 *   المعاينة — يُقرأ الملف كلّه ويُحكم على كلّ خانةٍ فيه، ولا يُكتب شيء.
 *   الاستيراد — يُعاد الحكم كلّه (فالقاعدة ربّما تغيّرت بين الرفعتين)، ثم
 *     إمّا تُنشأ الدفعة كلّها في معاملةٍ واحدة، وإمّا لا يُنشأ أحد.
 *
 * «كلّها أو لا شيء» لأنّ نصفَ دفعةٍ أسوأ من لا دفعة: يُعاد رفع الملف بعد
 * التصحيح فيصطدم نصفُه الأوّل بنفسه («مسجَّلٌ مسبقاً»)، ولا يُعرف مَن دخل
 * ومَن لا.
 */

/** كلمة مرورٍ أوّلية: ١٢ حرفاً بلا ما يلتبس عند النقل باليد (0/O، 1/l/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function generatePassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export const fullName = (u: {
  firstName: string | null;
  lastName: string | null;
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
}) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") ||
  [u.firstNameLatin, u.lastNameLatin].filter(Boolean).join(" ");

/** بريدٌ شخصيّ مستعمَلٌ في المنصّة ← صاحبه — بنداءٍ واحد للملف كلّه. */
export async function loadTakenMails(mails: string[]): Promise<Map<string, { role: string; name: string }>> {
  const unique = [...new Set(mails.map((m) => m.toLowerCase()))];
  if (!unique.length) return new Map();
  const users = await prisma.user.findMany({
    where: { email: { in: unique } },
    select: { email: true, role: true, firstName: true, lastName: true },
  });
  return new Map(users.map((u) => [(u.email ?? "").toLowerCase(), { role: u.role, name: fullName(u) }]));
}

/** نصوص عمودٍ في الملف كلّه، بلا الفارغ. */
export const columnTexts = (parsed: ParsedFile, k: string) =>
  parsed.rows.map((r) => r.cells[k]?.text ?? "").filter(Boolean);

/** تقرير ملفٍّ لم يُقرأ — أخطاؤه وحدها. */
export function unreadableReport(parsed: ParsedFile, columns: ImportColumn[]): ImportReport {
  return {
    fileErrors: parsed.fileErrors,
    fileWarnings: parsed.fileWarnings,
    columns: columnsOf(columns, parsed.info),
    rows: [],
    summary: { total: 0, valid: 0, invalid: 0, warned: 0 },
  };
}

export function buildReport<K extends string>(
  parsed: ParsedFile<K>,
  columns: ImportColumn<K>[],
  rows: ReportRow<K>[],
): ImportReport<K> {
  const info = parsed.info!;
  return {
    fileErrors: [],
    fileWarnings: parsed.fileWarnings,
    file: {
      sheetName: info.sheetName,
      headerRow: info.headerRow,
      otherSheets: info.otherSheets,
      ignored: info.ignored,
    },
    columns: columnsOf(columns, info),
    rows,
    summary: summarize(rows),
  };
}

/**
 * الملف نفسه مُعلَّماً بأخطائه وتنبيهاته، بترميز base64 ليصل في جواب JSON —
 * أو لا شيء إن لم يكن فيه ما يُعلَّم.
 *
 * وهو إضافةٌ على التقرير لا شرطٌ له: ملفٌّ لا تقدر مكتبة Excel على إعادة
 * كتابته لا يُسقط المعاينة، فالتقرير كاملٌ بدونه.
 */
export async function annotatedBase64(
  buffer: Buffer,
  parsed: ParsedFile,
  report: ImportReport,
  columns: ImportColumn[],
  tag: string,
): Promise<string | undefined> {
  const { invalid, warned } = report.summary;
  if (!parsed.layout || (invalid === 0 && warned === 0)) return undefined;
  try {
    return (await annotateImportFile(buffer, parsed.layout, report.rows, columns)).toString("base64");
  } catch (e) {
    console.error(`[${tag}] annotated file failed:`, e);
    return undefined;
  }
}
