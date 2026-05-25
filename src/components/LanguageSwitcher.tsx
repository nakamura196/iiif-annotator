'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/routing';
import { LanguageSwitcher as DsLanguageSwitcher } from '@nakamura196/react-ui';

const LOCALES = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
];

export default function LanguageSwitcher() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = params.locale as string;

  const handleChange = (code: string) => {
    const newLocale = code as 'en' | 'ja';
    // Preserve query parameters when switching languages
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    router.replace(path, { locale: newLocale });
  };

  return (
    <DsLanguageSwitcher
      locales={LOCALES}
      current={currentLocale}
      onChange={handleChange}
    />
  );
}