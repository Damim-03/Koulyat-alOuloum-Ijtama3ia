import { None } from "../../../../lib/none";

/**
 * خانة الاسم (أو اللقب) في جداول الإدارة: باللاتينية وحدها — وهي الإلزاميّة
 * للطالب والأستاذ، وبها يُكتب في الوثائق.
 *
 * ومن لا اسم لاتينيّ له (حسابٌ أقدم من القاعدة) يُعرض بالعربيّ، فلا تبقى
 * الخانة فارغة إلى أن يُكمَل حسابه.
 */
export function NameCell({ latin, arabic }: { latin?: string | null; arabic?: string | null }) {
  const name = latin?.trim() || arabic?.trim();
  if (!name) return <None />;
  return <span dir="auto">{name}</span>;
}
