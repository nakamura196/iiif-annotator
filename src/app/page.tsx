"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ManifestUrlForm } from "@/components/ManifestUrlForm";
import OpenSeadragonExample from "@/components/editor";

// 実際にuseSearchParamsを使用するコンポーネント
function AppContent() {
  const searchParams = useSearchParams();
  const manifestUrl = searchParams.get("manifest");

  // manifestUrlが未指定の場合は入力フォームを表示
  if (!manifestUrl) {
    return (
      <div className="flex-1 flex">
        <ManifestUrlForm />
      </div>
    );
  }

  return <OpenSeadragonExample />;
}

// 親コンポーネント
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppContent />
    </Suspense>
  );
}

export default App;
