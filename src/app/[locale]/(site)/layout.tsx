import Header from "@/components/Header";
import Footer from "@/components/Footer";

/** Standard site chrome: header + footer. Used by all pages except the editor. */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </>
  );
}
