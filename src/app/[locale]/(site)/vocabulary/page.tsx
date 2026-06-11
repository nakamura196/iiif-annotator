"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MetadataVocabularySettings from "@/components/settings/MetadataVocabularySettings";

/**
 * メタデータ語彙の管理ページ（API キー管理 /settings とは別ページ）。
 * ユーザアイコンのメニューから開く。
 */
export default function VocabularyPage() {
  const t = useTranslations("ApiKeys"); // loginRequired を流用
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--ds-primary)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>{t("loginRequired")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <MetadataVocabularySettings user={user} />
    </div>
  );
}
