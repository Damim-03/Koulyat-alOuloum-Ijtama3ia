import { Outlet } from "react-router-dom";
import { Navbar } from "../../features/home/components/layout/navbar";
import { Footer } from "../../features/home/components/layout/footer";
import { useLanguage } from "../../hooks/use-language";

/**
 * Layout for public (no-auth) pages. Provides the shared Navbar
 * and Footer; the active page renders through <Outlet />.
 */
export default function PublicLayout() {
  const { dir } = useLanguage();
  return (
    <div className="flex min-h-svh flex-col bg-cream font-body" dir={dir}>
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
