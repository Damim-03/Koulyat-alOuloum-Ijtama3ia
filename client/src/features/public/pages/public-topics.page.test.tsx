/**
 * صفحة المواضيع — البحث والفلاتر.
 *
 * كانت الفلاتر في الذاكرة وخلف زرّ «تصفية»: يضيّقها الطالب، يفتح موضوعاً،
 * يعود — فيجدها ذهبت. فصارت في الرابط، وتُطبَّق فوراً.
 *
 * وما يستحقّ اختباراً هنا ما لو انكسر لبدت الصفحة تعمل وهي لا تعمل: أن
 * يصل الفلترُ الخادمَ فعلاً، وأن يُقرأ الرابط المنسوخ كما كُتب، وأن يعود
 * كلّ تغييرٍ إلى الصفحة الأولى، وأن تُذكر اللوحة مطويّةً إن طُويت.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));
let role = "student";
vi.mock("../../../hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, role }),
}));
vi.mock("../../../hooks/use-language", () => ({
  useLanguage: () => ({ localePath: (p: string) => p }),
}));
// بلا تأخير في الاختبار: ما يُكتب يصل الرابط فوراً.
vi.mock("../../../hooks/use-debounced-value", () => ({
  useDebouncedValue: (v: string) => v,
}));

const topic = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `موضوع ${id} في علم النفس`,
  description: "وصفٌ قصير",
  status: "open",
  maxStudents: 3,
  createdAt: new Date().toISOString(),
  isAvailable: true,
  isReserved: false,
  specialization: { id: "s-1", name: "علم النفس العيادي", level: "master" },
  academicYear: { id: "y-1", title: "2025/2026" },
  professor: {
    id: "p-1",
    user: { firstName: "خالد", lastName: "مرابط" },
    department: { name: "قسم العلوم الاجتماعية" },
  },
  ...over,
});

let listPage: Record<string, unknown>;
let lastParams: Record<string, unknown> = {};

const facets = {
  professors: [
    { id: "p-1", user: { firstName: "خالد", lastName: "مرابط" }, count: 2 },
  ],
  academicYears: [{ id: "y-1", title: "2025/2026", isActive: true, count: 2 }],
  sizes: [
    { value: 2, count: 1 },
    { value: 3, count: 1 },
  ],
  mine: {
    specializationId: "s-1",
    specializationName: "علم النفس العيادي",
    departmentId: "d-1",
    academicYearId: "y-1",
  },
};

vi.mock("../hooks/public-hook", () => ({
  usePublicTopics: (p: Record<string, unknown>) => {
    lastParams = p;
    return {
      data: listPage,
      isFetching: false,
      isPlaceholderData: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
  usePublicDepartments: () => ({
    data: [{ id: "d-1", name: "قسم العلوم الاجتماعية" }],
  }),
  usePublicSpecializations: () => ({
    data: [
      { id: "s-1", name: "علم النفس العيادي" },
      { id: "s-2", name: "علم الاجتماع" },
    ],
  }),
  usePublicTopicFilters: () => ({ data: facets }),
}));

const { PublicTopicsPage } = await import("./public-topics.page");

/** الرابط كما هو الآن — الفلاتر تسكنه. */
function Url() {
  return <output data-testid="url">{useLocation().search}</output>;
}

const renderAt = (url = "/ar/topics") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/:lang/topics"
          element={
            <>
              <PublicTopicsPage />
              <Url />
            </>
          }
        />
        <Route path="/:lang/topics/:id" element={<Url />} />
      </Routes>
    </MemoryRouter>,
  );

const url = () => decodeURIComponent(screen.getByTestId("url").textContent ?? "");

describe("صفحة المواضيع", () => {
  beforeEach(() => {
    localStorage.clear();
    role = "student";
    listPage = {
      items: [topic("t-1"), topic("t-2", { isAvailable: false, isReserved: true })],
      total: 20,
      page: 1,
      limit: 9,
      counts: { all: 20, available: 12, reserved: 8 },
    };
  });

  /** رابطٌ منسوخ يفتح عند الزميل ما رآه صاحبه، لا الصفحة الأولى بلا فلتر. */
  it("تقرأ الفلاتر من الرابط وتُرسلها إلى الخادم", () => {
    renderAt("/ar/topics?q=نفس&size=3&status=available&sort=title&page=2");

    expect(lastParams).toMatchObject({
      search: "نفس",
      maxStudents: 3,
      availability: "available",
      sort: "title",
      page: 2,
    });
    expect(screen.getByTestId("topics-search")).toHaveValue("نفس");
    const chips = screen.getByTestId("topics-active-filters");
    expect(chips).toHaveTextContent("«نفس»");
    expect(chips).toHaveTextContent('public.browse.seats:{"count":3}');
  });

  it("ورابطٌ عُبث به لا يُسقطها: يُهمَل ما لا يُفهم", () => {
    renderAt("/ar/topics?status=hacked&sort=random&size=abc&page=-4");

    expect(lastParams).toMatchObject({ sort: "newest", page: 1 });
    expect(lastParams.availability).toBeUndefined();
    expect(lastParams.maxStudents).toBeUndefined();
  });

  it("التبويبات بأعدادها، والنقر يكتب الحالة ثم يمحوها", async () => {
    renderAt();

    const available = screen.getByTestId("topics-tab-available");
    expect(available).toHaveTextContent("12");

    await userEvent.click(available);
    expect(url()).toContain("status=available");
    expect(lastParams.availability).toBe("available");
    expect(available).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(available);
    expect(url()).not.toContain("status");
  });

  it("وكلّ تغييرٍ يُعيد إلى الصفحة الأولى", async () => {
    renderAt("/ar/topics?page=2");
    expect(lastParams.page).toBe(2);

    await userEvent.click(screen.getByTestId("topics-tab-reserved"));

    expect(url()).toContain("status=reserved");
    expect(url()).not.toContain("page=");
    expect(lastParams.page).toBe(1);
  });

  it("والبحث فوريّ بلا زرّ، ويُعلّم الكلمة حيث وقعت", async () => {
    renderAt();

    await userEvent.type(screen.getByTestId("topics-search"), "مرابط");

    expect(url()).toContain("q=مرابط");
    expect(lastParams.search).toBe("مرابط");
    const grid = screen.getByTestId("topics-grid");
    expect(within(grid).getAllByText("مرابط")[0]!.tagName).toBe("MARK");
  });

  it("و«تخصّصي» يضع تخصّص الطالب، وإزالةُ رقاقته تمحوه", async () => {
    renderAt();

    await userEvent.click(screen.getByTestId("topics-my-spec"));
    expect(url()).toContain("spec=s-1");
    expect(screen.getByTestId("topics-my-spec")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const chips = screen.getByTestId("topics-active-filters");
    expect(chips).toHaveTextContent("علم النفس العيادي");

    await userEvent.click(
      within(chips).getByRole("button", { name: /removeFilter/ }),
    );
    expect(url()).not.toContain("spec");
    expect(screen.queryByTestId("topics-active-filters")).not.toBeInTheDocument();
  });

  /** اللوحة تُطوى، وتبقى مطويّةً في الزيارة التالية. */
  it("واللوحة تُطوى وتُذكر", async () => {
    const first = renderAt();
    const toggle = screen.getByTestId("topics-filters-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("topics.filtersOpen")).toBe("0");

    first.unmount();
    renderAt();
    expect(screen.getByTestId("topics-filters-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("والفلاتر المطبّقة تبقى ظاهرةً واللوحة مطويّة", async () => {
    renderAt("/ar/topics?prof=p-1");
    await userEvent.click(screen.getByTestId("topics-filters-toggle"));

    expect(screen.getByTestId("topics-active-filters")).toHaveTextContent(
      "خالد مرابط",
    );
    // وزرّ الفلاتر يقول كم فيها.
    expect(screen.getByTestId("topics-filters-toggle")).toHaveTextContent("1");
  });

  it("ولا نتيجة مع فلتر ⇒ فراغٌ فيه «إعادة الضبط»، وهي تمحو كلّ شيء", async () => {
    listPage = { items: [], total: 0, page: 1, limit: 9, counts: { all: 0, available: 0, reserved: 0 } };
    renderAt("/ar/topics?q=zzz&size=3&sort=title");

    const empty = screen.getByTestId("topics-empty");
    expect(empty).toHaveTextContent("public.browse.noResults");

    await userEvent.click(
      within(empty).getByRole("button", { name: /resetFilters/ }),
    );
    // الترتيب ليس فلتراً: يبقى.
    expect(url()).toBe("?sort=title");
    expect(screen.getByTestId("topics-search")).toHaveValue("");
  });

  /**
   * المحجوز لفريقٍ آخر لا يُفتح للطالب: بطاقتُه تفتح نافذة «محجوز» فوق
   * القائمة، ومنها الخطوة التالية — لا صفحةٌ يرفضها الخادم.
   */
  describe("الموضوع المحجوز", () => {
    it("بطاقتُه للطالب زرٌّ يفتح النافذة، لا رابط", async () => {
      renderAt();

      const card = screen.getByTestId("topic-card-t-2");
      expect(card.tagName).toBe("BUTTON");
      await userEvent.click(card);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("public.reservedDialog.title");
      // ملخّص الموضوع فيها: يعرف الطالب أيّها نقر.
      expect(dialog).toHaveTextContent("موضوع t-2 في علم النفس");
      // ولم يغادر القائمة.
      expect(screen.getByTestId("topics-grid")).toBeInTheDocument();
    });

    it("و«تصفّح المتاحة» يُغلقها ويفتح تبويب المتاح", async () => {
      renderAt();
      await userEvent.click(screen.getByTestId("topic-card-t-2"));

      await userEvent.click(screen.getByTestId("reserved-browse-available"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(url()).toContain("status=available");
    });

    it("و«مواضيع المشرف المتاحة» يضع المشرف والمتاح معاً", async () => {
      renderAt();
      await userEvent.click(screen.getByTestId("topic-card-t-2"));

      await userEvent.click(screen.getByTestId("reserved-browse-supervisor"));

      expect(url()).toContain("prof=p-1");
      expect(url()).toContain("status=available");
    });

    it("وEscape يُغلقها ويعيد التركيز إلى البطاقة", async () => {
      renderAt();
      const card = screen.getByTestId("topic-card-t-2");
      await userEvent.click(card);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(card).toHaveFocus();
    });

    it("ومحجوزُ فريق القارئ نفسه رابطٌ، بشارةِ «لفريقك»", () => {
      listPage = {
        ...listPage,
        items: [topic("t-3", { isAvailable: false, isReserved: true, isMine: true })],
      };
      renderAt();

      const card = screen.getByTestId("topic-card-t-3");
      expect(card.tagName).toBe("A");
      expect(card).toHaveTextContent("public.browse.reservedForYou");
    });

    it("والأستاذ يفتحه كما هو", () => {
      role = "professor";
      renderAt();

      expect(screen.getByTestId("topic-card-t-2").tagName).toBe("A");
    });
  });

  it("والبطاقة رابطٌ إلى صفحة الموضوع", async () => {
    renderAt("/ar/topics?q=نفس");

    await userEvent.click(screen.getByTestId("topic-card-t-1"));
    // صفحة الموضوع — والفلاتر تُسلَّم إليها في الحالة لتعود بها.
    expect(screen.getByTestId("url")).toBeInTheDocument();
    expect(screen.queryByTestId("topics-grid")).not.toBeInTheDocument();
  });
});
