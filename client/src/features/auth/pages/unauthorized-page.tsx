import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { PATHS } from "../../../routes/paths";
import { useAuth } from "../../../hooks/use-auth";

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div
      dir="rtl"
      className="grid min-h-svh place-items-center bg-[#080a0c] p-7 text-[#eef2f5]"
    >
      <section className="w-full max-w-[420px] rounded-[22px] border border-white/[0.07] bg-[#121519] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-[18px] grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#34d399] to-[#2dd4bf] text-[#06302a]">
          <ShieldAlert size={22} />
        </div>

        <h2 className="m-0 text-[23px] font-bold">غير مصرّح بالدخول</h2>
        <p className="mt-1.5 mb-6 text-[13px] leading-relaxed text-[#8a929c]">
          ليست لديك صلاحية للوصول إلى هذه الصفحة.
        </p>

        <button
          onClick={() => navigate(PATHS.home)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#34d399] to-[#2dd4bf] p-[13px] text-[15px] font-bold text-[#06302a] shadow-[0_10px_26px_rgba(45,212,191,0.3)] transition hover:brightness-105"
        >
          العودة للرئيسية
        </button>

        <p
          onClick={logout}
          className="mt-4 cursor-pointer text-center text-[12.5px] text-[#8a929c]"
        >
          <span className="text-[#2dd4bf]">تسجيل الخروج</span>
        </p>
      </section>
    </div>
  );
}