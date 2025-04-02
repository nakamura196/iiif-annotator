"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManifestUrlForm() {
  const [url, setUrl] = useState("");
  const [pos, setPos] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      const query = new URLSearchParams();
      query.set("manifest", url);
      if (pos) {
        query.set("pos", pos);
      }
      router.push(`/?${query.toString()}`);
    }
  };

  return (
    <div
      className="flex-1 flex items-center justify-center 
      bg-gray-50 dark:bg-gray-900 px-4"
    >
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2
            className="mt-6 text-center text-3xl font-extrabold 
            text-gray-900 dark:text-white"
          >
            IIIF Annotator
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            マニフェストURLを入力してください
          </p>
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() =>
                setUrl(
                  "https://da.dl.itc.u-tokyo.ac.jp/portal/repo/iiif/fbd0479b-dbb4-4eaa-95b8-f27e1c423e4b/manifest"
                )
              }
              className="text-sm text-blue-600 dark:text-blue-400 
                hover:text-blue-800 dark:hover:text-blue-300 
                underline inline-flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              入力例を使用
            </button>
          </div>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="manifest-url"
                className="block text-sm font-medium 
                text-gray-700 dark:text-gray-300 mb-1"
              >
                Manifest URL
              </label>
              <input
                id="manifest-url"
                type="url"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 
                  border border-gray-300 dark:border-gray-600 
                  placeholder-gray-500 dark:placeholder-gray-400
                  text-gray-900 dark:text-gray-100
                  bg-white dark:bg-gray-800
                  focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 
                  focus:border-blue-500 dark:focus:border-blue-400
                  focus:z-10 sm:text-sm"
                placeholder="https://example.com/manifest.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="page-number"
                className="block text-sm font-medium 
                text-gray-700 dark:text-gray-300 mb-1"
              >
                ページ番号（任意）
              </label>
              <input
                id="page-number"
                type="number"
                min="1"
                className="appearance-none rounded-md relative block w-full px-3 py-2 
                  border border-gray-300 dark:border-gray-600 
                  placeholder-gray-500 dark:placeholder-gray-400
                  text-gray-900 dark:text-gray-100
                  bg-white dark:bg-gray-800
                  focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 
                  focus:border-blue-500 dark:focus:border-blue-400
                  focus:z-10 sm:text-sm"
                placeholder="1"
                value={pos}
                onChange={(e) => setPos(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 
                border border-transparent text-sm font-medium rounded-md 
                text-white bg-blue-600 dark:bg-blue-500
                hover:bg-blue-700 dark:hover:bg-blue-600
                focus:outline-none focus:ring-2 focus:ring-offset-2 
                focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              表示
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
