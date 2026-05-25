import Header from "@/components/Header";

/** Full-screen chrome: header only, no footer. Used by the editor for an
 *  uninterrupted work area (height-managed by the page itself). */
export default function FullLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
    </>
  );
}
