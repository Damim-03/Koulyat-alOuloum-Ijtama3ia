/**
 * روابط المراجع في موضوع الأستاذ.
 *
 * تُعرض للطلبة روابطَ يُنقر عليها. و`.url()` وحده يقبل كلّ مخطّطٍ يفهمه محلّل
 * العناوين — `javascript:` و`data:` منها — فرابطٌ «مرجعيّ» يصير سكربتاً يجري
 * في متصفّح كلّ طالبٍ ينقره. لذلك `http` و`https` وحدهما.
 */
import { createTopicSchema, updateTopicSchema } from "./professor.validation";
import { tr } from "../../core/i18n";

const topic = (references: { title: string; url: string }[]) => ({
  title: "موضوع",
  description: "وصف",
  maxStudents: 3,
  specializationId: "spec-1",
  academicYearId: "y-1",
  references,
});

const issues = (r: ReturnType<typeof createTopicSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => i.message);

describe("مراجع الموضوع", () => {
  it.each(["https://example.org/article", "http://intranet.univ.dz/doc.pdf", "HTTPS://Example.org"])(
    "%s ⇒ يُقبل",
    (url) => {
      expect(createTopicSchema.safeParse(topic([{ title: "مرجع", url }])).success).toBe(true);
    },
  );

  it.each(["javascript:alert(document.cookie)", "data:text/html,<script>alert(1)</script>", "ftp://files.univ.dz/x"])(
    "%s ⇒ يُرفض بسببه",
    (url) => {
      const r = createTopicSchema.safeParse(topic([{ title: "مرجع", url }]));
      expect(r.success).toBe(false);
      expect(issues(r)).toContain(tr("v.urlScheme"));
    },
  );

  it("والقاعدة نفسها عند التعديل", () => {
    const r = updateTopicSchema.safeParse({ references: [{ title: "مرجع", url: "javascript:void(0)" }] });
    expect(r.success).toBe(false);
  });

  it("وبلا مراجع ⇒ قائمةٌ فارغة لا undefined", () => {
    const r = createTopicSchema.parse(topic([]));
    const { references: _r, ...without } = topic([]);
    const parsed = createTopicSchema.parse(without);
    expect(r.references).toEqual([]);
    expect(parsed.references).toEqual([]);
    expect(parsed.requirements).toEqual([]);
    expect(parsed.objectives).toEqual([]);
  });
});
