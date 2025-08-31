'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/routing';

export default function LanguageSwitcher() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = params.locale as string;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value as 'en' | 'ja';
    // Preserve query parameters when switching languages
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    router.replace(path, { locale: newLocale });
  };

  return (
    <select
      value={currentLocale}
      onChange={handleChange}
      className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 
        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
        focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
    >
      <option value="ja">日本語</option>
      <option value="en">English</option>
    </select>
  );
}