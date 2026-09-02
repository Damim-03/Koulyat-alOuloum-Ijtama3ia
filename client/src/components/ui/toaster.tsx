import { Toaster as Sonner } from "sonner";
import { useLanguage } from "../../hooks/use-language";

export function Toaster() {
  // Toasts render in a portal, so they need the direction passed in.
  const { dir } = useLanguage();
  return (
    <Sonner
      position="top-center"
      dir={dir}
      theme="dark"
      richColors
      toastOptions={{ style: { fontFamily: "Tajawal, sans-serif" } }}
    />
  );
}