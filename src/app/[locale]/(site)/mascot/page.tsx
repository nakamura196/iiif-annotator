"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Loupe } from "@/components/Mascot";
import { ArrowLeft } from "lucide-react";

/** 「ルーペちゃんについて」紹介ページ。 */
export default function MascotPage() {
  const t = useTranslations("MascotPage");

  const rawRoles = t.raw("roles");
  const roles: string[] = Array.isArray(rawRoles) ? (rawRoles as string[]) : [];

  const moods = [
    { mood: "default" as const, label: t("moodDefault") },
    { mood: "happy" as const, label: t("moodHappy") },
    { mood: "thinking" as const, label: t("moodThinking") },
  ];

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

        {/* ヒーロー */}
        <div className="flex flex-col items-center text-center mb-10">
          <Loupe mood="happy" size={140} />
          <h1 className="mt-4 text-2xl font-bold text-[var(--ds-fg)]">{t("title")}</h1>
          <p className="mt-2 max-w-prose text-[var(--ds-fg-muted)] leading-relaxed">
            {t("lead")}
          </p>
        </div>

        <div className="space-y-10">
          {/* 名前の由来 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3 border-b border-[var(--ds-border)] pb-2">
              {t("nameHeading")}
            </h2>
            <p className="text-[var(--ds-fg-muted)] leading-relaxed">{t("nameBody")}</p>
          </section>

          {/* 役割 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3 border-b border-[var(--ds-border)] pb-2">
              {t("roleHeading")}
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[var(--ds-fg-muted)] leading-relaxed">
              {roles.map((role, i) => (
                <li key={i}>{role}</li>
              ))}
            </ul>
          </section>

          {/* 表情 */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3 border-b border-[var(--ds-border)] pb-2">
              {t("moodsHeading")}
            </h2>
            <p className="text-[var(--ds-fg-muted)] leading-relaxed mb-4">{t("moodsBody")}</p>
            <div className="grid grid-cols-3 gap-4">
              {moods.map(({ mood, label }) => (
                <figure
                  key={mood}
                  className="flex flex-col items-center gap-2 rounded-lg border border-[var(--ds-border)]
                    bg-[var(--ds-bg)] py-5 shadow-sm"
                >
                  <Loupe mood={mood} size={72} />
                  <figcaption className="text-sm text-[var(--ds-fg-muted)]">{label}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* デザイン */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--ds-fg)] mb-3 border-b border-[var(--ds-border)] pb-2">
              {t("designHeading")}
            </h2>
            <p className="text-[var(--ds-fg-muted)] leading-relaxed">{t("designBody")}</p>
          </section>

          {/* CTA */}
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-primary)] px-5 py-2.5
                text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              {t("cta")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
