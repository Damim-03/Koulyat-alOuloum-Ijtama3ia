/**
 * صفحة الموضوع العامّة — ما تقوله لكل قارئ.
 *
 * كان التلميح واحداً للجميع: «يجب تسجيل الدخول كطالب لإرسال طلب الانضمام».
 * يقرؤه الطالبُ الداخل بحسابه فيحسب أنّ شيئاً ناقصاً فيه، ويقرؤه الأستاذ
 * فيظنّ الزرّ له ثم يجده مطفأً بلا تفسير. وهذا هو اللبس بعينه: نصٌّ صحيحٌ
 * لحالةٍ واحدة، معروضٌ على الثلاث.
 *
 * فيسأل هذا الملفّ سؤالاً واحداً: هل يقرأ كلُّ دورٍ ما يخصّه؟
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "t-1", lang: "ar" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/ar/topics/t-1" }),
}));
vi.mock("../../student/components/group-request-dialog", () => ({
  GroupRequestDialog: () => null,
}));

const topic = {
  id: "t-1",
  title: "موضوع",
  description: "وصف الموضوع",
  isAvailable: true,
  maxStudents: 3,
  requirements: [],
  objectives: [],
  professor: { user: { firstName: "خالد", lastName: "مرابط" } },
  specialization: { name: "علم النفس العيادي" },
  academicYear: { title: "2025/2026" },
};

let auth: { isAuthenticated: boolean; role?: string } = {
  isAuthenticated: false,
};

let topicQuery: Record<string, unknown> = { data: topic, isLoading: false };

vi.mock("../hooks/public-hook", () => ({
  usePublicTopic: () => topicQuery,
}));
vi.mock("../../../hooks/use-auth", () => ({ useAuth: () => auth }));

const { PublicTopicDetailPage } = await import("./public-topic-detail.page");

const applyButton = () =>
  screen.getByRole("button", {
    name: /public\.(applyRequest|loginToApply)/,
  });

describe("تلميح التقديم يتبع القارئ", () => {
  it("زائرٌ يُدعى إلى الدخول", () => {
    auth = { isAuthenticated: false };
    render(<PublicTopicDetailPage />);

    expect(applyButton()).toHaveTextContent("public.loginToApply");
    expect(applyButton()).toBeEnabled();
    expect(screen.getByText("public.applyHint")).toBeInTheDocument();
  });

  /**
   * والأستاذ لا يُقال له «سجّل الدخول» وهو داخل: يُقال له إنّ التقديم ليس
   * لدوره — والزرّ مطفأٌ بهذا السبب نفسه في تلميحه.
   */
  it("وغيرُ الطالب يُقال له إنّ التقديم ليس لدوره", () => {
    auth = { isAuthenticated: true, role: "professor" };
    render(<PublicTopicDetailPage />);

    expect(applyButton()).toBeDisabled();
    expect(applyButton()).toHaveAttribute(
      "title",
      "public.applyStudentsOnly",
    );
    expect(screen.getByText("public.applyStudentsOnly")).toBeInTheDocument();
    expect(screen.queryByText("public.applyHint")).not.toBeInTheDocument();
  });

  it("والطالبُ يُقال له ما يقع عند الضغط", () => {
    auth = { isAuthenticated: true, role: "student" };
    render(<PublicTopicDetailPage />);

    expect(applyButton()).toBeEnabled();
    expect(screen.getByText("public.applyReady")).toBeInTheDocument();
    expect(screen.queryByText("public.applyHint")).not.toBeInTheDocument();
  });

  /** والرأس يحمل ما يُسأل عنه أوّلاً: المشرف والسنة وعدد المقاعد. */
  it("ورأس الصفحة يحمل المشرف والسنة والمقاعد", () => {
    auth = { isAuthenticated: true, role: "student" };
    render(<PublicTopicDetailPage />);

    const heading = screen.getByRole("heading", { name: "موضوع" });
    const hero = heading.parentElement!;
    expect(hero).toHaveTextContent("خالد مرابط");
    expect(hero).toHaveTextContent("2025/2026");
    expect(hero).toHaveTextContent("public.maxStudentsN");
  });
});

/**
 * بالرابط المباشر إلى موضوعٍ محجوزٍ لفريقٍ آخر: الخادم يردّ 403 برمزٍ
 * معروف، والصفحة تقول «محجوز» — لا «تعذّر التحميل» ولا زرّ إعادة.
 */
describe("المحجوز لفريقٍ آخر بالرابط المباشر", () => {
  it("يُعرض ختمُ «محجوز» ومنه الخطوة التالية، لا شاشةُ الخطأ", () => {
    auth = { isAuthenticated: true, role: "student" };
    topicQuery = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 403, data: { errorCode: "TOPIC_RESERVED" } } },
      refetch: vi.fn(),
    };
    render(<PublicTopicDetailPage />);

    expect(screen.getByTestId("reserved-panel")).toHaveTextContent(
      "public.reservedDialog.title",
    );
    expect(screen.getByTestId("reserved-browse-available")).toBeInTheDocument();
    // لا تفاصيل للموضوع: الخادم لم يُسلّم شيئاً منها.
    expect(screen.queryByRole("heading", { name: "موضوع" })).not.toBeInTheDocument();

    topicQuery = { data: topic, isLoading: false };
  });
});
