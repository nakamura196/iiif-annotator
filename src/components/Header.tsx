"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LoginButton } from "./auth/LoginButton";
import ThemeToggle from "@/theme/theme-toggle";
import { Link, useRouter } from '@/i18n/routing';
import ManifestLink from "./ManifestLink";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from 'next-intl';
import { List, HelpCircle, Menu, X } from "lucide-react";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    <header className="bg-white dark:bg-gray-800 shadow-sm relative">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <h1
              className="text-lg font-bold text-gray-900 dark:text-white 
              sm:text-xl md:text-2xl lg:text-3xl"
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
                  text-blue-600 dark:text-blue-400 hover:text-blue-800 
                  dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20
                  rounded-md transition-colors"
                title={t('ItemPage.backToCollection')}
              >
                <List className="h-4 w-4" />
                <span className="hidden lg:inline">{t('ItemPage.backToCollection')}</span>
              </button>
            )}
            <ManifestLink />
            <Link
              href="/help"
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
                dark:hover:text-gray-100 transition-colors"
              title={t('Common.help')}
            >
              <HelpCircle className="h-5 w-5" />
            </Link>
            <LanguageSwitcher />
            <ThemeToggle />
            <LoginButton user={user} loading={loading} />
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
              dark:hover:text-gray-100 transition-colors"
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
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-gray-800 
          border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
          <div className="px-4 py-3 space-y-3">
            {isItemPage && collectionUrl && (
              <button
                onClick={() => {
                  handleBackToCollection();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left
                  text-blue-600 dark:text-blue-400 hover:bg-gray-50 
                  dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <List className="h-4 w-4" />
                {t('ItemPage.backToCollection')}
              </button>
            )}
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <ManifestLink />
            </div>
            
            <Link
              href="/help"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 
                dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 
                rounded-md transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
              {t('Common.help')}
            </Link>
            
            <div className="flex items-center justify-between px-3 py-2 
              border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Language</span>
              <LanguageSwitcher />
            </div>
            
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
              <ThemeToggle />
            </div>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <LoginButton user={user} loading={loading} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
