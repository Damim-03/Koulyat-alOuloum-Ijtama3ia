/**
 * بطاقة مستوى من الهيكل (كلية، قسم، ميدان، شعبة، تخصص) حين يكون لها غلاف.
 *
 * ما يستحقّ اختباراً:
 *
 *   ١. أن الغلاف هو رأس البطاقة: الاسم والشارات وزرّا التعديل والحذف عليه،
 *      لا فوق الصورة متراكبةً على جسم البطاقة؛
 *   ٢. أن الصورة لا تظهر قبل أن تُحمَّل، ثم تظهر؛
 *   ٣. أن صورةً تعذّر تحميلها لا تترك علامة الصورة المكسورة؛
 *   ٤. وأن البطاقة بلا غلاف تبقى كما كانت.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GraduationCap, Users } from "lucide-react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { NodeCard } from "./structure-kit";

const COVER = "/uploads/cards/cover.jpg";

function card(props: { coverUrl?: string | null; deleteBlocked?: string | null } = {}) {
  render(
    <MemoryRouter initialEntries={["/ar/admin"]}>
      <Routes>
        <Route
          path="/:lang/*"
          element={
            <NodeCard
              to="/admin/specializations/s1"
              icon={GraduationCap}
              title="علم النفس"
              code="PSY"
              badge={<span>ليسانس</span>}
              stats={[{ icon: Users, label: "الطلبة", value: 8 }]}
              onEdit={() => undefined}
              onDelete={() => undefined}
              testId="spec-card"
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId("spec-card");
}

describe("NodeCard — الغلاف", () => {
  it("الاسم والشارات والإجراءات على الغلاف", () => {
    card({ coverUrl: COVER, deleteBlocked: "فيه طلبة" });
    const cover = screen.getByTestId("node-cover");
    expect(within(cover).getByRole("link", { name: "علم النفس" })).toHaveAttribute("href", "/ar/admin/specializations/s1");
    expect(within(cover).getByText("PSY")).toBeInTheDocument();
    expect(within(cover).getByText("ليسانس")).toBeInTheDocument();
    expect(within(cover).getByRole("button", { name: "admin.edit" })).toBeEnabled();
    expect(within(cover).getByRole("button", { name: "فيه طلبة" })).toBeDisabled();
  });

  it("الصورة تظهر بعد تحميلها", () => {
    card({ coverUrl: COVER });
    const img = screen.getByTestId("node-cover").querySelector("img")!;
    expect(img).toHaveAttribute("src", COVER);
    expect(img).toHaveAttribute("data-ready", "false");
    fireEvent.load(img);
    expect(img).toHaveAttribute("data-ready", "true");
  });

  it("وصورةٌ تعذّر تحميلها تُزال، ويبقى الغلاف باسمه", () => {
    card({ coverUrl: COVER });
    const cover = screen.getByTestId("node-cover");
    fireEvent.error(cover.querySelector("img")!);
    expect(cover.querySelector("img")).toBeNull();
    expect(within(cover).getByRole("link", { name: "علم النفس" })).toBeInTheDocument();
  });

  it("وبلا غلاف: الاسم والإجراءات في جسم البطاقة", () => {
    const el = card({ coverUrl: null });
    expect(screen.queryByTestId("node-cover")).toBeNull();
    expect(within(el).getByRole("link", { name: "علم النفس" })).toBeInTheDocument();
    expect(within(el).getByRole("button", { name: "admin.delete" })).toBeEnabled();
  });
});
