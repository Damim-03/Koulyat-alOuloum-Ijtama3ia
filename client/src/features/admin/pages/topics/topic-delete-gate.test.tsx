/**
 * زرّ الحذف على موضوعٍ قامت عليه مجموعة.
 *
 * بُني معالج الحذف لهذه الحالة بالذات، ثم بقي الزرّ مطفأً عليها: الشاشة
 * تقرأ حكم الخادم، والخادم يرفض حذف موضوعٍ له مجموعة — فالضغط لا يفتح شيئاً.
 * ومعالجٌ لا يُفتح يمرّ من كل اختبارات وحدته ولا يعمل.
 *
 * فهذا الملفّ يسأل سؤالاً واحداً: **متى يُفتح الزرّ؟** يُفتح حين يكون المانع
 * هو ما يزيله المعالج (مجموعةٌ قائمة)، ويبقى مطفأً حين يكون المانع طلبَ
 * فريقٍ ينتظر قراراً — فذاك لا يملك المعالج البتّ فيه.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && !("defaultValue" in opts)
        ? `${key}:${JSON.stringify(opts)}`
        : key,
  }),
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));
vi.mock("../../../../i18n/i18n", () => ({
  default: { language: "ar", t: (key: string) => key },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "t-1", lang: "ar" }),
  Link: ({ children }: { children?: unknown }) => <>{children}</>,
}));
vi.mock("../../components/dialog/projects/project-members-dialog.form", () => ({
  ProjectMembersDialog: () => null,
}));
vi.mock(
  "../../components/dialog/projects/edit-assigned-topic-dialog.form",
  () => ({ EditAssignedTopicDialog: () => null }),
);

const idle = { mutate: vi.fn(), isPending: false };
let topic: Record<string, unknown>;

vi.mock("../../hooks/admin-hook", () => ({
  useAdminTopic: () => ({ data: topic, isLoading: false, refetch: vi.fn() }),
  useApproveTopic: () => idle,
  useRejectTopic: () => idle,
  useArchiveTopic: () => idle,
  usePublishTopic: () => idle,
  useUnpublishTopic: () => idle,
  useUnarchiveTopic: () => idle,
  // يستعملها المعالج نفسه
  useDissolveProject: () => idle,
  useDeleteTopic: () => idle,
}));
vi.mock("../../hooks/messages-hook", () => ({ useSendMessage: () => idle }));

const { AdminTopicDetailPage } = await import("./topic-detail.page");

const BLOCKED = {
  canApprove: false,
  canReject: false,
  canPublish: false,
  canUnpublish: false,
  canArchive: true,
  canUnarchive: false,
  canDelete: false,
  canAssignGroup: false,
  blockedReasons: { delete: "لا يمكن حذف موضوع تشكّلت له مجموعة" },
  blockedCodes: {} as Record<string, { code: string }>,
};

const base = {
  id: "t-1",
  title: "موضوع",
  description: "وصف",
  status: "full",
  references: [],
  requirements: [],
  objectives: [],
  maxStudents: 3,
  createdAt: new Date().toISOString(),
  professor: { id: "p-1", universityEmail: "p@univ.dz", user: { id: "pu-1" } },
  specialization: { id: "s-1", name: "تخصّص" },
  academicYear: { id: "y-1", title: "2025/2026" },
  groupRequests: [],
};

const withGroup = {
  ...base,
  projectGroup: { id: "g-1", members: [{ id: "m-1", isLeader: true }] },
  actions: { ...BLOCKED, blockedCodes: { delete: { code: "hasGroup" } } },
};

const withPendingRequest = {
  ...base,
  status: "open",
  projectGroup: null,
  actions: { ...BLOCKED, blockedCodes: { delete: { code: "waitingTeam" } } },
};

const deleteButton = () =>
  screen.getByRole("button", { name: "admin.delete" });

describe("بوّابة زرّ الحذف", () => {
  it("مجموعةٌ قائمة ⇒ الزرّ يعمل ويفتح المعالج", async () => {
    topic = withGroup;
    render(<AdminTopicDetailPage />);

    expect(deleteButton()).toBeEnabled();
    await userEvent.click(deleteButton());

    expect(screen.getByTestId("group-next")).toBeInTheDocument();
  });

  it("وطلبُ فريقٍ ينتظر قراراً ⇒ الزرّ مطفأ", () => {
    topic = withPendingRequest;
    render(<AdminTopicDetailPage />);

    expect(deleteButton()).toBeDisabled();
  });
});
