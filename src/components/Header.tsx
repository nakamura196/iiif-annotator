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
import { List } from "lucide-react";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  
  const collectionUrl = searchParams.get("u");
  const isItemPage = pathname === "/item" || pathname === "/en/item";

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
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <h1
              className="text-xl font-bold text-gray-900 dark:text-white 
              sm:text-2xl md:text-3xl"
            >
              <Link href="/">IIIF Annotator</Link>
            </h1>
          </div>
          <div className="flex items-center gap-4">
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
                <span className="hidden sm:inline">{t('ItemPage.backToCollection')}</span>
              </button>
            )}
            <ManifestLink />
            <LanguageSwitcher />
            <ThemeToggle />
            <LoginButton user={user} loading={loading} />
          </div>
        </div>
      </div>
    </header>
  );
}
