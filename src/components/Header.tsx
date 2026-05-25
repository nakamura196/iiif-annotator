"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LoginButton } from "./auth/LoginButton";
import { ThemeToggle } from "@nakamura196/react-ui";
import { Link, useRouter } from '@/i18n/routing';
import ManifestLink from "./ManifestLink";
import LanguageSwitcher from "./LanguageSwitcher";
import { HelpDialog } from "./HelpDialog";
import { useTranslations } from 'next-intl';
import { List, HelpCircle, Menu, X, BookMarked } from "lucide-react";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  
  const collectionUrl = searchParams.get("from") || searchParams.get("u");
  const isItemPage = pathname.includes("/item");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleBackToCollection = () => {
    if (collectionUrl) {
      router.push(`/collection?u=${encodeURIComponent(collectionUrl)}`);
    }
  };

  return (
    <header className="bg-[var(--ds-bg)] border-b border-[var(--ds-border)] shadow-sm relative">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <h1
              className="text-lg font-bold text-[var(--ds-primary)]
              sm:text-xl md:text-2xl lg:text-3xl"
              style={{ fontFamily: "var(--ds-font-serif)" }}
            >
              <Link href="/">IIIF Annotator</Link>
            </h1>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            {isItemPage && collectionUrl && (
              <button
                onClick={handleBackToCollection}
                className="flex items-center gap-2 px-3 py-1.5 text-sm
                  text-[var(--ds-primary)] hover:bg-[var(--ds-surface-2)]
                  rounded-md transition-colors"
                title={t('ItemPage.backToCollection')}
              >
                <List className="h-4 w-4" />
                <span className="hidden lg:inline">{t('ItemPage.backToCollection')}</span>
              </button>
            )}
            <ManifestLink />
            {user && (
              <Link
                href="/my-annotations"
                className="p-2 text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] transition-colors"
                title={t('MyAnnotations.title')}
              >
                <BookMarked className="h-5 w-5" />
              </Link>
            )}
            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] transition-colors"
              title={t('Common.help')}
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <LanguageSwitcher />
            <ThemeToggle />
            <LoginButton user={user} loading={loading} />
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[var(--ds-bg)]
          border-t border-[var(--ds-border)] shadow-lg z-50">
          <div className="px-4 py-3 space-y-3">
            {isItemPage && collectionUrl && (
              <button
                onClick={() => {
                  handleBackToCollection();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left
                  text-[var(--ds-primary)] hover:bg-[var(--ds-surface-2)]
                  rounded-md transition-colors"
              >
                <List className="h-4 w-4" />
                {t('ItemPage.backToCollection')}
              </button>
            )}
            
            <div className="border-t border-[var(--ds-border)] pt-3">
              <ManifestLink />
            </div>

            {user && (
              <Link
                href="/my-annotations"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[var(--ds-fg-muted)]
                  hover:bg-[var(--ds-surface-2)] rounded-md transition-colors"
              >
                <BookMarked className="h-5 w-5" />
                {t('MyAnnotations.title')}
              </Link>
            )}

            <button
              onClick={() => {
                setHelpOpen(true);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-[var(--ds-fg-muted)]
                hover:bg-[var(--ds-surface-2)] rounded-md transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
              {t('Common.help')}
            </button>

            <div className="flex items-center justify-between px-3 py-2
              border-t border-[var(--ds-border)]">
              <span className="text-sm text-[var(--ds-fg-muted)]">Language</span>
              <LanguageSwitcher />
            </div>

            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-[var(--ds-fg-muted)]">Theme</span>
              <ThemeToggle />
            </div>

            <div className="border-t border-[var(--ds-border)] pt-3">
              <LoginButton user={user} loading={loading} />
            </div>
          </div>
        </div>
      )}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
