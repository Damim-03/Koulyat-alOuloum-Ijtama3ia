import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      dir="rtl"
      theme="dark"
      richColors
      toastOptions={{ style: { fontFamily: "Tajawal, sans-serif" } }}
    />
  );
}