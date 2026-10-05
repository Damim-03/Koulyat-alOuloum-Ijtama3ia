/**
 * مسار المراحل من جهة الإدارة.
 *
 * ما يُسأل عنه: أنّ «متأخرة» تُقرأ بالتاريخ لا بالعلامة وحدها — في العرض وفي
 * التصفية معاً — وأنّ ملفات الفريق تُفتح من هنا، وأنّ «تعليمها منجزة» يرسل
 * الحالة وحدها.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  // The component formats dates through the app's i18n instance, which
  // registers itself with this plugin on import.
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    // `defaultValue` is a fallback, not a parameter — it is left out of the key.
    t: (key: string, opts?: Record<string, unknown>) => {
      const params = { ...opts };
      delete params.defaultValue;
      return Object.keys(params).length ? `${key}:${JSON.stringify(params)}` : key;
    },
  }),
}));

const DAY = 86_400_000;
const milestones = [
  {
    id: "m1",
    order: 1,
    title: "الفصل النظري",
    status: "pending",
    deadline: new Date(Date.now() - 4 * DAY).toISOString(),
    _count: { submissions: 2 },
    submissions: [
      {
        id: "f1",
        fileName: "chapitre-1.pdf",
        fileUrl: "/uploads/submissions/chapitre-1.pdf",
        fileSize: 250_000,
        version: 2,
        createdAt: new Date().toISOString(),
        uploadedBy: { id: "u1", firstName: "سارة", lastName: "بوعلام" },
      },
    ],
  },
  {
    id: "m2",
    order: 2,
    title: "الدراسة الميدانية",
    status: "in_progress",
    deadline: new Date(Date.now() + 10 * DAY).toISOString(),
    _count: { submissions: 0 },
    submissions: [],
  },
];

const update = { mutate: vi.fn(), isPending: false };
vi.mock("../../hooks/admin-hook", () => ({
  useGroupMilestones: () => ({ data: milestones, isLoading: false }),
  useCreateMilestone: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateMilestone: () => update,
  useDeleteMilestone: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { MilestoneManager } = await import("./milestone-manager");

describe("MilestoneManager", () => {
  beforeEach(() => update.mutate.mockClear());

  it("مرحلةٌ فات موعدها وعلامتها pending تظهر متأخرة، بعدد الأيام", () => {
    render(<MilestoneManager groupId="g1" />);
    const [late, onTime] = screen.getAllByTestId("milestone-item");
    expect(within(late).getByText("status.overdue")).toBeInTheDocument();
    expect(within(late).getByText("admin.proj.ms.lateByDate")).toBeInTheDocument();
    expect(within(late).getByText('admin.proj.ms.daysAgo:{"n":4}')).toBeInTheDocument();
    expect(within(onTime).getByText("status.in_progress")).toBeInTheDocument();
  });

  it("وتصفية «متأخر» تشملها بالقاعدة نفسها", async () => {
    const user = userEvent.setup();
    render(<MilestoneManager groupId="g1" />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "status.overdue" }));
    const items = screen.getAllByTestId("milestone-item");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("الفصل النظري");
  });

  it("وملفات الفريق تُفتح من المرحلة برابطها", async () => {
    const user = userEvent.setup();
    render(<MilestoneManager groupId="g1" />);
    await user.click(screen.getByText('admin.submissionsCount:{"n":2}'));
    const files = within(screen.getByTestId("milestone-files"));
    expect(files.getByText("chapitre-1.pdf")).toBeInTheDocument();
    expect(files.getByRole("link", { name: "admin.proj.ms.openFile" })).toHaveAttribute(
      "href",
      "/uploads/submissions/chapitre-1.pdf",
    );
    // عشرةٌ تصل مع المرحلة، والعدد الحقيقي يقول إنّ هناك أقدم.
    expect(files.getByText('admin.proj.ms.moreFiles:{"n":1}')).toBeInTheDocument();
  });

  it("و«تعليمها منجزة» يرسل الحالة وحدها", async () => {
    const user = userEvent.setup();
    render(<MilestoneManager groupId="g1" />);
    const [first] = screen.getAllByTestId("milestone-item");
    await user.click(within(first).getByRole("button", { name: "admin.proj.ms.markDone" }));
    expect(update.mutate).toHaveBeenCalledWith({ id: "m1", data: { status: "completed" } });
  });
});
