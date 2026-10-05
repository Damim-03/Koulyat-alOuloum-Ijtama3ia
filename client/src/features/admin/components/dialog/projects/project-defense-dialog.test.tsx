/**
 * نافذة المناقشة: الموعد والقاعة والحالة واللجنة معاً.
 *
 * قواعد اللجنة يفرضها الخادم أيضاً، لكنّ ردّه نصٌّ تقنيّ؛ فالنافذة تقولها في
 * مكانها قبل الإرسال. ويُسأل هنا كذلك عن الحمولة: تاريخٌ بصيغة ISO، ولجنةٌ بلا
 * مقاعد فارغة، و`grade: null` حين تُمحى الدرجة في التعديل.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  // The dialog formats times through the app's i18n, which registers itself on import.
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

type Opts = { onSuccess?: () => void };
const create = { mutate: vi.fn((_v: unknown, o?: Opts) => o?.onSuccess?.()), isPending: false };
const update = { mutate: vi.fn((_v: unknown, o?: Opts) => o?.onSuccess?.()), isPending: false };
const clashes = vi.hoisted(() => ({ data: { room: [] as unknown[], professors: [] as unknown[] } }));
vi.mock("../../../hooks/admin-hook", () => ({
  useCreateDefense: () => create,
  useUpdateDefense: () => update,
  useDefenseConflicts: () => clashes,
  useAdminProjects: () => ({ data: { items: [] }, isFetching: false }),
}));

// The real picker searches the server; a plain select stands in for it.
vi.mock("../../ui/professor-picker", () => ({
  ProfessorPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="picker" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      <option value="p1">p1</option>
      <option value="p2">p2</option>
    </select>
  ),
}));

const { ProjectDefenseDialog } = await import("./project-defense-dialog");

describe("ProjectDefenseDialog", () => {
  beforeEach(() => {
    create.mutate.mockClear();
    update.mutate.mockClear();
  });

  it("بلا موعدٍ ولا قاعة ⇒ يقول ذلك ولا يرسل", async () => {
    const user = userEvent.setup();
    render(<ProjectDefenseDialog open onClose={() => {}} groupId="g1" supervisorId="p1" />);
    await user.click(screen.getByTestId("defense-save"));
    expect(screen.getByText("admin.proj.defenseForm.dateRequired")).toBeInTheDocument();
    expect(screen.getByText("admin.proj.defenseForm.roomRequired")).toBeInTheDocument();
    expect(create.mutate).not.toHaveBeenCalled();
  });

  it("الأستاذ نفسه في مقعدين ⇒ «مكرّر» ولا يرسل", async () => {
    const user = userEvent.setup();
    render(<ProjectDefenseDialog open onClose={() => {}} groupId="g1" supervisorId="p1" />);
    fireEvent.change(screen.getByTestId("defense-date"), { target: { value: "2030-06-15T09:30" } });
    await user.type(screen.getByTestId("defense-room"), "A1");
    await user.click(screen.getByTestId("defense-add-seat"));
    await user.click(screen.getByTestId("defense-add-seat"));
    const [a, b] = screen.getAllByTestId("picker");
    await user.selectOptions(a, "p2");
    await user.selectOptions(b, "p2");
    expect(screen.getByTestId("defense-committee-error")).toHaveTextContent("admin.proj.defenseForm.dupProfessor");
    await user.click(screen.getByTestId("defense-save"));
    expect(create.mutate).not.toHaveBeenCalled();
  });

  it("الجدولة ترسل ISO، والرئيس أوّلاً، والمشرف بنقرة، وتُسقط المقعد الفارغ", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProjectDefenseDialog open onClose={onClose} groupId="g1" supervisorId="p1" />);
    fireEvent.change(screen.getByTestId("defense-date"), { target: { value: "2030-06-15T09:30" } });
    await user.type(screen.getByTestId("defense-room"), "قاعة 12");
    await user.click(screen.getByTestId("defense-add-seat")); // president, left empty
    await user.click(screen.getByText("admin.proj.defenseForm.seatSupervisor"));
    await user.click(screen.getByTestId("defense-save"));

    expect(create.mutate).toHaveBeenCalledTimes(1);
    const payload = create.mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      groupId: "g1",
      room: "قاعة 12",
      status: "scheduled",
      date: new Date("2030-06-15T09:30").toISOString(),
      committee: [{ professorId: "p1", role: "supervisor" }],
    });
    expect(payload).not.toHaveProperty("grade");
    expect(onClose).toHaveBeenCalled();
  });

  it("والتعديل يمحو الدرجة بـ null ويستبدل اللجنة كما هي", async () => {
    const user = userEvent.setup();
    render(
      <ProjectDefenseDialog
        open
        onClose={() => {}}
        groupId="g1"
        supervisorId="p1"
        defense={{
          id: "d1",
          date: "2030-06-15T08:30:00.000Z",
          room: "A1",
          status: "completed",
          grade: 15,
          committee: [{ professorId: "p2", role: "president" }],
        }}
      />,
    );
    await user.clear(screen.getByTestId("defense-grade"));
    await user.click(screen.getByTestId("defense-save"));
    expect(update.mutate).toHaveBeenCalledWith(
      {
        id: "d1",
        data: expect.objectContaining({
          grade: null,
          status: "completed",
          committee: [{ professorId: "p2", role: "president" }],
        }),
      },
      expect.anything(),
    );
  });
});
