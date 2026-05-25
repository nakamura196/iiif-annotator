"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { changelog } from "@/data/changelog";
import { Sparkles, Wrench, Bug, AlertTriangle, ChevronRight } from "lucide-react";

const typeIcons = {
  feature: Sparkles,
  improvement: Wrench,
  fix: Bug,
  breaking: AlertTriangle,
};

const typeColors = {
  feature: "text-blue-600 dark:text-blue-400",
  improvement: "text-green-600 dark:text-green-400",
  fix: "text-orange-600 dark:text-orange-400",
  breaking: "text-red-600 dark:text-red-400",
};

/** Show the latest N changelog entries on the home page. */
export function LatestUpdates({ count = 3 }: { count?: number }) {
  const params = useParams();
  const locale = (params.locale as string) || "ja";
  const lang = locale === "ja" ? "ja" : "en";
  const t = useTranslations("Changelog");
  const latest = changelog.slice(0, count);

  return (
    <div className="bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-lg shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--ds-fg)]">
          {t("latestUpdates")}
        </h3>
        <Link
          href="/changelog"
          className="text-sm text-[var(--ds-primary)] hover:underline
            inline-flex items-center gap-0.5 transition-colors"
        >
          {t("viewAll")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="space-y-3">
        {latest.map((entry, i) => {
          const Icon = typeIcons[entry.type];
          const color = typeColors[entry.type];
          return (
            <div
              key={`${entry.date}-${i}`}
              className="flex items-start gap-3 py-2 border-b border-[var(--ds-border)] last:border-0"
            >
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--ds-fg)]">
                    {entry.title[lang]}
                  </span>
                  <span className="text-xs text-[var(--ds-fg-muted)] flex-shrink-0">
                    {entry.date}
                  </span>
                </div>
                <p className="text-xs text-[var(--ds-fg-muted)] mt-0.5 line-clamp-2">
                  {entry.description[lang]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
