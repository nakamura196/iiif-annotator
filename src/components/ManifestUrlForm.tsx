"use client";

import { useState } from "react";
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { SectionHeading, buttonClass } from '@nakamura196/react-ui';
import { LatestUpdates } from './LatestUpdates';

export function ManifestUrlForm() {
  const [manifestUrl, setManifestUrl] = useState("");
  const [collectionUrl, setCollectionUrl] = useState("");
  const [pos, setPos] = useState("");
  const router = useRouter();
  const t = useTranslations();

  const handleManifestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manifestUrl) {
      const query = new URLSearchParams();
      query.set("manifest", manifestUrl);
      if (pos) {
        query.set("pos", pos);
      }
      router.push(`/item?${query.toString()}`);
    }
  };

  const handleCollectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (collectionUrl) {
      const query = new URLSearchParams();
      query.set("u", collectionUrl);
      router.push(`/collection?${query.toString()}`);
    }
  };

  return (
    <div
      className="flex-1 flex items-center justify-center
      bg-[var(--ds-surface)] px-4 py-8"
    >
      <div className="max-w-2xl w-full space-y-8">
        <SectionHeading as="h2" accent={false} className="justify-center">
          {t('Common.title')}
        </SectionHeading>

        {/* Firebase Free Tier Warning */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                {t('HomePage.warning.title')}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                {t('HomePage.warning.description')}
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>{t('HomePage.warning.point1')}</li>
                <li>{t('HomePage.warning.point2')}</li>
                <li>{t('HomePage.warning.point3')}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* マニフェストフォーム */}
          <div className="bg-[var(--ds-bg)] border border-[var(--ds-border)] p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-[var(--ds-fg)] mb-4">
              {t('HomePage.manifest.title')}
            </h3>
            <p className="text-sm text-[var(--ds-fg-muted)] mb-4">
              {t('HomePage.manifest.description')}
            </p>
            <form className="space-y-4" onSubmit={handleManifestSubmit}>
              <div>
                <label
                  htmlFor="manifest-url"
                  className="block text-sm font-medium
                  text-[var(--ds-fg)] mb-1"
                >
                  {t('HomePage.manifest.urlLabel')}
                </label>
                <input
                  id="manifest-url"
                  type="url"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2
                    border border-[var(--ds-border)]
                    placeholder-[var(--ds-fg-muted)]
                    text-[var(--ds-fg)]
                    bg-[var(--ds-bg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]
                    focus:border-[var(--ds-primary)]
                    focus:z-10 sm:text-sm"
                  placeholder={t('HomePage.manifest.urlPlaceholder')}
                  value={manifestUrl}
                  onChange={(e) => setManifestUrl(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="page-number"
                  className="block text-sm font-medium
                  text-[var(--ds-fg)] mb-1"
                >
                  {t('HomePage.manifest.pageLabel')}
                </label>
                <input
                  id="page-number"
                  type="number"
                  min="1"
                  className="appearance-none rounded-md relative block w-full px-3 py-2
                    border border-[var(--ds-border)]
                    placeholder-[var(--ds-fg-muted)]
                    text-[var(--ds-fg)]
                    bg-[var(--ds-bg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]
                    focus:border-[var(--ds-primary)]
                    focus:z-10 sm:text-sm"
                  placeholder={t('HomePage.manifest.pagePlaceholder')}
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                />
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setManifestUrl(
                      "https://da.dl.itc.u-tokyo.ac.jp/portal/repo/iiif/fbd0479b-dbb4-4eaa-95b8-f27e1c423e4b/manifest"
                    )
                  }
                  className="text-sm text-[var(--ds-primary)] hover:underline
                    inline-flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  {t('HomePage.manifest.useExample')}
                </button>
              </div>

              <button
                type="submit"
                className={buttonClass("primary", "md", "w-full")}
              >
                {t('HomePage.manifest.submit')}
              </button>
            </form>
          </div>

          {/* コレクションフォーム */}
          <div className="bg-[var(--ds-bg)] border border-[var(--ds-border)] p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-[var(--ds-fg)] mb-4">
              {t('HomePage.collection.title')}
            </h3>
            <p className="text-sm text-[var(--ds-fg-muted)] mb-4">
              {t('HomePage.collection.description')}
            </p>
            <form className="space-y-4" onSubmit={handleCollectionSubmit}>
              <div>
                <label
                  htmlFor="collection-url"
                  className="block text-sm font-medium
                  text-[var(--ds-fg)] mb-1"
                >
                  {t('HomePage.collection.urlLabel')}
                </label>
                <input
                  id="collection-url"
                  type="url"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2
                    border border-[var(--ds-border)]
                    placeholder-[var(--ds-fg-muted)]
                    text-[var(--ds-fg)]
                    bg-[var(--ds-bg)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]
                    focus:border-[var(--ds-primary)]
                    focus:z-10 sm:text-sm"
                  placeholder={t('HomePage.collection.urlPlaceholder')}
                  value={collectionUrl}
                  onChange={(e) => setCollectionUrl(e.target.value)}
                />
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollectionUrl(
                      "https://iiif.bodleian.ox.ac.uk/iiif/collection/top"
                    )
                  }
                  className="text-sm text-[var(--ds-primary)] hover:underline
                    inline-flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                  </svg>
                  {t('HomePage.manifest.useExample')}
                </button>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 
                  border border-transparent text-sm font-medium rounded-md 
                  text-white bg-green-600 dark:bg-green-500
                  hover:bg-green-700 dark:hover:bg-green-600
                  focus:outline-none focus:ring-2 focus:ring-offset-2 
                  focus:ring-green-500 dark:focus:ring-green-400"
              >
                {t('HomePage.collection.submit')}
              </button>
            </form>
          </div>
        </div>

        {/* Latest Updates */}
        <LatestUpdates count={3} />
      </div>
    </div>
  );
}
