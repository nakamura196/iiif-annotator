import Header from "@/components/Header";
import { Toaster } from "sonner";

/** Full-screen chrome: header only, no footer. Used by the editor for an
 *  uninterrupted work area (height-managed by the page itself). */
export default function FullLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
      {/* 保存/削除などの完了通知（editor から toast.success/error を呼ぶ） */}
      <Toaster richColors position="top-center" />
    </>
  );
}
