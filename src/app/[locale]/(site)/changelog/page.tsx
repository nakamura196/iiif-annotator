"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { changelog } from "@/data/changelog";
import { ArrowLeft, Sparkles, Wrench, Bug, AlertTriangle } from "lucide-react";

const typeConfig = {
  feature: { icon: Sparkles, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", label: { ja: "新機能", en: "New" } },
  improvement: { icon: Wrench, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", label: { ja: "改善", en: "Improved" } },
  fix: { icon: Bug, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", label: { ja: "修正", en: "Fixed" } },
  breaking: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", label: { ja: "破壊的変更", en: "Breaking" } },
};

export default function ChangelogPage() {
  const params = useParams();
  const locale = (params.locale as string) || "ja";
  const t = useTranslations("Changelog");

  // Group entries by year-month
  const grouped = changelog.reduce<Record<string, typeof changelog>>((acc, entry) => {
    const key = entry.date.slice(0, 7); // YYYY-MM
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const formatMonth = (ym: string) => {
    const [year, month] = ym.split("-");
    if (locale === "ja") return `${year}年${parseInt(month)}月`;
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  return (
    <div className="min-h-screen bg-[var(--ds-surface)]">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-[var(--ds-primary)]
              hover:underline transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToHome")}
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[var(--ds-fg)] mb-8">
          {t("title")}
        </h1>

        <div className="space-y-10">
          {Object.entries(grouped).map(([ym, entries]) => (
            <section key={ym}>
              <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-4 border-b border-[var(--ds-border)] pb-2">
                {formatMonth(ym)}
              </h2>
              <div className="space-y-4">
                {entries.map((entry, i) => {
                  const config = typeConfig[entry.type];
                  const Icon = config.icon;
                  const lang = locale === "ja" ? "ja" : "en";
                  return (
                    <div
                      key={`${entry.date}-${i}`}
                      className="bg-[var(--ds-bg)] rounded-lg shadow-sm p-5 border border-[var(--ds-border)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0 mt-0.5`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                              {config.label[lang]}
                            </span>
                            <span className="text-xs text-[var(--ds-fg-muted)]">
                              {entry.date}
                            </span>
                            {entry.version && (
                              <span className="text-xs text-[var(--ds-fg-muted)] font-mono">
                                v{entry.version}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-[var(--ds-fg)] mb-1">
                            {entry.title[lang]}
                          </h3>
                          <p className="text-sm text-[var(--ds-fg-muted)] leading-relaxed">
                            {entry.description[lang]}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
