"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';
import OpenSeadragonExample from "@/components/editor";
import { Alert, AlertDescription } from "@/components/ui/alert";

function ItemContent() {
  const searchParams = useSearchParams();
  const manifestUrl = searchParams.get("manifest");
  const t = useTranslations();

  if (!manifestUrl) {
    return (
      <div className="container mx-auto p-4">
        <Alert>
          <AlertDescription>
            {t('ItemPage.noManifest')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <OpenSeadragonExample />
    </div>
  );
}

export default function ItemPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<div>{t('ItemPage.loading')}</div>}>
      <ItemContent />
    </Suspense>
  );
}